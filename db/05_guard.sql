-- Chore Wars 2026-11-04c: global code-guess budget, /24 backoff, 8-char codes, 250 KB photo cap.
-- Applied with Supabase apply_migration. Contains no secrets and no household codes.

-- 1. join requests follow their household on delete ------------------------------
-- (checked before applying: no orphan requests existed)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cw_requests_household_id_fkey') then
    alter table public.cw_requests add constraint cw_requests_household_id_fkey
      foreign key (household_id) references public.cw_households(id) on delete cascade;
  end if;
end $$;

-- 2. photo cap: 250 KB for the stored proof (data URL), enforced by the table itself
update public.cw_chores set proof = null where proof is not null and octet_length(proof) > 256000;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cw_chores_proof_250kb') then
    alter table public.cw_chores add constraint cw_chores_proof_250kb check (proof is null or octet_length(proof) <= 256000);
  end if;
end $$;

-- 3. family codes: 8 characters, no 0/O/1/I, from a CSPRNG (32 symbols = 40 bits) ---
create or replace function public.cw__code() returns text language plpgsql volatile set search_path = public, extensions as $function$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; c text; i int;
begin
  loop
    b := extensions.gen_random_bytes(8); c := '';
    for i in 0..7 loop c := c || substr(a, 1 + (get_byte(b, i) & 31), 1); end loop;
    exit when not exists (select 1 from public.cw_households where code = c);
  end loop;
  return c;
end $function$;

-- what a typed code is compared as: upper case, letters and digits only
create or replace function public.cw__norm(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$$;

-- every household that still has an old short code gets a new 8-character one
do $$ declare r record; begin
  for r in select id from public.cw_households where length(code) <> 8 loop
    update public.cw_households set code = public.cw__code(), rev = rev + 1 where id = r.id;
  end loop;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cw_households_code_8') then
    alter table public.cw_households add constraint cw_households_code_8 check (code ~ '^[A-HJ-NP-Z2-9]{8}$');
  end if;
end $$;

-- 4. code-guess guard --------------------------------------------------------------
-- network prefix of the caller: IPv4 /24, IPv6 /48; null when no IP is known
create or replace function public.cw__net() returns text language sql stable set search_path = public as $$
  select case
    when ip ~ '^\d+\.\d+\.\d+\.\d+$' then 'net:' || regexp_replace(ip, '\.\d+$', '') || '.0/24'
    when ip like '%:%' then 'net:' || array_to_string((string_to_array(ip, ':'))[1:3], ':') || '::/48'
    else null end
  from (select public.cw__ip() ip) x
$$;

-- null = this caller may check a code now; otherwise the error to return
--   busy:   30 failed or refused code lookups in 10 minutes across ALL callers, then 5 minutes of global cool-down
--   locked: the caller's /24 has failed 3+ times in 30 minutes (waits 5s, 10s, 20s ... up to 15 min after each miss),
--           or its IP / device hit 5 misses in 15 minutes. A refused try still spends the global budget.
create or replace function public.cw__code_gate(p_keys text[]) returns text
language plpgsql volatile security definer set search_path = public as $function$
declare net text := public.cw__net(); n int; last timestamptz; locked boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('cw_code_gate'));
  if exists (select 1 from public.cw_attempts where kind = 'gcool' and k = 'global' and at > now() - interval '5 minutes')
     or (select count(*) from public.cw_attempts where kind = 'code' and k = 'global' and at > now() - interval '10 minutes') >= 30 then
    return 'busy';
  end if;
  if net is not null then
    select count(*), max(at) into n, last from public.cw_attempts where kind = 'code' and k = net and at > now() - interval '30 minutes';
    locked := n >= 3 and now() < last + make_interval(secs => least(900, 5 * power(2, n - 3)));
  end if;
  locked := locked or public.cw__locked('code', p_keys);
  if locked then perform public.cw__code_global(); return 'locked'; end if;
  return null;
end $function$;

-- one try against the global budget; the 30th in 10 minutes starts the cool-down
create or replace function public.cw__code_global() returns void
language plpgsql volatile security definer set search_path = public as $function$
begin
  insert into public.cw_attempts(k, kind) values ('global', 'code');
  if (select count(*) from public.cw_attempts where kind = 'code' and k = 'global' and at > now() - interval '10 minutes') >= 30
     and not exists (select 1 from public.cw_attempts where kind = 'gcool' and k = 'global' and at > now() - interval '5 minutes') then
    insert into public.cw_attempts(k, kind) values ('global', 'gcool');
  end if;
end $function$;

-- record one failed lookup against the caller's keys, its /24 and the global budget
create or replace function public.cw__code_fail(p_keys text[]) returns void
language plpgsql volatile security definer set search_path = public as $function$
declare net text := public.cw__net();
begin
  insert into public.cw_attempts(k, kind) select unnest(p_keys || case when net is null then '{}'::text[] else array[net] end), 'code';
  perform public.cw__code_global();
end $function$;

-- 5. entry points that take a family code ------------------------------------------
create or replace function public.cw_seats(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare ks text[] := public.cw__keys(p_device); g text; c text := public.cw__norm(p_code);
begin
  g := public.cw__code_gate(ks); if g is not null then return jsonb_build_object('err', g); end if;
  if length(c) <> 8 or not exists (select 1 from public.cw_households where code = c) then
    perform public.cw__code_fail(ks); return jsonb_build_object('err','bad_code');
  end if;
  return jsonb_build_object('ok', true, 'code', c);
end $function$;

create or replace function public.cw_join(p_code text, p_name text, p_avatar text, p_badge text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $function$
declare h public.cw_households; ks text[] := public.cw__keys(p_device); sec text := encode(extensions.gen_random_bytes(24),'hex'); rid uuid; g text;
begin
  g := public.cw__code_gate(ks); if g is not null then return jsonb_build_object('err', g); end if;
  -- 8 join requests per 15 min per IP/device (a whole family on one home Wi-Fi fits)
  if public.cw__locked('req', ks, 8) then return jsonb_build_object('err','locked'); end if;
  select * into h from public.cw_households where code = public.cw__norm(p_code);
  if h.id is null then perform public.cw__code_fail(ks); return jsonb_build_object('err','bad_code'); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('err','need_name'); end if;
  if (select count(*) from public.cw_requests where household_id = h.id and status = 'pending' and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('err','too_many'); end if;
  perform public.cw__count('req', ks);
  insert into public.cw_requests(household_id, name, avatar, badge, secret_hash)
    values (h.id, left(trim(p_name),14), left(coalesce(p_avatar,'fox'),12), left(coalesce(p_badge,'bolt'),12), public.cw__h(sec)) returning id into rid;
  update public.cw_households set rev = rev + 1 where id = h.id;
  return jsonb_build_object('request', rid, 'secret', sec, 'household', h.id);
end $function$;

create or replace function public.cw_parent(p_code text, p_pin text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $function$
declare h public.cw_households; ks text[] := public.cw__keys(p_device); pid uuid; sec text := encode(extensions.gen_random_bytes(24),'hex'); g text;
begin
  g := public.cw__code_gate(ks); if g is not null then return jsonb_build_object('err', g); end if;
  select * into h from public.cw_households where code = public.cw__norm(p_code);
  if h.id is null then perform public.cw__code_fail(ks); return jsonb_build_object('err','bad_code'); end if;
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

-- 6. cw_act: photo cap 400000 -> 256000 bytes (only that line changes) ---------------
do $$ declare d text := pg_get_functiondef('public.cw_act(uuid,text,text,jsonb)'::regprocedure); begin
  if position('> 400000' in d) > 0 then execute replace(d, '> 400000', '> 256000'); end if;
end $$;

-- 7. housekeeping also drops old attempt rows ---------------------------------------
create or replace function public.cw__purge() returns void language sql security definer set search_path = public as $$
  update public.cw_chores set proof = null where proof is not null and status = 'done' and done_at < now() - interval '7 days';
  update public.cw_requests set status = 'expired', secret_hash = 'x' where status = 'pending' and created_at < now() - interval '1 day';
  delete from public.cw_attempts where at < now() - interval '1 day';
$$;

-- 8. admin-only cleanup: delete one household (and, by cascade, everything in it).
--    Needs both its id and its current code. Not callable with the browser key.
create or replace function public.cw_admin_drop_household(p_id uuid, p_code text) returns int
language plpgsql volatile security definer set search_path = public as $function$
declare n int;
begin
  delete from public.cw_households where id = p_id and code = public.cw__norm(p_code);
  get diagnostics n = row_count; return n;
end $function$;

-- 9. permissions ---------------------------------------------------------------------
revoke all on function public.cw__code(), public.cw__norm(text), public.cw__net(), public.cw__code_gate(text[]), public.cw__code_global(), public.cw__code_fail(text[]),
  public.cw__purge(), public.cw_admin_drop_household(uuid,text) from public, anon, authenticated;
grant execute on function public.cw_admin_drop_household(uuid,text) to service_role;
revoke all on function public.cw_seats(text,text), public.cw_join(text,text,text,text,text), public.cw_parent(text,text,text) from public;
grant execute on function public.cw_seats(text,text), public.cw_join(text,text,text,text,text), public.cw_parent(text,text,text) to anon, authenticated;
