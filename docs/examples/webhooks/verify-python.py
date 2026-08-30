import hashlib
import hmac

secret = b"whsec_test_vector_32bytes_minimum"
timestamp = "1787947200"
body = b'{"id":"evt_01JTEST","type":"project.updated","api_version":"2026-08-01","created_at":"2026-08-28T20:00:00Z","project_id":"prj_01JTEST","data":{"object":{"name":"Grove"}}}'
received = "v1=c4a0a5507fb568805feccffcf4a6909fea055f96e67fa4b37b7c2a9c819bb7bf"
expected = "v1=" + hmac.new(secret, timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
valid = hmac.compare_digest(expected, received)
if not valid:
    raise SystemExit("webhook signature did not verify")
print(valid)
