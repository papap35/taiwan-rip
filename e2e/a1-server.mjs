// 端對端測試用：模擬 data.gov.tw 的 A1 CSV 下載（後台「立即匯入」與每日排程會抓這裡）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const csv = await readFile(new URL('../tests/fixtures/a1-realtime-big5.csv', import.meta.url));
createServer((req, res) => {
  if (req.url === '/a1.csv') {
    res.writeHead(200, { 'content-type': 'text/csv' });
    res.end(csv);
  } else res.writeHead(req.url === '/' ? 200 : 404).end('ok');
}).listen(3124, '127.0.0.1');
