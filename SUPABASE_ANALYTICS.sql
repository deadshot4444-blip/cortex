-- Cortex — anonymous usage analytics for research
-- Run ONCE in your Supabase project: SQL Editor -> New query -> paste -> Run.
-- Design: clients can only INSERT events (write-only); nobody can read them with the
-- public anon key. You read/export the data from the Supabase dashboard (Table editor
-- / SQL editor), which uses your privileged role. No names or PII are ever stored —
-- each browser is a random anon_id only.

create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  anon_id     text not null,            -- random per-browser id (no PII)
  session_id  text,                     -- random per page-load
  user_id     uuid,                     -- set only if the person is signed in (optional)
  app_version text,
  section     text,                     -- e.g. 'genetics'
  event       text not null,            -- 'session_start' | 'unlock' | 'mode_start' | 'answer' | 'run_end' | 'milestone'
  props       jsonb not null default '{}'::jsonb
);

create index if not exists usage_events_anon_idx  on public.usage_events (anon_id, ts);
create index if not exists usage_events_event_idx on public.usage_events (event, ts);
create index if not exists usage_events_section_idx on public.usage_events (section, ts);

alter table public.usage_events enable row level security;

-- Anyone (anon or signed-in) may INSERT events. No SELECT/UPDATE/DELETE policy exists,
-- so the public key cannot read or change anything — only your dashboard/service role can.
drop policy if exists "anon insert events" on public.usage_events;
create policy "anon insert events" on public.usage_events
  for insert to anon, authenticated
  with check (true);

-- ============================================================================
-- READY-MADE RESEARCH QUERIES (run these in the SQL editor whenever you want)
-- ============================================================================

-- 1) How many people are using it, and how much (last 30 days)
-- select
--   count(distinct anon_id)                                   as people,
--   count(*) filter (where event = 'session_start')           as sessions,
--   count(*) filter (where event = 'answer')                  as questions_answered,
--   round(count(*) filter (where event='answer') ::numeric
--         / nullif(count(distinct anon_id),0), 1)             as answers_per_person
-- from public.usage_events
-- where section = 'genetics' and ts > now() - interval '30 days';

-- 2) Daily active users + answers per day (engagement over time)
-- select date_trunc('day', ts)::date as day,
--        count(distinct anon_id)                        as active_people,
--        count(*) filter (where event='answer')         as answers
-- from public.usage_events
-- where section='genetics'
-- group by 1 order by 1;

-- 3) Accuracy + which questions are HARDEST (item difficulty for your research)
-- select props->>'qid'                                  as question,
--        props->>'topic'                                as topic,
--        count(*)                                       as attempts,
--        round(100.0*avg((props->>'correct')::int),1)   as pct_correct
-- from public.usage_events
-- where event='answer' and section='genetics'
-- group by 1,2 having count(*) >= 3
-- order by pct_correct asc;            -- hardest first

-- 4) Per-person engagement + best competency reached (retention / progress)
-- select anon_id,
--        count(*) filter (where event='answer')                          as answers,
--        count(distinct date_trunc('day', ts))                           as active_days,
--        max((props->>'competency')::int)                                as best_competency,
--        bool_or(event='milestone' and props->>'kind'='exam_ready')      as hit_exam_ready
-- from public.usage_events
-- where section='genetics'
-- group by anon_id order by answers desc;

-- 5) Mode popularity + mobile vs desktop
-- select props->>'mode' as mode, count(*) as starts
--   from public.usage_events where event='mode_start' group by 1 order by 2 desc;
-- select props->>'mobile' as mobile, count(distinct anon_id) as people
--   from public.usage_events where event='session_start' group by 1;
