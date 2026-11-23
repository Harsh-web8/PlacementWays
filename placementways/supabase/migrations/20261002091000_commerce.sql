alter table public.site_settings add column commerce_enabled boolean not null default false;
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,
 test_id uuid references public.mock_tests(id) on delete restrict,course_id uuid references public.courses(id) on delete restrict,
 title text not null,amount integer not null check(amount>0),currency text not null default 'inr' check(currency='inr'),
 status text not null default 'pending' check(status in ('pending','paid','refund_pending','refunded')),
 provider_session_id text unique,payment_intent text unique,
 created_at timestamptz not null default now(),paid_at timestamptz,refunded_at timestamptz,
 check(num_nonnulls(test_id,course_id)=1)
);
create index orders_user on public.purchase_orders(user_id,created_at desc);
create table public.payment_events (id text primary key check(char_length(id) between 1 and 200),order_id uuid not null references public.purchase_orders(id),action text not null,created_at timestamptz not null default now());
alter table public.purchase_orders enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.purchase_orders,public.payment_events from anon,authenticated;
grant select on public.purchase_orders,public.payment_events to authenticated;
create policy orders_own on public.purchase_orders for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and is_active));
create policy orders_admin on public.purchase_orders for select to authenticated using(public.is_admin());
create policy events_admin on public.payment_events for select to authenticated using(public.is_admin());
alter table public.content_entitlements add column order_id uuid unique references public.purchase_orders(id) on delete restrict;
drop index public.entitlement_test;
drop index public.entitlement_course;
create unique index entitlement_test on public.content_entitlements(user_id,test_id) where test_id is not null and order_id is null;
create unique index entitlement_course on public.content_entitlements(user_id,course_id) where course_id is not null and order_id is null;
-- Existing admin grants remain independent of purchases/refunds.
create function public.create_purchase_order(p_kind text,p_content_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare price integer;title text;tid uuid;cid uuid;o public.purchase_orders;
begin
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 if not found then raise exception 'Active account required' using errcode='42501'; end if;
 if not exists(select 1 from public.site_settings where id=true and commerce_enabled) then raise exception 'Purchases are not enabled' using errcode='23514'; end if;
 if p_kind='test' then
  select price_paise,t.title,id into price,title,tid from public.mock_tests t where id=p_content_id and status='published' and not is_free and (company_id is null or exists(select 1 from public.companies where id=t.company_id and status='published'));
 elsif p_kind='course' then
  select price_paise,c.title,id into price,title,cid from public.courses c where id=p_content_id and status='published' and not is_free and (company_id is null or exists(select 1 from public.companies where id=c.company_id and status='published'));
 else raise exception 'Invalid content type' using errcode='22023'; end if;
 if price is null or price<=0 then raise exception 'Content is not available for purchase' using errcode='23514'; end if;
 if public.has_content_access(tid,cid) then raise exception 'You already have access to this content' using errcode='23514'; end if;
 select * into o from public.purchase_orders where user_id=auth.uid() and status='pending' and amount=price
 and (test_id=tid or course_id=cid) and created_at>now()-interval '30 minutes' order by created_at desc limit 1;
 if found then return to_jsonb(o); end if;
 if (select count(*) from public.purchase_orders where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before creating another checkout' using errcode='23514'; end if;
 insert into public.purchase_orders(user_id,test_id,course_id,title,amount) values(auth.uid(),tid,cid,title,price) returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.create_purchase_order(text,uuid) from public,anon;
grant execute on function public.create_purchase_order(text,uuid) to authenticated;
create function public.attach_checkout_session(p_order_id uuid,p_session_id text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_session_id is null or p_session_id !~ '^cs_[a-zA-Z0-9_]+$' then raise exception 'Invalid checkout'; end if;
 update public.purchase_orders set provider_session_id=p_session_id where id=p_order_id and status='pending' and (provider_session_id is null or provider_session_id=p_session_id);
 return found;
end $$;
create function public.apply_payment_event(p_event_id text,p_action text,p_session_id text,p_payment_intent text,p_amount integer,p_currency text) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.purchase_orders;
begin
 if exists(select 1 from public.payment_events where id=p_event_id) then return true; end if;
 if p_action='pay' then select * into o from public.purchase_orders where provider_session_id=p_session_id for update;
 else select * into o from public.purchase_orders where payment_intent=p_payment_intent for update; end if;
 if not found then return false; end if;
 if exists(select 1 from public.payment_events where id=p_event_id) then return true; end if;
 if p_amount is null or p_currency is distinct from o.currency or p_amount<>o.amount or p_payment_intent is null or p_payment_intent !~ '^pi_[a-zA-Z0-9_]+$' then raise exception 'Payment does not match order' using errcode='23514'; end if;
 if p_action='pay' then
  if o.payment_intent is not null and o.payment_intent<>p_payment_intent then raise exception 'Payment conflict'; end if;
  if o.status='pending' then
   update public.purchase_orders set status='paid',paid_at=now(),payment_intent=p_payment_intent where id=o.id;
   if o.user_id is not null then
    insert into public.content_entitlements(user_id,test_id,course_id,order_id) values(o.user_id,o.test_id,o.course_id,o.id) on conflict(order_id) do nothing;
   end if;
  end if;
 elsif p_action='refund' then
  update public.purchase_orders set status='refunded',refunded_at=now() where id=o.id and status in ('paid','refund_pending');
  delete from public.content_entitlements where order_id=o.id;
 elsif p_action='refund_failed' then
  update public.purchase_orders set status='paid' where id=o.id and status='refund_pending';
 else raise exception 'Invalid payment action'; end if;
 insert into public.payment_events(id,order_id,action) values(p_event_id,o.id,p_action);
 return true;
end $$;
create function public.request_order_refund(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.purchase_orders;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into o from public.purchase_orders where id=p_order_id for update;
 if not found or o.status not in ('paid','refund_pending') then raise exception 'Order cannot be refunded' using errcode='23514'; end if;
 update public.purchase_orders set status='refund_pending' where id=o.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'order.refund.request','purchase_order',o.id);
 return to_jsonb(o);
end $$;
revoke all on function public.attach_checkout_session(uuid,text),public.apply_payment_event(text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.attach_checkout_session(uuid,text),public.apply_payment_event(text,text,text,text,integer,text) to service_role;
revoke all on function public.request_order_refund(uuid) from public,anon;
grant execute on function public.request_order_refund(uuid) to authenticated;
