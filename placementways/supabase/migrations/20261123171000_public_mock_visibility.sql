-- Direct mock URLs and the public listing must agree on parent visibility.
drop policy tests_read on public.mock_tests;
create policy tests_read on public.mock_tests for select using (
  (select public.is_admin())
  or (
    status='published'
    and (company_id is null or exists (
      select 1 from public.companies c where c.id=company_id and c.status='published'
    ))
  )
);
