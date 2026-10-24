import { projectId, publicAnonKey } from "../utils/supabase/info"
import { createBrowserOwnerIdentity } from "./ownerIdentity"

export type BackendReport = {
  id: string
  title: string
  description: string
  category: string
  location: string
  latitude: number
  longitude: number
  photo_url: string | null
  status: string
  created_at: string
  updated_at: string
  mine: boolean
}

export type NewReport = Pick<BackendReport, "title" | "description" | "category" | "location" | "latitude" | "longitude"> & {
  photo_url?: string
}

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e8c188f4`
const ownerIdentity = createBrowserOwnerIdentity()
export const getOwnerId = ownerIdentity.getOwnerId

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiUrl}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
  } catch {
    throw new Error(
      "Unable to reach the report service. Check your connection and retry.",
    )
  }

  const text = await response.text()
  let body: Record<string, unknown> = {}
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      if (!response.ok) {
        throw new Error(
          `Report service request failed with HTTP ${response.status}.`,
        )
      }
      throw new Error("The report service returned an invalid response.")
    }
  }

  if (!response.ok) {
    const detail =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : `Report service request failed with HTTP ${response.status}.`
    throw new Error(detail)
  }
  return body as T
}

export async function getReports() {
  const body = await request<{ reports?: unknown }>(
    `/reports?owner_id=${encodeURIComponent(getOwnerId())}`,
  )
  if (!Array.isArray(body.reports)) {
    throw new Error("The report service returned an invalid reports response.")
  }
  return body.reports as BackendReport[]
}

export async function createReport(report: NewReport) {
  const body = await request<{ report?: unknown }>("/reports", {
    method: "POST",
    body: JSON.stringify({ ...report, owner_id: getOwnerId() }),
  })
  if (!body.report || typeof body.report !== "object") {
    throw new Error(
      "The report service did not confirm that the report was saved.",
    )
  }
  const saved = body.report as BackendReport
  if (!saved.id || saved.mine !== true) {
    throw new Error(
      "The saved report was not associated with this browser session.",
    )
  }
  return saved
}
