begin;

create table public.app_growth_settings (
  id boolean primary key default true check (id),
  discovery_enabled boolean not null default true,
  sending_enabled boolean not null default false,
  daily_cap integer not null default 20 check (daily_cap between 0 and 20)
);
insert into public.app_growth_settings(id) values (true);

create table public.app_growth_campaigns (
  app_key text primary key check (app_key in ('fmc','musclemap','rera')),
  enabled boolean not null default true,
  sender_ready boolean not null default false,
  replies_ready boolean not null default false,
  replies_last_checked_at timestamptz,
  daily_cap integer not null default 10 check (daily_cap between 0 and 10),
  time_zone text not null default 'Europe/London',
  window_start integer not null default 9 check (window_start between 0 and 23),
  window_end integer not null default 17 check (window_end between 1 and 24),
  send_weekdays integer[] not null default array[1,2,3,4,5],
  discovery_cursor integer not null default 0,
  discovery_last_at timestamptz,
  check (window_end > window_start)
);
insert into public.app_growth_campaigns(app_key,time_zone) values
 ('fmc','Europe/London'),('musclemap','Europe/London'),('rera','Asia/Dubai');

-- Only established identity equivalences are collapsed; never guess that two
-- unrelated addresses are the same person. Source-system person_key adds linkage.
create function public.app_growth_email_identity(p_email text) returns text
language sql immutable strict security invoker set search_path = '' as $$
  select case when split_part(lower(btrim(p_email)),'@',2) in ('gmail.com','googlemail.com')
    then replace(split_part(split_part(lower(btrim(p_email)),'@',1),'+',1),'.','') || '@gmail.com'
    else lower(btrim(p_email)) end;
$$;

create table public.app_growth_leads (
  lead_id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' and length(email) <= 254),
  email_identity text generated always as (public.app_growth_email_identity(email)) stored unique,
  person_key text unique check (person_key is null or length(btrim(person_key)) between 1 and 250),
  first_name text not null default '',
  app_key text not null references public.app_growth_campaigns(app_key),
  audience text not null,
  ios_interest boolean not null default false,
  permission_state text not null default 'pending' check (permission_state in ('pending','opted_in','withdrawn')),
  consent_app_key text,
  consent_source text,
  consent_text text,
  consent_at timestamptz,
  email_verified_at timestamptz,
  status text not null default 'active' check (status in ('active','replied','converted','suppressed')),
  stop_reason text,
  converted_at timestamptz,
  conversion_source text,
  created_at timestamptz not null default now(),
  unique (lead_id,app_key),
  check ((app_key='fmc' and audience='personal_trainer') or
         (app_key='musclemap' and audience='gym_user') or
         (app_key='rera' and audience='dubai_exam_candidate')),
  check (permission_state <> 'opted_in' or
    (consent_app_key is not null and consent_app_key=app_key and consent_at is not null
     and length(btrim(consent_source)) >= 10 and consent_source is not null
     and length(btrim(consent_text)) >= 10 and consent_text is not null))
);
create index app_growth_leads_queue on public.app_growth_leads(app_key,created_at) where status='active';

create function public.app_growth_keep_assignment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.app_key is distinct from old.app_key or new.email is distinct from old.email
     or new.person_key is distinct from old.person_key then
    raise exception 'App and recipient identity cannot be reassigned';
  end if;
  if old.status <> 'active' and new.status='active' then raise exception 'Stopped recipients cannot be re-enrolled'; end if;
  if old.permission_state='withdrawn' and new.permission_state <> 'withdrawn' then raise exception 'Withdrawn permission cannot be reset'; end if;
  return new;
end;
$$;
create trigger app_growth_keep_assignment before update on public.app_growth_leads
for each row execute function public.app_growth_keep_assignment();

create table public.app_growth_messages (
  message_id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  app_key text not null,
  sequence_step integer not null check (sequence_step in (1,2)),
  status text not null default 'reserved' check (status in ('reserved','sending','sent','delivered','bounced','complained','uncertain','cancelled')),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  payload jsonb,
  provider_message_id text unique,
  error text,
  reserved_at timestamptz not null default now(),
  sent_at timestamptz,
  event_at timestamptz,
  unique (lead_id,sequence_step),
  foreign key (lead_id,app_key) references public.app_growth_leads(lead_id,app_key)
);
create index app_growth_messages_daily on public.app_growth_messages(reserved_at,app_key);

create table public.app_growth_opportunities (
  opportunity_id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  app_key text not null references public.app_growth_campaigns(app_key),
  name text not null,
  website text,
  source_url text,
  source_query text not null,
  source_attributions jsonb not null default '[]',
  note text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index app_growth_opportunities_app on public.app_growth_opportunities(app_key,observed_at desc);

create table public.app_growth_runs (
  run_id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('discovery','outreach','import','reply','conversion')),
  created_at timestamptz not null default now(),
  detail jsonb not null default '{}'
);

create table public.app_growth_reply_events (
  event_key text primary key,
  lead_id uuid not null references public.app_growth_leads(lead_id),
  classification text not null,
  subject text,
  body text,
  received_at timestamptz not null
);

create function public.app_growth_blockers(p_lead_id uuid) returns table(blocker text)
language sql stable security invoker set search_path = '' as $$
 with l as (select * from public.app_growth_leads where lead_id=p_lead_id),
 c as (select c.*, now() at time zone c.time_zone as local_now from public.app_growth_campaigns c join l using(app_key))
 select 'engine_not_active' where not exists(select 1 from public.app_config where key='LEAD_ENGINE_MODE' and value='ios_apps')
 union all select 'legacy_outreach_not_paused' where not exists(select 1 from public.app_config where key='OUTREACH_ENABLED' and value='false')
 union all select 'sending_paused' where not exists(select 1 from public.app_growth_settings where id and sending_enabled)
 union all select 'recipient_missing' where not exists(select 1 from l)
 union all select 'campaign_paused' where not exists(select 1 from c where enabled)
 union all select 'sender_not_verified' from c where not sender_ready
 union all select 'reply_monitor_not_ready' from c where not replies_ready
 union all select 'reply_monitor_stale' from c where replies_last_checked_at is null or replies_last_checked_at<now()-interval '2 hours'
 union all select 'outside_send_window' from c where not (extract(isodow from local_now)::integer=any(send_weekdays)
    and extract(hour from local_now)>=window_start and extract(hour from local_now)<window_end)
 union all select 'recipient_stopped' from l where status<>'active'
 union all select 'ios_interest_missing' from l where not ios_interest
 union all select 'app_permission_missing' from l where permission_state<>'opted_in' or consent_app_key is distinct from app_key
    or consent_at is null or consent_at>now() or consent_source is null or consent_text is null
 union all select 'email_not_verified' from l where email_verified_at is null or email_verified_at>now() or email_verified_at<now()-interval '180 days'
 union all select 'suppressed' from l where exists(select 1 from public.suppression s
    where public.app_growth_email_identity(s.email)=l.email_identity
    or (s.email_domain is not null and (split_part(l.email,'@',2)=lower(btrim(s.email_domain))
      or split_part(l.email,'@',2) like '%.'||lower(btrim(s.email_domain)))))
 union all select 'existing_contact_stopped' from l where exists(select 1 from public.contacts ct left join public.companies co using(company_id)
    where public.app_growth_email_identity(ct.email)=l.email_identity and
    (ct.objected or ct.hard_bounced or co.is_customer or co.pipeline_status::text in
     ('DO_NOT_CONTACT','POSITIVE_REPLY','ASSESSMENT_REQUIRED','PROPOSAL_DRAFT','PROPOSAL_SENT','NEGOTIATION','WON','INSTALLATION_BOOKED','INSTALLED','MONITORING_CUSTOMER')))
 union all select 'existing_reply' from l where exists(select 1 from public.replies r
    where public.app_growth_email_identity(r.from_email)=l.email_identity and r.classification::text<>'OUT_OF_OFFICE')
 union all select 'recent_other_outreach' from l where exists(select 1 from public.contacts ct join public.outreach o using(contact_id)
    where public.app_growth_email_identity(ct.email)=l.email_identity and o.sent_at>now()-interval '30 days')
 union all select 'bounce_circuit' where (
   select count(*)>=10 and count(*) filter(where status in ('bounced','complained'))::numeric / nullif(count(*),0)>=0.04
   from public.app_growth_messages where reserved_at>now()-interval '14 days' and status in ('sent','delivered','bounced','complained'));
$$;

create function public.app_growth_due_step(p_lead_id uuid) returns integer
language sql stable security invoker set search_path = '' as $$
 select case
   when not exists(select 1 from public.app_growth_messages where lead_id=p_lead_id) then 1
   when exists(select 1 from public.app_growth_messages where lead_id=p_lead_id and sequence_step=1
        and status in ('sent','delivered') and sent_at<=now()-interval '5 days')
    and not exists(select 1 from public.app_growth_messages where lead_id=p_lead_id and sequence_step=2) then 2
   else null end;
$$;

create function public.app_growth_claim(p_app_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare cfg public.app_growth_settings; campaign public.app_growth_campaigns; candidate public.app_growth_leads;
 msg public.app_growth_messages; today timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 select * into cfg from public.app_growth_settings where id for update;
 if not found or not cfg.sending_enabled then return null; end if;
 select * into campaign from public.app_growth_campaigns where app_key=p_app_key;
 if not found then return null; end if;
 if (select count(*) from public.app_growth_messages where reserved_at>=today)
    +(select count(*) from public.outreach where sent_at>=today) >= cfg.daily_cap then return null; end if;
 if (select count(*) from public.app_growth_messages where app_key=p_app_key and reserved_at>=today)>=campaign.daily_cap then return null; end if;
 select * into candidate from public.app_growth_leads l where l.app_key=p_app_key and l.status='active'
   and public.app_growth_due_step(l.lead_id) is not null
   and not exists(select 1 from public.app_growth_blockers(l.lead_id))
   order by public.app_growth_due_step(l.lead_id) desc,l.created_at,l.lead_id limit 1 for update;
 if not found then return null; end if;
 insert into public.app_growth_messages(lead_id,app_key,sequence_step)
 values(candidate.lead_id,candidate.app_key,public.app_growth_due_step(candidate.lead_id)) returning * into msg;
 return to_jsonb(msg);
end;
$$;

create function public.app_growth_begin_send(p_message_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare msg public.app_growth_messages;
begin
 perform 1 from public.app_growth_settings where id for update;
 select * into msg from public.app_growth_messages where message_id=p_message_id for update;
 if not found or msg.status<>'reserved' or msg.payload is null then return false; end if;
 if msg.reserved_at < now()-interval '5 minutes' or exists(select 1 from public.app_growth_blockers(msg.lead_id)) then
   update public.app_growth_messages set status='cancelled',error='Send gate blocked' where message_id=p_message_id;
   return false;
 end if;
 update public.app_growth_messages set status='sending' where message_id=p_message_id;
 return true;
end;
$$;

create function public.app_growth_record_sent(p_message_id uuid,p_provider_id text) returns void
language sql security invoker set search_path = '' as $$
 update public.app_growth_messages set provider_message_id=p_provider_id,sent_at=coalesce(sent_at,now()),
   status=case when status in ('sending','uncertain') then 'sent' else status end
 where message_id=p_message_id and (provider_message_id is null or provider_message_id=p_provider_id);
$$;

create function public.app_growth_stop(p_lead_id uuid,p_reason text,p_suppress boolean default false) returns void
language plpgsql security invoker set search_path = '' as $$
declare recipient public.app_growth_leads;
begin
 perform 1 from public.app_growth_settings where id for update;
 select * into recipient from public.app_growth_leads where lead_id=p_lead_id for update;
 if not found then return; end if;
 update public.app_growth_leads set status=case when p_suppress then 'suppressed' when status='active' then 'replied' else status end,
   permission_state=case when p_suppress then 'withdrawn' else permission_state end,stop_reason=p_reason where lead_id=p_lead_id;
 update public.app_growth_messages set status='cancelled',error=p_reason where lead_id=p_lead_id and status='reserved';
 if p_suppress then
   insert into public.suppression(email,reason,source,permanent)
   select recipient.email,p_reason,'app_growth',true where not exists
     (select 1 from public.suppression where public.app_growth_email_identity(email)=recipient.email_identity);
   update public.contacts set objected=true where public.app_growth_email_identity(email)=recipient.email_identity;
 end if;
end;
$$;

create function public.app_growth_unsubscribe(p_token uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare recipient_id uuid;
begin
 select lead_id into recipient_id from public.app_growth_messages where unsubscribe_token=p_token;
 if not found then return false; end if;
 perform public.app_growth_stop(recipient_id,'Unsubscribed',true);
 return true;
end;
$$;

create function public.app_growth_claim_discovery(p_app_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare c public.app_growth_campaigns;
begin
 perform 1 from public.app_growth_settings where id for update;
 if not exists(select 1 from public.app_growth_settings where id and discovery_enabled) then return null; end if;
 select * into c from public.app_growth_campaigns where app_key=p_app_key and enabled for update;
 if not found or c.discovery_last_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' then return null; end if;
 update public.app_growth_campaigns set discovery_cursor=discovery_cursor+1,discovery_last_at=now() where app_key=p_app_key;
 return jsonb_build_object('cursor',c.discovery_cursor);
end;
$$;

create function public.app_growth_receive_reply(p_lead_id uuid,p_event_key text,p_classification text,p_subject text,p_body text,p_received_at timestamptz) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 insert into public.app_growth_reply_events(event_key,lead_id,classification,subject,body,received_at)
 values(p_event_key,p_lead_id,p_classification,left(p_subject,500),left(p_body,20000),p_received_at) on conflict do nothing;
 if not found then return false; end if;
 if p_classification <> 'OUT_OF_OFFICE' then
   perform public.app_growth_stop(p_lead_id,'Email reply: '||p_classification,p_classification in ('UNSUBSCRIBE','NEGATIVE','BOUNCE'));
 end if;
 return true;
end;
$$;

create function public.app_growth_delivery_event(p_message_id uuid,p_provider_id text,p_type text,p_event_at timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
declare msg public.app_growth_messages;
begin
 perform 1 from public.app_growth_settings where id for update;
 select * into msg from public.app_growth_messages where message_id=p_message_id for update;
 if not found then raise exception 'Unknown app message'; end if;
 if msg.provider_message_id is not null and msg.provider_message_id<>p_provider_id then raise exception 'Provider mismatch'; end if;
 if p_type in ('email.bounced','email.complained','email.suppressed','email.failed') then
   perform public.app_growth_stop(msg.lead_id,p_type,true);
   update public.app_growth_messages set status=case when p_type='email.complained' then 'complained' else 'bounced' end,
     provider_message_id=p_provider_id,event_at=p_event_at where message_id=p_message_id;
 elsif p_type='email.delivered' and msg.status not in ('bounced','complained','cancelled') then
   update public.app_growth_messages set status='delivered',provider_message_id=p_provider_id,
     sent_at=coalesce(sent_at,p_event_at),event_at=p_event_at where message_id=p_message_id;
 elsif p_type='email.sent' and msg.status in ('sending','uncertain') then
   perform public.app_growth_record_sent(p_message_id,p_provider_id);
 end if;
end;
$$;

create function public.app_growth_conversion(p_app_key text,p_email text,p_source text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare recipient_id uuid;
begin
 perform 1 from public.app_growth_settings where id for update;
 select lead_id into recipient_id from public.app_growth_leads where app_key=p_app_key
   and email_identity=public.app_growth_email_identity(p_email) for update;
 if not found then return false; end if;
 perform public.app_growth_stop(recipient_id,'Known app customer',false);
 update public.app_growth_leads set status=case when status='suppressed' then status else 'converted' end,
   converted_at=coalesce(converted_at,now()),conversion_source=p_source where lead_id=recipient_id;
 return true;
end;
$$;

-- Private server-side access only, including functions exposed by PostgREST.
alter table public.app_growth_settings enable row level security;
alter table public.app_growth_campaigns enable row level security;
alter table public.app_growth_leads enable row level security;
alter table public.app_growth_messages enable row level security;
alter table public.app_growth_opportunities enable row level security;
alter table public.app_growth_runs enable row level security;
alter table public.app_growth_reply_events enable row level security;
revoke all on table public.app_growth_settings,public.app_growth_campaigns,public.app_growth_leads,
 public.app_growth_messages,public.app_growth_opportunities,public.app_growth_runs,public.app_growth_reply_events from public,anon,authenticated;
grant select,insert,update on table public.app_growth_settings,public.app_growth_campaigns,public.app_growth_leads,
 public.app_growth_messages,public.app_growth_opportunities,public.app_growth_runs,public.app_growth_reply_events to service_role;
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'app_growth_%' loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

-- Pause the former campaign atomically with installation. Preserve its history.
update public.app_config set value='false' where key in ('OUTREACH_ENABLED','DISCOVERY_ENABLED');
insert into public.app_config(key,value,description,is_secret) values
 ('LEAD_ENGINE_MODE','ios_apps','App-specific acquisition replaces backup outreach',false)
 on conflict(key) do update set value=excluded.value;
update public.campaigns set active=false where active;

notify pgrst,'reload schema';
commit;
