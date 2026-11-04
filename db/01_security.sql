-- Chore Wars 2026-11-04b: parent-approved joins, rate limits, bcrypt PINs, photo expiry.
-- Applied with Supabase apply_migration. Contains no secrets.

-- 1. tables ---------------------------------------------------------------
alter table public.cw_players add column if not exists badge text not null default 'bolt';

create table if not exists public.cw_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  name text not null,
  avatar text not null default 'fox',
  badge text not null default 'bolt',
  secret_hash text not null,
  status text not null default 'pending',      -- pending | approved | denied
  player_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists cw_requests_hh on public.cw_requests(household_id, status);
alter table public.cw_requests enable row level security;

create table if not exists public.cw_attempts (
  id bigserial primary key,
  k text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists cw_attempts_k on public.cw_attempts(kind, k, at);
alter table public.cw_attempts enable row level security;
revoke all on public.cw_requests, public.cw_attempts from anon, authenticated;

-- 2. helpers ----------------------------------------------------------------
create or replace function public.cw__ip() returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), ''),
    nullif(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    'none')
$$;

-- keys an attempt is counted against: the caller's IP and its device token
create or replace function public.cw__keys(p_device text, p_extra text default null) returns text[] language sql stable set search_path = public as $$
  select array_remove(array['ip:' || public.cw__ip(),
    case when length(coalesce(p_device,'')) between 16 and 80 then 'dev:' || p_device end,
    p_extra], null)
$$;

-- locked = any key already has p_max attempts of this kind in the last 15 minutes
create or replace function public.cw__locked(p_kind text, p_keys text[], p_max int default 5) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cw_attempts where kind = p_kind and k = any(p_keys) and at > now() - interval '15 minutes'
                 group by k having count(*) >= p_max)
$$;

create or replace function public.cw__count(p_kind text, p_keys text[]) returns void
language sql security definer set search_path = public as $$
  insert into public.cw_attempts(k, kind) select unnest(p_keys), p_kind;
$$;

-- bcrypt for PINs (secrets are 192-bit random tokens and stay sha256 for lookup)
create or replace function public.cw__pin(p text) returns text language sql volatile set search_path = public, extensions as $$
  select extensions.crypt(p, extensions.gen_salt('bf', 8))
$$;
create or replace function public.cw__pin_ok(p text, h text) returns boolean language sql stable set search_path = public, extensions as $$
  select h is not null and p is not null and length(h) = 60 and extensions.crypt(p, h) = h
$$;

-- housekeeping, also run hourly by pg_cron (03_cron.sql)
create or replace function public.cw__purge() returns void language sql security definer set search_path = public as $$
  update public.cw_chores set proof = null where proof is not null and status = 'done' and done_at < now() - interval '7 days';
  update public.cw_requests set status = 'expired', secret_hash = 'x' where status = 'pending' and created_at < now() - interval '1 day';
$$;

-- 3. migrate existing sha256 PINs to bcrypt (4-digit space, recovered in-db) ----
do $$
declare r record; d text;
begin
  for r in select id, pin_hash from public.cw_players where pin_hash is not null and length(pin_hash) = 64 loop
    select lpad(n::text, 4, '0') into d from generate_series(0, 9999) n
      where encode(extensions.digest(lpad(n::text, 4, '0'), 'sha256'), 'hex') = r.pin_hash limit 1;
    update public.cw_players set pin_hash = case when d is null then null else public.cw__pin(d) end where id = r.id;
  end loop;
end $$;

-- 4. roll: also expire unreviewed photos ----------------------------------------
create or replace function public.cw__roll(p_hh uuid) returns void language plpgsql security definer set search_path = public as $function$
declare h public.cw_households; champ uuid; c record; w uuid; sa int; sb int;
begin
  select * into h from public.cw_households where id = p_hh for update;
  if h.week_key <> public.cw__week() then
    select id into champ from public.cw_players where household_id = p_hh and role = 'player' and pts_week > 0 order by pts_week desc, xp desc limit 1;
    for c in select * from public.cw_challenges where household_id = p_hh and status = 'on' and week_key = h.week_key loop
      select pts_week - c.a_start into sa from public.cw_players where id = c.a_id;
      select pts_week - c.b_start into sb from public.cw_players where id = c.b_id;
      w := case when sa > sb then c.a_id when sb > sa then c.b_id else null end;
      update public.cw_challenges set status = 'done', winner_id = w where id = c.id;
      if w is not null then
        update public.cw_players set xp = xp + 25 where id = w;
        perform public.cw__feed(p_hh, 'chal_win', w, case when w = c.a_id then c.b_id else c.a_id end, '{}');
      end if;
    end loop;
    update public.cw_challenges set status = 'declined' where household_id = p_hh and status = 'pending' and week_key <> public.cw__week();
    update public.cw_players set pts_week = 0 where household_id = p_hh;
    update public.cw_households set week_key = public.cw__week(), champion_id = coalesce(champ, champion_id), rev = rev + 1 where id = p_hh;
    if champ is not null then perform public.cw__feed(p_hh, 'champion', champ, null, '{}'); end if;
  end if;
  update public.cw_chores set status = 'open', owner_id = null, claimed_at = null, done_at = null, approved_at = null
   where household_id = p_hh and status = 'approved' and (approved_at at time zone 'Asia/Jerusalem')::date < public.cw__today();
  update public.cw_chores set proof = null where household_id = p_hh and proof is not null and status = 'done' and done_at < now() - interval '7 days';
end $function$;

-- 5. state: badge per player, pending join requests for parents only -----------
create or replace function public.cw__state(p_hh uuid, p_me uuid) returns jsonb language sql security definer set search_path = public as $function$
  select jsonb_build_object(
    'house', (select jsonb_build_object('id',id,'code',code,'name',name,'week',week_key,'champion',champion_id,'rev',rev) from public.cw_households where id = p_hh),
    'me', p_me,
    'players', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'avatar',avatar,'badge',badge,'color',color,'role',role,'xp',xp,'pts',pts_week,
        'streak', case when last_win_day >= public.cw__today() - 1 then streak else 0 end,
        'cards', case when id = p_me then cards else null end,
        'double', double_armed, 'shield', shield_on, 'seat', secret_hash is null,
        'ads', case when ads_day = public.cw__today() then ads_count else 0 end) order by created_at) from public.cw_players where household_id = p_hh), '[]'),
    'chores', coalesce((select jsonb_agg(jsonb_build_object('id',id,'icon',icon,'title',title,'pts',pts,'bounty',bounty,'status',status,'owner',owner_id,
        'proof', case when status = 'done' then proof else null end,'at',coalesce(done_at,claimed_at,created_at)) order by created_at) from public.cw_chores where household_id = p_hh), '[]'),
    'trades', coalesce((select jsonb_agg(jsonb_build_object('id',id,'from',from_id,'to',to_id,'give',give_chore,'take',take_chore,'sweet',sweetener,'payer',payer,'status',status) order by created_at desc)
        from public.cw_trades where household_id = p_hh and (status = 'open' or created_at > now() - interval '1 day')), '[]'),
    'challenges', coalesce((select jsonb_agg(jsonb_build_object('id',id,'a',a_id,'b',b_id,'as',a_start,'bs',b_start,'status',status,'winner',winner_id,'week',week_key) order by created_at desc)
        from public.cw_challenges where household_id = p_hh and (week_key = public.cw__week() or created_at > now() - interval '8 days')), '[]'),
    'feed', coalesce((select jsonb_agg(f order by f.id desc) from (select id, kind, actor, target, info, created_at from public.cw_feed where household_id = p_hh order by id desc limit 25) f), '[]'),
    'requests', case when (select role from public.cw_players where id = p_me) = 'parent' then
        coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'avatar',avatar,'badge',badge,'at',created_at) order by created_at)
          from public.cw_requests where household_id = p_hh and status = 'pending' and created_at > now() - interval '1 day'), '[]')
      else '[]'::jsonb end
  );
$function$;

-- 6. public entry points -------------------------------------------------------
-- cw_state signs a freed/unknown device out softly (no data, no HTTP error)
create or replace function public.cw_state(p_player uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare me public.cw_players;
begin
  select * into me from public.cw_players where id = p_player;
  if me.id is null or me.secret_hash is null or me.secret_hash <> public.cw__h(p_secret) then
    return jsonb_build_object('err', 'not_allowed');
  end if;
  perform public.cw__roll(me.household_id);
  return public.cw__state(me.household_id, me.id);
end $function$;

-- old entry points (household-revealing seat list, direct join) are switched off, not dropped
create or replace function public.cw_seats(p_code text) returns jsonb language sql security definer set search_path = public as $$ select jsonb_build_object('err','update_app') $$;
create or replace function public.cw_join(p_code text, p_name text, p_avatar text, p_seat uuid default null, p_pin text default null) returns jsonb language sql security definer set search_path = public as $$ select jsonb_build_object('err','update_app') $$;
create or replace function public.cw_create(p_house text, p_name text, p_avatar text, p_pin text default null) returns jsonb language sql security definer set search_path = public as $$ select jsonb_build_object('err','update_app') $$;
revoke all on function public.cw_seats(text), public.cw_join(text,text,text,uuid,text), public.cw_create(text,text,text,text) from public, anon, authenticated;

create or replace function public.cw_create(p_house text, p_name text, p_avatar text, p_pin text, p_badge text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $function$
declare hh uuid; pid uuid; sec text := encode(extensions.gen_random_bytes(24),'hex'); c text; ks text[] := public.cw__keys(p_device);
begin
  if public.cw__locked('create', ks) then return jsonb_build_object('err','locked'); end if;
  if coalesce(trim(p_house),'') = '' or coalesce(trim(p_name),'') = '' then return jsonb_build_object('err','need_name'); end if;
  if coalesce(p_pin,'') !~ '^[0-9]{4}$' then return jsonb_build_object('err','bad_pin'); end if;
  perform public.cw__count('create', ks);
  c := public.cw__code();
  insert into public.cw_households(code, name) values (c, left(trim(p_house),24)) returning id into hh;
  insert into public.cw_players(household_id, name, avatar, badge, role, secret_hash, pin_hash)
    values (hh, left(trim(p_name),14), left(coalesce(p_avatar,'owl'),12), left(coalesce(p_badge,'bolt'),12), 'parent', public.cw__h(sec), public.cw__pin(p_pin)) returning id into pid;
  perform public.cw__seed_chores(hh);
  return jsonb_build_object('player', pid, 'secret', sec, 'household', hh, 'code', c);
end $function$;

-- step 1 of joining: check the code. Reveals nothing about the household.
create or replace function public.cw_seats(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare ks text[] := public.cw__keys(p_device); ok boolean;
begin
  if public.cw__locked('code', ks) then return jsonb_build_object('err','locked'); end if;
  select exists(select 1 from public.cw_households where code = upper(trim(coalesce(p_code,'')))) into ok;
  if not ok then perform public.cw__count('code', ks); return jsonb_build_object('err','bad_code'); end if;
  return jsonb_build_object('ok', true, 'code', upper(trim(p_code)));
end $function$;

-- step 2: ask to join. The device waits until a parent approves; it sees nothing before that.
create or replace function public.cw_join(p_code text, p_name text, p_avatar text, p_badge text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $function$
declare h public.cw_households; ks text[] := public.cw__keys(p_device); sec text := encode(extensions.gen_random_bytes(24),'hex'); rid uuid;
begin
  if public.cw__locked('code', ks) or public.cw__locked('req', ks) then return jsonb_build_object('err','locked'); end if;
  select * into h from public.cw_households where code = upper(trim(coalesce(p_code,'')));
  if h.id is null then perform public.cw__count('code', ks); return jsonb_build_object('err','bad_code'); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('err','need_name'); end if;
  if (select count(*) from public.cw_requests where household_id = h.id and status = 'pending' and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('err','too_many'); end if;
  perform public.cw__count('req', ks);
  insert into public.cw_requests(household_id, name, avatar, badge, secret_hash)
    values (h.id, left(trim(p_name),14), left(coalesce(p_avatar,'fox'),12), left(coalesce(p_badge,'bolt'),12), public.cw__h(sec)) returning id into rid;
  update public.cw_households set rev = rev + 1 where id = h.id;
  return jsonb_build_object('request', rid, 'secret', sec, 'household', h.id);
end $function$;

-- the waiting device polls this; it learns its player id only after approval
create or replace function public.cw_join_status(p_request uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare r public.cw_requests; c text;
begin
  select * into r from public.cw_requests where id = p_request;
  if r.id is null or r.secret_hash <> public.cw__h(p_secret) then return jsonb_build_object('status','gone'); end if;
  if r.status = 'approved' then
    select code into c from public.cw_households where id = r.household_id;
    return jsonb_build_object('status','ok','player', r.player_id, 'household', r.household_id, 'code', c);
  end if;
  return jsonb_build_object('status', r.status);
end $function$;

-- parent seat on a new phone: code + PIN, rate-limited per IP, device and household
create or replace function public.cw_parent(p_code text, p_pin text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $function$
declare h public.cw_households; ks text[] := public.cw__keys(p_device); pid uuid; sec text := encode(extensions.gen_random_bytes(24),'hex');
begin
  if public.cw__locked('code', ks) then return jsonb_build_object('err','locked'); end if;
  select * into h from public.cw_households where code = upper(trim(coalesce(p_code,'')));
  if h.id is null then perform public.cw__count('code', ks); return jsonb_build_object('err','bad_code'); end if;
  ks := ks || ('hh:' || h.id::text);
  if public.cw__locked('pin', ks) then return jsonb_build_object('err','locked'); end if;
  select id into pid from public.cw_players where household_id = h.id and role = 'parent' and public.cw__pin_ok(coalesce(p_pin,''), pin_hash) order by created_at limit 1;
  if pid is null then
    perform public.cw__count('pin', ks);
    return jsonb_build_object('err', case when public.cw__locked('pin', ks) then 'locked' else 'bad_pin' end);
  end if;
  update public.cw_players set secret_hash = public.cw__h(sec) where id = pid;   -- any older phone on this seat is signed out
  update public.cw_households set rev = rev + 1 where id = h.id;
  return jsonb_build_object('player', pid, 'secret', sec, 'household', h.id, 'code', h.code);
end $function$;
