# Malicious private attachment or public XSS report

**Trigger:** A scanner, user, or operator reports script execution, unsafe
HTML, an executable upload, a public private attachment, or a stale signed
URL.

**Contain:** Unpublish the affected post and soft-delete or quarantine the
asset through the authorised project/admin action. Revoke or expire signed
URLs and invalidate the relevant cache. Do not open the payload on an
operator workstation or serve the quarantine object.

For an upload outage or repeated scanner-unavailable result, keep PDF and
plain-text promotion paused. Check the configured ClamAV daemon from the web
and worker network:

```bash
nc -z "$MALWARE_SCANNER_HOST" "${MALWARE_SCANNER_PORT:-3310}"
```

Restore the daemon and its signature database before retrying. Do not bypass
the scanner or copy quarantine objects into a final bucket manually.

**Evidence:** Preserve project, post revision, asset, object hash, sanitizer
and scanner result, URL path, timestamps, and request correlation. Keep the
payload in restricted quarantine only when required for analysis.

**Communicate:** Notify affected project owners and users whose private access
may have been exposed. Give security contacts a safe incident reference, not
the attachment URL.

**Recover:** Patch the sanitizer or upload rule, decode and re-encode safe
media, rescan, verify private access with an authorised entitlement and a
public request, then republish only after review. Confirm CSP and cache
invalidation.

**Owner:** Security lead. Postmortem owner: content/storage owner.
