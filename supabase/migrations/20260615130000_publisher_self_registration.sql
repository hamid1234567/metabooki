-- Publisher/editor accounts need a publisher profile before Word imports can be uploaded.
drop policy if exists "Eligible users create publisher profile" on public.publisher_profiles;
create policy "Eligible users create publisher profile"
on public.publisher_profiles for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role in ('publisher', 'editor')
    )
  )
);
