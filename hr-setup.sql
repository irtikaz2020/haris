-- حارس: جدول النبضة. شغّله مرة واحدة في SQL Editor داخل مشروع سوبابيز.
-- الجدول فيه صف واحد فقط، والمفتاح العام يقدر يقرأه بس.

create table if not exists public.heartbeat (
  id int primary key,
  note text,
  created_at timestamptz default now()
);

insert into public.heartbeat (id, note) values (1, 'ok')
on conflict (id) do nothing;

alter table public.heartbeat enable row level security;

drop policy if exists "heartbeat_read" on public.heartbeat;
create policy "heartbeat_read" on public.heartbeat
  for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.heartbeat to anon, authenticated;
