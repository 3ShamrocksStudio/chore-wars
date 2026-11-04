-- cw_act: every in-game move. Changes 2026-11-04b: join approval, bcrypt set_pin, 720px photo limit.
create or replace function public.cw_act(p_player uuid, p_secret text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare me public.cw_players; hh uuid; ch public.cw_chores; o public.cw_players; t public.cw_trades; cl public.cw_challenges; rq public.cw_requests;
  gain int; k text; nid uuid; kinds text[] := array['steal','shield','double']; a jsonb := coalesce(p_args,'{}');
begin
  me := public.cw__auth(p_player, p_secret); hh := me.household_id;
  perform public.cw__roll(hh);
  select * into me from public.cw_players where id = me.id for update;
  if a ? 'chore' then select * into ch from public.cw_chores where id = (a->>'chore')::uuid and household_id = hh for update; end if;

  if p_action in ('claim','steal','done','offer','challenge','ad_reward','shield','double','drop') and me.role <> 'player' then raise exception 'players_only'; end if;
  if p_action in ('approve','reject','bounty','add_chore','free_seat','set_pin','approve_join','deny_join') and me.role <> 'parent' then raise exception 'parent_only'; end if;
  if a ? 'chore' and ch.id is null then raise exception 'no_chore'; end if;

  if p_action = 'claim' then
    if ch.status <> 'open' then raise exception 'not_open'; end if;
    if (select count(*) from public.cw_chores where owner_id = me.id and status in ('claimed','done')) >= 3 then raise exception 'hands_full'; end if;
    update public.cw_chores set status = 'claimed', owner_id = me.id, claimed_at = now() where id = ch.id;
    perform public.cw__feed(hh,'claim',me.id,null,jsonb_build_object('chore',ch.id));
  elsif p_action = 'drop' then
    if ch.owner_id <> me.id or ch.status <> 'claimed' then raise exception 'not_yours'; end if;
    update public.cw_chores set status = 'open', owner_id = null, claimed_at = null where id = ch.id;
    update public.cw_trades set status = 'void' where status = 'open' and (give_chore = ch.id or take_chore = ch.id);
  elsif p_action = 'steal' then
    if ch.status <> 'claimed' or ch.owner_id = me.id then raise exception 'cant_steal'; end if;
    if coalesce((me.cards->>'steal')::int,0) < 1 then raise exception 'no_card'; end if;
    update public.cw_players set cards = jsonb_set(cards,'{steal}',to_jsonb(coalesce((cards->>'steal')::int,0)-1)) where id = me.id;
    select * into o from public.cw_players where id = ch.owner_id for update;
    if o.shield_on then
      update public.cw_players set shield_on = false where id = o.id;
      perform public.cw__feed(hh,'blocked',o.id,me.id,jsonb_build_object('chore',ch.id));
      k := 'blocked';
    else
      update public.cw_chores set owner_id = me.id, claimed_at = now() where id = ch.id;
      update public.cw_trades set status = 'void' where status = 'open' and (give_chore = ch.id or take_chore = ch.id);
      perform public.cw__feed(hh,'steal',me.id,o.id,jsonb_build_object('chore',ch.id));
    end if;
  elsif p_action in ('shield','double') then
    if coalesce((me.cards->>p_action)::int,0) < 1 then raise exception 'no_card'; end if;
    if (p_action = 'shield' and me.shield_on) or (p_action = 'double' and me.double_armed) then raise exception 'already_on'; end if;
    update public.cw_players set cards = jsonb_set(cards, array[p_action], to_jsonb((cards->>p_action)::int-1)),
      shield_on = shield_on or p_action = 'shield', double_armed = double_armed or p_action = 'double' where id = me.id;
  elsif p_action = 'done' then
    if ch.owner_id <> me.id or ch.status <> 'claimed' then raise exception 'not_yours'; end if;
    if length(coalesce(a->>'proof','')) > 400000 then raise exception 'photo_too_big'; end if;
    if coalesce(a->>'proof','') <> '' and a->>'proof' not like 'data:image/jpeg;base64,%' then raise exception 'photo_too_big'; end if;
    update public.cw_chores set status = 'done', done_at = now(), proof = nullif(a->>'proof','') where id = ch.id;
    update public.cw_trades set status = 'void' where status = 'open' and (give_chore = ch.id or take_chore = ch.id);
    perform public.cw__feed(hh,'done',me.id,null,jsonb_build_object('chore',ch.id));
  elsif p_action = 'approve' then
    if ch.status <> 'done' then raise exception 'not_done'; end if;
    select * into o from public.cw_players where id = ch.owner_id for update;
    gain := (ch.pts + ch.bounty) * case when o.double_armed then 2 else 1 end;
    update public.cw_players set xp = xp + gain, pts_week = pts_week + gain, double_armed = false,
      streak = case when last_win_day = public.cw__today() then streak when last_win_day = public.cw__today() - 1 then streak + 1 else 1 end,
      last_win_day = public.cw__today() where id = o.id;
    if floor(o.xp / 50.0) < floor((o.xp + gain) / 50.0) then
      k := kinds[1 + floor(random()*3)::int];
      update public.cw_players set cards = jsonb_set(cards, array[k], to_jsonb(coalesce((cards->>k)::int,0)+1)) where id = o.id;
    end if;
    update public.cw_chores set status = 'approved', approved_at = now(), proof = null, bounty = 0 where id = ch.id;
    perform public.cw__feed(hh,'approved',o.id,me.id,jsonb_build_object('chore',ch.id,'gain',gain,'card',k));
  elsif p_action = 'reject' then
    if ch.status <> 'done' then raise exception 'not_done'; end if;
    update public.cw_chores set status = 'claimed', proof = null, done_at = null where id = ch.id;
    perform public.cw__feed(hh,'rejected',ch.owner_id,me.id,jsonb_build_object('chore',ch.id));
  elsif p_action = 'bounty' then
    if ch.status not in ('open','claimed') then raise exception 'cant_bounty'; end if;
    if ch.bounty >= 30 then raise exception 'bounty_max'; end if;
    update public.cw_chores set bounty = least(bounty + 10, 30) where id = ch.id;
    perform public.cw__feed(hh,'bounty',me.id,null,jsonb_build_object('chore',ch.id,'bounty',least(ch.bounty+10,30)));
  elsif p_action = 'add_chore' then
    if (select count(*) from public.cw_chores where household_id = hh) >= 30 then raise exception 'too_many'; end if;
    if coalesce(trim(a->>'title'),'') = '' then raise exception 'need_name'; end if;
    insert into public.cw_chores(household_id, icon, title, pts) values (hh, left(coalesce(a->>'icon','spark'),16), left(trim(a->>'title'),24), greatest(1, least(100, coalesce((a->>'pts')::int,10))));
  elsif p_action = 'free_seat' then
    -- the seat keeps its name and score; a new phone can only take it through a parent-approved join
    update public.cw_players set secret_hash = null where id = (a->>'player')::uuid and household_id = hh and id <> me.id;
  elsif p_action = 'set_pin' then
    if coalesce(a->>'pin','') !~ '^[0-9]{4}$' then raise exception 'bad_pin'; end if;
    update public.cw_players set pin_hash = public.cw__pin(a->>'pin') where id = me.id;
  elsif p_action in ('approve_join','deny_join') then
    select * into rq from public.cw_requests where id = (a->>'req')::uuid and household_id = hh and status = 'pending' for update;
    if rq.id is null then raise exception 'no_req'; end if;
    if p_action = 'deny_join' then
      update public.cw_requests set status = 'denied' where id = rq.id;
    else
      if a ? 'seat' and coalesce(a->>'seat','') <> '' then
        select * into o from public.cw_players where id = (a->>'seat')::uuid and household_id = hh and role = 'player' and secret_hash is null for update;
        if o.id is null then raise exception 'seat_taken'; end if;
        update public.cw_players set secret_hash = rq.secret_hash where id = o.id;
        nid := o.id;
      else
        if (select count(*) from public.cw_players where household_id = hh) >= 8 then raise exception 'house_full'; end if;
        insert into public.cw_players(household_id, name, avatar, badge, role, secret_hash)
          values (hh, rq.name, rq.avatar, rq.badge, 'player', rq.secret_hash) returning id into nid;
      end if;
      update public.cw_requests set status = 'approved', player_id = nid where id = rq.id;
      perform public.cw__feed(hh, 'join', nid, null, '{}');
    end if;
  elsif p_action = 'offer' then
    select * into ch from public.cw_chores where id = (a->>'give')::uuid and household_id = hh;
    if ch.owner_id is distinct from me.id or ch.status <> 'claimed' then raise exception 'not_yours'; end if;
    select * into ch from public.cw_chores where id = (a->>'take')::uuid and household_id = hh;
    if ch.owner_id is null or ch.owner_id = me.id or ch.status <> 'claimed' then raise exception 'cant_trade'; end if;
    if coalesce((a->>'sweet')::int,0) > me.pts_week then raise exception 'not_enough'; end if;
    insert into public.cw_trades(household_id, from_id, to_id, give_chore, take_chore, sweetener, payer)
      values (hh, me.id, ch.owner_id, (a->>'give')::uuid, ch.id, greatest(0, least(30, coalesce((a->>'sweet')::int,0))), me.id) returning id into nid;
    perform public.cw__feed(hh,'offer',me.id,ch.owner_id,jsonb_build_object('trade',nid));
  elsif p_action in ('accept','decline','counter') then
    select * into t from public.cw_trades where id = (a->>'trade')::uuid and household_id = hh for update;
    if t.id is null or t.status <> 'open' or t.to_id <> me.id then raise exception 'no_trade'; end if;
    if p_action = 'decline' then
      update public.cw_trades set status = 'declined' where id = t.id;
      perform public.cw__feed(hh,'trade_no',me.id,t.from_id,'{}');
    elsif p_action = 'counter' then
      update public.cw_trades set status = 'countered' where id = t.id;
      insert into public.cw_trades(household_id, from_id, to_id, give_chore, take_chore, sweetener, payer)
        values (hh, me.id, t.from_id, t.take_chore, t.give_chore, greatest(0, least(30, coalesce((a->>'sweet')::int,10))), t.from_id) returning id into nid;
      perform public.cw__feed(hh,'counter',me.id,t.from_id,jsonb_build_object('trade',nid));
    else
      if not exists (select 1 from public.cw_chores where id = t.give_chore and owner_id = t.from_id and status = 'claimed')
         or not exists (select 1 from public.cw_chores where id = t.take_chore and owner_id = t.to_id and status = 'claimed') then
        update public.cw_trades set status = 'void' where id = t.id;
        return public.cw__state(hh, me.id) || jsonb_build_object('err','trade_stale');
      end if;
      if t.sweetener > (select pts_week from public.cw_players where id = t.payer) then raise exception 'not_enough'; end if;
      update public.cw_chores set owner_id = t.to_id where id = t.give_chore;
      update public.cw_chores set owner_id = t.from_id where id = t.take_chore;
      update public.cw_players set pts_week = pts_week - t.sweetener where id = t.payer;
      update public.cw_players set pts_week = pts_week + t.sweetener where id = case when t.payer = t.from_id then t.to_id else t.from_id end;
      update public.cw_trades set status = 'accepted' where id = t.id;
      update public.cw_trades set status = 'void' where status = 'open' and id <> t.id and (give_chore in (t.give_chore,t.take_chore) or take_chore in (t.give_chore,t.take_chore));
      perform public.cw__feed(hh,'trade_ok',me.id,t.from_id,jsonb_build_object('sweet',t.sweetener));
    end if;
  elsif p_action = 'challenge' then
    select * into o from public.cw_players where id = (a->>'target')::uuid and household_id = hh and role = 'player';
    if o.id is null or o.id = me.id then raise exception 'bad_target'; end if;
    if exists (select 1 from public.cw_challenges where household_id = hh and week_key = public.cw__week() and status in ('pending','on')
        and ((a_id = me.id and b_id = o.id) or (a_id = o.id and b_id = me.id))) then raise exception 'already_on'; end if;
    insert into public.cw_challenges(household_id, week_key, a_id, b_id) values (hh, public.cw__week(), me.id, o.id);
    perform public.cw__feed(hh,'chal',me.id,o.id,'{}');
  elsif p_action in ('chal_yes','chal_no') then
    select * into cl from public.cw_challenges where id = (a->>'chal')::uuid and household_id = hh for update;
    if cl.id is null or cl.status <> 'pending' or cl.b_id <> me.id then raise exception 'no_chal'; end if;
    if p_action = 'chal_no' then update public.cw_challenges set status = 'declined' where id = cl.id;
    else
      update public.cw_challenges set status = 'on', a_start = (select pts_week from public.cw_players where id = cl.a_id), b_start = me.pts_week where id = cl.id;
      perform public.cw__feed(hh,'chal_on',me.id,cl.a_id,'{}');
    end if;
  elsif p_action = 'ad_reward' then
    if me.ads_day = public.cw__today() and me.ads_count >= 3 then raise exception 'ads_maxed'; end if;
    k := kinds[1 + floor(random()*3)::int];
    update public.cw_players set cards = jsonb_set(cards, array[k], to_jsonb(coalesce((cards->>k)::int,0)+1)),
      ads_count = case when ads_day = public.cw__today() then ads_count + 1 else 1 end, ads_day = public.cw__today() where id = me.id;
    perform public.cw__feed(hh,'card',me.id,null,jsonb_build_object('card',k));
  else
    raise exception 'bad_action';
  end if;
  update public.cw_households set rev = rev + 1 where id = hh;
  return public.cw__state(hh, me.id) || jsonb_build_object('got', k);
end $function$;

-- 7. permissions: only the entry points are callable from the browser ------------
revoke all on function public.cw__ip(), public.cw__keys(text,text), public.cw__locked(text,text[],int), public.cw__count(text,text[]),
  public.cw__pin(text), public.cw__pin_ok(text,text), public.cw__purge(), public.cw__roll(uuid), public.cw__state(uuid,uuid) from public, anon, authenticated;
revoke all on function public.cw_create(text,text,text,text,text,text), public.cw_seats(text,text), public.cw_join(text,text,text,text,text),
  public.cw_join_status(uuid,text), public.cw_parent(text,text,text), public.cw_act(uuid,text,text,jsonb) from public;
grant execute on function public.cw_create(text,text,text,text,text,text), public.cw_seats(text,text), public.cw_join(text,text,text,text,text),
  public.cw_join_status(uuid,text), public.cw_parent(text,text,text), public.cw_act(uuid,text,text,jsonb) to anon, authenticated;
