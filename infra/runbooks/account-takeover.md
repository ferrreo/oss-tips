# OAuth and OTP account takeover

**Trigger:** A user reports an unauthorised sign-in or project change, or
monitoring shows unusual OTP requests, OAuth links, sessions, or privileged
actions.

**Contain:** Identify the account without sharing its email in the incident
channel. Revoke its sessions immediately, disable affected project actions,
and rotate any exposed OAuth or recovery credential. For an emergency session
revocation, use the exact user ID after a second-person check:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "update session set expires_at = now() where user_id = '<user_id>'"
```

Do not delete the account or its audit history while scope is uncertain.

**Evidence:** Preserve user ID, session IDs, provider ID, audit correlation,
OTP rate-limit events, timestamps, and changed resource IDs. Hash or redact
email, IP, tokens, and provider payloads.

**Communicate:** Use a verified channel to tell the user what was revoked and
what they must re-authenticate. Escalate project owners and any affected
supporters through the incident lead.

**Recover:** Confirm sessions and linked accounts are clean, rotate secrets,
restore only authorised project changes, and verify security notices deliver.
Review recent team, ownership, API-key, webhook, and domain actions.

**Owner:** Security lead. Postmortem owner: operations lead.
