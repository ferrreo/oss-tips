use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    let mut difference = left.len() ^ right.len();
    for index in 0..left.len().max(right.len()) {
        let left_byte = left.get(index).copied().unwrap_or(0);
        let right_byte = right.get(index).copied().unwrap_or(0);
        difference |= usize::from(left_byte ^ right_byte);
    }
    difference == 0
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push(HEX[usize::from(byte >> 4)] as char);
        result.push(HEX[usize::from(byte & 0x0f)] as char);
    }
    result
}

fn main() {
    let secret = b"whsec_test_vector_32bytes_minimum";
    let timestamp = "1787947200";
    let body = br#"{"id":"evt_01JTEST","type":"project.updated","api_version":"2026-08-01","created_at":"2026-08-28T20:00:00Z","project_id":"prj_01JTEST","data":{"object":{"name":"Grove"}}}"#;
    let received = b"v1=c4a0a5507fb568805feccffcf4a6909fea055f96e67fa4b37b7c2a9c819bb7bf";

    let mut mac = HmacSha256::new_from_slice(secret).expect("valid HMAC key");
    mac.update(timestamp.as_bytes());
    mac.update(b".");
    mac.update(body);

    let expected = format!("v1={}", hex_encode(&mac.finalize().into_bytes()));
    let valid = constant_time_eq(expected.as_bytes(), received);
    if !valid {
        panic!("webhook signature did not verify");
    }
    println!("{valid}");
}
