-- Harbor follow-up: make journey soft-delete work under RLS.
-- Do NOT re-run the first-slice migration.

-- Client-path: PostgREST UPDATE ... RETURNING needs a SELECT policy on the
-- new (soft-deleted) row. List reads still use deleted_at IS NULL (owner
-- select policy + Atlas .is('deleted_at', null)).
drop policy if exists "journeys_owner_select_deleted" on public.journeys;
create policy "journeys_owner_select_deleted" on public.journeys
  for select using (
    (select auth.uid()) = user_id
    and deleted_at is not null
  );

drop policy if exists "journeys_owner_update" on public.journeys;
create policy "journeys_owner_update" on public.journeys
  for update
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id);

-- Preferred atomic path for Atlas: move pins to Imported, then set deleted_at.
create or replace function public.soft_delete_journey(p_journey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owner_id uuid;
  j_title text;
  j_deleted timestamptz;
  imported_id uuid;
  moved integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select user_id, title, deleted_at
    into owner_id, j_title, j_deleted
  from public.journeys
  where id = p_journey_id;

  if owner_id is null then
    raise exception 'journey not found' using errcode = 'P0002';
  end if;

  if owner_id <> uid then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if j_title = 'Imported' then
    raise exception 'The Imported journey cannot be deleted.' using errcode = 'P0001';
  end if;

  if j_deleted is not null then
    return jsonb_build_object('ok', true, 'already_deleted', true, 'imported_id', null, 'pins_moved', 0);
  end if;

  select j.id into imported_id
  from public.journeys j
  where j.user_id = uid
    and j.title = 'Imported'
    and j.deleted_at is null
  order by j.created_at
  limit 1;

  if imported_id is null then
    insert into public.journeys (user_id, title, visibility, summary)
    values (uid, 'Imported', 'private', 'Soft-migrate catch-all for pins without a journey.')
    returning id into imported_id;
  end if;

  update public.pins
  set journey_id = imported_id,
      updated_at = now()
  where journey_id = p_journey_id
    and deleted_at is null;
  get diagnostics moved = row_count;

  update public.journeys
  set deleted_at = now()
  where id = p_journey_id
    and user_id = uid
    and deleted_at is null;

  return jsonb_build_object(
    'ok', true,
    'already_deleted', false,
    'imported_id', imported_id,
    'pins_moved', moved
  );
end;
$$;

revoke all on function public.soft_delete_journey(uuid) from public, anon;
grant execute on function public.soft_delete_journey(uuid) to authenticated;
