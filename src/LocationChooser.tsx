import { FormEvent, useState } from "react"
import {
  geolocationMessage,
  geolocationRequestDisabled,
  GeolocationState,
  requestBrowserLocation,
} from "./browserGeolocation"
import { GeoArea, reverseGeocode, searchLocations } from "./geocoding"
import { LocationPicker } from "./Map"

export default function LocationChooser({
  onChoose,
  onCancel,
}: {
  onChoose: (area: GeoArea, remember: boolean) => void
  onCancel?: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeoArea[]>([])
  const [manual, setManual] = useState<GeoArea>()
  const [mapOpen, setMapOpen] = useState(false)
  const [remember, setRemember] = useState(true)
  const [searchState, setSearchState] =
    useState<"idle" | "searching" | "no-results" | "error">("idle")
  const [locationState, setLocationState] =
    useState<GeolocationState>("idle")

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 3) return
    setSearchState("searching")
    try {
      const matches = await searchLocations(query)
      setResults(matches)
      setSearchState(matches.length ? "idle" : "no-results")
    } catch {
      setSearchState("error")
    }
  }

  const useLocation = () =>
    void requestBrowserLocation({
      onStateChange: setLocationState,
      onSuccess: async ({ coords }) => {
        let label = "Current location area"
        try {
          label = await reverseGeocode(coords.latitude, coords.longitude, true)
        } catch {
          // The coordinates remain useful when the optional label lookup fails.
        }
        onChoose(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            label,
            source: "geolocation",
          },
          remember,
        )
      },
      options: {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    })

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-forest">
            Choose an area
          </p>
          <h2 className="mt-1 text-xl font-black text-ink">
            Where would you like to explore?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Location permission is optional. Search or choose directly on the
            map at any time.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-bold text-muted hover:text-forest"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <button
            type="button"
            onClick={useLocation}
            disabled={geolocationRequestDisabled(locationState)}
            className="w-full rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
          >
            {locationState === "locating"
              ? "Finding your area…"
              : "Use my current location"}
          </button>
          <div className="flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" />
            or search
            <span className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={search} className="flex gap-2">
            <label className="sr-only" htmlFor="area-search">
              Search for a city, locality, neighbourhood, or address
            </label>
            <input
              id="area-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City, town, locality or address"
              className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-muted px-4 text-sm outline-none focus:border-forest focus:ring-3 focus:ring-sage"
            />
            <button
              type="submit"
              disabled={
                query.trim().length < 3 || searchState === "searching"
              }
              className="rounded-xl border border-line bg-surface px-4 text-sm font-bold text-forest disabled:opacity-50"
            >
              {searchState === "searching" ? "Searching…" : "Search"}
            </button>
          </form>
          {searchState === "no-results" && (
            <p className="text-sm text-muted">
              No matching locations found. Try a broader place name.
            </p>
          )}
          {searchState === "error" && (
            <p className="text-sm text-danger">
              Search is currently unavailable. Choose an area on the map
              instead, or try again later.
            </p>
          )}
          {geolocationMessage(locationState) && (
            <p className="text-sm text-danger">
              {geolocationMessage(locationState)}
            </p>
          )}
          {results.length > 0 && (
            <div className="max-h-52 space-y-2 overflow-auto">
              {results.map((result) => (
                <button
                  type="button"
                  key={`${result.latitude},${result.longitude}`}
                  onClick={() => onChoose(result, remember)}
                  className="w-full rounded-xl border border-line bg-surface-muted p-3 text-left text-sm text-ink hover:border-sage-deep"
                >
                  {result.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-subtle">
            Search results © OpenStreetMap contributors, provided by Nominatim.
            Search runs only when you press Search.
          </p>
        </div>

        <div className="flex flex-col">
          {!mapOpen ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              aria-expanded="false"
              aria-controls="area-map-picker"
              className="w-full rounded-xl border border-forest bg-surface px-4 py-3 text-sm font-bold text-forest hover:bg-sage"
            >
              Choose an area using Map
            </button>
          ) : (
            <div id="area-map-picker">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  className="text-sm font-bold text-muted hover:text-forest"
                >
                  Close map
                </button>
              </div>
              <LocationPicker
                purpose="area"
                value={manual}
                onChange={({ latitude, longitude }) =>
                  setManual({
                    latitude,
                    longitude,
                    label: "Selected map area",
                    source: "manual",
                  })
                }
              />
              {manual && (
                <button
                  type="button"
                  onClick={() => onChoose(manual, remember)}
                  className="mt-3 w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
                >
                  Explore this map area
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-4 w-4 accent-forest"
        />
        Remember this general map area on this device
      </label>
    </section>
  )
}
