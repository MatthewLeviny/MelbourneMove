"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { VehiclePosition, VehiclesResponse } from "@/types/vehicle";
import TrainPopup from "./TrainPopup";
import StatusBar from "./StatusBar";
import type { LayerVisibility } from "./LayersControl";

const MELBOURNE = { latitude: -37.8136, longitude: 144.9631 };
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const POLL_INTERVAL_MS = 30_000;

function toGeoJSON(vehicles: VehiclePosition[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature",
      id: v.id,
      geometry: {
        type: "Point",
        coordinates: [v.longitude, v.latitude],
      },
      properties: {
        id: v.id,
        bearing: v.bearing,
        speed: v.speed,
        tripId: v.tripId,
        routeId: v.routeId,
        label: v.label,
        timestamp: v.timestamp,
      },
    })),
  };
}

// Create a teardrop/arrow marker: circle on one end, pointed on the other.
// Points upward (north) by default; icon-rotate uses bearing to orient.
function createMarkerImage(
  fillColor: string,
  strokeColor: string,
  size: number
): ImageData {
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;

  ctx.beginPath();
  // Pointed tip at top (direction of travel)
  ctx.moveTo(cx, cy - r * 1.6);
  // Right arc
  ctx.quadraticCurveTo(cx + r * 1.2, cy - r * 0.3, cx + r, cy + r * 0.2);
  // Bottom semicircle
  ctx.arc(cx, cy + r * 0.2, r, 0, Math.PI, false);
  // Left arc
  ctx.quadraticCurveTo(cx - r * 1.2, cy - r * 0.3, cx, cy - r * 1.6);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function createCircleImage(
  fillColor: string,
  strokeColor: string,
  size: number
): ImageData {
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// --- Route line layers ---
const trainLineLayer: maplibregl.LayerSpecification = {
  id: "train-lines",
  type: "line",
  source: "train-lines",
  paint: {
    "line-color": ["get", "color"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 3],
    "line-opacity": 0.6,
  },
  layout: { "line-cap": "round", "line-join": "round" },
};

const tramLineLayer: maplibregl.LayerSpecification = {
  id: "tram-lines",
  type: "line",
  source: "tram-lines",
  paint: {
    "line-color": ["get", "color"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 2.5],
    "line-opacity": 0.5,
  },
  layout: { "line-cap": "round", "line-join": "round" },
};

const vlineLineLayer: maplibregl.LayerSpecification = {
  id: "vline-lines",
  type: "line",
  source: "vline-lines",
  paint: {
    "line-color": ["get", "color"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 3],
    "line-opacity": 0.6,
  },
  layout: { "line-cap": "round", "line-join": "round" },
};

// --- Vehicle symbol layers (defined after map load registers images) ---
function vehicleSymbolLayer(
  id: string,
  source: string,
  arrowImage: string,
  circleImage: string,
  circleOnly = false
): maplibregl.LayerSpecification {
  return {
    id,
    type: "symbol",
    source,
    layout: {
      "icon-image": circleOnly
        ? circleImage
        : [
            "case",
            ["!=", ["get", "bearing"], null],
            arrowImage,
            circleImage,
          ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 1],
      ...(circleOnly
        ? {}
        : {
            "icon-rotate": ["coalesce", ["get", "bearing"], 0],
            "icon-rotation-alignment": "map" as const,
          }),
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-opacity": 0.9,
    },
  };
}

// --- Glow layers (still circles, underneath symbols) ---
function glowLayer(
  id: string,
  source: string,
  color: string
): maplibregl.LayerSpecification {
  return {
    id,
    type: "circle",
    source,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 14],
      "circle-color": color,
      "circle-opacity": 0.15,
    },
  };
}

export default function TrainMap() {
  const mapRef = useRef<MapRef>(null);
  const [metroVehicles, setMetroVehicles] = useState<VehiclePosition[]>([]);
  const [vlineVehicles, setVlineVehicles] = useState<VehiclePosition[]>([]);
  const [tramVehicles, setTramVehicles] = useState<VehiclePosition[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "connected" | "error">(
    "loading"
  );
  const [selectedVehicle, setSelectedVehicle] =
    useState<VehiclePosition | null>(null);
  const [trainLines, setTrainLines] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [vlineLines, setVlineLines] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [tramLines, setTramLines] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [routeNames, setRouteNames] = useState<
    Record<string, { name: string; color: string }>
  >({});
  const [layers, setLayers] = useState<LayerVisibility>({
    trains: true,
    vline: true,
    trams: true,
  });

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Load static route geometry
  useEffect(() => {
    fetch("/train-lines.geojson")
      .then((res) => res.json())
      .then(setTrainLines)
      .catch((err) => console.error("Failed to load train lines:", err));
    fetch("/vline-lines.geojson")
      .then((res) => res.json())
      .then(setVlineLines)
      .catch((err) => console.error("Failed to load V/Line lines:", err));
    fetch("/tram-lines.geojson")
      .then((res) => res.json())
      .then(setTramLines)
      .catch((err) => console.error("Failed to load tram lines:", err));
    fetch("/route-names.json")
      .then((res) => res.json())
      .then(setRouteNames)
      .catch((err) => console.error("Failed to load route names:", err));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [metroRes, vlineRes, tramRes] = await Promise.all([
        fetch("/api/vehicles?mode=metro"),
        fetch("/api/vehicles?mode=vline"),
        fetch("/api/vehicles?mode=tram"),
      ]);
      if (!metroRes.ok) throw new Error(`Metro HTTP ${metroRes.status}`);
      if (!vlineRes.ok) throw new Error(`V/Line HTTP ${vlineRes.status}`);
      if (!tramRes.ok) throw new Error(`Tram HTTP ${tramRes.status}`);

      const metroData: VehiclesResponse = await metroRes.json();
      const vlineData: VehiclesResponse = await vlineRes.json();
      const tramData: VehiclesResponse = await tramRes.json();

      setMetroVehicles(metroData.vehicles);
      setVlineVehicles(vlineData.vehicles);
      setTramVehicles(tramData.vehicles);
      setFetchedAt(Date.now());
      setStatus("connected");
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const metroGeojson = toGeoJSON(metroVehicles);
  const vlineGeojson = toGeoJSON(vlineVehicles);
  const tramGeojson = toGeoJSON(tramVehicles);

  const allVehicles = [
    ...(layers.trains ? metroVehicles : []),
    ...(layers.vline ? vlineVehicles : []),
    ...(layers.trams ? tramVehicles : []),
  ];

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) {
        setSelectedVehicle(null);
        return;
      }
      const props = feature.properties;
      const vehicle = allVehicles.find((v) => v.id === props?.id);
      setSelectedVehicle(vehicle ?? null);
    },
    [allVehicles]
  );

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Register directional marker + circle fallback images
    const markers = [
      { name: "marker-metro", fill: "#00e5ff", stroke: "#006064" },
      { name: "marker-vline", fill: "#a855f7", stroke: "#581c87" },
      { name: "marker-tram", fill: "#4ade80", stroke: "#166534" },
    ];
    const pr = window.devicePixelRatio || 1;
    for (const m of markers) {
      map.addImage(m.name, createMarkerImage(m.fill, m.stroke, 32), { pixelRatio: pr });
      map.addImage(`${m.name}-circle`, createCircleImage(m.fill, m.stroke, 32), { pixelRatio: pr });
    }

    const interactiveLayers = ["trains-symbol", "vline-symbol", "tram-symbol"];
    for (const layerId of interactiveLayers) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, []);

  const totalCount =
    (layers.trains ? metroVehicles.length : 0) +
    (layers.vline ? vlineVehicles.length : 0) +
    (layers.trams ? tramVehicles.length : 0);

  return (
    <div className="relative w-screen h-screen">
      <Map
        ref={mapRef}
        initialViewState={{
          ...MELBOURNE,
          zoom: 11,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onClick={handleClick}
        onLoad={handleMapLoad}
        interactiveLayerIds={["trains-symbol", "vline-symbol", "tram-symbol"]}
      >
        <NavigationControl position="top-right" />

        {/* Metro train routes + vehicles */}
        {trainLines && layers.trains && (
          <Source id="train-lines" type="geojson" data={trainLines}>
            <Layer {...trainLineLayer} />
          </Source>
        )}
        {layers.trains && (
          <Source id="trains" type="geojson" data={metroGeojson}>
            <Layer {...glowLayer("trains-glow", "trains", "#00e5ff")} />
            <Layer {...vehicleSymbolLayer("trains-symbol", "trains", "marker-metro", "marker-metro-circle")} />
          </Source>
        )}

        {/* V/Line routes + vehicles */}
        {vlineLines && layers.vline && (
          <Source id="vline-lines" type="geojson" data={vlineLines}>
            <Layer {...vlineLineLayer} />
          </Source>
        )}
        {layers.vline && (
          <Source id="vline-vehicles" type="geojson" data={vlineGeojson}>
            <Layer {...glowLayer("vline-glow", "vline-vehicles", "#a855f7")} />
            <Layer {...vehicleSymbolLayer("vline-symbol", "vline-vehicles", "marker-vline", "marker-vline-circle")} />
          </Source>
        )}

        {/* Tram routes + vehicles */}
        {tramLines && layers.trams && (
          <Source id="tram-lines" type="geojson" data={tramLines}>
            <Layer {...tramLineLayer} />
          </Source>
        )}
        {layers.trams && (
          <Source id="tram-vehicles" type="geojson" data={tramGeojson}>
            <Layer {...glowLayer("tram-glow", "tram-vehicles", "#4ade80")} />
            <Layer {...vehicleSymbolLayer("tram-symbol", "tram-vehicles", "marker-tram", "marker-tram-circle", true)} />
          </Source>
        )}

        {selectedVehicle && (
          <TrainPopup
            vehicle={selectedVehicle}
            routeNames={routeNames}
            onClose={() => setSelectedVehicle(null)}
          />
        )}
      </Map>

      <StatusBar
        trainCount={totalCount}
        fetchedAt={fetchedAt}
        status={status}
        layers={layers}
        onToggleLayer={handleToggleLayer}
      />
    </div>
  );
}
