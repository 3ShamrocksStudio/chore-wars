-- Chore Wars 2026-11-04d: fair code-guess budget, attempt-row purge, drop debug function.
-- Contains no secrets and no household codes.
-- LIVE: sections 1, 2 (create/replace only) and the revoke for them (migration cw_guard_fair_a_gate).
-- NOT APPLIED: the DROP lines and section 3 (DELETE). apply_migration asks for approval on DROP/DELETE and the
--   prompt was auto-cancelled on 2026-11-04 (no one present). Needs a run with Dave's approval. NEEDS YOUR EYES
--
-- Why: the 11-04c global budget counted every try, including tries already refused as
-- 'locked' or 'busy'. One phone sending 30 tries every 10 minutes kept every family out.
-- Now:
--   * only a genuine failed lookup by a caller who passed the gate (not in backoff, not busy) is counted;
--   * each global-budget row is tagged with the caller's /24 (kind 'gcode', k = 'net:a.b.c.0/24');
--     one /24 can fill at most 10 of the 30 global slots per 10 minutes, so one network alone
--     can never close code checks for everyone;
--   * successful lookups and joins never count.

-- 1. gate: refused tries spend nothing ---------------------------------------------
create or replace function public.cw__code_gate(p_keys text[]) returns text
language plpgsql volatile security definer set search_path = public as $function$
declare net text := public.cw__net(); n int; last timestamptz; locked boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('cw_code_gate'));
  if exists (select 1 from public.cw_attempts where kind = 'gcool' and k = 'global' and at > now() - interval '5 minutes')
     or (select count(*) from public.cw_attempts where kind = 'gcode' and at > now() - interval '10 minutes') >= 30 then
    return 'busy';
  end if;
  if net is not null then
    select count(*), max(at) into n, last from public.cw_attempts where kind = 'code' and k = net and at > now() - interval '30 minutes';
    locked := n >= 3 and now() < last + make_interval(secs => least(900, 5 * power(2, n - 3)));
  end if;
  locked := locked or public.cw__locked('code', p_keys);
  if locked then return 'locked'; end if;   -- a refused try is not counted anywhere
  return null;
end $function$;

-- 2. one genuine failed lookup: caller keys + /24 backoff, and (within the /24's share) the global budget
create or replace function public.cw__code_fail(p_keys text[]) returns void
language plpgsql volatile security definer set search_path = public as $function$
declare net text := public.cw__net(); src text := coalesce(public.cw__net(), 'net:none');
begin
  insert into public.cw_attempts(k, kind) select unnest(p_keys || case when net is null then '{}'::text[] else array[net] end), 'code';
  if (select count(*) from public.cw_attempts where kind = 'gcode' and k = src and at > now() - interval '10 minutes') < 10 then
    insert into public.cw_attempts(k, kind) values (src, 'gcode');
    if (select count(*) from public.cw_attempts where kind = 'gcode' and at > now() - interval '10 minutes') >= 30
       and not exists (select 1 from public.cw_attempts where kind = 'gcool' and k = 'global' and at > now() - interval '5 minutes') then
      insert into public.cw_attempts(k, kind) values ('global', 'gcool');
    end if;
  end if;
end $function$;

drop function if exists public.cw__code_global();

-- 3. (11-04c part 7) hourly housekeeping also drops attempt rows older than 24 hours.
--    Attempt rows are rate-limit counters, not household data. Runs from the existing cw-purge pg_cron job.
create or replace function public.cw__purge() returns void language sql security definer set search_path = public as $$
  update public.cw_chores set proof = null where proof is not null and status = 'done' and done_at < now() - interval '7 days';
  update public.cw_requests set status = 'expired', secret_hash = 'x' where status = 'pending' and created_at < now() - interval '1 day';
  delete from public.cw_attempts where at < now() - interval '1 day';
$$;

-- 4. leftover empty debug function
drop function if exists public.cw_tmp_dbg();

-- 5. permissions
revoke all on function public.cw__code_gate(text[]), public.cw__code_fail(text[]), public.cw__purge() from public, anon, authenticated;

-- NOT applied: 11-04c part 8 (cw_admin_drop_household) deletes household data; left for Dave's decision.
