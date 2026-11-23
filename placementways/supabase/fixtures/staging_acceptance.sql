-- Run only on the independently confirmed, private staging project.
-- The rows below are explicitly synthetic and belong to no real employer.
begin;

insert into public.companies (id,name,slug,description,status)
values ('dd100000-0000-4000-8000-000000000001','PlacementWays staging acceptance',
 'pw-staging-acceptance','Synthetic release fixture with no real employer affiliation.','published')
on conflict (id) do nothing;

insert into public.company_roles (id,company_id,slug,title,eligibility,status)
values ('dd100000-0000-4000-8000-000000000002','dd100000-0000-4000-8000-000000000001',
 'pw-staging-acceptance-role','Synthetic acceptance role','Synthetic eligibility baseline.','published')
on conflict (id) do nothing;

insert into public.recruitment_drives (id,role_id,title,status)
values ('dd100000-0000-4000-8000-000000000003','dd100000-0000-4000-8000-000000000002',
 'Synthetic acceptance drive','published')
on conflict (id) do nothing;

insert into public.recruitment_rounds (id,drive_id,round_number,name,duration_minutes,source_kind)
values ('dd100000-0000-4000-8000-000000000004','dd100000-0000-4000-8000-000000000003',
 1,'Synthetic acceptance round',20,'unverified')
on conflict (id) do nothing;

insert into public.categories (id,name,slug)
values ('dd100000-0000-4000-8000-000000000005','Staging acceptance','pw-staging-acceptance')
on conflict (id) do nothing;

insert into public.questions
 (id,category_id,question_type,question_text,correct_answer,explanation,slug,is_practice,status)
values
 ('dd100000-0000-4000-8000-000000000006','dd100000-0000-4000-8000-000000000005',
 'mcq','What is 6 times 7?','A','Six groups of seven total 42.','pw-staging-acceptance-mcq',true,'published'),
 ('dd100000-0000-4000-8000-000000000007','dd100000-0000-4000-8000-000000000005',
 'coding','Print the number 42 followed by a newline.',null,null,'pw-staging-acceptance-coding',true,'published')
on conflict (id) do nothing;

insert into public.question_options (question_id,option_key,option_text)
values ('dd100000-0000-4000-8000-000000000006','A','42'),
       ('dd100000-0000-4000-8000-000000000006','B','43')
on conflict do nothing;

insert into public.coding_test_cases (question_id,input,expected_output,is_sample,position)
values ('dd100000-0000-4000-8000-000000000007','',E'42\n',true,1),
       ('dd100000-0000-4000-8000-000000000007',E'Ignored input\n',E'42\n',false,2)
on conflict (question_id,position) do nothing;

insert into public.mock_tests (id,company_id,title,slug,duration_minutes,status)
values ('dd100000-0000-4000-8000-000000000008','dd100000-0000-4000-8000-000000000001',
 'Staging acceptance mock','pw-staging-acceptance-mock',15,'published')
on conflict (id) do nothing;

insert into public.test_questions (test_id,question_id,question_order,marks,negative_marks)
select 'dd100000-0000-4000-8000-000000000008','dd100000-0000-4000-8000-000000000006',1,1,0
where not exists (select 1 from public.test_questions where test_id='dd100000-0000-4000-8000-000000000008');

insert into public.courses (id,company_id,mock_test_id,title,slug,status)
values ('dd100000-0000-4000-8000-000000000009','dd100000-0000-4000-8000-000000000001',
 'dd100000-0000-4000-8000-000000000008','Staging acceptance course','pw-staging-acceptance-course','published')
on conflict (id) do nothing;

insert into public.course_modules (id,course_id,title,status)
values ('dd100000-0000-4000-8000-00000000000a','dd100000-0000-4000-8000-000000000009',
 'Staging acceptance module','published')
on conflict (id) do nothing;

insert into public.lessons (id,module_id,title,slug,status)
values ('dd100000-0000-4000-8000-00000000000b','dd100000-0000-4000-8000-00000000000a',
 'Staging acceptance lesson','pw-staging-acceptance-lesson','published')
on conflict (id) do nothing;

insert into public.lesson_contents (lesson_id,body)
values ('dd100000-0000-4000-8000-00000000000b','PlacementWays staging acceptance lesson body.')
on conflict (lesson_id) do nothing;

commit;
