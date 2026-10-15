import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTemples } from '../lib/temple-schema.ts';

const ok = { id: 'test-temple', name: '測試宮', county: '臺北市', lat: 25.05, lng: 121.5, shoujing: true };

test('shipped temples.json passes validation', async () => {
  const json = JSON.parse(await readFile(new URL('../public/data/temples.json', import.meta.url), 'utf8'));
  const { temples, errors } = validateTemples(json);
  assert.deepEqual(errors, []);
  assert.ok(temples.length > 0);
});

test('reports missing, malformed, unknown and duplicate fields', () => {
  const { errors } = validateTemples({
    temples: [
      ok,
      { ...ok, name: '重複', website: 'http://insecure.example' },
      { name: '缺欄位', county: '台北', lat: 10, lng: 121.5, shoujing: 'yes', phon: '02-1234' },
      { ...ok, id: 'Bad_ID', verifiedOn: '2026/1/1' },
    ],
  });
  const text = errors.join('\n');
  for (const want of ['id 重複', 'website 必須是 https://', '缺少 id', '未知欄位 phon', '縣市「台北」', 'lat 不在', 'shoujing 必須是', 'id 只能用', 'verifiedOn 格式']) {
    assert.ok(text.includes(want), `expected error containing「${want}」\n${text}`);
  }
  assert.deepEqual(validateTemples({ temples: [] }).errors, ['缺少 temples 陣列或是空的']);
});
