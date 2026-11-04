-- hourly: expire unreviewed proof photos older than 7 days and stale join requests
create extension if not exists pg_cron;
select cron.schedule('cw-purge', '17 * * * *', 'select public.cw__purge()');
