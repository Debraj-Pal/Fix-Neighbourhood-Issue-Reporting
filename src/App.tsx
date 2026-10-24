import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react"
import { BackendReport, createReport, getReports } from "./reportApi"
import { LocationPicker, ReportMap } from "./Map"
import LocationChooser from "./LocationChooser"
import { GeoArea, reverseGeocode } from "./geocoding"

type View = "explore" | "report" | "mine"
type Status = "Submitted" | "Under Review" | "In Progress" | "Resolved"
type Category = "Pothole" | "Streetlight" | "Waste" | "Road damage" | "Drainage" | "Other"

type Issue = {
  id: string
  category: Category
  title: string
  description: string
  location: string
  date: string
  status: Status
  image?: string
  mine?: boolean
  latitude?: number
  longitude?: number
  updatedAt?: string
}

const categories: Category[] = [
  "Pothole",
  "Streetlight",
  "Waste",
  "Road damage",
  "Drainage",
  "Other",
]
const statuses: Status[] = [
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved",
]
function fromBackend(report: BackendReport): Issue {
  return {
    id: report.id,
    category: report.category as Category,
    title: report.title,
    description: report.description,
    location: report.location,
    date: report.created_at,
    updatedAt: report.updated_at,
    status: report.status as Status,
    image: report.photo_url ?? undefined,
    mine: report.mine,
    latitude: report.latitude,
    longitude: report.longitude,
  }
}

function distanceKm(area: GeoArea, issue: Issue) {
  if (!Number.isFinite(issue.latitude) || !Number.isFinite(issue.longitude))
    return undefined
  const radians = (value: number) => (value * Math.PI) / 180
  const latitudeDistance = radians(issue.latitude! - area.latitude)
  const longitudeDistance = radians(issue.longitude! - area.longitude)
  const a =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(radians(area.latitude)) *
      Math.cos(radians(issue.latitude!)) *
      Math.sin(longitudeDistance / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const statusStyle: Record<Status, string> = {
  Submitted: "bg-warning-soft text-warning border-warning/25",
  "Under Review": "bg-warning-soft text-warning border-warning/25",
  "In Progress": "bg-info-soft text-info border-info/25",
  Resolved: "bg-sage text-forest-dark border-sage-deep",
}

const categoryIcon: Record<Category, string> = {
  Pothole: "road",
  Streetlight: "light",
  Waste: "waste",
  "Road damage": "road",
  Drainage: "drain",
  Other: "alert",
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: string
  className?: string
}) {
  const paths: Record<string, ReactNode> = {
    explore: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    list: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <circle cx="4" cy="6" r=".5" />
        <circle cx="4" cy="12" r=".5" />
        <circle cx="4" cy="18" r=".5" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z" />
        <path d="M8 3v15M16 6v15" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M4 15v5h16v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    alert: (
      <>
        <path d="M12 8v5" />
        <circle cx="12" cy="17" r=".5" />
        <path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    road: (
      <>
        <path d="M8 3 6 21M16 3l2 18M12 4v3m0 4v3m0 4v2" />
      </>
    ),
    light: (
      <>
        <path d="M8 21h8M12 17v4M8.5 10.5a5 5 0 1 1 7 0c-1.2 1-1.5 2-1.5 3h-4c0-1-.3-2-1.5-3Z" />
      </>
    ),
    waste: (
      <>
        <path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    drain: (
      <>
        <path d="M4 8h16M4 12h16M4 16h16M8 5v14M16 5v14" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

function IssueCard({ issue, onOpen }: { issue: Issue onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[0_1px_2px_rgba(38,51,45,.04)] transition hover:-translate-y-0.5 hover:border-sage-deep hover:shadow-[0_10px_28px_rgba(38,51,45,.08)] focus:outline-none focus:ring-4 focus:ring-sage"
    >
      {issue.image ? (
        <img src={issue.image} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center border-b border-line bg-sage/70 text-forest">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-sage-deep bg-surface/70">
            <Icon name={categoryIcon[issue.category]} className="h-6 w-6" />
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-forest">
            {issue.category}
          </span>
          <StatusBadge status={issue.status} />
        </div>
        <h3 className="line-clamp-2 text-[17px] font-extrabold leading-snug text-ink group-hover:text-forest-dark">
          {issue.title}
        </h3>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="pin" className="h-4 w-4" />
          {issue.location}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span>
            {issue.mine ? "Your report" : "Community report"}{" "}
            ·{" "}
            {new Date(issue.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span className="flex items-center font-bold text-ink-soft">
            Details <Icon name="arrow" className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  )
}

function Navigation({ view, go }: { view: View go: (v: View) => void }) {
  const items: { id: View label: string icon: string }[] = [
    { id: "explore", label: "Explore", icon: "explore" },
    { id: "report", label: "Report", icon: "plus" },
    { id: "mine", label: "My Reports", icon: "user" },
  ]
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface px-5 py-7 md:flex">
        <button
          onClick={() => go("explore")}
          className="flex items-center gap-3 text-left"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-white">
            <Icon name="pin" />
          </span>
          <span>
            <b className="block text-base leading-tight text-ink">Fix My</b>
            <b className="block text-base leading-tight text-forest">
              Neighbourhood
            </b>
          </span>
        </button>
        <nav className="mt-12 space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${
                view === item.id
                  ? "bg-forest text-white shadow-md"
                  : "text-muted hover:bg-sage/60"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-ink p-4 text-white">
          <p className="text-sm font-bold">Small reports. Better streets.</p>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas/95 px-5 backdrop-blur md:hidden">
        <button
          onClick={() => go("explore")}
          className="flex items-center gap-2 font-extrabold text-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest text-white">
            <Icon name="pin" className="h-4 w-4" />
          </span>
          Fix My Neighbourhood
        </button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={`flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-bold ${
              view === item.id ? "text-forest" : "text-muted"
            }`}
          >
            <span
              className={view === item.id ? "rounded-lg bg-sage p-1" : "p-1"}
            >
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  )
}

function Explore({
  issues,
  open,
  goReport,
  area,
  chooseArea,
  clearArea,
}: {
  issues: Issue[]
  open: (i: Issue) => void
  goReport: () => void
  area?: GeoArea
  chooseArea: (area: GeoArea, remember: boolean) => void
  clearArea: () => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [status, setStatus] = useState("All")
  const [mode, setMode] = useState<"list" | "map">("list")
  const [choosingArea, setChoosingArea] = useState(!area)
  const [nearbyOnly, setNearbyOnly] = useState(false)
  const filtered = useMemo(
    () =>
      issues.filter((i) => {
        const text =
          `${i.title} ${i.description} ${i.location} ${i.id}`.toLowerCase()
        return (
          text.includes(query.toLowerCase()) &&
          (category === "All" || i.category === category) &&
          (status === "All" || i.status === status) &&
          (!nearbyOnly ||
            !area ||
            distanceKm(area, i) === undefined ||
            distanceKm(area, i)! <= 25)
        )
      }),
    [area, issues, nearbyOnly, query, category, status],
  )
  const clear = () => {
    setQuery("")
    setCategory("All")
    setStatus("All")
  }
  return (
    <div>
      <section className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <span className="mb-3 inline-flex rounded-full bg-sage px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-forest">
            Community issue tracker
          </span>
          <h1 className="max-w-2xl text-3xl font-black tracking-tight text-ink sm:text-4xl">
            See what’s happening nearby.
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">
            Discover reported issues, avoid duplicates, and follow progress
            across your neighbourhood.
          </p>
        </div>
        <button
          onClick={goReport}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-forest/10 hover:bg-forest-dark"
        >
          <Icon name="plus" />
          Report an issue
        </button>
      </section>
      {choosingArea ? (
        <LocationChooser
          onChoose={(nextArea, remember) => {
            chooseArea(nextArea, remember)
            setChoosingArea(false)
          }}
          onCancel={area ? () => setChoosingArea(false) : undefined}
        />
      ) : area ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-sage/70 px-4 py-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-forest">
              Selected map area
            </span>
            <p className="text-sm font-bold text-ink">{area.label}</p>
            {area.source === "geolocation" && (
              <span className="text-xs text-muted">
                Established from browser geolocation
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChoosingArea(true)}
              className="rounded-lg bg-surface px-3 py-2 text-xs font-bold text-forest"
            >
              Change area
            </button>
            <button
              onClick={() => {
                clearArea()
                setNearbyOnly(false)
                setChoosingArea(true)
              }}
              className="px-2 text-xs font-bold text-muted"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative">
            <span className="sr-only">Search reports</span>
            <Icon
              name="explore"
              className="absolute left-3.5 top-3.5 h-5 w-5 text-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues or locations"
              className="h-12 w-full rounded-xl border border-line bg-surface-muted pl-11 pr-4 text-sm outline-none focus:border-forest focus:ring-3 focus:ring-sage"
            />
          </label>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-12 rounded-xl border border-line bg-surface-muted px-3 text-sm font-semibold outline-none focus:border-forest"
          >
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-12 rounded-xl border border-line bg-surface-muted px-3 text-sm font-semibold outline-none focus:border-forest"
          >
            <option>All</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={clear}
            className="px-3 text-sm font-bold text-muted hover:text-forest"
          >
            Clear
          </button>
        </div>
      </section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            <b className="text-ink">{filtered.length}</b> reports
          </p>
          {area && (
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">
              <input
                type="checkbox"
                checked={nearbyOnly}
                onChange={(event) => setNearbyOnly(event.target.checked)}
                className="h-4 w-4 accent-forest"
              />
              Within 25 km of selected area
            </label>
          )}
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-1">
          <button
            onClick={() => setMode("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${
              mode === "list" ? "bg-ink text-white" : "text-muted"
            }`}
          >
            <Icon name="list" className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => setMode("map")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${
              mode === "map" ? "bg-ink text-white" : "text-muted"
            }`}
          >
            <Icon name="map" className="h-4 w-4" />
            Map
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface py-16 text-center">
          <Icon name="explore" className="mx-auto h-9 w-9 text-subtle" />
          <h2 className="mt-4 text-xl font-black">No matching issues</h2>
          <p className="mt-2 text-sm text-muted">
            Try changing your search or filters.
          </p>
          <button
            onClick={clear}
            className="mt-5 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white"
          >
            Clear filters
          </button>
        </div>
      ) : mode === "list" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((i) => (
            <IssueCard key={i.id} issue={i} onOpen={() => open(i)} />
          ))}
        </div>
      ) : (
        <ReportMap
          issues={filtered}
          area={area}
          onOpen={(id) => {
            const issue = filtered.find((item) => item.id === id)
            if (issue) open(issue)
          }}
        />
      )}
    </div>
  )
}

type FormData = {
  category: string
  title: string
  description: string
  location: string
  latitude?: number
  longitude?: number
}
const emptyForm: FormData = {
  category: "",
  title: "",
  description: "",
  location: "",
  latitude: undefined,
  longitude: undefined,
}

function ReportForm({
  submit,
  open,
  goExplore,
  area,
}: {
  submit: (data: FormData, image?: string) => Promise<Issue>
  open: (i: Issue) => void
  goExplore: () => void
  area?: GeoArea
}) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [image, setImage] = useState<string>()
  const [done, setDone] = useState<Issue>()
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [addressState, setAddressState] =
    useState<"idle" | "loading" | "error">("idle")
  const [automaticAddress, setAutomaticAddress] = useState("")
  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  const chooseImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/"))
      return setErrors((x) => ({ ...x, image: "Please choose an image file." }))
    if (file.size > 1_500_000)
      return setErrors((x) => ({
        ...x,
        image: "Photo must be smaller than 1.5 MB.",
      }))
    const reader = new FileReader()
    reader.onload = () => {
      setImage(String(reader.result))
      setErrors((x) => ({ ...x, image: "" }))
    }
    reader.onerror = () =>
      setErrors((x) => ({ ...x, image: "We could not read this photo." }))
    reader.readAsDataURL(file)
  }
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.category) next.category = "Choose an issue category."
    if (form.title.trim().length < 5)
      next.title = "Add a clear title of at least 5 characters."
    if (form.description.trim().length < 15)
      next.description = "Tell us a little more (at least 15 characters)."
    if (!form.location) next.location = "Choose the nearest location."
    if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) {
      next.coordinates =
        "Place a pin on the map to identify the issue location."
    }
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setSubmitError("")
    try {
      setDone(await submit(form, image))
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The report could not be saved. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }
  if (done)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-sage-deep bg-surface p-7 text-center shadow-xl sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage text-forest">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-forest">
          Report submitted
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">
          Thanks for looking out for your neighbourhood.
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          Your report <b>{done.id}</b> is now visible in Explore and My Reports.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => open(done)}
            className="rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white"
          >
            View report
          </button>
          <button
            onClick={() => {
              setDone(undefined)
              setForm(emptyForm)
              setImage(undefined)
            }}
            className="rounded-xl border border-line px-5 py-3 text-sm font-bold text-ink-soft"
          >
            Report another
          </button>
        </div>
        <button
          onClick={goExplore}
          className="mt-5 text-sm font-bold text-forest"
        >
          Back to Explore
        </button>
      </div>
    )
  const field =
    "mt-2 h-12 w-full rounded-xl border border-line bg-surface-muted px-4 text-sm outline-none focus:border-forest focus:ring-3 focus:ring-sage"
  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={goExplore}
        className="mb-5 flex items-center gap-1 text-sm font-bold text-muted hover:text-forest"
      >
        <Icon name="back" className="h-4 w-4" />
        Back to Explore
      </button>
      <div className="mb-7">
        <p className="text-xs font-extrabold uppercase tracking-widest text-forest">
          New report
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Tell us what needs fixing.
        </h1>
        <p className="mt-3 text-muted">
          Share a few details. Required fields are marked with an asterisk.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        noValidate
        className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <label className="text-sm font-bold text-ink">
            Issue category *
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className={field}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {errors.category && (
              <span className="mt-1.5 block text-xs font-semibold text-danger">
                {errors.category}
              </span>
            )}
          </label>
          <label className="text-sm font-bold text-ink">
            Short title *
            <input
              value={form.title}
              maxLength={80}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Streetlight not working"
              className={field}
            />
            {errors.title && (
              <span className="mt-1.5 block text-xs font-semibold text-danger">
                {errors.title}
              </span>
            )}
          </label>
          <label className="text-sm font-bold text-ink">
            Description *
            <textarea
              value={form.description}
              maxLength={500}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What did you notice? Add any helpful safety details."
              className={`${field} h-32 py-3 resize-none`}
            />
            <span className="mt-1 flex justify-between text-xs font-normal text-subtle">
              {errors.description ? (
                <b className="text-danger">{errors.description}</b>
              ) : (
                <span>Do not include personal information.</span>
              )}
              <span>{form.description.length}/500</span>
            </span>
          </label>
          <label className="text-sm font-bold text-ink">
            Location name or address *
            <input
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Enter an address or nearby landmark"
              className={field}
            />
            {errors.location && (
              <span className="mt-1.5 block text-xs font-semibold text-danger">
                {errors.location}
              </span>
            )}
            <span className="mt-1.5 block text-xs font-normal text-subtle">
              {addressState === "loading"
                ? "Looking up the selected pin address…"
                : addressState === "error"
                  ? "Address lookup unavailable. Enter the location manually."
                  : "A map lookup may suggest an address; you can always edit it."}
            </span>
          </label>
          <div>
            <LocationPicker
              value={
                Number.isFinite(form.latitude) &&
                Number.isFinite(form.longitude)
                  ? {
                      latitude: form.latitude!,
                      longitude: form.longitude!,
                    }
                  : undefined
              }
              onChange={({ latitude, longitude }) => {
                setForm((current) => ({
                  ...current,
                  latitude,
                  longitude,
                }))
                setErrors((current) => ({ ...current, coordinates: "" }))
                setAddressState("loading")
                void reverseGeocode(latitude, longitude)
                  .then((address) => {
                    setForm((current) => ({
                      ...current,
                      location:
                        !current.location ||
                        current.location === automaticAddress
                          ? address
                          : current.location,
                    }))
                    setAutomaticAddress(address)
                    setAddressState("idle")
                  })
                  .catch(() => setAddressState("error"))
              }}
              initialCenter={area}
            />
            {errors.coordinates && (
              <span className="mt-1.5 block text-xs font-semibold text-danger">
                {errors.coordinates}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-ink">
              Photo <span className="font-normal text-subtle">(optional)</span>
            </p>
            {image ? (
              <div className="relative mt-2 overflow-hidden rounded-2xl">
                <img
                  src={image}
                  alt="Selected issue preview"
                  className="h-52 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImage(undefined)}
                  aria-label="Remove photo"
                  className="absolute right-3 top-3 rounded-full bg-ink/85 p-2 text-white"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-line bg-surface-muted px-4 py-8 text-center hover:border-forest">
                <Icon name="upload" className="h-7 w-7 text-forest" />
                <b className="mt-2 text-sm text-ink">Upload a photo</b>
                <span className="mt-1 text-xs text-subtle">
                  JPG, PNG or WEBP · Max 1.5 MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={chooseImage}
                  className="sr-only"
                />
              </label>
            )}
            {errors.image && (
              <span className="mt-1.5 block text-xs font-semibold text-danger">
                {errors.image}
              </span>
            )}
          </div>
        </div>
        <div className="mt-8 border-t border-line pt-6">
          {submitError && (
            <div
              role="alert"
              className="mb-4 flex gap-3 rounded-xl border border-danger/25 bg-danger-soft p-4 text-sm text-danger"
            >
              <Icon name="alert" className="h-5 w-5 shrink-0" />
              <div>
                <b>Report not saved.</b>
                <p className="mt-1">{submitError}</p>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-forest/10 hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
          >
            <Icon name="plus" />
            {saving ? "Saving report…" : "Submit report"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Detail({ issue, back }: { issue: Issue back: () => void }) {
  const [copied, setCopied] = useState(false)
  const current = statuses.indexOf(issue.status)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issue.id)
    } catch {
      /* unavailable in some previews */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={back}
        className="mb-5 flex items-center gap-1 text-sm font-bold text-muted hover:text-forest"
      >
        <Icon name="back" className="h-4 w-4" />
        Back to reports
      </button>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        {issue.image && (
          <img
            src={issue.image}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        )}
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-forest">
              {issue.category}
            </span>
            <span className="text-subtle">·</span>
            <span className="text-xs font-bold text-muted">
              {issue.mine ? "Your report" : "Community report"}
            </span>
          </div>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-ink">
                {issue.title}
              </h1>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                <Icon name="pin" className="h-4 w-4" />
                {issue.location} · Reported{" "}
                {new Date(issue.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <StatusBadge status={issue.status} />
          </div>
          <p className="mt-7 max-w-2xl text-[15px] leading-7 text-muted">
            {issue.description}
          </p>
          <div className="mt-7 grid gap-4 rounded-2xl border border-line bg-surface-muted px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
                Report ID
              </span>
              <b className="font-mono text-sm text-ink">{issue.id}</b>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
                Last updated
              </span>
              <b className="text-sm text-ink">
                {new Date(issue.updatedAt ?? issue.date).toLocaleDateString(
                  "en-GB",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                )}
              </b>
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-2 justify-self-start rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-forest hover:border-sage-deep sm:justify-self-end"
            >
              <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
              {copied ? "Copied" : "Copy ID"}
            </button>
          </div>
        </div>
      </div>
      <section className="mt-5 rounded-3xl border border-line bg-surface p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-forest">
              Resolution progress
            </p>
            <h2 className="mt-2 text-xl font-black text-ink">
              Status timeline
            </h2>
          </div>
          <span className="rounded-full bg-sage px-3 py-1 text-[10px] font-bold uppercase text-forest">
            Progress
          </span>
        </div>
        <div className="mt-7">
          {statuses.map((s, index) => (
            <div key={s} className="relative flex gap-4 pb-7 last:pb-0">
              {index < statuses.length - 1 && (
                <span
                  className={`absolute left-[15px] top-8 h-full w-0.5 ${
                    index < current ? "bg-forest" : "bg-line"
                  }`}
                />
              )}
              <span
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                  index < current
                    ? "border-forest bg-forest text-white"
                    : index === current
                      ? "border-forest bg-surface text-forest ring-4 ring-sage"
                      : "border-line bg-surface text-subtle"
                }`}
              >
                {index < current ? (
                  <Icon name="check" className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-black">{index + 1}</span>
                )}
              </span>
              <div>
                <p
                  className={`text-sm font-extrabold ${
                    index <= current ? "text-ink" : "text-subtle"
                  }`}
                >
                  {s}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {index < current
                    ? "Stage complete"
                    : index === current
                      ? "Current stage"
                      : "Not started"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const areaPreferenceKey = "fmn-map-area-v1"

function loadAreaPreference(): GeoArea | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(areaPreferenceKey) ?? "null")
    if (
      Number.isFinite(value?.latitude) &&
      Number.isFinite(value?.longitude) &&
      typeof value?.label === "string"
    ) {
      return value
    }
  } catch {
    // Location onboarding remains available when preferences are unavailable.
  }
}

export default function App() {
  const [view, setView] = useState<View>("explore")
  const [savedReports, setSavedReports] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selected, setSelected] = useState<Issue>()
  const [origin, setOrigin] = useState<View>("explore")
  const [area, setArea] = useState<GeoArea | undefined>(loadAreaPreference)
  const mine = savedReports.filter((report) => report.mine)
  const all = savedReports
  const load = async () => {
    setLoading(true)
    setLoadError("")
    try {
      setSavedReports((await getReports()).map(fromBackend))
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Reports could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const go = (v: View) => {
    setSelected(undefined)
    setView(v)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const open = (i: Issue) => {
    setOrigin(view)
    setSelected(i)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const submit = async (data: FormData, image?: string) => {
    const issue = fromBackend(
      await createReport({
        category: data.category,
        title: data.title.trim(),
        description: data.description.trim(),
        location: data.location,
        latitude: data.latitude!,
        longitude: data.longitude!,
        photo_url: image,
      }),
    )
    setSavedReports((reports) => [issue, ...reports])
    return issue
  }
  const chooseArea = (nextArea: GeoArea, remember: boolean) => {
    setArea(nextArea)
    if (!remember) return
    try {
      localStorage.setItem(
        areaPreferenceKey,
        JSON.stringify({
          ...nextArea,
          latitude: Number(nextArea.latitude.toFixed(3)),
          longitude: Number(nextArea.longitude.toFixed(3)),
        }),
      )
    } catch {
      // The selected area still works for this page session.
    }
  }
  const clearArea = () => {
    setArea(undefined)
    try {
      localStorage.removeItem(areaPreferenceKey)
    } catch {
      // The in-memory preference is still cleared.
    }
  }
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navigation view={view} go={go} />
      <main className="pb-28 md:ml-64 md:pb-12">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
          {loading && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-forest" />
              Loading saved reports…
            </div>
          )}
          {loadError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-danger/25 bg-danger-soft p-4 text-sm text-danger"
            >
              <span>
                <b>Saved reports are unavailable.</b> {loadError}
              </span>
              <button
                onClick={() => void load()}
                className="shrink-0 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}
          {selected ? (
            <Detail
              issue={selected}
              back={() => {
                setSelected(undefined)
                setView(origin)
              }}
            />
          ) : view === "explore" ? (
            <Explore
              issues={all}
              open={open}
              goReport={() => go("report")}
              area={area}
              chooseArea={chooseArea}
              clearArea={clearArea}
            />
          ) : view === "report" ? (
            <ReportForm
              submit={submit}
              open={open}
              goExplore={() => go("explore")}
              area={area}
            />
          ) : (
            <div>
              <div className="mb-7">
                <p className="text-xs font-extrabold uppercase tracking-widest text-forest">
                  Your activity
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
                  My Reports
                </h1>
                <p className="mt-3 text-muted">
                  Persisted issues submitted from this browser.
                </p>
              </div>
              {mine.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {mine.map((i) => (
                    <IssueCard key={i.id} issue={i} onOpen={() => open(i)} />
                  ))}
                </div>
              ) : loading || loadError ? null : (
                <div className="rounded-3xl border border-dashed border-line-strong bg-surface py-16 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage text-forest">
                    <Icon name="user" />
                  </span>
                  <h2 className="mt-5 text-xl font-black">No reports yet</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    When you report an issue, it will appear here so you can
                    easily follow its progress.
                  </p>
                  <button
                    onClick={() => go("report")}
                    className="mt-6 rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white hover:bg-forest-dark"
                  >
                    Report your first issue
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
