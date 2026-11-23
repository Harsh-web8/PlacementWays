-- Aggregate only the caller's private records. No user ID argument is accepted.
create function public.get_learning_analytics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 with latest_practice as (
  select distinct on(question_id) category_id,difficulty,is_correct,created_at,question_id
  from public.practice_attempts where user_id=auth.uid() and is_correct is not null
  order by question_id,created_at desc,id desc
 ), observations as (
  select category_id,difficulty,is_correct from latest_practice
  union all
  select q.category_id,q.difficulty,coalesce(aa.is_correct,false)
  from public.attempt_answers aa join public.test_attempts a on a.id=aa.attempt_id
  join public.questions q on q.id=aa.question_id
  where a.user_id=auth.uid() and a.status<>'in_progress' and q.question_type='mcq'
 ), topic_stats as (
  select o.category_id,c.name,c.parent_id,count(*)::int total,count(*) filter(where o.is_correct)::int correct
  from observations o join public.categories c on c.id=o.category_id group by o.category_id,c.name,c.parent_id
 ), weak as (select * from topic_stats where total>=3 and correct::numeric/total<0.6),
 subjects as (
  select coalesce(c.parent_id,c.id) id,coalesce(parent.name,c.name) name,count(*)::int total,count(*) filter(where o.is_correct)::int correct
  from observations o join public.categories c on c.id=o.category_id left join public.categories parent on parent.id=c.parent_id
  group by coalesce(c.parent_id,c.id),coalesce(parent.name,c.name)
 ), difficulty_stats as (
  select difficulty,count(*)::int total,count(*) filter(where is_correct)::int correct from observations group by difficulty
 ), companies as (
  select co.id,co.name,count(*)::int attempts,round(avg(100*a.score/nullif(a.total_marks,0)),1) percentage
  from public.test_attempts a join public.mock_tests t on t.id=a.test_id join public.companies co on co.id=t.company_id
  where a.user_id=auth.uid() and a.status<>'in_progress' group by co.id,co.name
 )
 select jsonb_build_object(
  'topics',coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from topic_stats t),'[]'::jsonb),
  'subjects',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from subjects s),'[]'::jsonb),
  'difficulties',coalesce((select jsonb_agg(to_jsonb(d) order by d.difficulty) from difficulty_stats d),'[]'::jsonb),
  'companies',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from companies c),'[]'::jsonb),
  'recommendations',coalesce((select jsonb_agg(jsonb_build_object('category_id',w.category_id,'topic',w.name,
   'lessons',coalesce((select jsonb_agg(to_jsonb(l)) from (
    select l.id,l.title,c.slug course_slug from public.lessons l join public.course_modules m on m.id=l.module_id
    join public.courses c on c.id=m.course_id where l.category_id=w.category_id and public.can_read_lesson(l.id)
    order by l.sort_order,l.id limit 3) l),'[]'::jsonb),
   'mocks',coalesce((select jsonb_agg(to_jsonb(t)) from (
    select t.slug,t.title from public.mock_tests t join public.mock_test_categories tc on tc.test_id=t.id
    where tc.category_id in(w.category_id,w.parent_id) and t.status='published' and t.is_free
    and (t.company_id is null or exists(select 1 from public.companies co where co.id=t.company_id and co.status='published'))
    order by t.duration_minutes,t.id limit 3) t),'[]'::jsonb)
   ) order by w.correct::numeric/w.total) from weak w),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.started_at desc) from (
   select a.id,a.started_at,a.score,a.total_marks,a.status,t.title,t.slug,
    round(100*a.score/nullif(a.total_marks,0),1) percentage
   from public.test_attempts a join public.mock_tests t on t.id=a.test_id where a.user_id=auth.uid() and a.status<>'in_progress'
   order by a.started_at desc,a.id desc limit 30) h),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.get_learning_analytics() from public,anon;
grant execute on function public.get_learning_analytics() to authenticated;
