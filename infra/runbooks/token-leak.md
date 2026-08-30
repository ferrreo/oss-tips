# Leaked API, webhook, or Discord token

**Trigger:** A secret appears in source, logs, telemetry, a ticket, a browser
capture, or a provider alert.

**Contain:** Treat the token as compromised. Revoke or rotate it in the
provider dashboard and secret store before investigating further. Revoke the
affected API key, replace the webhook signing secret, or rotate the Discord
bot token as applicable. Do not paste the token into commands or incident
notes.

**Evidence:** Preserve only token type, last four characters or a one-way
hash, provider resource ID, first-seen time, source location, and request
correlation. Restrict the source artifact and remove the secret from future
builds and logs.

**Communicate:** Notify affected project owners and provider contacts if the
token could have been used. Do not disclose the secret or a usable signed
request.

**Recover:** Update the deployment secret, restart only affected processes,
verify API authentication and webhook signatures with a fresh test, and audit
activity since first exposure:

```bash
docker compose -f infra/docker/docker-compose.production.yml restart web worker finance-worker discord-bot
```

**Owner:** Security lead. Postmortem owner: service owner for the leaked token.
