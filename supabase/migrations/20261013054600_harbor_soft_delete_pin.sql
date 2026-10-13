-- Already applied live on travel-map (hmpwdgwoohpwhhzbhboz) on 2026-10-13. Schema only.
create or replace function public.soft_delete_pin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := (select auth.uid());
  owner_id uuid;
  p_deleted timestamptz;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select user_id, deleted_at into owner_id, p_deleted from public.pins where id = p_id;
  if owner_id is null then raise exception 'pin not found' using errcode = 'P0002'; end if;
  if owner_id <> uid then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_deleted is not null then return jsonb_build_object('ok', true, 'already_deleted', true); end if;
  update public.pins set deleted_at = now(), updated_at = now() where id = p_id and user_id = uid and deleted_at is null;
  return jsonb_build_object('ok', true, 'already_deleted', false);
end;
$$;
revoke all on function public.soft_delete_pin(uuid) from public, anon;
grant execute on function public.soft_delete_pin(uuid) to authenticated;
