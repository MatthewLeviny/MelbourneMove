/**
 * Downloads the PTV GTFS static feed and extracts train line shapes
 * into GeoJSON files at public/train-lines.geojson and public/vline-lines.geojson
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const GTFS_URL = "https://data.ptv.vic.gov.au/downloads/gtfs.zip";
const TEMP_DIR = join(process.cwd(), ".gtfs-temp");

const FEEDS: {
  folder: string;
  name: string;
  output: string;
  filterCoach?: boolean;
}[] = [
  { folder: "2", name: "Metro", output: "train-lines.geojson" },
  { folder: "1", name: "V-Line", output: "vline-lines.geojson", filterCoach: true },
  { folder: "3", name: "Tram", output: "tram-lines.geojson" },
];

function parseCsv(content: string): Record<string, string>[] {
  const clean = content.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter((l) => l.trim());
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line
      .split(",")
      .map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

interface TripEndpoints {
  origin: string;
  destination: string;
}

function processGtfs(dir: string, filterCoach: boolean): {
  geojson: GeoJSON.FeatureCollection;
  routeNames: Record<string, { name: string; color: string }>;
  tripLookup: Record<string, TripEndpoints>;
} {
  const routes = parseCsv(
    readFileSync(join(dir, "routes.txt"), "utf-8")
  ).filter(
    (r) =>
      !r.route_long_name.includes("Replacement") &&
      !r.route_short_name.includes("Replacement") &&
      (!filterCoach || !r.route_short_name.includes("Coach"))
  );

  const routeMap = new Map(routes.map((r) => [r.route_id, r]));
  console.log(`  Found ${routes.length} routes`);

  const trips = parseCsv(readFileSync(join(dir, "trips.txt"), "utf-8"));
  const routeShapes = new Map<string, Set<string>>();
  for (const trip of trips) {
    if (!trip.shape_id || !routeMap.has(trip.route_id)) continue;
    if (!routeShapes.has(trip.route_id)) {
      routeShapes.set(trip.route_id, new Set());
    }
    routeShapes.get(trip.route_id)!.add(trip.shape_id);
  }

  const allShapeIds = new Set<string>();
  for (const shapes of routeShapes.values()) {
    for (const s of shapes) allShapeIds.add(s);
  }
  console.log(`  Found ${allShapeIds.size} unique shapes`);

  console.log("  Parsing shapes...");
  const shapePoints = parseCsv(readFileSync(join(dir, "shapes.txt"), "utf-8"));

  const shapeCoords = new Map<string, [number, number][]>();
  for (const pt of shapePoints) {
    if (!allShapeIds.has(pt.shape_id)) continue;
    if (!shapeCoords.has(pt.shape_id)) {
      shapeCoords.set(pt.shape_id, []);
    }
    shapeCoords.get(pt.shape_id)!.push([
      parseFloat(pt.shape_pt_lon),
      parseFloat(pt.shape_pt_lat),
    ]);
  }

  const features: GeoJSON.Feature[] = [];

  for (const [routeId, shapeIds] of routeShapes) {
    const route = routeMap.get(routeId);
    if (!route) continue;

    let bestShapeId = "";
    let bestLen = 0;
    for (const sid of shapeIds) {
      const coords = shapeCoords.get(sid);
      if (coords && coords.length > bestLen) {
        bestLen = coords.length;
        bestShapeId = sid;
      }
    }

    if (!bestShapeId) continue;
    const coords = shapeCoords.get(bestShapeId)!;

    features.push({
      type: "Feature",
      properties: {
        routeId,
        name: route.route_short_name || route.route_long_name,
        longName: route.route_long_name,
        color: `#${route.route_color}`,
      },
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    });
  }

  // Build route name lookup: routeId -> { name, color }
  const routeNames: Record<string, { name: string; color: string }> = {};
  for (const [routeId, route] of routeMap) {
    routeNames[routeId] = {
      name: route.route_short_name || route.route_long_name,
      color: `#${route.route_color}`,
    };
  }

  // Build trip endpoints lookup: trip_id -> { origin, destination }
  console.log("  Building trip endpoints...");
  const stops = parseCsv(readFileSync(join(dir, "stops.txt"), "utf-8"));
  const stopNames = new Map(stops.map((s) => [s.stop_id, s.stop_name.replace(/ Station$/, "")]));

  const stopTimes = parseCsv(readFileSync(join(dir, "stop_times.txt"), "utf-8"));

  // Group stop_times by trip_id, track first and last
  const tripFirstLast = new Map<string, { firstSeq: number; firstStop: string; lastSeq: number; lastStop: string }>();
  for (const st of stopTimes) {
    const seq = parseInt(st.stop_sequence, 10);
    const existing = tripFirstLast.get(st.trip_id);
    if (!existing) {
      tripFirstLast.set(st.trip_id, { firstSeq: seq, firstStop: st.stop_id, lastSeq: seq, lastStop: st.stop_id });
    } else {
      if (seq < existing.firstSeq) { existing.firstSeq = seq; existing.firstStop = st.stop_id; }
      if (seq > existing.lastSeq) { existing.lastSeq = seq; existing.lastStop = st.stop_id; }
    }
  }

  const tripLookup: Record<string, TripEndpoints> = {};
  for (const trip of trips) {
    if (!routeMap.has(trip.route_id)) continue;
    const fl = tripFirstLast.get(trip.trip_id);
    if (!fl) continue;
    tripLookup[trip.trip_id] = {
      origin: stopNames.get(fl.firstStop) ?? fl.firstStop,
      destination: trip.trip_headsign || (stopNames.get(fl.lastStop) ?? fl.lastStop),
    };
  }
  console.log(`  Built ${Object.keys(tripLookup).length} trip endpoints`);

  return { geojson: { type: "FeatureCollection" as const, features }, routeNames, tripLookup };
}

async function main() {
  mkdirSync(TEMP_DIR, { recursive: true });
  const zipPath = join(TEMP_DIR, "gtfs.zip");

  const allRouteNames: Record<string, { name: string; color: string }> = {};
  const allTripLookup: Record<string, TripEndpoints> = {};

  console.log("Downloading GTFS static feed...");
  execSync(`curl -sL -o "${zipPath}" "${GTFS_URL}"`);

  for (const feed of FEEDS) {
    console.log(`\nProcessing ${feed.name} (folder ${feed.folder})...`);

    const innerZip = join(TEMP_DIR, feed.folder, "google_transit.zip");
    const extractDir = join(TEMP_DIR, feed.name.toLowerCase().replace("/", ""));

    execSync(
      `unzip -o "${zipPath}" "${feed.folder}/google_transit.zip" -d "${TEMP_DIR}"`,
      { stdio: "pipe" }
    );

    mkdirSync(extractDir, { recursive: true });
    execSync(
      `unzip -o "${innerZip}" routes.txt trips.txt shapes.txt stops.txt stop_times.txt -d "${extractDir}"`,
      { stdio: "pipe" }
    );

    const { geojson, routeNames, tripLookup } = processGtfs(extractDir, feed.filterCoach ?? false);
    const json = JSON.stringify(geojson);
    const outputPath = join(process.cwd(), "public", feed.output);
    writeFileSync(outputPath, json);
    console.log(
      `  Written ${geojson.features.length} lines to public/${feed.output} (${(json.length / 1024).toFixed(0)} KB)`
    );

    Object.assign(allRouteNames, routeNames);
    Object.assign(allTripLookup, tripLookup);
  }

  // Write trip endpoints lookup
  const tripLookupPath = join(process.cwd(), "data", "trip-endpoints.json");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(tripLookupPath, JSON.stringify(allTripLookup));
  console.log(`Written trip endpoints (${Object.keys(allTripLookup).length} trips) to data/trip-endpoints.json (${(JSON.stringify(allTripLookup).length / 1024).toFixed(0)} KB)`);

  // Write combined route name lookup
  const routeNamesPath = join(process.cwd(), "public", "route-names.json");
  writeFileSync(routeNamesPath, JSON.stringify(allRouteNames));
  console.log(`\nWritten route lookup (${Object.keys(allRouteNames).length} routes) to public/route-names.json`);

  rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
