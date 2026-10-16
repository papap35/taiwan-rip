// 事件 API 的 GeoJSON 格式 ↔ 事件紀錄
import type { Feature, FeatureCollection, Point } from 'geojson';

export function toFeatureCollection<R extends { lat: number; lng: number }, M>(records: R[], meta: M): FeatureCollection<Point> & { meta: M } {
  return {
    type: 'FeatureCollection',
    meta,
    features: records.map(({ lat, lng, ...props }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    })),
  };
}

export function fromFeatures(features: Feature<Point>[]): Record<string, unknown>[] {
  return features.map((f) => ({ ...(f.properties ?? {}), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
}
