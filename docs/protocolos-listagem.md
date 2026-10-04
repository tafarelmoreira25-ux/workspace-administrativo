# Protocolos: deployment and validation

1. Execute supabase/20261004_protocolos_lista.sql in the project's Supabase SQL editor before deploying the frontend.
2. Deploy the frontend only after the migration succeeds. There is no full-record fallback for the listing.
3. Open Protocolos as an authenticated user and inspect the network request to protocolos_lista: select contains seven summary fields, limit=10, offset changes by ten on the next page. No clientes, documents, or history requests should occur on entry.
4. Click a row: a single processos query filtered by id loads the complete record for the modal. Edit from the modal. After saving, the summary page is refreshed.
5. Validate at least eleven eligible records, search by client/ID/bank, dashboard alert filters, and transitions between stages. Counts beside stages refer to the current page; the footer counts all matching records.

The view uses security_invoker=true, preserving the existing processos RLS policies, and grants SELECT only to authenticated users. Its partial index covers the existing eligibility filter and stable ordering. Reads use the existing short-lived Supabase GET cache; writes invalidate that cache.

Days in stage preserve the existing updated_at-based calculation, falling back to SLA/send/creation dates. Without a dedicated stage-transition timestamp this value measures days since the last record update.

Automated regression: node --test scripts/protocolos-listagem.test.mjs. Database deployment and production latency were not validated in this local session.
