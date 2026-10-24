# Fix My Neighbourhood

Fix My Neighbourhood is a mobile-first civic issue reporting application. It
helps residents discover local problems, submit reports with precise map
locations, and follow each report through its resolution status.

## Features

- Explore community reports in list and map views
- Filter reports by category and status
- Select an area using browser geolocation, place search, or an interactive map
- Submit reports with a category, description, location, map pin, and optional
  photo
- Track reports submitted from the current browser in **My Reports**
- View report details and status timelines
- Responsive navigation for mobile and desktop
- Clear fallbacks when geolocation, geocoding, or background map tiles are
  unavailable

## Technology

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Leaflet](https://leafletjs.com/)
- [MapTiler](https://www.maptiler.com/) for background map tiles
- [OpenStreetMap](https://www.openstreetmap.org/) data
- [Nominatim](https://nominatim.org/) for explicit location searches and
  reverse geocoding
- Supabase Edge Functions and KV storage for report persistence

## Getting Started

### Requirements

- Node.js 22
- pnpm 10
- A MapTiler API key
- Access to the configured Supabase project and Edge Function

The repository includes `.mise.toml` with the expected Node.js and pnpm
versions.

### Installation

```bash
pnpm install
```

Create an `.env.local` file and add your MapTiler browser key:

```env
VITE_MAPTILER_API_KEY=your_maptiler_key
```

Restrict the key to the domains that serve the application, including local,
preview, and production domains as appropriate. MapTiler usage limits and
attribution requirements are controlled by the selected MapTiler plan.

The Supabase project ID and public anonymous key are provided by the existing
project integration in `utils/supabase/info`. Never commit private Supabase
service-role credentials.

### Development

```bash
pnpm dev
```

When working in Figma Make, the development server is managed automatically
and does not need to be started manually.

## Available Commands

```bash
pnpm dev       # Start the Vite development server
pnpm build     # Create a production build
pnpm preview   # Preview the production build
pnpm test      # Run browser ownership regression tests
pnpm format    # Format the project with oxfmt
```

The geolocation classification tests can also be run directly:

```bash
node --experimental-strip-types --test src/browserGeolocation.test.ts
```

## Project Structure

```text
src/
├── App.tsx                       Main application views and report workflow
├── LocationChooser.tsx           Area search, geolocation, and map selection
├── Map.tsx                       Leaflet report maps and location picker
├── browserGeolocation.ts         Geolocation preflight and error handling
├── geocoding.ts                  Nominatim search and reverse geocoding
├── ownerIdentity.ts              Anonymous browser ownership identity
├── reportApi.ts                  Supabase Edge Function client
├── index.css                     Tailwind theme and global map styles
└── main.tsx                      React entry point
```

## Location and Map Behaviour

Browser location access is optional. The app distinguishes permission denial,
embedded-preview restrictions, insecure contexts, unavailable positions, and
timeouts. Search and manual map selection remain available when geolocation
fails.

On a new report, using the current location only centres the map. The user must
click the map to confirm the issue location before submission.

If background tiles fail, Leaflet interaction and coordinate-based pin
selection remain available. Report cards can still be accessed through the
list view.

## Report Ownership

The app does not require user accounts. It creates an anonymous browser owner
identifier and preserves it across supported browser storage mechanisms. The
identifier allows **My Reports** to associate submissions with the browser that
created them.

Clearing browser storage or using another browser or device may prevent
previous reports from appearing in **My Reports**.

## Production Notes

Before publishing:

1. Add every production and preview domain to the MapTiler key restrictions.
2. Confirm the Supabase Edge Function accepts requests from the production
   origin.
3. Verify geolocation over HTTPS; browsers generally block it on insecure
   production pages.
4. Confirm Nominatim and MapTiler usage remains within their published policies
   and limits.
5. Run `pnpm build` and `pnpm test`.

## Data Attribution

Map data is provided by OpenStreetMap contributors. Background tiles are served
by MapTiler. Search and reverse-geocoding results are provided by Nominatim.
Attribution is displayed in the application where required.
