-- harbor_stats_v2_review
-- Already applied live on travel-map (hmpwdgwoohpwhhzbhboz) on 2026-10-13. Schema only.

create or replace view public.journey_leg_stats with (security_invoker = true) as
select l.journey_id, l.user_id,
  count(*) as leg_count,
  count(*) filter (where l.status='draft') as draft_leg_count,
  coalesce(sum(k.km) filter (where l.mode='fly'),0) as flown_km,
  coalesce(sum(k.km) filter (where l.mode='drive'),0) as driven_km,
  coalesce(sum(k.km) filter (where l.mode not in ('fly','drive')),0) as other_km,
  coalesce(sum(k.km),0) as leg_total_km
from journey_legs l
left join pins fp on fp.id=l.from_pin_id
left join pins tp on tp.id=l.to_pin_id
cross join lateral (select coalesce(l.distance_km, haversine_km(coalesce(fp.latitude,l.from_lat)::float8, coalesce(fp.longitude,l.from_lng)::float8, coalesce(tp.latitude,l.to_lat)::float8, coalesce(tp.longitude,l.to_lng)::float8)) as km) k
where l.deleted_at is null
group by l.journey_id, l.user_id;

create or replace view public.journey_stats_v2 with (security_invoker = true) as
select s.journey_id, s.user_id, s.stop_count, s.country_count, s.first_date, s.last_date,
  case when s.first_date is not null then (s.last_date - s.first_date + 1) end as days,
  coalesce(ls.leg_count,0) as leg_count, coalesce(ls.draft_leg_count,0) as draft_leg_count,
  coalesce(ls.flown_km,0) as flown_km, coalesce(ls.driven_km,0) as driven_km, coalesce(ls.other_km,0) as other_km,
  case when coalesce(ls.leg_count,0)>0 then ls.leg_total_km else s.total_km end as total_km
from journey_stats s left join journey_leg_stats ls on ls.journey_id=s.journey_id;

create or replace view public.profile_stats_v2 with (security_invoker = true) as
select user_id, count(*) as journey_count, sum(stop_count) as stop_count, sum(total_km) as total_km,
  sum(flown_km) as flown_km, sum(driven_km) as driven_km, sum(other_km) as other_km,
  sum(days) as days_on_road,
  (select count(distinct p.country_code) from pins p where p.user_id=j.user_id and p.deleted_at is null) as country_count,
  min(first_date) as first_date, max(last_date) as last_date
from journey_stats_v2 j group by user_id;

create or replace view public.data_review_items with (security_invoker = true) as
select 'undated_stop'::text as kind, p.user_id, p.journey_id, p.id as item_id, coalesce(p.location_name,p.title) as label, null::text as detail
from pins p join journeys j on j.id=p.journey_id and j.deleted_at is null
where p.deleted_at is null and p.start_date is null
union all
select 'draft_leg', l.user_id, l.journey_id, l.id, coalesce(fp.title,l.from_label,'?')||' to '||coalesce(tp.title,l.to_label,'?'), l.mode
from journey_legs l join journeys j on j.id=l.journey_id and j.deleted_at is null
left join pins fp on fp.id=l.from_pin_id left join pins tp on tp.id=l.to_pin_id
where l.deleted_at is null and l.status='draft';

grant select on public.journey_leg_stats, public.journey_stats_v2, public.profile_stats_v2, public.data_review_items to authenticated;
