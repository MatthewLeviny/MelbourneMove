import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { readFileSync } from "fs";
import { join } from "path";
import type { VehiclePosition } from "@/types/vehicle";

export type TransportMode = "metro" | "vline" | "tram";

const VEHICLE_POSITIONS_URLS: Record<TransportMode, string> = {
  metro:
    "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions",
  vline:
    "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/vline/vehicle-positions",
  tram:
    "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions",
};

// Load trip endpoints lookup once on server startup
let tripEndpoints: Record<string, { origin: string; destination: string }> | null = null;

function getTripEndpoints() {
  if (!tripEndpoints) {
    try {
      const filePath = join(process.cwd(), "data", "trip-endpoints.json");
      tripEndpoints = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      console.warn("trip-endpoints.json not found, origin/destination will be unavailable");
      tripEndpoints = {};
    }
  }
  return tripEndpoints!;
}

const cache = new Map<
  TransportMode,
  { vehicles: VehiclePosition[]; fetchedAt: number }
>();
const CACHE_TTL_MS = 5000;

export async function fetchVehiclePositions(
  mode: TransportMode
): Promise<VehiclePosition[]> {
  const now = Date.now();
  const cached = cache.get(mode);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.vehicles;
  }

  const apiKey = process.env.PTV_API_KEY;
  if (!apiKey) {
    throw new Error("PTV_API_KEY environment variable is not set");
  }

  const response = await fetch(VEHICLE_POSITIONS_URLS[mode], {
    headers: { KeyId: apiKey },
  });

  if (!response.ok) {
    throw new Error(
      `PTV API error (${mode}): ${response.status} ${response.statusText}`
    );
  }

  const buffer = await response.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  );

  const endpoints = getTripEndpoints();

  const vehicles: VehiclePosition[] = feed.entity
    .filter((entity) => entity.vehicle?.position)
    .map((entity) => {
      const v = entity.vehicle!;
      const pos = v.position!;
      const tripId = v.trip?.tripId ?? "";
      const ep = endpoints[tripId];
      return {
        id: entity.id,
        latitude: pos.latitude,
        longitude: pos.longitude,
        bearing: pos.bearing ?? null,
        speed: pos.speed ?? null,
        tripId,
        routeId: v.trip?.routeId ?? "",
        label: v.vehicle?.label ?? null,
        timestamp: v.timestamp
          ? typeof v.timestamp === "number"
            ? v.timestamp
            : v.timestamp.toNumber()
          : 0,
        origin: ep?.origin ?? null,
        destination: ep?.destination ?? null,
      };
    });

  cache.set(mode, { vehicles, fetchedAt: now });
  return vehicles;
}
