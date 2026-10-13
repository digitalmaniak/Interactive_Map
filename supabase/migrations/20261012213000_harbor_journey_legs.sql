-- Harbor v2: journey legs (from, to, mode). Additive. Prefill rows are status 'draft'.
create table if not exists public.journey_legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  from_pin_id uuid references public.pins(id) on delete set null,
  from_label text, from_lat double precision, from_lng double precision,
  to_pin_id uuid not null references public.pins(id) on delete cascade,
  mode text not null default 'drive' check (mode in ('fly','drive','train','boat','cruise','walk','other')),
  depart_at timestamptz, arrive_at timestamptz,
  sort_order integer not null default 0,
  status text not null default 'confirmed' check (status in ('draft','confirmed')),
  distance_km double precision,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journey_legs_journey_idx on public.journey_legs (journey_id, sort_order);
create index if not exists journey_legs_user_idx on public.journey_legs (user_id);

alter table public.journey_legs enable row level security;
create policy journey_legs_owner_all on public.journey_legs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Prefill drafts: first leg from home base (if set), then stop to stop. Mode by distance (>500 km fly).
insert into public.journey_legs (user_id, journey_id, from_pin_id, from_label, from_lat, from_lng, to_pin_id, mode, sort_order, status, distance_km)
select s.user_id, s.journey_id,
  s.prev_pin,
  case when s.prev_pin is null then pr.home_base_label end,
  coalesce(s.prev_lat, pr.home_base_lat), coalesce(s.prev_lng, pr.home_base_lng),
  s.pin_id,
  case when public.haversine_km(coalesce(s.prev_lat, pr.home_base_lat), coalesce(s.prev_lng, pr.home_base_lng), s.lat, s.lng) > 500 then 'fly' else 'drive' end,
  s.stop_index, 'draft',
  public.haversine_km(coalesce(s.prev_lat, pr.home_base_lat), coalesce(s.prev_lng, pr.home_base_lng), s.lat, s.lng)
from (
  select r.*, lag(r.pin_id) over w prev_pin, lag(r.lat) over w prev_lat, lag(r.lng) over w prev_lng
  from public.journey_route_stops r window w as (partition by r.journey_id order by r.stop_index)
) s
left join public.profiles pr on pr.id = s.user_id
where (s.prev_pin is not null or pr.home_base_lat is not null)
  and not exists (select 1 from public.journey_legs l where l.journey_id = s.journey_id);

-- Confirm all drafts for a journey (review screen "save"). Rollback is: delete where status='draft'.
create or replace function public.confirm_journey_legs(p_journey uuid)
returns integer language sql security invoker set search_path = '' as $$
  with u as (update public.journey_legs set status = 'confirmed', updated_at = now()
    where journey_id = p_journey and status = 'draft' and user_id = (select auth.uid()) returning 1)
  select count(*)::int from u
$$;
