-- harbor_confirm_review_item
-- Already applied live on travel-map (hmpwdgwoohpwhhzbhboz) on 2026-10-13. Schema only.

create or replace function public.confirm_review_item(p_kind text, p_item_id uuid, p_start_date date default null, p_end_date date default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind = 'draft_leg' then
    update public.journey_legs set status = 'confirmed'
    where id = p_item_id and user_id = auth.uid() and status = 'draft';
  elsif p_kind = 'undated_stop' then
    if p_start_date is null then raise exception 'start_date required'; end if;
    update public.pins set start_date = p_start_date, end_date = coalesce(p_end_date, p_start_date)
    where id = p_item_id and user_id = auth.uid() and deleted_at is null;
  else
    raise exception 'unknown kind %', p_kind;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.confirm_review_item(text, uuid, date, date) from public, anon;
grant execute on function public.confirm_review_item(text, uuid, date, date) to authenticated;
