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
  market_viability_score integer check (market_viability_score between 0 and 100),
  analysis_mode text check (analysis_mode in ('demand_validation', 'early_market', 'competition')),
  viability_classification text,
  data_confidence jsonb not null default '{}'::jsonb,
  viability_components jsonb not null default '{}'::jsonb,
  density integer check (density between 0 and 100),
  average_rating numeric(2,1),
  total_reviews integer,
  feasibility jsonb not null default '{}'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Safe, repeatable migration for existing SerpMe databases.
alter table public.reports add column if not exists market_viability_score integer check (market_viability_score between 0 and 100);
alter table public.reports add column if not exists analysis_mode text check (analysis_mode in ('demand_validation', 'early_market', 'competition'));
alter table public.reports add column if not exists viability_classification text;
alter table public.reports add column if not exists data_confidence jsonb not null default '{}'::jsonb;
alter table public.reports add column if not exists viability_components jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.reports enable row level security;

create policy "users manage own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "users manage own ideas" on public.ideas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users manage own reports" on public.reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'SerpMe kullanıcısı')) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Input limits apply even when requests bypass the browser. Existing rows are
-- left untouched; new and updated records must satisfy these constraints.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ideas_concept_length') then
    alter table public.ideas add constraint ideas_concept_length check (char_length(concept) between 2 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ideas_location_length') then
    alter table public.ideas add constraint ideas_location_length check (char_length(location) between 2 and 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ideas_notes_length') then
    alter table public.ideas add constraint ideas_notes_length check (char_length(coalesce(notes, '')) <= 4000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_business_length') then
    alter table public.reports add constraint reports_business_length check (char_length(business) between 2 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_location_length') then
    alter table public.reports add constraint reports_location_length check (char_length(location) between 2 and 200) not valid;
  end if;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
