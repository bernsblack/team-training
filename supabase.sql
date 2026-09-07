-- Team Training rooms. Run once in Supabase → SQL Editor.
-- One row per (room code, slice). Slices: host, team0, team1.

create table if not exists public.room_slices (
  code        text        not null,
  slice       text        not null check (slice in ('host','team0','team1')),
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (code, slice)
);

alter table public.room_slices enable row level security;

-- Anyone with the anon key may read and write any room. The key is public
-- by design; a 4-letter room code is the only "secret". Fine for a Saturday
-- session, not for anything that matters.
create policy "anon read"   on public.room_slices for select to anon using (true);
create policy "anon insert" on public.room_slices for insert to anon with check (true);
create policy "anon update" on public.room_slices for update to anon using (true) with check (true);

-- Realtime needs the table in the publication.
alter publication supabase_realtime add table public.room_slices;

-- Optional housekeeping: drop rooms older than a week.
-- delete from public.room_slices where updated_at < now() - interval '7 days';
