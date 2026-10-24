export const legacyOwnerKey = "fmn-anonymous-owner-v1"
export const canonicalOwnerKey = "fmn-anonymous-owner-canonical-v2"

const uuidPattern = /^[a-f0-9-]{36}$/i

export type OwnerStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type OwnerEnvironment = {
  localStorage?: OwnerStore
  sessionStorage?: OwnerStore
  cookieStorage?: OwnerStore
  windowNameStorage?: OwnerStore
  randomUUID(): string
  warn(message: string): void
}

type Candidate = {
  id: string
  source: string
  canonical: boolean
}

function safeGet(store: OwnerStore | undefined, key: string) {
  try {
    const value = store?.getItem(key)
    return value && uuidPattern.test(value) ? value : undefined
  } catch {
    return undefined
  }
}

function preserveOrFill(
  store: OwnerStore | undefined,
  key: string,
  ownerId: string,
) {
  try {
    const existing = store?.getItem(key)
    if (!existing || !uuidPattern.test(existing) || existing === ownerId) {
      store?.setItem(key, ownerId)
    }
  } catch {
    // Another available store or window.name remains the fallback.
  }
}

export function createOwnerIdentity(environment: OwnerEnvironment) {
  let cachedOwnerId: string | undefined

  function getOwnerId() {
    if (cachedOwnerId) return cachedOwnerId

    const stores = [
      ["localStorage", environment.localStorage],
      ["sessionStorage", environment.sessionStorage],
      ["cookie", environment.cookieStorage],
      ["window.name", environment.windowNameStorage],
    ] as const
    const candidates: Candidate[] = []

    for (const [source, store] of stores) {
      const canonical = safeGet(store, canonicalOwnerKey)
      const legacy = safeGet(store, legacyOwnerKey)
      if (canonical) candidates.push({ id: canonical, source, canonical: true })
      if (legacy) candidates.push({ id: legacy, source, canonical: false })
    }

    const canonicalCandidates = candidates.filter(
      (candidate) => candidate.canonical,
    )
    const selected = canonicalCandidates[0] ?? candidates[0]
    cachedOwnerId = selected?.id ?? environment.randomUUID()

    const distinctIds = new Set(candidates.map((candidate) => candidate.id))
    if (distinctIds.size > 1) {
      const sources = [
        ...new Set(candidates.map((candidate) => candidate.source)),
      ]
      environment.warn(
        `Anonymous owner conflict detected across ${sources.join(", ")}; preserving the deterministic canonical identity.`,
      )
    }

    for (const [, store] of stores) {
      preserveOrFill(store, canonicalOwnerKey, cachedOwnerId)
      preserveOrFill(store, legacyOwnerKey, cachedOwnerId)
    }

    return cachedOwnerId
  }

  return { getOwnerId }
}

function cookieStore(): OwnerStore {
  return {
    getItem(key) {
      const value = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${key}=`))
        ?.slice(key.length + 1)
      return value ? decodeURIComponent(value) : null
    },
    setItem(key, value) {
      document.cookie = `${key}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`
    },
  }
}

function windowNameStore(): OwnerStore {
  return {
    getItem(key) {
      const match = window.name.match(
        new RegExp(`(?:^|\\\\|)${key}=([a-f0-9-]{36})(?:\\\\||$)`, "i"),
      )
      return match?.[1] ?? null
    },
    setItem(key, value) {
      const entry = `${key}=${value}`
      const pattern = new RegExp(
        `(?:^|\\\\|)${key}=[a-f0-9-]{36}(?=\\\\||$)`,
        "i",
      )
      window.name = pattern.test(window.name)
        ? window.name.replace(pattern, entry)
        : [window.name, entry].filter(Boolean).join("|")
    },
  }
}

export function createBrowserOwnerIdentity() {
  const browserStorage = (name: "localStorage" | "sessionStorage") => {
    try {
      return window[name]
    } catch {
      return undefined
    }
  }

  return createOwnerIdentity({
    localStorage: browserStorage("localStorage"),
    sessionStorage: browserStorage("sessionStorage"),
    cookieStorage: cookieStore(),
    windowNameStorage: windowNameStore(),
    randomUUID: () => crypto.randomUUID(),
    warn: (message) => console.warn(message),
  })
}
