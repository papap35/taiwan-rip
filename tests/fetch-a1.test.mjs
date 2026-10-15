import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 用本機伺服器模擬 data.gov.tw 的資料集 API 與檔案下載
let server, base, mod;
const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url));

before(async () => {
  server = createServer(async (req, res) => {
    const routes = {
      '/api/12818': () => JSON.stringify({
        success: true,
        result: {
          title: '即時交通事故資料(A1類)',
          landingPageUrl: 'https://data.gov.tw/dataset/12818',
          distributionFormats: 'CSV',
          distribution: [
            { resourceFormat: 'CSV', resourceDownloadUrl: `${base}/files/a1.csv` },
            { resourceFormat: 'JSON', resourceDownloadUrl: `${base}/files/a1.json` },
          ],
        },
      }),
      '/api/nocsv': () => JSON.stringify({ result: { distribution: [{ resourceFormat: 'XML', resourceDownloadUrl: `${base}/x.xml` }] } }),
      '/files/a1.csv': () => fixture('a1-yearly.csv'),
      '/files/big5.csv': () => fixture('a1-realtime-big5.csv'),
      '/files/changed.csv': () => '日期,地點,X座標,Y座標\n2023-01-01,某處,1,2\n2023-01-02,某處,1,2\n',
      '/files/page.html': () => '<!doctype html><html><body>系統維護中</body></html>',
    };
    const route = routes[req.url];
    if (!route) return res.writeHead(404).end();
    res.end(await route());
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.A1_API_BASE = `${base}/api/`;
  mod = await import('../tools/fetch-a1.mjs');
});
after(() => server.close());

const tempOut = async (content) => {
  const p = join(await mkdtemp(join(tmpdir(), 'a1-')), 'incidents.json');
  if (content) await writeFile(p, JSON.stringify(content));
  return p;
};
const quiet = () => {};

test('findCsvUrls picks CSV resources only, not landing pages', () => {
  const urls = mod.findCsvUrls({
    landingPageUrl: 'https://data.gov.tw/dataset/12818', distributionFormats: 'CSV',
    distribution: [
      { resourceFormat: 'CSV', resourceDownloadUrl: 'https://example.gov.tw/a.csv' },
      { resourceFormat: 'JSON', resourceDownloadUrl: 'https://example.gov.tw/a.json' },
      { format: 'xml', downloadURL: 'https://example.gov.tw/b' },
      { mimeType: 'text/csv', link: 'https://example.gov.tw/c' },
    ],
  });
  assert.deepEqual(urls, ['https://example.gov.tw/a.csv', 'https://example.gov.tw/c']);
});

test('resolves dataset, replaces demo data, and is idempotent', async () => {
  const out = await tempOut({ meta: { demo: true }, incidents: [{ id: 'demo-1', date: '2026-01-01', lat: 25, lng: 121.5, type: 'theft', source: 'demo' }] });
  const first = await mod.run({ datasets: ['12818'], out, keepYears: 0, log: quiet });
  assert.deepEqual(first, { previous: 0, added: 2, total: 2, range: ['2023-01-05', '2023-02-10'] });

  const written = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(written.meta.demo, false);
  assert.ok(written.incidents.every((d) => d.source !== 'demo'));
  assert.deepEqual(written.meta.sources, [`${base}/files/a1.csv`]);

  const second = await mod.run({ datasets: ['12818'], out, keepYears: 0, log: quiet });
  assert.equal(second.added, 0);
  assert.equal(second.total, 2);
});

test('direct URLs are merged with existing real data', async () => {
  const out = await tempOut();
  await mod.run({ urls: [`${base}/files/a1.csv`], out, keepYears: 0, log: quiet });
  const s = await mod.run({ urls: [`${base}/files/big5.csv`], out, keepYears: 0, log: quiet });
  assert.equal(s.previous, 2);
  assert.equal(s.added, 2);
  assert.equal(s.total, 4);
});

test('refuses to write when the format changed or the download is a web page', async () => {
  const out = await tempOut({ meta: { demo: false }, incidents: [] });
  await assert.rejects(mod.run({ urls: [`${base}/files/changed.csv`], out, log: quiet }), /欄位可能改變/);
  await assert.rejects(mod.run({ urls: [`${base}/files/page.html`], out, log: quiet }), /網頁而不是 CSV/);
  await assert.rejects(mod.run({ datasets: ['nocsv'], out, log: quiet }), /找不到 CSV/);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')).incidents, []); // 檔案沒被動到
});

test('dry run does not write; retention keeps the latest N years', async () => {
  const out = await tempOut();
  await mod.run({ urls: [`${base}/files/a1.csv`], out, dryRun: true, log: quiet });
  await assert.rejects(readFile(out));

  const list = ['2020-01-01', '2021-12-01', '2022-06-01', '2023-02-10'].map((date, i) => ({ id: String(i), date }));
  assert.deepEqual(mod.applyRetention(list, 1).map((d) => d.date), ['2022-06-01', '2023-02-10']);
  assert.equal(mod.applyRetention(list, 0).length, 4);
});
