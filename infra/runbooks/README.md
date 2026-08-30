# Operations runbooks

Use these runbooks with an incident owner and a second person watching logs.
Commands assume deployment secrets are loaded into the shell and the production
compose file is the process supervisor.

- [Postgres outage](operations.md#postgres-outage)
- [Backup and restore verification](operations.md#backup-and-restore-verification)
- [Stripe backlog](operations.md#stripe-backlog)
- [Incorrect application fee](money-incidents.md#incorrect-application-fee)
- [Duplicate or missing ledger posting](money-incidents.md#duplicate-or-missing-ledger-posting)
- [TigerBeetle restart and replay](operations.md#tigerbeetle-restart-and-replay)
- [Connected account compromise or restriction](money-incidents.md#connected-account-compromise-or-restriction)
- [Refund or chargeback surge](money-incidents.md#refund-or-chargeback-surge)
- [OAuth and OTP account takeover](account-takeover.md)
- [Leaked API, webhook, or Discord token](token-leak.md)
- [Malicious private attachment or public XSS](attachment-xss.md)
- [RustFS outage and data recovery](operations.md#rustfs-outage-and-data-recovery)
- [Custom-domain takeover or certificate failure](domain-takeover.md)
- [Personal-data breach and ICO assessment](personal-data-breach.md)
- [Discord permissions](operations.md#discord-permissions)
- [Webhook backlog](operations.md#webhook-backlog)
- [Incident communication](operations.md#incident-communication)
