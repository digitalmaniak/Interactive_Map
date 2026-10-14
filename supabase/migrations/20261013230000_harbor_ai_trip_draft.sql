-- harbor_ai_trip_draft
-- Already applied on the database (Harbor). Kept here for the record. Do not re-run.
-- Note: journey_legs_mode_check already allows fly, drive, train, boat, cruise, walk, other; no change needed.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_usage from anon, authenticated;

create or replace function public.ai_usage_bump(p_limit int default 20)
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'America/New_York')::date;
  v_calls int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.ai_usage (user_id, day, calls) values (v_uid, v_day, 0)
  on conflict (user_id, day) do nothing;
  select calls into v_calls from public.ai_usage
   where user_id = v_uid and day = v_day for update;
  if v_calls + 1 > p_limit then
    raise exception 'daily_limit';
  end if;
  update public.ai_usage set calls = calls + 1
   where user_id = v_uid and day = v_day
  returning calls into v_calls;
  return v_calls;
end $$;

create or replace function public.create_journey_from_draft(draft jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_journey uuid;
  v_pins uuid[] := '{}';
  v_stop jsonb;
  v_leg jsonb;
  v_pin uuid;
  v_idx int := 0;
  v_from int;
  v_to int;
  v_n int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if jsonb_typeof(draft->'stops') is distinct from 'array' or jsonb_array_length(draft->'stops') = 0 then
    raise exception 'draft_needs_stops';
  end if;

  insert into public.journeys (user_id, title, date_start, date_end)
  values (v_uid,
          coalesce(nullif(draft#>>'{journey,title}', ''), 'Untitled trip'),
          nullif(draft#>>'{journey,date_start}', '')::date,
          nullif(draft#>>'{journey,date_end}', '')::date)
  returning id into v_journey;

  for v_stop in select value from jsonb_array_elements(draft->'stops') loop
    v_pin := null;
    if nullif(v_stop->>'matched_pin_id', '') is not null then
      select p.id into v_pin from public.pins p
       where p.id = (v_stop->>'matched_pin_id')::uuid
         and p.user_id = v_uid and p.deleted_at is null;
    end if;
    if v_pin is null then
      insert into public.pins (user_id, journey_id, title, location_name, latitude, longitude,
                               country_code, start_date, sort_order)
      values (v_uid, v_journey, v_stop->>'name', v_stop->>'name',
              (v_stop->>'lat')::numeric, (v_stop->>'lng')::numeric,
              upper(nullif(v_stop->>'country_code', '')),
              nullif(v_stop->>'date', '')::date, v_idx)
      returning id into v_pin;
    end if;
    v_pins := v_pins || v_pin;
    v_idx := v_idx + 1;
  end loop;

  v_n := array_length(v_pins, 1);
  v_idx := 0;
  for v_leg in select value from jsonb_array_elements(coalesce(draft->'legs', '[]'::jsonb)) loop
    v_from := (v_leg->>'from_stop')::int;
    v_to := (v_leg->>'to_stop')::int;
    if v_from is null or v_to is null or v_from < 0 or v_to < 0 or v_from >= v_n or v_to >= v_n then
      raise exception 'draft_bad_leg_index';
    end if;
    -- No from_iata/to_iata or notes/metadata column on journey_legs: IATA codes are skipped.
    insert into public.journey_legs (user_id, journey_id, from_pin_id, to_pin_id,
                                     from_label, to_label, from_lat, from_lng, to_lat, to_lng,
                                     mode, depart_at, sort_order, status)
    select v_uid, v_journey, fp.id, tp.id,
           fp.location_name, tp.location_name,
           fp.latitude::double precision, fp.longitude::double precision,
           tp.latitude::double precision, tp.longitude::double precision,
           coalesce(nullif(v_leg->>'mode', ''), 'other'),
           nullif(v_leg->>'date', '')::date::timestamptz, v_idx, 'confirmed'
      from public.pins fp, public.pins tp
     where fp.id = v_pins[v_from + 1] and tp.id = v_pins[v_to + 1];
    v_idx := v_idx + 1;
  end loop;

  return v_journey;
end $$;

revoke all on function public.ai_usage_bump(int) from public, anon;
revoke all on function public.create_journey_from_draft(jsonb) from public, anon;
grant execute on function public.ai_usage_bump(int) to authenticated;
grant execute on function public.create_journey_from_draft(jsonb) to authenticated;
