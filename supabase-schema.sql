-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  concept text not null,
  location text not null,
  stage text not null default 'Fikir' check (stage in ('Fikir', 'Araştırma', 'Doğrulama', 'Yatırım')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete set null,
  business text not null,
  location text not null,
  opportunity_score integer check (opportunity_score between 0 and 100),
  density integer check (density between 0 and 100),
  average_rating numeric(2,1),
  total_reviews integer,
  feasibility jsonb not null default '{}'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.reports enable row level security;

create policy "users manage own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "users manage own ideas" on public.ideas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own reports" on public.reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'SerpMe kullanıcısı')) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
