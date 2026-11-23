-- Published practice exposes only prompts. Answers stay in the admin-only bank.
alter table public.questions add column slug text not null default ('question-' || gen_random_uuid()::text);
alter table public.questions add constraint questions_slug_key unique(slug);
alter table public.questions add constraint questions_slug_format check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.questions add column is_practice boolean not null default false;
create view public.practice_questions with (security_invoker=false) as
select q.id,q.slug,q.question_text,q.question_type,q.difficulty,q.category_id,c.name category_name,c.parent_id subject_id
from public.questions q join public.categories c on c.id=q.category_id
where q.status='published' and q.is_practice;
grant select on public.practice_questions to anon, authenticated;

create table public.practice_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 category_id uuid not null references public.categories(id) on delete restrict,
 difficulty public.difficulty_level not null,
 selected_answer text not null check(char_length(selected_answer) between 1 and 20000),
 is_correct boolean,
 explanation text,
 correct_answer text,
 created_at timestamptz not null default now()
);
create index practice_attempts_user_idx on public.practice_attempts(user_id,created_at desc);
create index practice_attempts_question_idx on public.practice_attempts(question_id);
create index practice_attempts_topic_idx on public.practice_attempts(user_id,category_id);
alter table public.practice_attempts enable row level security;
grant select on public.practice_attempts to authenticated;
create policy practice_own on public.practice_attempts for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and is_active));

create function public.get_practice_question(p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',q.id,'slug',q.slug,'text',q.question_text,'type',q.question_type,
  'difficulty',q.difficulty,'category_id',q.category_id,'category_name',c.name,
  'options',(select coalesce(jsonb_agg(jsonb_build_object('key',o.option_key,'text',o.option_text) order by o.option_key),'[]'::jsonb)
             from public.question_options o where o.question_id=q.id))
 from public.questions q join public.categories c on c.id=q.category_id
 where q.slug=p_slug and q.status='published' and q.is_practice;
$$;
revoke all on function public.get_practice_question(text) from public;
grant execute on function public.get_practice_question(text) to anon,authenticated;

create function public.submit_practice(p_question_id uuid,p_answer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.questions; result uuid;
begin
 -- Lock the profile to serialize the per-account rate check.
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 if not found then raise exception 'Active account required' using errcode='42501'; end if;
 if (select count(*) from public.practice_attempts where user_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then
  raise exception 'Please wait a minute before another submission' using errcode='P0001';
 end if;
 select * into q from public.questions where id=p_question_id and status='published' and is_practice;
 if not found then raise exception 'Practice unavailable' using errcode='42501'; end if;
 if p_answer is null or char_length(trim(p_answer)) not between 1 and 20000 then raise exception 'Answer required' using errcode='22023'; end if;
 if q.question_type='mcq' and not exists(select 1 from public.question_options where question_id=q.id and option_key=p_answer) then
  raise exception 'Invalid option' using errcode='22023';
 end if;
 insert into public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct,explanation,correct_answer)
 values(auth.uid(),q.id,q.category_id,q.difficulty,p_answer,case when q.question_type='mcq' then q.correct_answer=p_answer else null end,q.explanation,q.correct_answer)
 returning id into result;
 return result;
end $$;
revoke all on function public.submit_practice(uuid,text) from public;
grant execute on function public.submit_practice(uuid,text) to authenticated;

grant select on public.lesson_questions to anon;
create policy lesson_questions_access on public.lesson_questions for select to anon,authenticated using(public.can_read_lesson(lesson_id));
create function public.assign_lesson_question(p_lesson_id uuid,p_question_id uuid,p_remove boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_remove then
  delete from public.lesson_questions where lesson_id=p_lesson_id and question_id=p_question_id;
 else
  if not exists(select 1 from public.questions where id=p_question_id and status='published' and is_practice) then
   raise exception 'Choose a published practice question' using errcode='22023';
  end if;
  insert into public.lesson_questions values(p_lesson_id,p_question_id) on conflict do nothing;
 end if;
end $$;
revoke all on function public.assign_lesson_question(uuid,uuid,boolean) from public;
grant execute on function public.assign_lesson_question(uuid,uuid,boolean) to authenticated;

create table public.blog_posts (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 200),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text not null default '' check(char_length(description)<=500),
 body text not null default '' check(char_length(body)<=100000),
 status public.content_status not null default 'draft',
 seo_title text check(char_length(seo_title)<=70),seo_description text check(char_length(seo_description)<=200),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index blog_listing_idx on public.blog_posts(status,created_at desc);
alter table public.blog_posts enable row level security;
grant select on public.blog_posts to anon,authenticated;
grant insert,update,delete on public.blog_posts to authenticated;
create policy blog_public on public.blog_posts for select using(status='published');
create policy blog_admin on public.blog_posts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create trigger blog_updated before update on public.blog_posts for each row execute function public.set_updated_at();

create table public.site_settings (
 id boolean primary key default true check(id),
 support_email text not null default '' check(char_length(support_email)<=254),
 announcement text not null default '' check(char_length(announcement)<=500),
 updated_at timestamptz not null default now()
);
insert into public.site_settings(id) values(true);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon,authenticated;
grant update on public.site_settings to authenticated;
create policy settings_read on public.site_settings for select using(true);
create policy settings_admin on public.site_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create trigger settings_updated before update on public.site_settings for each row execute function public.set_updated_at();

create function public.admin_set_student_active(p_user_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 update public.profiles set is_active=p_active where id=p_user_id and role='student';
 if not found then raise exception 'Student not found' using errcode='P0002'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'student.access','profile',p_user_id,jsonb_build_object('is_active',p_active));
end $$;
revoke all on function public.admin_set_student_active(uuid,boolean) from public;
grant execute on function public.admin_set_student_active(uuid,boolean) to authenticated;

-- Explicit grants also override Supabase default privileges.
revoke all on public.practice_attempts from anon,authenticated;
grant select on public.practice_attempts to authenticated;
revoke all on public.blog_posts from anon,authenticated;
grant select on public.blog_posts to anon,authenticated;
grant insert,update,delete on public.blog_posts to authenticated;
revoke all on public.site_settings from anon,authenticated;
grant select on public.site_settings to anon,authenticated;
grant update on public.site_settings to authenticated;
revoke all on function public.submit_practice(uuid,text),public.assign_lesson_question(uuid,uuid,boolean),public.admin_set_student_active(uuid,boolean) from anon;
