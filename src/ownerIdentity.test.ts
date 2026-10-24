import assert from "node:assert/strict"
import test from "node:test"
import {
  canonicalOwnerKey,
  createOwnerIdentity,
  legacyOwnerKey,
  type OwnerStore,
} from "./ownerIdentity.ts"

const IDs = {
  current: "11111111-1111-4111-8111-111111111111",
  previous: "22222222-2222-4222-8222-222222222222",
  generated: "33333333-3333-4333-8333-333333333333",
}

function memoryStore(initial: Record<string, string> = {}): OwnerStore {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test("keeps one owner across repeated calls and reloads", () => {
  const local = memoryStore({ [legacyOwnerKey]: IDs.current })
  const first = createOwnerIdentity({
    localStorage: local,
    randomUUID: () => IDs.generated,
    warn: () => {},
  })
  assert.equal(first.getOwnerId(), IDs.current)
  assert.equal(first.getOwnerId(), IDs.current)

  const reloaded = createOwnerIdentity({
    localStorage: local,
    randomUUID: () => IDs.generated,
    warn: () => {},
  })
  assert.equal(reloaded.getOwnerId(), IDs.current)
  assert.equal(local.getItem(canonicalOwnerKey), IDs.current)
})

test("detects conflicts, keeps localStorage priority, and does not overwrite valid alternatives", () => {
  const local = memoryStore({ [legacyOwnerKey]: IDs.current })
  const session = memoryStore({ [legacyOwnerKey]: IDs.previous })
  const warnings: string[] = []
  const identity = createOwnerIdentity({
    localStorage: local,
    sessionStorage: session,
    randomUUID: () => IDs.generated,
    warn: (message) => warnings.push(message),
  })

  assert.equal(identity.getOwnerId(), IDs.current)
  assert.equal(session.getItem(legacyOwnerKey), IDs.previous)
  assert.equal(local.getItem(canonicalOwnerKey), IDs.current)
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].includes(IDs.current), false)
})

test("a canonical owner wins deterministically over conflicting legacy stores", () => {
  const local = memoryStore({
    [legacyOwnerKey]: IDs.previous,
    [canonicalOwnerKey]: IDs.current,
  })
  const session = memoryStore({ [legacyOwnerKey]: IDs.previous })
  const identity = createOwnerIdentity({
    localStorage: local,
    sessionStorage: session,
    randomUUID: () => IDs.generated,
    warn: () => {},
  })
  assert.equal(identity.getOwnerId(), IDs.current)
})

test("uses window.name fallback when regular browser storage is unavailable", () => {
  const unavailable: OwnerStore = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
  }
  const windowName = memoryStore()
  const first = createOwnerIdentity({
    localStorage: unavailable,
    sessionStorage: unavailable,
    cookieStorage: unavailable,
    windowNameStorage: windowName,
    randomUUID: () => IDs.generated,
    warn: () => {},
  })
  assert.equal(first.getOwnerId(), IDs.generated)

  const reloaded = createOwnerIdentity({
    localStorage: unavailable,
    sessionStorage: unavailable,
    cookieStorage: unavailable,
    windowNameStorage: windowName,
    randomUUID: () => IDs.previous,
    warn: () => {},
  })
  assert.equal(reloaded.getOwnerId(), IDs.generated)
})

test("GET and POST callers receive the same cached owner", () => {
  const identity = createOwnerIdentity({
    localStorage: memoryStore(),
    randomUUID: () => IDs.generated,
    warn: () => {},
  })
  const getOwner = identity.getOwnerId()
  const postOwner = identity.getOwnerId()
  assert.equal(getOwner, postOwner)
})
