import { NextResponse, type NextRequest } from "next/server";
import { fetchVehiclePositions, type TransportMode } from "@/lib/ptv";
import type { VehiclesResponse } from "@/types/vehicle";

const VALID_MODES = new Set<TransportMode>(["metro", "vline", "tram"]);

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") ?? "metro") as TransportMode;

  if (!VALID_MODES.has(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    const vehicles = await fetchVehiclePositions(mode);
    const data: VehiclesResponse = {
      vehicles,
      fetchedAt: Date.now(),
    };
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Vehicle fetch error (${mode}):`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
