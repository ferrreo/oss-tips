# Money incident runbooks

Use these sections with an incident owner and a second person watching logs.
Keep signed Stripe webhook receipt running unless the incident is a webhook
forgery. Never edit an existing ledger intent, transfer, payment, or refund.
Record IDs and hashes, not customer payloads.

## Incorrect application fee

**Trigger:** Stripe reconciliation, an invoice, or a project report shows an
application fee that does not match the immutable checkout inputs.

**Contain:** Stop `finance-worker` if the scope is uncertain. Leave the signed
webhook endpoint up so events remain durable. Do not issue a manual refund or
change a fee in place.

**Evidence:** Preserve the Stripe account, event, payment, and invoice IDs;
the expected and observed fee; the posting semantic key; and the audit
correlation ID. Inspect intent state without copying payloads:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "select id, semantic_key, status, created_at from ledger_posting_intent where payment_id = '<payment_id>' order by created_at"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "select id, status, error, posted_at from ledger_posting_result where intent_id in (select id from ledger_posting_intent where payment_id = '<payment_id>') order by created_at"
```

**Communicate:** Tell the affected project owner that settlement is paused
and whether supporter-facing amounts are affected. Do not send payment or
supporter identity to a project.

**Recover:** Recompute from the stored checkout and Stripe records. Resume the
approved finance path so it creates a new corrective intent, then reconcile
Stripe, PostgreSQL, and TigerBeetle. A correction is a new event, never an
update to the original posting.

**Owner:** Finance lead. Postmortem owner: operations lead.

## Duplicate or missing ledger posting

**Trigger:** A payment has no posting result, has more than one semantic
posting, or a transit account does not return to zero.

**Contain:** Stop `finance-worker`; keep `stripe_event` rows and the webhook
endpoint untouched. Do not grant an entitlement from a redirect or insert a
second event.

**Evidence:** Preserve payment, Stripe event, intent semantic key, result
status, transfer IDs, and the affected currency. Compare the Stripe event,
`ledger_posting_intent`, `ledger_posting_result`, and reconciliation output.

**Communicate:** Mark the payment as processing until the invariant is known.
Tell the project owner only what support state is delayed.

**Recover:** Restore TigerBeetle or the finance worker first. Replay the
original pending intent through the idempotent worker path. If a correction is
required, create a versioned correction intent. Run the replay check and
reconciliation before restarting normal processing:

```bash
TIGERBEETLE_ADDRESSES=127.0.0.1:3000 \
TIGERBEETLE_CLUSTER_ID=0 \
TIGERBEETLE_REPLAY_DRILL_CONFIRM=fresh-isolated-cluster \
  pnpm check:tigerbeetle-replay
```

**Owner:** Finance lead. Postmortem owner: ledger owner.

## Connected account compromise or restriction

**Trigger:** Stripe reports a capability, payout, identity, or account-security
failure, or a project reports an unauthorised connected-account change.

**Contain:** Suspend the affected project and disable new support through the
authorised admin action. Do not edit bank details in oss.tips. Keep inbound
Stripe events durable and do not delete the connected-account record.

**Evidence:** Preserve the Stripe account ID, capability event IDs, project
ID, timestamps, request correlation, and audit records. Do not store bank data
or full provider payloads in the incident log.

**Communicate:** Contact the project owner through the verified channel. Tell
supporters only if a payment or entitlement is actually affected.

**Recover:** Resolve identity and capability issues in Stripe, rotate any
suspect provider credentials, refresh account state, and run one low-value
test payment and refund before re-enabling support. Reconcile all events
received while suspended.

**Owner:** Payments lead. Postmortem owner: security lead.

## Refund or chargeback surge

**Trigger:** Refund, dispute, or chargeback volume exceeds the project or
platform baseline, or an abuse signal indicates coordinated activity.

**Contain:** Pause new refund approvals for the affected scope and suspend the
project if abuse is plausible. Keep Stripe webhook receipt and dispute
processing running. Do not bulk-edit refund rows or reverse ledger transfers
manually.

**Evidence:** Preserve aggregate counts and amounts by currency, Stripe event
and refund IDs, project IDs, reasons, and reconciliation differences. Restrict
raw payment access to the incident team.

**Communicate:** Notify the project owner about the hold and expected review
time. Send supporter notices only for confirmed payment or entitlement impact.

**Recover:** Review each exceptional refund, use the idempotent refund path,
post ledger corrections from provider events, and reconcile project and
platform balances. Re-enable approvals after the surge has an owner and a
documented cause.

**Owner:** Finance lead. Postmortem owner: operations lead.
