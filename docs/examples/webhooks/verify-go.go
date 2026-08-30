package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func main() {
	secret := []byte("whsec_test_vector_32bytes_minimum")
	timestamp := "1787947200"
	body := []byte(`{"id":"evt_01JTEST","type":"project.updated","api_version":"2026-08-01","created_at":"2026-08-28T20:00:00Z","project_id":"prj_01JTEST","data":{"object":{"name":"Grove"}}}`)
	received := "v1=c4a0a5507fb568805feccffcf4a6909fea055f96e67fa4b37b7c2a9c819bb7bf"
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(timestamp + "."))
	mac.Write(body)
	expected := "v1=" + hex.EncodeToString(mac.Sum(nil))
	valid := hmac.Equal([]byte(expected), []byte(received))
	if !valid {
		panic("webhook signature did not verify")
	}
	fmt.Println(valid)
}
