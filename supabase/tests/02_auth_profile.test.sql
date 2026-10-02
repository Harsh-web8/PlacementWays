-- Signup trigger: every account becomes a student, whatever the client sends.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'Student.One@Example.com',
     '{"name":"  Asha Rao  ","role":"admin","is_admin":true}'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com',
     jsonb_build_object('name', repeat('x', 300))),
  ('33333333-3333-3333-3333-333333333333', 'three@example.com', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'four@example.com',
     '{"full_name":"Google Name","app_role":"admin"}');

do $$
begin
  perform t.eq((select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
               'student', 'malicious metadata role=admin is ignored');
  perform t.eq((select name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
               'Asha Rao', 'name is trimmed');
  perform t.eq((select email from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
               'student.one@example.com', 'email is lower-cased');
  perform t.eq((select char_length(name) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
               100, 'over-long name is truncated to 100');
  perform t.eq((select name from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
               'three', 'name falls back to email local-part');
  perform t.eq((select name from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
               'Google Name', 'full_name (OAuth) is used when name missing');
  perform t.eq((select count(*)::int from public.profiles where role = 'admin'),
               0, 'no signup can produce an admin');
  perform t.eq((select is_active from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
               true, 'new accounts are active');
end $$;

-- Email change is mirrored.
update auth.users set email = 'New.Address@Example.com' where id = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform t.eq((select email from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
               'new.address@example.com', 'email change is synced (lower-cased)');
end $$;

-- updated_at trigger: a caller cannot back-date or fake it.
update public.profiles set updated_at = '2000-01-01', college = 'X'
 where id = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform t.eq((select updated_at = now() from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
               true, 'updated_at is set by the trigger, not the caller');
end $$;

-- Constraints.
select t.throws($$update public.profiles set graduation_year = 1990 where id = '33333333-3333-3333-3333-333333333333'$$, '23514', 'graduation_year range');
select t.throws($$update public.profiles set email = 'UPPER@X.COM' where id = '33333333-3333-3333-3333-333333333333'$$, '23514', 'email must be lower-case');
select t.throws($$insert into auth.users (email) values ('THREE@example.com'), ('three@example.com')$$, '23505', 'duplicate auth email rejected');

-- Deleting the auth user removes the profile.
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  perform t.eq((select count(*)::int from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
               0, 'deleting auth user cascades to profile');
end $$;

rollback;
