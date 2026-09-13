-- Harbor first slice (2026-09-13)
-- Additive journeys + in-place pins.journey_id. No parallel places table.
-- Safe for current MapCanvas: missing journey_id on insert is filled via Imported journey.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.request_share_token()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json;
  raw text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  raw := coalesce(headers->>'x-share-token', '');
  if raw = '' then
    return null;
  end if;
  begin
    return raw::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function private.geohash_encode(lat double precision, lng double precision, prec integer default 7)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  base32 constant text := '0123456789bcdefghjkmnpqrstuvwxyz';
  min_lat double precision := -90;
  max_lat double precision := 90;
  min_lng double precision := -180;
  max_lng double precision := 180;
  hash text := '';
  bit_n int := 0;
  ch int := 0;
  even boolean := true;
  mid double precision;
begin
  if lat < -90 or lat > 90 or lng < -180 or lng > 180 or prec < 1 then
    return null;
  end if;
  while length(hash) < prec loop
    if even then
      mid := (min_lng + max_lng) / 2;
      if lng >= mid then
        ch := (ch * 2) + 1;
        min_lng := mid;
      else
        ch := ch * 2;
        max_lng := mid;
      end if;
    else
      mid := (min_lat + max_lat) / 2;
      if lat >= mid then
        ch := (ch * 2) + 1;
        min_lat := mid;
      else
        ch := ch * 2;
        max_lat := mid;
      end if;
    end if;
    even := not even;
    bit_n := bit_n + 1;
    if bit_n = 5 then
      hash := hash || substr(base32, ch + 1, 1);
      bit_n := 0;
      ch := 0;
    end if;
  end loop;
  return hash;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle extensions.citext unique,
  display_name text,
  avatar_url text,
  home_base_label text,
  home_base_lat double precision,
  home_base_lng double precision,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

insert into public.profiles (id, handle, display_name)
select
  u.id,
  'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- journeys
-- ---------------------------------------------------------------------------

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  summary text,
  date_start date,
  date_end date,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted')),
  share_token uuid not null default gen_random_uuid(),
  cover_media_id uuid,
  tags text[],
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journeys_user_id_date_start_idx
  on public.journeys (user_id, date_start desc);

create unique index if not exists journeys_share_token_active_uidx
  on public.journeys (share_token)
  where deleted_at is null;

drop trigger if exists journeys_set_updated_at on public.journeys;
create trigger journeys_set_updated_at
  before update on public.journeys
  for each row execute function private.set_updated_at();

alter table public.journeys enable row level security;

drop policy if exists "journeys_owner_select" on public.journeys;
create policy "journeys_owner_select" on public.journeys
  for select using ((select auth.uid()) = user_id and deleted_at is null);

drop policy if exists "journeys_unlisted_select" on public.journeys;
create policy "journeys_unlisted_select" on public.journeys
  for select using (
    deleted_at is null
    and visibility = 'unlisted'
    and share_token is not null
    and share_token = private.request_share_token()
  );

drop policy if exists "journeys_owner_insert" on public.journeys;
create policy "journeys_owner_insert" on public.journeys
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "journeys_owner_update" on public.journeys;
create policy "journeys_owner_update" on public.journeys
  for update using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id);

drop policy if exists "journeys_owner_delete" on public.journeys;
create policy "journeys_owner_delete" on public.journeys
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.journeys to authenticated;
grant select on public.journeys to anon;

-- ---------------------------------------------------------------------------
-- pins: additive columns (keep latitude/longitude/name as shipped)
-- ---------------------------------------------------------------------------

alter table public.pins
  add column if not exists journey_id uuid references public.journeys (id),
  add column if not exists deleted_at timestamptz,
  add column if not exists geohash text,
  add column if not exists sort_order integer not null default 0;

create index if not exists pins_journey_id_sort_idx on public.pins (journey_id, sort_order);
create index if not exists pins_user_id_idx on public.pins (user_id);
create index if not exists pins_geohash_idx on public.pins (geohash);

create or replace function private.pins_set_geohash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geohash := private.geohash_encode(new.latitude::double precision, new.longitude::double precision, 7);
  else
    new.geohash := null;
  end if;
  return new;
end;
$$;

drop trigger if exists pins_set_geohash on public.pins;
create trigger pins_set_geohash
  before insert or update of latitude, longitude on public.pins
  for each row execute function private.pins_set_geohash();

update public.pins
set geohash = private.geohash_encode(latitude::double precision, longitude::double precision, 7)
where latitude is not null and longitude is not null and geohash is null;

-- Group dated pins: same user + same title + overlapping/adjacent dates (gap <= 3 days)
with dated as (
  select
    id,
    user_id,
    title,
    start_date,
    coalesce(end_date, start_date) as end_d,
    trip_type
  from public.pins
  where start_date is not null
    and journey_id is null
),
ordered as (
  select
    *,
    lag(end_d) over (
      partition by user_id, lower(btrim(title))
      order by start_date, id
    ) as prev_end
  from dated
),
flagged as (
  select
    *,
    case
      when prev_end is null or start_date > prev_end + 3 then 1
      else 0
    end as new_grp
  from ordered
),
grps as (
  select
    *,
    sum(new_grp) over (
      partition by user_id, lower(btrim(title))
      order by start_date, id
    ) as grp
  from flagged
),
created as (
  insert into public.journeys (user_id, title, date_start, date_end, tags, visibility)
  select
    g.user_id,
    min(g.title),
    min(g.start_date),
    max(g.end_d),
    case
      when min(g.trip_type) is null then null
      else array[min(g.trip_type)]
    end,
    'private'
  from grps g
  group by g.user_id, lower(btrim(g.title)), g.grp
  returning id, user_id, title, date_start, date_end
)
update public.pins p
set
  journey_id = c.id,
  sort_order = coalesce(
    (extract(epoch from (p.start_date::timestamp - c.date_start::timestamp)) / 86400)::int,
    0
  )
from created c
where p.journey_id is null
  and p.user_id = c.user_id
  and lower(btrim(p.title)) = lower(btrim(c.title))
  and p.start_date is not null
  and p.start_date >= c.date_start
  and coalesce(p.end_date, p.start_date) <= c.date_end;

-- Orphans (undated or unmatched) → per-user Imported journey
insert into public.journeys (user_id, title, visibility, summary)
select distinct p.user_id, 'Imported', 'private', 'Soft-migrate catch-all for pins without dates or a title/date cluster.'
from public.pins p
where p.journey_id is null
  and not exists (
    select 1 from public.journeys j
    where j.user_id = p.user_id and j.title = 'Imported' and j.deleted_at is null
  );

update public.pins p
set journey_id = j.id
from public.journeys j
where p.journey_id is null
  and j.user_id = p.user_id
  and j.title = 'Imported'
  and j.deleted_at is null;

create or replace function private.pins_default_journey()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  imported_id uuid;
begin
  if new.journey_id is not null then
    return new;
  end if;
  if new.user_id is null then
    raise exception 'pins.user_id required before journey default';
  end if;
  select j.id into imported_id
  from public.journeys j
  where j.user_id = new.user_id
    and j.title = 'Imported'
    and j.deleted_at is null
  order by j.created_at
  limit 1;
  if imported_id is null then
    insert into public.journeys (user_id, title, visibility, summary)
    values (new.user_id, 'Imported', 'private', 'Soft-migrate catch-all for pins without a journey.')
    returning id into imported_id;
  end if;
  new.journey_id := imported_id;
  return new;
end;
$$;

drop trigger if exists pins_default_journey on public.pins;
create trigger pins_default_journey
  before insert on public.pins
  for each row execute function private.pins_default_journey();

alter table public.pins
  alter column journey_id set not null;

-- Refresh pin RLS: hide soft-deleted; allow unlisted read via share token header
drop policy if exists "Users can view their own pins" on public.pins;
create policy "Users can view their own pins" on public.pins
  for select using ((select auth.uid()) = user_id and deleted_at is null);

drop policy if exists "pins_unlisted_select" on public.pins;
create policy "pins_unlisted_select" on public.pins
  for select using (
    deleted_at is null
    and exists (
      select 1
      from public.journeys j
      where j.id = pins.journey_id
        and j.deleted_at is null
        and j.visibility = 'unlisted'
        and j.share_token = private.request_share_token()
    )
  );

drop policy if exists "Users can update their own pins" on public.pins;
create policy "Users can update their own pins" on public.pins
  for update using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id);

grant select on public.pins to anon;

drop policy if exists "Users can view logs of their own pins" on public.pin_logs;
create policy "Users can view logs of their own pins" on public.pin_logs
  for select using (
    exists (
      select 1 from public.pins
      where pins.id = pin_logs.pin_id
        and pins.user_id = (select auth.uid())
        and pins.deleted_at is null
    )
  );

drop policy if exists "pin_logs_unlisted_select" on public.pin_logs;
create policy "pin_logs_unlisted_select" on public.pin_logs
  for select using (
    exists (
      select 1
      from public.pins p
      join public.journeys j on j.id = p.journey_id
      where p.id = pin_logs.pin_id
        and p.deleted_at is null
        and j.deleted_at is null
        and j.visibility = 'unlisted'
        and j.share_token = private.request_share_token()
    )
  );

grant select on public.pin_logs to anon;

-- ---------------------------------------------------------------------------
-- journal_blocks + activities + restaurants (pin_logs stay)
-- ---------------------------------------------------------------------------

create table if not exists public.journal_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_type text not null check (parent_type in ('place', 'journey')),
  parent_id uuid not null,
  type text not null,
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_blocks_parent_idx
  on public.journal_blocks (parent_type, parent_id, position);

create index if not exists journal_blocks_user_id_idx
  on public.journal_blocks (user_id);

drop trigger if exists journal_blocks_set_updated_at on public.journal_blocks;
create trigger journal_blocks_set_updated_at
  before update on public.journal_blocks
  for each row execute function private.set_updated_at();

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.pins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text,
  rating smallint,
  notes text,
  happened_on date,
  created_at timestamptz not null default now()
);

create index if not exists activities_place_id_idx on public.activities (place_id);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.pins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  cuisine text,
  tags text[],
  price_tier smallint,
  rating smallint,
  notes text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists restaurants_place_id_idx on public.restaurants (place_id);

-- Map pin_logs. Content/title → journal_markdown. Restaurant category → restaurants.
-- Experience → activities. media_urls → media_gallery block when non-empty.
insert into public.journal_blocks (user_id, parent_type, parent_id, type, position, payload)
select
  p.user_id,
  'place',
  l.pin_id,
  'journal_markdown',
  row_number() over (partition by l.pin_id order by l.log_date nulls last, l.created_at, l.id) - 1,
  jsonb_build_object(
    'markdown',
    trim(both from concat_ws(E'\n\n', nullif(l.title, ''), nullif(l.content, ''))),
    'legacy_pin_log_id', l.id,
    'legacy_category', l.category,
    'log_date', l.log_date
  )
from public.pin_logs l
join public.pins p on p.id = l.pin_id
where coalesce(l.title, '') <> '' or coalesce(l.content, '') <> '';

insert into public.journal_blocks (user_id, parent_type, parent_id, type, position, payload)
select
  p.user_id,
  'place',
  l.pin_id,
  'media_gallery',
  1000 + row_number() over (partition by l.pin_id order by l.created_at, l.id),
  jsonb_build_object(
    'items', l.media_urls,
    'legacy_pin_log_id', l.id
  )
from public.pin_logs l
join public.pins p on p.id = l.pin_id
where l.media_urls is not null
  and jsonb_typeof(l.media_urls) = 'array'
  and jsonb_array_length(l.media_urls) > 0;

insert into public.activities (place_id, user_id, name, category, notes, happened_on)
select
  l.pin_id,
  p.user_id,
  coalesce(nullif(l.title, ''), 'Experience'),
  coalesce(l.category, 'Experience'),
  l.content,
  l.log_date
from public.pin_logs l
join public.pins p on p.id = l.pin_id
where lower(coalesce(l.category, '')) = 'experience';

insert into public.restaurants (place_id, user_id, name, notes)
select
  l.pin_id,
  p.user_id,
  coalesce(nullif(l.title, ''), 'Restaurant'),
  l.content
from public.pin_logs l
join public.pins p on p.id = l.pin_id
where lower(coalesce(l.category, '')) = 'restaurant';

-- RLS helpers for child rows (pins remain Place rows)
create or replace function private.can_read_place(place uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pins p
    join public.journeys j on j.id = p.journey_id
    where p.id = place
      and p.deleted_at is null
      and j.deleted_at is null
      and (
        j.user_id = (select auth.uid())
        or (
          j.visibility = 'unlisted'
          and j.share_token = private.request_share_token()
        )
      )
  );
$$;

alter table public.journal_blocks enable row level security;
alter table public.activities enable row level security;
alter table public.restaurants enable row level security;

drop policy if exists "journal_blocks_select" on public.journal_blocks;
create policy "journal_blocks_select" on public.journal_blocks
  for select using (
    (parent_type = 'place' and private.can_read_place(parent_id))
    or (
      parent_type = 'journey'
      and exists (
        select 1 from public.journeys j
        where j.id = journal_blocks.parent_id
          and j.deleted_at is null
          and (
            j.user_id = (select auth.uid())
            or (j.visibility = 'unlisted' and j.share_token = private.request_share_token())
          )
      )
    )
  );

drop policy if exists "journal_blocks_owner_write" on public.journal_blocks;
create policy "journal_blocks_owner_insert" on public.journal_blocks
  for insert with check ((select auth.uid()) = user_id);
create policy "journal_blocks_owner_update" on public.journal_blocks
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "journal_blocks_owner_delete" on public.journal_blocks
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select using (private.can_read_place(place_id));
create policy "activities_owner_insert" on public.activities
  for insert with check ((select auth.uid()) = user_id);
create policy "activities_owner_update" on public.activities
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "activities_owner_delete" on public.activities
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "restaurants_select" on public.restaurants;
create policy "restaurants_select" on public.restaurants
  for select using (private.can_read_place(place_id));
create policy "restaurants_owner_insert" on public.restaurants
  for insert with check ((select auth.uid()) = user_id);
create policy "restaurants_owner_update" on public.restaurants
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "restaurants_owner_delete" on public.restaurants
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.journal_blocks to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.restaurants to authenticated;
grant select on public.journal_blocks to anon;
grant select on public.activities to anon;
grant select on public.restaurants to anon;

grant usage on schema private to anon, authenticated;
grant execute on function private.request_share_token() to anon, authenticated;
grant execute on function private.can_read_place(uuid) to anon, authenticated;
