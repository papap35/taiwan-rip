'use client';

import { useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import { setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { TYPES, type Incident } from '@/lib/data.ts';
import { LEVELS, type RiskCell } from '@/lib/risk.ts';
import type { Temple } from '@/lib/temples.ts';
import { IncidentPopup, RiskPopup, TemplePopup } from './Popups';

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// 由 tools/copy-maplibre-worker.mjs 在建置前複製到 public/
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const TAIWAN_BOUNDS: [[number, number], [number, number]] = [[120.0, 21.9], [122.0, 25.35]];

export interface MapViewHandle {
  /** [south, west, north, east] */
  getBounds(): [number, number, number, number] | null;
  getZoom(): number;
  flyTo(lat: number, lng: number, zoom: number): void;
}

interface Props {
  apiRef: RefObject<MapViewHandle | null>;
  incidents: Incident[];
  cells: RiskCell[];
  temples: Temple[];
  layers: { incidents: boolean; risk: boolean; temples: boolean };
  me: { lat: number; lng: number } | null;
  initialView?: { lat: number; lng: number; zoom: number };
  onViewChange(view: { lat: number; lng: number; zoom: number }): void;
  onBackgroundClick(): void;
}

type PopupState =
  | { kind: 'incident'; incident: Incident }
  | { kind: 'risk'; cell: RiskCell }
  | { kind: 'temple'; temple: Temple }
  | null;

const typeColor = ['match', ['get', 'type'], ...Object.entries(TYPES).flatMap(([k, v]) => [k, v.color]), '#9e9e9e'];
const levelColor = ['match', ['get', 'level'], ...LEVELS.flatMap((l, i) => [i, l.color]), '#9e9e9e'];

export default function MapView({ apiRef, incidents, cells, temples, layers, me, initialView, onViewChange, onBackgroundClick }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [popup, setPopup] = useState<PopupState>(null);
  const [zoom, setZoom] = useState(initialView?.zoom ?? 7);

  useImperativeHandle(apiRef, () => ({
    getBounds() {
      const b = mapRef.current?.getBounds();
      return b ? [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()] : null;
    },
    getZoom: () => mapRef.current?.getZoom() ?? 0,
    flyTo(lat, lng, z) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: z });
    },
  }));

  const byId = useMemo(() => new globalThis.Map(incidents.map((d) => [d.id, d])), [incidents]);
  const byKey = useMemo(() => new globalThis.Map(cells.map((c) => [c.key, c])), [cells]);

  const incidentGeo = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: incidents.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: { id: d.id, type: d.type, severity: d.severity },
    })),
  }), [incidents]);

  const riskGeo = useMemo<FeatureCollection<Polygon>>(() => ({
    type: 'FeatureCollection',
    features: cells.map((c) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[c.west, c.south], [c.east, c.south], [c.east, c.north], [c.west, c.north], [c.west, c.south]]],
      },
      properties: { key: c.key, level: c.level },
    })),
  }), [cells]);

  // 全台視野只顯示可收驚的宮廟，避免蓋住危險網格
  const visibleTemples = useMemo(
    () => (layers.temples ? temples.filter((t) => zoom >= 9 || t.shoujing) : []),
    [temples, layers.temples, zoom],
  );

  async function handleClick(e: MapLayerMouseEvent) {
    const f = e.features?.[0];
    if (!f) {
      setPopup(null);
      onBackgroundClick();
      return;
    }
    const p = f.properties as Record<string, any>;
    if (f.layer.id === 'clusters') {
      const src = mapRef.current?.getSource('incidents') as GeoJSONSource | undefined;
      if (!src) return;
      const z = await src.getClusterExpansionZoom(p.cluster_id);
      const [lng, lat] = (f.geometry as Point).coordinates;
      mapRef.current?.easeTo({ center: [lng, lat], zoom: z });
    } else if (f.layer.id === 'incident-points') {
      const incident = byId.get(p.id);
      if (incident) setPopup({ kind: 'incident', incident });
    } else if (f.layer.id === 'risk-fill') {
      const cell = byKey.get(p.key);
      if (cell) setPopup({ kind: 'risk', cell });
    }
  }

  function handleMoveEnd(e: ViewStateChangeEvent) {
    const { latitude, longitude, zoom: z } = e.viewState;
    setZoom(z);
    onViewChange({ lat: latitude, lng: longitude, zoom: z });
  }

  const popupAt =
    popup?.kind === 'incident' ? { lat: popup.incident.lat, lng: popup.incident.lng }
    : popup?.kind === 'risk' ? { lat: popup.cell.north, lng: (popup.cell.west + popup.cell.east) / 2 }
    : popup?.kind === 'temple' ? { lat: popup.temple.lat, lng: popup.temple.lng }
    : null;

  return (
    <Map
      ref={mapRef}
      mapStyle={MAP_STYLE}
      initialViewState={
        initialView
          ? { latitude: initialView.lat, longitude: initialView.lng, zoom: initialView.zoom }
          : { bounds: TAIWAN_BOUNDS, fitBoundsOptions: { padding: { top: 10, bottom: 130, left: 10, right: 10 } } }
      }
      interactiveLayerIds={['clusters', 'incident-points', 'risk-fill']}
      onClick={handleClick}
      onMoveEnd={handleMoveEnd}
      cursor="auto"
      style={{ position: 'absolute', inset: 0 }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="risk" type="geojson" data={riskGeo}>
        <Layer
          id="risk-fill"
          type="fill"
          layout={{ visibility: layers.risk ? 'visible' : 'none' }}
          paint={{
            'fill-color': levelColor as any,
            'fill-opacity': ['+', 0.12, ['*', ['get', 'level'], 0.1]] as any,
          }}
        />
        <Layer
          id="risk-line"
          type="line"
          layout={{ visibility: layers.risk ? 'visible' : 'none' }}
          paint={{ 'line-color': levelColor as any, 'line-width': ['case', ['>=', ['get', 'level'], 2], 1.5, 0.5] as any }}
        />
      </Source>

      <Source id="incidents" type="geojson" data={incidentGeo} cluster clusterMaxZoom={10} clusterRadius={36}>
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          layout={{ visibility: layers.incidents ? 'visible' : 'none' }}
          paint={{
            'circle-color': '#455a64',
            'circle-opacity': 0.85,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
            'circle-radius': ['step', ['get', 'point_count'], 12, 20, 16, 100, 22] as any,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            visibility: layers.incidents ? 'visible' : 'none',
            'text-field': ['get', 'point_count_abbreviated'] as any,
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
          }}
          paint={{ 'text-color': '#fff' }}
        />
        <Layer
          id="incident-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          layout={{ visibility: layers.incidents ? 'visible' : 'none' }}
          paint={{
            'circle-color': typeColor as any,
            'circle-opacity': 0.85,
            'circle-radius': ['+', 3, ['get', 'severity']] as any,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1,
          }}
        />
      </Source>

      {visibleTemples.map((t) => {
        const small = t.osm || zoom < 10;
        return (
          <Marker
            key={`${t.osm ? 'osm' : 'cur'}-${t.name}-${t.lat}-${t.lng}`}
            latitude={t.lat}
            longitude={t.lng}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup({ kind: 'temple', temple: t });
            }}
          >
            <button
              type="button"
              aria-label={`宮廟：${t.name}`}
              className={`grid place-items-center rounded-full shadow ${
                t.shoujing ? 'border-[#c0392b] bg-[#ffe0b2]' : 'border-[#b8860b] bg-[#fff8e1]'
              } ${small ? 'size-5 border text-[11px]' : 'size-7 border-2 text-[15px]'}`}
            >
              🏮
            </button>
          </Marker>
        );
      })}

      {me && (
        <Marker latitude={me.lat} longitude={me.lng}>
          <div className="size-4 rounded-full border-[3px] border-white bg-[#1e88e5] shadow-[0_0_0_2px_#1e88e5]" aria-label="我的位置" />
        </Marker>
      )}

      {popup && popupAt && (
        <Popup latitude={popupAt.lat} longitude={popupAt.lng} closeOnClick={false} onClose={() => setPopup(null)} maxWidth="300px">
          {popup.kind === 'incident' && <IncidentPopup incident={popup.incident} temples={temples} />}
          {popup.kind === 'risk' && <RiskPopup cell={popup.cell} temples={temples} />}
          {popup.kind === 'temple' && <TemplePopup temple={popup.temple} />}
        </Popup>
      )}
    </Map>
  );
}
