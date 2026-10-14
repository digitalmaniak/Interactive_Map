-- harbor_draft_leg_labels
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
    -- No IATA columns on journey_legs: label precedence is draft label, then IATA code, then pin location_name.
    insert into public.journey_legs (user_id, journey_id, from_pin_id, to_pin_id,
                                     from_label, to_label, from_lat, from_lng, to_lat, to_lng,
                                     mode, depart_at, sort_order, status)
    select v_uid, v_journey, fp.id, tp.id,
           coalesce(nullif(v_leg->>'from_label', ''), nullif(v_leg->>'from_iata', ''), fp.location_name),
           coalesce(nullif(v_leg->>'to_label', ''), nullif(v_leg->>'to_iata', ''), tp.location_name),
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

revoke all on function public.create_journey_from_draft(jsonb) from public, anon;
grant execute on function public.create_journey_from_draft(jsonb) to authenticated;
