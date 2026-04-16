export interface VehiclePosition {
  id: string;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speed: number | null;
  tripId: string;
  routeId: string;
  label: string | null;
  timestamp: number;
  origin: string | null;
  destination: string | null;
}

export interface VehiclesResponse {
  vehicles: VehiclePosition[];
  fetchedAt: number;
}
