-- Safe to run once after the initial supabase-schema.sql setup.
begin;

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.reports enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'SerpMe kullanıcısı'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

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

commit;
