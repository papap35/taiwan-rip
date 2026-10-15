import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlState, serializeUrlState } from '../lib/url-state.ts';
import { TYPE_KEYS } from '../lib/data.ts';

test('parses valid parameters and ignores invalid ones', () => {
  assert.deepEqual(parseUrlState('?end=2025-07-28&window=30&types=homicide,bogus,theft&lat=25.04&lng=121.53&z=12'), {
    end: '2025-07-28', window: 30, types: ['homicide', 'theft'], view: { lat: 25.04, lng: 121.53, zoom: 12 },
  });
  assert.deepEqual(parseUrlState('?end=2025-13-99&window=45&lat=40&lng=121&z=12'), {});
  assert.deepEqual(parseUrlState('?window=0&types='), { window: 0, types: [] });
  assert.deepEqual(parseUrlState(''), {});
});

test('serializes only non-default values and round-trips', () => {
  const all = { end: '2026-09-30', window: 90, types: [...TYPE_KEYS] };
  assert.equal(serializeUrlState(all, '2026-09-30'), '');

  const s = { end: '2025-07-28', window: 30, types: ['homicide', 'traffic_fatal'], view: { lat: 25.04321, lng: 121.5, zoom: 11.5 } };
  const q = serializeUrlState(s, '2026-09-30');
  assert.equal(q, '?end=2025-07-28&window=30&types=homicide%2Ctraffic_fatal&lat=25.0432&lng=121.5000&z=11.50');
  assert.deepEqual(parseUrlState(q), { ...s, view: { lat: 25.0432, lng: 121.5, zoom: 11.5 } });
});
