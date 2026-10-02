-- Replacing a test's categories is one atomic, admin-authorized operation.
create function public.set_test_categories(p_test_id uuid, p_category_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_category_ids), 0) > 1000 then
    raise exception 'Too many categories' using errcode = '23514';
  end if;
  -- Serialize concurrent replacements of the same test's assignments.
  perform 1 from public.mock_tests where id = p_test_id for update;
  if not found then
    raise exception 'Test not found' using errcode = 'P0002';
  end if;
  delete from public.mock_test_categories where test_id = p_test_id;
  insert into public.mock_test_categories(test_id, category_id)
  select p_test_id, category_id from (select distinct unnest(p_category_ids) as category_id) ids;
end;
$$;
revoke all on function public.set_test_categories(uuid, uuid[]) from public;
grant execute on function public.set_test_categories(uuid, uuid[]) to authenticated;
