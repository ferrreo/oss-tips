# Custom-domain takeover or certificate failure

**Trigger:** DNS validation changes unexpectedly, Cloudflare reports a
hostname or certificate failure, a domain owner disputes control, or a custom
host serves the wrong project.

**Contain:** Disable the custom domain through the authorised project/admin
action and remove the provider hostname if compromise is suspected. Keep the
canonical `oss.tips` project URL available. Do not accept a new DNS target
from an unverified request.

**Evidence:** Preserve hostname, project and domain IDs, Cloudflare provider
ID, validation records, certificate status, DNS observations, timestamps, and
audit correlation. Do not record domain-owner email or provider tokens.

**Communicate:** Tell the verified project owner that the custom host is
disabled and give the canonical URL. Escalate disputed control to security and
legal before restoring it.

**Recover:** Verify DNS ownership again, rotate provider credentials if
needed, refresh the provider state, and confirm `canonical_enabled` is false
until both hostname and TLS status are active. Test public pages and ensure
support, sign-in, dashboard, and API paths still redirect to the canonical
origin.

**Owner:** Platform operations lead. Postmortem owner: security lead.
