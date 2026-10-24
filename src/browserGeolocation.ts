export type GeolocationState =
  | "idle"
  | "locating"
  | "centered"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "insecure"
  | "blocked"

type GeolocationPolicy = {
  allowsFeature: (feature: string) => boolean
}

type PolicyDocument = Document & {
  permissionsPolicy?: GeolocationPolicy
  featurePolicy?: GeolocationPolicy
}

export function getGeolocationPreflightState({
  secure,
  supported,
  policyAllows,
}: {
  secure: boolean
  supported: boolean
  policyAllows?: boolean
}): GeolocationState | undefined {
  if (!secure) return "insecure"
  if (policyAllows === false) return "blocked"
  if (!supported) return "unsupported"
}

export function getGeolocationErrorState(code: number): GeolocationState {
  if (code === 1) return "denied"
  if (code === 2) return "unavailable"
  if (code === 3) return "timeout"
  return "unavailable"
}

export function geolocationMessage(state: GeolocationState) {
  const messages: Partial<Record<GeolocationState, string>> = {
    denied:
      "Location access was denied by the browser. Search for an area or choose it on the map instead.",
    unavailable:
      "Your position is currently unavailable. Search for an area or choose it on the map instead.",
    timeout:
      "Finding your position took too long. You can try again, search, or choose on the map.",
    unsupported:
      "This browser does not support location access. Search for an area or choose it on the map instead.",
    insecure:
      "Location access requires a secure HTTPS page. Search for an area or choose it on the map instead.",
    blocked:
      "Location access is blocked by this embedded preview. Open the site directly, search, or choose on the map.",
  }
  return messages[state]
}

export function geolocationRequestDisabled(state: GeolocationState) {
  return (
    state === "locating" ||
    state === "denied" ||
    state === "unsupported" ||
    state === "insecure" ||
    state === "blocked"
  )
}

export async function requestBrowserLocation({
  onSuccess,
  onStateChange,
  options,
}: {
  onSuccess: (position: GeolocationPosition) => void
  onStateChange: (state: GeolocationState) => void
  options?: PositionOptions
}) {
  const policyDocument = document as PolicyDocument
  const policy =
    policyDocument.permissionsPolicy ?? policyDocument.featurePolicy
  const preflight = getGeolocationPreflightState({
    secure: window.isSecureContext,
    supported: "geolocation" in navigator,
    policyAllows: policy?.allowsFeature("geolocation"),
  })
  if (preflight) {
    onStateChange(preflight)
    return
  }

  if (navigator.permissions) {
    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      })
      if (permission.state === "denied") {
        onStateChange("denied")
        return
      }
    } catch {
      // Some browsers expose geolocation without supporting this permission query.
    }
  }

  onStateChange("locating")
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    (error) => onStateChange(getGeolocationErrorState(error.code)),
    options,
  )
}
