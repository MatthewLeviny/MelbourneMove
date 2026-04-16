# MelbourneMove

Real-time interactive map of Melbourne's public transport network. Live tracking of metro trains, V/Line services, and trams using PTV GTFS-Realtime data, displayed on a dark-themed MapLibre GL map with directional markers and route overlays.

**Live:** [https://main.d13ok54mja1g66.amplifyapp.com](https://main.d13ok54mja1g66.amplifyapp.com)

## Features

- Full-screen dark-themed map centered on Melbourne
- Live vehicle positions for metro trains, V/Line, and trams (updated every 30s)
- Directional teardrop markers for trains, circle markers for trams
- Route line overlays with official PTV colours for all transport modes
- Click any vehicle to see line name, origin, destination, speed, and bearing
- Layers control to toggle transport modes on/off
- Status bar with connection indicator, vehicle count, and update countdown
- Legend showing all metro train lines with colour swatches

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Map:** MapLibre GL JS via react-map-gl
- **Styling:** Tailwind CSS
- **Tiles:** CartoCDN Dark Matter
- **Data:** PTV GTFS-Realtime (protobuf) + GTFS Static

## Getting Started

### 1. Get a PTV API key

Register for free at [https://opendata.transport.vic.gov.au](https://opendata.transport.vic.gov.au)

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local and add your API key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Regenerate route data (optional)

The static route GeoJSON and trip endpoint data are already committed. To regenerate from the latest GTFS schedule:

```bash
npx tsx scripts/generate-train-lines.ts
```

## Architecture

```
Browser (React + MapLibre GL)
    |  fetch /api/vehicles?mode=metro|vline|tram every 30s
    v
Next.js Route Handler
    |  fetches PTV GTFS-RT with KeyId header, parses protobuf
    |  enriches with origin/destination from static GTFS trip data
    v
PTV GTFS-Realtime API (protobuf)
```

## Deployment

Hosted on AWS Amplify. Every push to `main` triggers an auto-deploy. The `PTV_API_KEY` environment variable is configured in the Amplify Console.
