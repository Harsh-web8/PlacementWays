-- Prevent new practice answers from disclosing an active mock solution.
create or replace function public.submit_practice(p_question_id uuid,p_answer text) returns uuid
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
 -- The same question may appear in practice and a timed mock. Do not reveal
 -- its solution through a new practice submission while that mock is running.
 perform pg_advisory_xact_lock(73501901);
 if exists(select 1 from public.test_attempts a join public.test_questions tq on tq.test_id=a.test_id
   where a.user_id=auth.uid() and a.status='in_progress' and now()<=a.expires_at+public.attempt_grace() and tq.question_id=q.id) then
  raise exception 'Finish your active mock before practising this question' using errcode='23514';
 end if;
 if p_answer is null or char_length(trim(p_answer)) not between 1 and 20000 then raise exception 'Answer required' using errcode='22023'; end if;
 if q.question_type='mcq' and not exists(select 1 from public.question_options where question_id=q.id and option_key=p_answer) then
  raise exception 'Invalid option' using errcode='22023';
 end if;
 insert into public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct,explanation,correct_answer)
 values(auth.uid(),q.id,q.category_id,q.difficulty,p_answer,case when q.question_type='mcq' then q.correct_answer=p_answer else null end,q.explanation,q.correct_answer)
 returning id into result;
 return result;
end $$;
