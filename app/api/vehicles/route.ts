import { NextResponse, type NextRequest } from "next/server";
import { fetchVehiclePositions, type TransportMode } from "@/lib/ptv";
import type { VehiclesResponse } from "@/types/vehicle";

const VALID_MODES = new Set<TransportMode>(["metro", "vline", "tram"]);

// Simple in-memory rate limiter: max requests per window per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Vehicle fetch error (${mode}):`, message);
    return NextResponse.json(
      { error: "Failed to fetch vehicle data" },
      { status: 500 }
    );
  }
}
