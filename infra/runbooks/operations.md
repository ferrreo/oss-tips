# Operations runbooks

Record incident start time, owner, and commands run in the incident log. Do
not paste credentials or customer payloads into that log.

## Postgres outage

Use when `/readyz` returns `503`, database connections time out, or provider
alerts show failover or storage trouble.

1. Check process and database signals:

   ```bash
   curl -fsS -i "$PUBLIC_APP_URL/healthz"
   curl -fsS -i "$PUBLIC_APP_URL/readyz"
   docker compose -f infra/docker/docker-compose.production.yml ps
   docker compose -f infra/docker/docker-compose.production.yml logs --since 15m web worker finance-worker
   ```

2. Check provider status and, when the endpoint is reachable, run:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'select 1'
   ```

3. Keep payment and entitlement mutations stopped if database state is
   uncertain. Do not repeat a checkout or refund from a browser redirect.
4. Follow the provider failover or PITR procedure. Restore into a new instance
   when possible. Confirm migrations and row counts before switching the
   connection secret.
5. Restart one process at a time and watch readiness and queue errors:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml restart web
   docker compose -f infra/docker/docker-compose.production.yml restart worker finance-worker
   ```

6. Reconcile Stripe events and ledger posting intents before closing incident.

## Backup and restore verification

Run against a disposable database or an isolated restore host, never against
the live primary. The check creates one uniquely named temporary database,
restores the custom-format dump, verifies required tables, and removes only
that database:

```bash
DATABASE_URL="$DATABASE_URL" \
  BACKUP_RESTORE_CONFIRM=disposable \
  pnpm check:backup-restore
```

Keep the dump and restore logs under the restricted operations location when
this is part of a scheduled drill. This check proves restore execution only;
provider PITR, off-host encryption, retention, and RPO still need their
provider-side evidence.

## Stripe backlog

Use when Stripe events are arriving but finance processing is delayed or
repeatedly failing.

1. Measure unprocessed and failed events without reading payloads:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
     "select count(*) filter (where processed_at is null) as pending, count(*) filter (where process_error is not null) as failed from stripe_event"
   docker compose -f infra/docker/docker-compose.production.yml logs --since 30m finance-worker
   ```

2. Check Stripe Dashboard webhook delivery and API status. Keep the signed
   webhook endpoint available so new events remain durable.
3. Fix the first repeated error. Do not bulk-edit `stripe_event`, grant an
   entitlement from a redirect, or replay an event by inserting a second row.
4. Restart the finance worker once the dependency or configuration is fixed:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml restart finance-worker
   ```

5. Confirm pending count falls, then run Stripe and ledger reconciliation.

## TigerBeetle restart and replay

Use when ledger connections fail, posting intents remain pending, or a
TigerBeetle process restarts. Stop finance processing before touching its data.

1. Capture current state and stop only the finance worker:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
     "select status, count(*) from ledger_posting_intent group by status order by status"
   docker compose -f infra/docker/docker-compose.production.yml stop finance-worker
   docker ps --filter name=oss-tips-tigerbeetle
   docker logs --since 15m oss-tips-tigerbeetle
   ```

2. Verify the data file is on persistent storage. Never delete or reformat it.
   Restart the configured TigerBeetle container or supervisor:

   ```bash
   docker restart oss-tips-tigerbeetle
   ```

3. Run the infrastructure smoke check with the configured address and cluster:

   ```bash
   pnpm --filter @oss-tips/ledger build
   node scripts/smoke-tigerbeetle.mjs
   ```

4. Start finance processing. Its durable posting-intent replay is
   idempotent, so it may retry unresolved intents:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml start finance-worker
   docker compose -f infra/docker/docker-compose.production.yml logs -f finance-worker
   ```

5. Compare every affected payment with Stripe and posting results. Escalate
   any transit or balance difference before resuming normal traffic.

## RustFS outage and data recovery

Use when asset reads, uploads, or RustFS health checks fail.

1. Check endpoint and process logs without listing private object names:

   ```bash
   curl -fsS "$S3_ENDPOINT/health"
   docker compose -f infra/docker/docker-compose.production.yml logs --since 15m web worker
   ```

2. Keep private asset links disabled while storage integrity is unknown. Do
   not replace the data volume or run a broad delete command.
3. Check disk, volume, and backup provider status. Restore to a separate
   bucket or volume first, then verify object hashes and the weekly inventory.
4. Point `S3_ENDPOINT` and credentials at the verified store, restart workers,
   and test one public and one authorised private asset:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml restart web worker
   ```

5. Reconcile `object_asset` records with the restored inventory. Keep missing
   objects quarantined and tell affected project owners what is unavailable.

## Discord permissions

Use when role reconciliation reports missing permissions, missing members, or
Discord rate limits.

1. Inspect bot and queue logs:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml logs --since 30m discord-bot
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
     "select status, count(*) from job where queue = 'discord' group by status order by status"
   ```

2. In Discord, confirm bot membership, `Manage Roles`, and bot role position
   above every mapped role. Do not grant broader administrator permission as a
   shortcut.
3. Correct the guild configuration, then restart the bot once:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml restart discord-bot
   ```

4. Confirm one test member reaches desired state and failed jobs receive a
   future retry time. Never change entitlement state to hide a Discord error.

## Webhook backlog

Use when outgoing project webhook deliveries are delayed or failing.

1. Measure delivery state and inspect worker errors:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
     "select status, count(*) from webhook_delivery group by status order by status"
   docker compose -f infra/docker/docker-compose.production.yml logs --since 30m worker
   ```

2. Check destination status, DNS, TLS, and the endpoint owner. Keep signing
   secrets out of shell history and incident notes.
3. Fix or disable only the affected endpoint through the authorised dashboard.
   Do not edit delivery rows or call a destination manually with a copied
   payload.
4. Restart the general worker once the dependency is healthy:

   ```bash
   docker compose -f infra/docker/docker-compose.production.yml restart worker
   ```

5. Watch retries and endpoint response codes. Confirm duplicate deliveries are
   accepted by the endpoint before closing incident.

## Incident communication

Use for any customer-visible outage, delayed payment, data recovery, or
security event.

1. Name one incident lead and one communications owner. Record impact, first
   observed time, current scope, and next update time.
2. Publish a short status update through the configured independent status
   provider. Use plain facts: what is affected, what still works, and when the
   next update will arrive.
3. Notify affected project owners through the approved channel. Never include
   supporter email, payment identity, webhook payloads, or credentials.
4. Update at a fixed interval until service is stable. Mark recovery only after
   readiness, queue depth, payment reconciliation, and relevant data checks
   pass.
5. Within two business days, write a timeline, root cause, customer impact,
   and follow-up owner. Do not close the incident while an unexplained ledger
   or data difference remains.
