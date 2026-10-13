-- Data script (not a migration). Angel's home bases + draft legs from/to home. Rerunnable.
with u as (select distinct user_id from public.journeys)
insert into public.profile_home_bases (user_id, label, lat, lng, valid_from, valid_to)
select u.user_id, v.label, v.lat, v.lng, v.f, v.t from u, (values
  ('Brooklyn, NY', 40.6782, -73.9442, null::date, date '2014-07-01'),
  ('North Bergen, NJ', 40.8043, -74.0121, date '2014-07-01', null::date)) v(label, lat, lng, f, t)
where not exists (select 1 from public.profile_home_bases h where h.user_id = u.user_id);

update public.profiles p set home_base_label = 'North Bergen, NJ', home_base_lat = 40.8043, home_base_lng = -74.0121
where p.home_base_lat is null;

-- First leg from home (dated journeys only; skips journeys that already start from home).
insert into public.journey_legs (user_id, journey_id, from_label, from_lat, from_lng, to_pin_id, mode, sort_order, status, distance_km)
select s.user_id, s.journey_id, h.label, h.lat, h.lng, s.pin_id,
  case when public.haversine_km(h.lat, h.lng, s.lat, s.lng) > 500 then 'fly' else 'drive' end,
  0, 'draft', public.haversine_km(h.lat, h.lng, s.lat, s.lng)
from public.journey_route_stops s
cross join lateral public.home_base_on(s.user_id, s.start_date) h
where s.stop_index = 1 and s.start_date is not null and h.id is not null
  and not exists (select 1 from public.journey_legs l where l.journey_id = s.journey_id and l.from_pin_id is null);

-- Last leg back home, from the final stop.
insert into public.journey_legs (user_id, journey_id, from_pin_id, to_label, to_lat, to_lng, mode, sort_order, status, distance_km)
select s.user_id, s.journey_id, s.pin_id, h.label, h.lat, h.lng,
  case when public.haversine_km(s.lat, s.lng, h.lat, h.lng) > 500 then 'fly' else 'drive' end,
  s.stop_index + 1, 'draft', public.haversine_km(s.lat, s.lng, h.lat, h.lng)
from (select r.*, max(r.stop_index) over (partition by r.journey_id) mx from public.journey_route_stops r) s
cross join lateral public.home_base_on(s.user_id, coalesce(s.end_date, s.start_date)) h
where s.stop_index = s.mx and s.start_date is not null and h.id is not null
  and not exists (select 1 from public.journey_legs l where l.journey_id = s.journey_id and l.to_pin_id is null);
