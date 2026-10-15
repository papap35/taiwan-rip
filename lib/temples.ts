// 宮廟：最近收驚宮廟、導航連結、OpenStreetMap 即時搜尋。

import { haversineKm } from './risk.ts';

export interface Temple {
  name: string;
  lat: number;
  lng: number;
  county?: string;
  deity?: string;
  shoujing?: boolean;
  note?: string;
  /** 來自 OpenStreetMap 即時搜尋 */
  osm?: boolean;
}

export const gmapLink = (t: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;

export function nearestTemples(pt: { lat: number; lng: number }, temples: Temple[], n = 3) {
  return temples
    .map((t) => ({ ...t, km: haversineKm(pt, t) }))
    // 精選收驚宮廟優先（距離打 7 折）
    .sort((a, b) => a.km * (a.shoujing ? 0.7 : 1) - b.km * (b.shoujing ? 0.7 : 1))
    .slice(0, n);
}

/** bbox：[south, west, north, east] */
export async function searchOsmTemples(bbox: [number, number, number, number], signal?: AbortSignal): Promise<Temple[]> {
  const q = `[out:json][timeout:25];
    nwr["amenity"="place_of_worship"]["religion"~"taoist|buddhist|chinese_folk|folk"](${bbox.map((v) => v.toFixed(4)).join(',')});
    out center 300;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: q }),
    signal,
  });
  if (!res.ok) throw new Error(String(res.status));
  const json: { elements: any[] } = await res.json();
  return json.elements
    .map((e) => ({
      name: e.tags?.['name:zh'] || e.tags?.name || '',
      lat: e.lat ?? e.center?.lat,
      lng: e.lon ?? e.center?.lon,
      deity: e.tags?.['subject:zh'] || '',
      note: e.tags?.religion === 'buddhist' ? '佛寺' : '宮廟',
      osm: true,
    }))
    .filter((t) => Number.isFinite(t.lat) && t.name);
}
