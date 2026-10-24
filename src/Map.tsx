import L, {
  type LayerGroup,
  type Map as LeafletMap,
  type Marker,
} from "leaflet"
import { useEffect, useRef, useState } from "react"
import {
  geolocationMessage,
  geolocationRequestDisabled,
  GeolocationState,
  requestBrowserLocation,
} from "./browserGeolocation"

type MappedIssue = {
  id: string
  title: string
  category: string
  location: string
  status: string
  latitude?: number
  longitude?: number
}

type Coordinates = {
  latitude: number
  longitude: number
}

const neutralCenter: L.LatLngExpression = [20, 0]
const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY
const tileUrl = `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey ?? "")}`
const tileOptions = {
  maxZoom: 19,
  tileSize: 512,
  zoomOffset: -1,
  referrerPolicy: "strict-origin-when-cross-origin" as const,
  attribution:
    '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
}

function validCoordinates(latitude?: number, longitude?: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude! >= -90 &&
    latitude! <= 90 &&
    longitude! >= -180 &&
    longitude! <= 180
  )
}

function pinIcon(selected = false) {
  return L.divIcon({
    className: "",
    html: `<span class="leaflet-civic-pin${
      selected ? " leaflet-civic-pin--selected" : ""
    }" aria-hidden="true"><span></span></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
  })
}

function useBaseMap(
  container: React.RefObject<HTMLDivElement | null>,
  onTileState: (state: "loading" | "ready" | "error") => void,
  initialCenter: Coordinates | undefined,
  initialZoom: number,
) {
  const mapRef = useRef<LeafletMap>()

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = L.map(container.current, { zoomControl: true }).setView(
      initialCenter
        ? [initialCenter.latitude, initialCenter.longitude]
        : neutralCenter,
      initialCenter ? initialZoom : 2,
    )
    mapRef.current = map
    let tiles: L.TileLayer | undefined
    let tileFailed = false
    if (mapTilerKey) {
      tiles = L.tileLayer(tileUrl, tileOptions)
        .on("load", () => {
          if (!tileFailed) onTileState("ready")
        })
        .on("tileerror", () => {
          if (tileFailed) return
          tileFailed = true
          onTileState("error")
          tiles?.remove()
        })
        .addTo(map)
    } else {
      onTileState("error")
    }
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(container.current)

    return () => {
      resize.disconnect()
      tiles?.off()
      map.remove()
      mapRef.current = undefined
    }
  }, [container, onTileState])

  return mapRef
}

export function ReportMap({
  issues,
  onOpen,
  area,
}: {
  issues: MappedIssue[]
  onOpen: (id: string) => void
  area?: Coordinates
}) {
  const container = useRef<HTMLDivElement>(null)
  const layerRef = useRef<LayerGroup>()
  const openRef = useRef(onOpen)
  const [tileState, setTileState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const mapRef = useBaseMap(container, setTileState, area, 13)
  openRef.current = onOpen

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layerRef.current?.remove()
    const layer = L.layerGroup().addTo(map)
    layerRef.current = layer
    const bounds: L.LatLngExpression[] = []

    for (const issue of issues) {
      if (!validCoordinates(issue.latitude, issue.longitude)) continue
      const position: L.LatLngExpression = [issue.latitude!, issue.longitude!]
      bounds.push(position)
      const marker = L.marker(position, { icon: pinIcon() }).addTo(layer)
      const popup = document.createElement("div")
      popup.className = "civic-map-popup"
      const category = document.createElement("span")
      category.className = "civic-map-popup__category"
      category.textContent = issue.category
      const title = document.createElement("strong")
      title.textContent = issue.title
      const meta = document.createElement("span")
      meta.textContent = `${issue.location} · ${issue.status}`
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = "View report details"
      button.addEventListener("click", () => openRef.current(issue.id))
      popup.append(category, title, meta, button)
      marker.bindPopup(popup, { minWidth: 210 })
    }

    if (area) {
      map.setView([area.latitude, area.longitude], 13)
    } else if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [38, 38], maxZoom: 16 })
    }
    return () => {
      layer.remove()
    }
  }, [area, issues, mapRef])

  const mappedCount = issues.filter((issue) =>
    validCoordinates(issue.latitude, issue.longitude),
  ).length

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-sage">
      <div
        ref={container}
        className="h-[420px] w-full sm:h-[500px]"
        aria-label="Interactive map of neighbourhood reports"
      />
      {tileState === "loading" && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg bg-surface/95 px-3 py-2 text-xs font-bold text-muted shadow-sm">
          Loading OpenStreetMap…
        </div>
      )}
      {tileState === "error" && (
        <div className="absolute inset-x-3 top-3 z-[500] rounded-xl border border-warning/25 bg-warning-soft p-3 text-xs text-warning shadow-sm">
          Map tiles could not be loaded. Report locations remain available in
          List view.
        </div>
      )}
      {mappedCount === 0 && tileState !== "error" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface/95 px-4 py-3 text-center text-sm text-muted shadow-sm">
          No reports in this view have stored coordinates.
        </div>
      )}
    </div>
  )
}

export function LocationPicker({
  value,
  onChange,
  initialCenter,
  purpose = "report",
}: {
  value?: Coordinates
  onChange: (coordinates: Coordinates) => void
  initialCenter?: Coordinates
  purpose?: "report" | "area"
}) {
  const container = useRef<HTMLDivElement>(null)
  const markerRef = useRef<Marker>()
  const [tileState, setTileState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [locationState, setLocationState] =
    useState<GeolocationState>("idle")
  const mapRef = useBaseMap(container, setTileState, initialCenter, 13)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const select = (event: L.LeafletMouseEvent) =>
      changeRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    map.on("click", select)
    return () => {
      map.off("click", select)
    }
  }, [mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = undefined
      return
    }
    const position: L.LatLngExpression = [value.latitude, value.longitude]
    if (markerRef.current) markerRef.current.setLatLng(position)
    else
      markerRef.current = L.marker(position, { icon: pinIcon(true) }).addTo(map)
    if (purpose === "area") map.setView(position, 13)
  }, [mapRef, purpose, value])

  const useMyLocation = () =>
    void requestBrowserLocation({
      onStateChange: setLocationState,
      onSuccess: ({ coords }) => {
        mapRef.current?.setView([coords.latitude, coords.longitude], 17)
        setLocationState("centered")
      },
      options: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    })

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface-muted">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <b className="block text-sm text-ink">
            {purpose === "report" ? "Place the issue pin" : "Choose an area"}
          </b>
          <span className="text-xs text-muted">
            {purpose === "report"
              ? "Click the map or use your current location."
              : "Pan and click the map to select an area."}
          </span>
        </div>
        {purpose === "report" && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geolocationRequestDisabled(locationState)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-forest hover:border-sage-deep disabled:cursor-wait disabled:opacity-60"
          >
            {locationState === "locating"
              ? "Finding location…"
              : "Use my location"}
          </button>
        )}
      </div>
      <div className="relative">
        <div
          ref={container}
          className="h-72 w-full"
          aria-label={
            purpose === "report"
              ? "Choose the report location on the map"
              : "Choose an area on the map"
          }
        />
        {tileState === "loading" && (
          <span className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg bg-surface/95 px-3 py-2 text-xs font-bold text-muted">
            Loading map…
          </span>
        )}
        {tileState === "error" && (
          <span className="absolute inset-x-3 top-3 z-[500] rounded-lg border border-warning/25 bg-warning-soft p-3 text-xs text-warning">
            The background map is unavailable. You can still pan, zoom, and
            click to place a pin by coordinates.
          </span>
        )}
      </div>
      <div className="border-t border-line px-4 py-3 text-xs">
        {value ? (
          <span className="font-semibold text-forest">
            Pin selected: {value.latitude.toFixed(5)},{" "}
            {value.longitude.toFixed(5)}
          </span>
        ) : (
          <span className="text-muted">No pin selected yet.</span>
        )}
        {locationState === "centered" && (
          <p className="mt-1 text-forest">
            Map centred on your current position. Click the map to confirm the
            issue location.
          </p>
        )}
        {geolocationMessage(locationState) && (
          <p className="mt-1 text-danger">
            {geolocationMessage(locationState)}
          </p>
        )}
      </div>
    </div>
  )
}
