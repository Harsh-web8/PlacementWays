alter table public.lesson_contents add column private_resource_path text;
alter table public.lesson_contents add constraint resource_path_scoped check(private_resource_path is null or private_resource_path ~ ('^lessons/' || lesson_id::text || '/[a-f0-9-]{36}\.pdf$'));
-- Supabase Storage is absent in the plain PostgreSQL harness. In Supabase, create
-- a private bucket with no public object policy. Only the server service role uploads/signs.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  execute $q$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   values('learning-resources','learning-resources',false,10485760,array['application/pdf'])
   on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf']$q$;
 end if;
end $$;
