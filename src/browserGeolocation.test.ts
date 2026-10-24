import assert from "node:assert/strict"
import test from "node:test"
import {
  getGeolocationErrorState,
  getGeolocationPreflightState,
} from "./browserGeolocation.ts"

test("classifies browser geolocation errors separately", () => {
  assert.equal(getGeolocationErrorState(1), "denied")
  assert.equal(getGeolocationErrorState(2), "unavailable")
  assert.equal(getGeolocationErrorState(3), "timeout")
})

test("detects insecure, embedded-policy, and unsupported contexts", () => {
  assert.equal(
    getGeolocationPreflightState({
      secure: false,
      supported: true,
      policyAllows: true,
    }),
    "insecure",
  )
  assert.equal(
    getGeolocationPreflightState({
      secure: true,
      supported: true,
      policyAllows: false,
    }),
    "blocked",
  )
  assert.equal(
    getGeolocationPreflightState({
      secure: true,
      supported: false,
    }),
    "unsupported",
  )
})
