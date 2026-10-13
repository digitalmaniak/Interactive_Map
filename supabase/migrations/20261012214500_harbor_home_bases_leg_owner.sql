-- Harbor v2: dated home base history, legs to/from free coordinates, same-owner check on legs.
create table if not exists public.profile_home_bases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);
create index if not exists profile_home_bases_user_idx on public.profile_home_bases (user_id, valid_from);
alter table public.profile_home_bases enable row level security;
create policy profile_home_bases_owner_all on public.profile_home_bases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Home base that applied on a date (null date = current).
create or replace function public.home_base_on(p_user uuid, p_date date)
returns public.profile_home_bases language sql stable security invoker set search_path = '' as $$
  select h.* from public.profile_home_bases h
  where h.user_id = p_user
    and (h.valid_from is null or h.valid_from <= coalesce(p_date, current_date))
    and (h.valid_to is null or h.valid_to > coalesce(p_date, current_date))
  order by h.valid_from desc nulls last limit 1
$$;

-- Legs can end at free coordinates (return home).
alter table public.journey_legs alter column to_pin_id drop not null;
alter table public.journey_legs add column if not exists to_label text;
alter table public.journey_legs add column if not exists to_lat double precision;
alter table public.journey_legs add column if not exists to_lng double precision;
alter table public.journey_legs add constraint journey_legs_to_present
  check (to_pin_id is not null or (to_lat is not null and to_lng is not null)) not valid;
alter table public.journey_legs validate constraint journey_legs_to_present;

-- Same-owner check: journey, from pin and to pin must all belong to the leg's owner.
create or replace function private.journey_legs_same_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.journeys j where j.id = new.journey_id and j.user_id = new.user_id) then
    raise exception 'journey_legs: journey does not belong to leg owner';
  end if;
  if new.from_pin_id is not null and not exists (select 1 from public.pins p where p.id = new.from_pin_id and p.user_id = new.user_id) then
    raise exception 'journey_legs: from place does not belong to leg owner';
  end if;
  if new.to_pin_id is not null and not exists (select 1 from public.pins p where p.id = new.to_pin_id and p.user_id = new.user_id) then
    raise exception 'journey_legs: to place does not belong to leg owner';
  end if;
  return new;
end $$;
drop trigger if exists journey_legs_same_owner on public.journey_legs;
create trigger journey_legs_same_owner before insert or update on public.journey_legs
  for each row execute function private.journey_legs_same_owner();
