begin;
-- Feature catalog only. Existing grants, records and policies remain untouched.
insert into public.permissions(id,module,action,description) values
 ('exports.view','exports','view','Access central data export'),
 ('accounts.export','accounts','export','Export authorized Account records'),
 ('contacts.export','contacts','export','Export authorized Contact records'),
 ('opportunities.export','opportunities','export','Export authorized Opportunity records')
on conflict(id) do nothing;
commit;
