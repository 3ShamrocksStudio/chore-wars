-- QA for 06_guard_fair.sql. Runs entirely inside one transaction and ends with RAISE EXCEPTION,
-- so every row it writes (test household, attempts, join requests) is rolled back. Prints no codes.
-- Clock: now() is fixed inside a transaction, so "time passes" by shifting cw_attempts.at back.
do $qa$
declare
  c text; r jsonb; step int; t int; ip text; dev text; bad text := 'QQQQQQQQ';
  a_bad int := 0; a_locked int := 0; a_busy int := 0;
  legit_seats_ok int := 0; legit_seats_err text[] := '{}'; legit_join_ok int := 0; legit_join_err text[] := '{}';
  max_g int := 0; max_att int := 0; g int; att int;
  b_res jsonb := '{}'; b_busy int := 0; b_bad int := 0; b_locked int := 0; g_before int; g_after int; busy_after jsonb; fresh jsonb;
  succ_before int; succ_after int;
  first_id bigint;
begin
  perform set_config('request.headers', '{"x-forwarded-for":"192.0.2.10"}', true);
  r := public.cw_create('QA Fair House', 'QA Parent', 'owl', '4321', 'bolt', 'qa-device-create-000001');
  c := r->>'code';
  if exists (select 1 from public.cw_households where code = bad) then raise exception 'pick another bad code'; end if;
  -- only rows this QA run writes are ever shifted; real rows are left as they are
  select coalesce(max(id), 0) into first_id from public.cw_attempts;

  -- Phase A: one attacker /24 (203.0.113.0/24) sends a wrong code every 20 s for 40 minutes (120 tries,
  -- = 30 per 10 min), each from a new IP and a new device. A family on 198.51.100.0/24 checks in every 5 min.
  for step in 1..120 loop
    update public.cw_attempts set at = at - interval '20 seconds' where id > first_id;
    ip := '203.0.113.' || (step % 250 + 1); dev := 'qa-attacker-device-' || lpad(step::text, 6, '0');
    perform set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, true);
    r := public.cw_seats(bad, dev);
    if r->>'err' = 'bad_code' then a_bad := a_bad + 1; elsif r->>'err' = 'locked' then a_locked := a_locked + 1; elsif r->>'err' = 'busy' then a_busy := a_busy + 1; end if;
    select count(*) into g from public.cw_attempts where kind = 'gcode' and at > now() - interval '10 minutes';
    select count(*) into att from public.cw_attempts where kind = 'gcode' and k = 'net:203.0.113.0/24' and at > now() - interval '10 minutes';
    max_g := greatest(max_g, g); max_att := greatest(max_att, att);
    if step % 15 = 0 then
      perform set_config('request.headers', json_build_object('x-forwarded-for', '198.51.100.' || step)::text, true);
      select count(*) into succ_before from public.cw_attempts where kind = 'gcode';
      r := public.cw_seats(c, 'qa-family-device-' || lpad(step::text, 6, '0'));
      if (r->>'ok')::boolean then legit_seats_ok := legit_seats_ok + 1; else legit_seats_err := legit_seats_err || (r->>'err'); end if;
      if step % 30 = 0 then
        r := public.cw_join(c, 'Kid' || step, 'fox', 'bolt', 'qa-family-device-' || lpad(step::text, 6, '0'));
        if r ? 'request' then legit_join_ok := legit_join_ok + 1; else legit_join_err := legit_join_err || (r->>'err'); end if;
      end if;
      select count(*) into succ_after from public.cw_attempts where kind = 'gcode';
      if succ_after <> succ_before then raise exception 'a successful lookup spent the global budget'; end if;
    end if;
  end loop;

  -- Phase B: 4 attacker /24s at once (one try each every 20 s for 10 min) -> the shared budget fills (30) and closes;
  -- 'busy' and 'locked' tries add nothing.
  update public.cw_attempts set at = at - interval '2 hours' where id > first_id;
  for step in 1..30 loop
    update public.cw_attempts set at = at - interval '20 seconds' where id > first_id;
    for t in 1..4 loop
      perform set_config('request.headers', json_build_object('x-forwarded-for', '10.' || t || '.7.' || step)::text, true);
      select count(*) into g_before from public.cw_attempts where kind in ('gcode','code');
      r := public.cw_seats(bad, 'qa-swarm-device-' || t || '-' || lpad(step::text, 4, '0'));
      select count(*) into g_after from public.cw_attempts where kind in ('gcode','code');
      if r->>'err' = 'bad_code' then b_bad := b_bad + 1;
      else
        if r->>'err' = 'busy' then b_busy := b_busy + 1; else b_locked := b_locked + 1; end if;
        if g_after <> g_before then raise exception 'a refused try was counted'; end if;
      end if;
    end loop;
  end loop;
  select count(*) into g from public.cw_attempts where kind = 'gcode' and at > now() - interval '10 minutes';
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.200"}', true);
  busy_after := public.cw_seats(c, 'qa-family-device-late-0001');
  -- 10 minutes later with no new failures the budget has drained
  update public.cw_attempts set at = at - interval '11 minutes' where id > first_id;
  fresh := public.cw_seats(c, 'qa-family-device-late-0002');

  -- Phase C: unit test of the per-/24 share: 15 genuine failures from one /24 fill only 10 global slots
  update public.cw_attempts set at = at - interval '2 hours' where id > first_id;
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.99"}', true);
  for step in 1..15 loop perform public.cw__code_fail(array['ip:203.0.113.99']); end loop;
  select count(*) into att from public.cw_attempts where kind = 'gcode' and at > now() - interval '10 minutes';

  raise exception 'QA_RESULT %', jsonb_build_object(
    'A_attacker_tries', 120, 'A_bad_code', a_bad, 'A_locked', a_locked, 'A_busy', a_busy,
    'A_max_global_in_10min', max_g, 'A_max_attacker_share_in_10min', max_att,
    'A_family_seats_ok', legit_seats_ok || '/8', 'A_family_seats_err', to_jsonb(legit_seats_err),
    'A_family_join_ok', legit_join_ok || '/4', 'A_family_join_err', to_jsonb(legit_join_err),
    'B_bad_code', b_bad, 'B_busy', b_busy, 'B_locked', b_locked, 'B_global_after', g,
    'B_family_during_cooldown', busy_after->>'err', 'B_family_after_drain_ok', fresh->>'ok', 'C_15_fails_one_net_global_rows', att);
end $qa$;
