export type GeoArea = {
  latitude: number
  longitude: number
  label: string
  source: "geolocation" | "search" | "manual"
}

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

let lastRequest = 0
const cache = new Map<string, unknown>()

async function nominatim<T>(path: string, cacheKey: string): Promise<T> {
  if (cache.has(cacheKey)) return cache.get(cacheKey) as T
  const wait = Math.max(0, 1050 - (Date.now() - lastRequest))
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
  const response = await fetch(`https://nominatim.openstreetmap.org${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok)
    throw new Error("Location search is temporarily unavailable.")
  const body = (await response.json()) as T
  cache.set(cacheKey, body)
  return body
}

export async function searchLocations(query: string): Promise<GeoArea[]> {
  const normalized = query.trim()
  if (normalized.length < 3) return []
  const results = await nominatim<NominatimResult[]>(
    `/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(normalized)}`,
    `search:${normalized.toLowerCase()}`,
  )
  return results
    .map((result) => ({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      label: result.display_name,
      source: "search" as const,
    }))
    .filter(
      (result) =>
        Number.isFinite(result.latitude) && Number.isFinite(result.longitude),
    )
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  broad = false,
) {
  const key = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`
  const result = await nominatim<NominatimResult>(
    `/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}&zoom=${
      broad ? 12 : 18
    }`,
    key,
  )
  if (!broad) return result.display_name
  const address = result.address ?? {}
  return (
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    address.country ||
    result.display_name
  )
}
