import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCSV } from '../js/data.js';
import { convertRows, decode, parseDateTime, parseCasualties, guessCounty } from '../tools/convert-a1.mjs';

const load = async (name) => parseCSV(decode(await readFile(new URL(`./fixtures/${name}`, import.meta.url))));

test('parseDateTime handles AD, ROC and stripped leading zeros', () => {
  assert.deepEqual(parseDateTime('20230105', '73000'), { date: '2023-01-05', time: '07:30:00' });
  assert.deepEqual(parseDateTime('20230301', '1530'), { date: '2023-03-01', time: '00:15:30' });
  assert.deepEqual(parseDateTime('112年07月01日 08時05分00秒'), { date: '2023-07-01', time: '08:05:00' });
  assert.deepEqual(parseDateTime('1120101'), { date: '2023-01-01', time: '' });
  assert.deepEqual(parseDateTime('112/1/2', '13:05'), { date: '2023-01-02', time: '13:05:00' });
  assert.deepEqual(parseDateTime('2023-1-2'), { date: '2023-01-02', time: '' });
  assert.equal(parseDateTime('說明：本資料'), null);
  assert.equal(parseDateTime('20231340'), null);
});

test('parseCasualties and guessCounty', () => {
  assert.deepEqual(parseCasualties('死亡2;受傷3'), { deaths: 2, injuries: 3 });
  assert.deepEqual(parseCasualties(''), { deaths: 0, injuries: 0 });
  assert.equal(guessCounty('台中市政府警察局', ''), '臺中市');
  assert.equal(guessCounty('彰化縣警察局', ''), '彰化縣');
  assert.equal(guessCounty('國道公路警察局', '國道1號'), '國道');
  assert.equal(guessCounty('', '花蓮縣花蓮市測試街'), '花蓮縣');
});

test('yearly file: merges party rows, skips bad coords and footer', async () => {
  const { incidents, skipped } = convertRows(await load('a1-yearly.csv'));
  assert.equal(incidents.length, 2);
  assert.equal(skipped, 3); // abc 經度、外海座標、說明列

  const [taipei, freeway] = incidents;
  assert.equal(taipei.date, '2023-01-05');
  assert.equal(taipei.time, '07:30:00');
  assert.equal(taipei.county, '臺北市');
  assert.equal(taipei.deaths, 1);
  assert.equal(taipei.injuries, 1); // 不因兩位當事者而重複相加
  assert.equal(taipei.severity, 4);
  assert.deepEqual(taipei.vehicles, ['自用小客車', '普通重型機車']);
  assert.equal(taipei.cause, '未注意車前狀態');

  assert.equal(freeway.county, '國道');
  assert.equal(freeway.deaths, 2);
  assert.equal(freeway.severity, 5);
});

test('real-time Big5 file: ROC datetime in one column, vehicles split on ;', async () => {
  const { incidents } = convertRows(await load('a1-realtime-big5.csv'));
  assert.equal(incidents.length, 2);
  assert.equal(incidents[0].date, '2023-07-01');
  assert.equal(incidents[0].county, '彰化縣');
  assert.deepEqual(incidents[0].vehicles, ['普通重型-機車', '自用-小客車']);
  assert.equal(incidents[1].time, '21:40:12');
  assert.equal(incidents[1].title, '花蓮縣花蓮市測試街・死亡 1 人、受傷 2 人');
});

test('--since filter and stable ids', async () => {
  const rows = await load('a1-yearly.csv');
  const { incidents } = convertRows(rows, { since: '2023-02-01' });
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].id, convertRows(rows).incidents[1].id);
});
