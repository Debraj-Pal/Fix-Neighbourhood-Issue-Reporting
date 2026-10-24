# Fix My Neighbourhood — MVP Implementation Plan

## Objective

Build a polished, mobile-first civic issue reporting demo in the existing React 19 + Vite + Tailwind CSS v4 app. The MVP will support the complete journey in one client-side application:

1. Explore and filter realistic sample reports.
2. Submit a report with validation and optional photo preview.
3. See the new report immediately in Explore and My Reports.
4. Open any report to inspect its details, ID, status, and simulated progress timeline.
5. Navigate between views without losing reports submitted in the current browser session.

## Confirmed Repository Context

- The repository is a minimal Vite application with `src/App.tsx` as the empty UI shell and `src/index.css` containing only the Tailwind v4 import.
- Runtime dependencies are only React and React DOM; there is no router, icon package, form library, or component library.
- The existing development server is host-managed and must not be started manually.
- The implementation should therefore use React state, browser APIs, Tailwind utilities, and small local components rather than adding dependencies.

## Product Assumptions and Scope Decisions

- **Navigation:** Use three state-driven views—Explore, Report, and My Reports—rather than adding a routing dependency. Opening report details uses an in-app detail view with a clear Back action.
- **Location:** Use a curated list of clearly fictional neighbourhood landmarks plus a free-text detail field. No geolocation, reverse geocoding, or external map API.
- **Map:** Include a lightweight “Map” toggle in Explore. It will be a labelled schematic neighbourhood panel with positioned issue markers and an explicit “Simulated locations” label, not a geographic map.
- **Persistence:** Store user-created reports in `sessionStorage`, so they survive view changes and page refreshes within the current tab/session. If storage is unavailable or full, retain reports in React state and show a non-blocking notice.
- **Photos:** Accept common image files, validate type and a conservative size limit, and show a preview. Persist the preview with the report only when browser storage accepts it; otherwise keep it for the current in-memory session and explain the fallback.
- **Statuses:** User-created reports start as `Submitted`. Statuses do not automatically advance. Sample reports cover all four statuses, and all authority/status updates are labelled simulated.
- **Sample content:** Seed data remains separate from user-created reports and is visibly labelled “Sample report.” Submitted reports are marked “Your report.”
- **Accessibility:** Status is always communicated by text and icon/shape as well as colour. Forms have labels, errors are associated with fields, controls have visible focus states, and overlays/details support keyboard interaction.
- **Out of scope:** Authentication, real authority integrations, real maps, backend storage, duplicate detection automation, comments/chat, voting, administration, analytics, and status editing.

## Screens and Responsive Layout

### 1. Application Shell

- Mobile: compact header, scrollable content, and fixed bottom navigation for Explore, Report, and My Reports.
- Desktop: persistent left sidebar with brand, navigation, a short civic-help message, and main content constrained to a readable width.
- Shared visual language: warm off-white background, deep navy text, teal primary actions, amber/red status treatments, rounded cards, subtle borders/shadows, generous spacing, and minimal motion.
- Use small inline SVG icon components because the project has no icon system; decorative icons are hidden from assistive technology and interactive icons have accessible labels.

### 2. Explore

- Intro header with title, short explanation, issue count, and a prominent “Report an issue” action.
- Search input matching title, description, location, category, and report ID.
- Category and status filters, with a clear/reset action.
- List/Map segmented view toggle.
- Responsive issue card grid/list showing optional photo or category fallback artwork, category, title, location, report date, status badge, report ID, and sample/owned label.
- Card click or “View details” opens the report detail view.
- Empty filtered state explains that no issues match and offers “Clear filters” and “Report an issue.”
- Simulated map view positions filtered issues as labelled markers; selecting a marker opens a compact preview and then the detail view.

### 3. Report an Issue

- Guided single-page form with:
  - Category select
  - Title
  - Description
  - Simulated location select
  - Optional nearby landmark/address detail
  - Optional image upload with preview and remove action
- Inline required-field validation plus image type/size errors.
- Submit creates a unique human-readable ID, timestamps the report, marks it as owned, sets status to `Submitted`, persists it when possible, and updates shared state immediately.
- Success confirmation summarizes the new report and offers “View report,” “Report another,” and “Explore issues.”
- Form values remain intact if submission cannot complete; double submission is prevented while processing.

### 4. My Reports

- Shows only reports submitted during the current browser session.
- Uses the same card component and detail interaction as Explore.
- Displays a helpful empty state with a direct action to submit the first report.
- Includes a concise note that reports and progress are part of a demo and not sent to real authorities.

### 5. Report Detail

- Back action returns to the originating view.
- Displays title, status, category, location, date, full description, optional photo, ownership/sample label, and unique report ID with a working Copy ID control and transient confirmation.
- Four-step timeline: Submitted → Under Review → In Progress → Resolved.
  - Steps through the current status appear complete/current.
  - Future steps remain pending.
  - Timeline copy and update dates are deterministic sample/demo content.
- Clearly states that authority updates and locations are simulated.

## Data Model

Define typed constants and interfaces:

```ts
type IssueCategory =
  | "Pothole"
  | "Streetlight"
  | "Waste"
  | "Road damage"
  | "Drainage"
  | "Other";

type IssueStatus = "Submitted" | "Under Review" | "In Progress" | "Resolved";

interface Issue {
  id: string;
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  locationDetail?: string;
  reportedAt: string; // ISO timestamp
  status: IssueStatus;
  image?: string; // bundled sample URL or uploaded data URL
  isOwned: boolean;
  isSample: boolean;
  mapPosition: { x: number; y: number }; // percentage coordinates for schematic map
}
```

- Add 6–8 realistic sample issues spanning categories, all statuses, image/no-image cards, and multiple fictional locations.
- Keep category labels, status ordering, status presentation metadata, simulated locations, and samples in a dedicated data module.
- Generate new IDs from timestamp plus a short random segment to avoid collisions in the current session.

## Component Structure

Keep the implementation small but avoid one oversized component:

- `src/App.tsx`
  - Owns active view, selected issue, filters, user reports, persistence hydration, submit handler, and shell composition.
- `src/data/issues.ts`
  - Types, sample reports, categories, locations, status order, and presentation metadata.
- `src/components/AppShell.tsx`
  - Responsive sidebar/header/bottom navigation.
- `src/components/IssueCard.tsx`
  - Shared issue summary presentation.
- `src/components/ExploreView.tsx`
  - Search/filter controls, list/map toggle, result states, and simulated map.
- `src/components/ReportForm.tsx`
  - Form state, validation, upload preview, and success panel.
- `src/components/MyReportsView.tsx`
  - Owned-report list and empty state.
- `src/components/IssueDetail.tsx`
  - Detail content, copy action, and timeline.
- `src/components/Icons.tsx`
  - Small consistent inline SVG icon set.
- `src/index.css`
  - Tailwind import, theme tokens, base typography/background/focus treatment, and only the few global styles that utilities do not express cleanly.

Component props remain typed and callbacks flow upward; no global state library or context is necessary at this size.

## State and Data Flow

1. Initialize sample reports from static data.
2. Lazily read and validate an array of user reports from a versioned `sessionStorage` key.
3. Combine sample and user reports for Explore; sort newest first.
4. Derive filtered results with `useMemo` from query, category, and status.
5. On valid form submission:
   - Construct the complete `Issue`.
   - Add it to user-report state.
   - Attempt to write the updated array to `sessionStorage`.
   - Show success regardless of storage support, with a warning only if persistence failed.
6. My Reports derives directly from user-report state.
7. Detail selection stores the selected report ID and origin view; resolve the current report from shared data so newly added reports remain consistent.
8. Navigation changes do not reset user-report state. Form reset occurs only after successful submission or explicit “Report another.”

## Validation, Edge Cases, and Fallbacks

- Trim all text before validation/storage.
- Require category, title, description, and location.
- Enforce practical client-side lengths (short title, bounded description/location detail) and display remaining/maximum guidance where useful.
- Reject non-image uploads and oversized files before reading.
- Handle `FileReader` failure by preserving form fields and displaying an upload-specific error.
- Revoke temporary object URLs if used; prefer a validated data URL where persistence is viable.
- Wrap all browser storage parsing and writes in `try/catch`; discard malformed stored payloads without crashing.
- If image data causes quota failure, retry persistence without the image and notify the user that the report was saved but its photo is available only until refresh; if that also fails, retain the report in memory.
- Search and filters combine predictably; result count updates and reset returns to all reports.
- Copy ID uses the Clipboard API when available and a safe DOM fallback otherwise.
- Broken sample/uploaded images show a category-based fallback panel.
- Detail view handles a missing/stale report ID by returning to the prior list with a friendly message rather than rendering a blank screen.

## Implementation Sequence

1. Add typed issue data, realistic samples, category/status metadata, and simulated locations.
2. Add the responsive shell and navigation.
3. Build reusable status, card, image fallback, and icon primitives.
4. Implement Explore search, filters, list view, empty state, and simulated map toggle.
5. Implement report form validation, photo preview, submission, success state, and session persistence.
6. Implement My Reports and report details with the simulated timeline and copy interaction.
7. Apply responsive polish, accessible focus/labels, content disclaimers, and fallback states.
8. Format and verify the complete flow.

## Verification Strategy

- Run the repository formatter: `pnpm format`.
- Run the production build: `pnpm build`.
- Manually verify in the host preview at mobile and desktop widths:
  - Explore shows varied sample reports.
  - Search, category/status filters, clear action, and list/map toggle work together.
  - Every sample card/marker opens the correct detail.
  - Invalid form submission exposes clear field errors and focuses/identifies the first problem.
  - Invalid/oversized image input fails gracefully; valid image input previews and can be removed.
  - Valid submission shows success, appears immediately in Explore and My Reports, and opens in Detail.
  - View navigation and page refresh within the tab retain submitted reports when `sessionStorage` is available.
  - Copy ID provides feedback.
  - Timeline state matches each status and always includes text labels.
  - Empty My Reports and empty filtered-results states have working recovery actions.
  - All visible controls have meaningful behavior, keyboard focus is visible, and no content is hidden behind mobile bottom navigation.

## Definition of Completion

The work is complete when the production build succeeds and the manual checks confirm the end-to-end journey, responsive navigation, current-session persistence, validation, detail timeline, and graceful empty/fallback states, with all simulated data and updates clearly labelled.
