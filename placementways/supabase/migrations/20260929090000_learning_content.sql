-- Additive learning architecture. Existing question bank and categories are reused.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  mock_test_id uuid references public.mock_tests(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 10000),
  thumbnail_url text check (thumbnail_url ~ '^https://'),
  difficulty public.difficulty_level not null default 'easy',
  status public.content_status not null default 'draft',
  is_free boolean not null default true,
  price_paise integer not null default 0 check (price_paise between 0 and 100000000),
  currency text not null default 'INR' check (currency = 'INR'),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_price_consistent check ((is_free and price_paise = 0) or (not is_free and price_paise > 0))
);
create index courses_listing_idx on public.courses(status, company_id, created_at desc);
create index courses_category_idx on public.courses(category_id);
create index courses_mock_idx on public.courses(mock_test_id);
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  sort_order integer not null default 0 check (sort_order >= 0),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modules_course_idx on public.course_modules(course_id, sort_order, id);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 600),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_free boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id, slug)
);
create index lessons_module_idx on public.lessons(module_id, sort_order, id);
create index lessons_topic_idx on public.lessons(category_id);
-- Sensitive body and resource URLs are separate from the public syllabus.
create table public.lesson_contents (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 100000),
  video_url text check (video_url ~ '^https://'),
  resource_url text check (resource_url ~ '^https://'),
  updated_at timestamptz not null default now()
);
create table public.lesson_questions (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  primary key(lesson_id, question_id)
);
create index lesson_questions_question_idx on public.lesson_questions(question_id);
create table public.course_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  started_at timestamptz not null default now(),
  primary key(user_id, course_id)
);
create index course_progress_course_idx on public.course_progress(course_id);
create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  completed_at timestamptz not null default now(),
  primary key(user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

create function public.can_read_lesson(p_lesson_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.lessons l
  join public.course_modules m on m.id = l.module_id
  join public.courses c on c.id = m.course_id
  where l.id = p_lesson_id and l.status = 'published'
    and m.status = 'published' and c.status = 'published'
    and (c.company_id is null or exists(select 1 from public.companies co where co.id=c.company_id and co.status='published'))
    and (c.is_free or l.is_free)
 );
$$;
revoke all on function public.can_read_lesson(uuid) from public;
grant execute on function public.can_read_lesson(uuid) to anon, authenticated;

do $$ declare tbl text; begin
 foreach tbl in array array['courses','course_modules','lessons','lesson_contents','lesson_questions','course_progress','lesson_progress'] loop
  execute format('alter table public.%I enable row level security', tbl);
  execute format('revoke all on public.%I from anon, authenticated', tbl);
 end loop;
 foreach tbl in array array['courses','course_modules','lessons','lesson_contents','lesson_questions'] loop
  execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',tbl||'_admin',tbl);
 end loop;
 foreach tbl in array array['courses','course_modules','lessons','lesson_contents'] loop
  execute format('grant select on public.%I to anon',tbl);
  execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',tbl||'_updated',tbl);
 end loop;
end $$;
create policy courses_public on public.courses for select using (
 status='published' and (company_id is null or exists(select 1 from public.companies c where c.id=company_id and c.status='published'))
);
create policy modules_public on public.course_modules for select using (
 status='published' and exists(select 1 from public.courses c where c.id=course_id and c.status='published')
);
create policy lessons_public on public.lessons for select using (
 status='published' and exists(select 1 from public.course_modules m where m.id=module_id and m.status='published')
);
create policy contents_public on public.lesson_contents for select using (public.can_read_lesson(lesson_id));
grant select on public.course_progress, public.lesson_progress to authenticated;
create policy course_progress_own on public.course_progress for select to authenticated using (user_id=(select auth.uid()));
create policy lesson_progress_own on public.lesson_progress for select to authenticated using (user_id=(select auth.uid()));

-- Enrollment and completion derive identity and timestamps on the server.
create function public.start_course(p_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Active account required' using errcode='42501';
 end if;
 if not exists(select 1 from public.courses c where id=p_course_id and status='published' and is_free
   and (c.company_id is null or exists(select 1 from public.companies co where co.id=c.company_id and co.status='published'))) then
  raise exception 'Course unavailable or locked' using errcode='42501';
 end if;
 insert into public.course_progress(user_id,course_id) values(auth.uid(),p_course_id) on conflict do nothing;
end $$;
create function public.complete_lesson(p_lesson_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) or not public.can_read_lesson(p_lesson_id) then
  raise exception 'Lesson unavailable or locked' using errcode='42501';
 end if;
 insert into public.course_progress(user_id,course_id)
 select auth.uid(),m.course_id from public.lessons l join public.course_modules m on m.id=l.module_id where l.id=p_lesson_id
 on conflict do nothing;
 insert into public.lesson_progress(user_id,lesson_id) values(auth.uid(),p_lesson_id) on conflict do nothing;
end $$;
revoke all on function public.start_course(uuid), public.complete_lesson(uuid) from public;
grant execute on function public.start_course(uuid), public.complete_lesson(uuid) to authenticated;

-- Atomic lesson/body saving: an invalid resource cannot leave a half-saved lesson.
create function public.admin_save_lesson(p_id uuid, p_metadata jsonb, p_content jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := coalesce(p_id,gen_random_uuid());
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_id is not null and not exists(select 1 from public.lessons where id=p_id) then
  raise exception 'Lesson not found' using errcode='P0002';
 end if;
 insert into public.lessons(id,module_id,category_id,title,slug,duration_minutes,sort_order,is_free,status)
 values(v_id,(p_metadata->>'module_id')::uuid,(p_metadata->>'category_id')::uuid,p_metadata->>'title',p_metadata->>'slug',
 (p_metadata->>'duration_minutes')::int,(p_metadata->>'sort_order')::int,(p_metadata->>'is_free')::boolean,(p_metadata->>'status')::public.content_status)
 on conflict(id) do update set module_id=excluded.module_id,category_id=excluded.category_id,title=excluded.title,slug=excluded.slug,
 duration_minutes=excluded.duration_minutes,sort_order=excluded.sort_order,is_free=excluded.is_free,status=excluded.status;
 insert into public.lesson_contents(lesson_id,body,video_url,resource_url)
 values(v_id,p_content->>'body',p_content->>'video_url',p_content->>'resource_url')
 on conflict(lesson_id) do update set body=excluded.body,video_url=excluded.video_url,resource_url=excluded.resource_url;
 return v_id;
end $$;
revoke all on function public.admin_save_lesson(uuid,jsonb,jsonb) from public;
grant execute on function public.admin_save_lesson(uuid,jsonb,jsonb) to authenticated;
