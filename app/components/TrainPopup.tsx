"use client";

import { Popup } from "react-map-gl/maplibre";
import type { VehiclePosition } from "@/types/vehicle";

interface TrainPopupProps {
  vehicle: VehiclePosition;
  routeNames: Record<string, { name: string; color: string }>;
  onClose: () => void;
}

function formatTime(ts: number): string {
  if (!ts) return "Unknown";
  return new Date(ts * 1000).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TrainPopup({ vehicle, routeNames, onClose }: TrainPopupProps) {
  const route = routeNames[vehicle.routeId];
  const lineName = route?.name ?? null;
  const lineColor = route?.color ?? null;

  return (
    <Popup
      longitude={vehicle.longitude}
      latitude={vehicle.latitude}
      anchor="bottom"
      onClose={onClose}
      closeOnClick={false}
      className="train-popup"
    >
      <div className="min-w-[200px] p-3 bg-zinc-900 text-zinc-100 rounded-lg text-sm">
        <h3 className="text-base font-semibold text-cyan-400 mb-2">
          {vehicle.label ? `Train ${vehicle.label}` : `Vehicle ${vehicle.id}`}
        </h3>
        <div className="space-y-1">
          {lineName && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Line</span>
              <span className="font-medium flex items-center gap-1.5">
                {lineColor && (
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: lineColor }}
                  />
                )}
                {lineName}
              </span>
            </div>
          )}
          {vehicle.routeId && !lineName && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Route</span>
              <span className="font-medium">{vehicle.routeId}</span>
            </div>
          )}
          {vehicle.origin && (
            <div className="flex justify-between">
              <span className="text-zinc-400">From</span>
              <span className="font-medium">{vehicle.origin}</span>
            </div>
          )}
          {vehicle.destination && (
            <div className="flex justify-between">
              <span className="text-zinc-400">To</span>
              <span className="font-medium">{vehicle.destination}</span>
            </div>
          )}
          {vehicle.speed !== null && vehicle.speed > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Speed</span>
              <span className="font-medium">
                {Math.round(vehicle.speed * 3.6)} km/h
              </span>
            </div>
          )}
          {vehicle.bearing !== null && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Bearing</span>
              <span className="font-medium">{Math.round(vehicle.bearing)}&deg;</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-400">Updated</span>
            <span className="font-medium">{formatTime(vehicle.timestamp)}</span>
          </div>
        </div>
      </div>
    </Popup>
  );
}
