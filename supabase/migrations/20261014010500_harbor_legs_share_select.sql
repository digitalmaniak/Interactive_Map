-- harbor_legs_share_select
-- Mirrors pins_unlisted_select. share_token and private.request_share_token() are both uuid (no cast).
-- anon already holds SELECT on journey_legs (as on pins), so no grant is added.
drop policy if exists journey_legs_unlisted_select on public.journey_legs;
create policy journey_legs_unlisted_select on public.journey_legs
  for select to public
  using (
    deleted_at is null
    and exists (
      select 1 from public.journeys j
      where j.id = journey_legs.journey_id
        and j.deleted_at is null
        and j.visibility = 'unlisted'
        and j.share_token = private.request_share_token()
    )
  );
