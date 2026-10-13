-- Harbor v2: routes, stats, elevation, country. Additive only.
alter table public.pins add column if not exists elevation_m double precision;
alter table public.pins add column if not exists country_code char(2);

create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe set search_path = '' as $$
  select 6371.0088 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace view public.journey_route_stops with (security_invoker = true) as
select p.journey_id, p.id as pin_id, p.user_id, p.title, p.location_name,
  p.latitude::double precision as lat, p.longitude::double precision as lng,
  p.elevation_m, p.country_code, p.start_date, p.end_date,
  row_number() over w as stop_index,
  coalesce(public.haversine_km(
    lag(p.latitude::double precision) over w, lag(p.longitude::double precision) over w,
    p.latitude::double precision, p.longitude::double precision), 0) as leg_km
from public.pins p
where p.deleted_at is null
window w as (partition by p.journey_id order by p.sort_order nulls last, p.start_date nulls last, p.created_at);

create or replace view public.journey_stats with (security_invoker = true) as
select j.id as journey_id, j.user_id,
  count(s.pin_id) as stop_count,
  coalesce(sum(s.leg_km), 0) as total_km,
  count(distinct s.country_code) as country_count,
  min(s.start_date) as first_date,
  max(coalesce(s.end_date, s.start_date)) as last_date
from public.journeys j
left join public.journey_route_stops s on s.journey_id = j.id
where j.deleted_at is null
group by j.id, j.user_id;

create or replace view public.profile_stats with (security_invoker = true) as
select j.user_id,
  count(*) as journey_count,
  sum(j.stop_count) as stop_count,
  sum(j.total_km) as total_km,
  (select count(distinct p.country_code) from public.pins p where p.user_id = j.user_id and p.deleted_at is null) as country_count,
  min(j.first_date) as first_date,
  max(j.last_date) as last_date
from public.journey_stats j
group by j.user_id;

-- One call for the cinematic share page. Unlisted, not deleted, token must match.
create or replace function public.get_shared_flyover(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'journey', jsonb_build_object('id', j.id, 'title', j.title, 'summary', j.summary,
      'date_start', j.date_start, 'date_end', j.date_end),
    'stats', (select to_jsonb(st) - 'user_id' from public.journey_stats st where st.journey_id = j.id),
    'stops', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.stop_index)
      from public.journey_route_stops s where s.journey_id = j.id), '[]'::jsonb))
  from public.journeys j
  where j.share_token = p_token and j.visibility = 'unlisted' and j.deleted_at is null
$$;
revoke all on function public.get_shared_flyover(uuid) from public;
grant execute on function public.get_shared_flyover(uuid) to anon, authenticated;
