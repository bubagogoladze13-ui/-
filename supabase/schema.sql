-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Creates the journal table and the private photo storage.
-- Only logged-in users can read or add; nobody can edit or delete from the page.

create table if not exists public.messages (
  id          text primary key,
  day         date not null,
  time_of_day text not null,
  author      text not null default '',
  body        text not null default '',
  files       text[] not null default '{}',
  missing     text[] not null default '{}',
  is_system   boolean not null default false,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now()
);
create index if not exists messages_day_idx on public.messages (day);

alter table public.messages enable row level security;

drop policy if exists "staff read" on public.messages;
create policy "staff read" on public.messages
  for select to authenticated using (true);

drop policy if exists "staff add" on public.messages;
create policy "staff add" on public.messages
  for insert to authenticated with check (true);

-- Private bucket for photos and other files from the chat.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "staff read photos" on storage.objects;
create policy "staff read photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');

drop policy if exists "staff add photos" on storage.objects;
create policy "staff add photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
