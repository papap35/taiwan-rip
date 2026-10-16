// 產生「示範用」事件資料（非真實事件）。
// 用法：node tools/generate-demo-data.mjs > public/data/incidents.json
// 真實資料請改用 README 說明的 CSV / JSON 格式匯入。

import { pathToFileURL } from 'node:url';

/** 每次呼叫都從同一個種子重新產生，結果完全相同 */
export function generateDemo() {
  // 固定種子的 PRNG，讓每次產生的資料一致
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20261014);
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = (items) => {
    const total = items.reduce((s, i) => s + i.w, 0);
    let r = rand() * total;
    for (const i of items) { if ((r -= i.w) <= 0) return i; }
    return items[items.length - 1];
  };

  // [縣市, 緯度, 經度, 權重(約略人口), 擴散半徑(度)]
  const COUNTIES = [
    ['臺北市', 25.0375, 121.5637, 2.5, 0.035],
    ['新北市', 25.012, 121.465, 4.0, 0.06],
    ['桃園市', 24.993, 121.301, 2.3, 0.06],
    ['臺中市', 24.147, 120.674, 2.8, 0.06],
    ['臺南市', 22.999, 120.227, 1.9, 0.05],
    ['高雄市', 22.627, 120.301, 2.7, 0.045],
    ['基隆市', 25.128, 121.742, 0.4, 0.012],
    ['新竹市', 24.804, 120.968, 0.45, 0.02],
    ['新竹縣', 24.839, 121.018, 0.55, 0.03],
    ['苗栗縣', 24.56, 120.821, 0.5, 0.03],
    ['彰化縣', 24.075, 120.544, 1.2, 0.04],
    ['南投縣', 23.91, 120.685, 0.5, 0.03],
    ['雲林縣', 23.709, 120.431, 0.65, 0.04],
    ['嘉義市', 23.48, 120.449, 0.26, 0.015],
    ['嘉義縣', 23.459, 120.33, 0.48, 0.03],
    ['屏東縣', 22.669, 120.488, 0.78, 0.035],
    ['宜蘭縣', 24.757, 121.753, 0.45, 0.025],
    ['花蓮縣', 23.991, 121.601, 0.32, 0.012],
    ['臺東縣', 22.755, 121.144, 0.21, 0.012],
    ['澎湖縣', 23.571, 119.579, 0.1, 0.008],
    ['金門縣', 24.436, 118.318, 0.14, 0.012],
    ['連江縣', 26.16, 119.951, 0.02, 0.004],
  ].map(([county, lat, lng, w, s]) => ({ county, lat, lng, w, s }));

  const TYPES = [
    { type: 'traffic_fatal', w: 30 },
    { type: 'assault', w: 25 },
    { type: 'theft', w: 20 },
    { type: 'drugs', w: 10 },
    { type: 'robbery', w: 6 },
    { type: 'accident_fatal', w: 6 },
    { type: 'homicide', w: 3 },
  ];
  const SEVERITY = { homicide: 5, traffic_fatal: 4, accident_fatal: 4, robbery: 3, assault: 2, drugs: 2, theft: 1 };
  const LABEL = {
    homicide: '他殺命案', traffic_fatal: '交通事故死亡', accident_fatal: '意外死亡',
    robbery: '強盜搶奪', assault: '傷害鬥毆', drugs: '毒品案件', theft: '竊盜',
  };

  // 幾個「近期升溫」的示範熱點，用來展示 AI 分群會抓到趨勢
  const HOTSPOTS = [
    { county: '新北市', lat: 25.06, lng: 121.46, start: '2026-05-01', n: 70, s: 0.008 },
    { county: '臺中市', lat: 24.138, lng: 120.686, start: '2026-07-01', n: 55, s: 0.007 },
    { county: '高雄市', lat: 22.63, lng: 120.30, start: '2026-03-01', n: 60, s: 0.008 },
    { county: '桃園市', lat: 24.955, lng: 121.225, start: '2026-08-01', n: 40, s: 0.006 },
  ];

  const START = Date.UTC(2024, 9, 1); // 2024-10-01
  const END = Date.UTC(2026, 8, 30); // 2026-09-30
  const DAY = 86400000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  const out = [];
  const push = (c, lat, lng, t) => {
    const { type } = pick(TYPES);
    out.push({
      id: `demo-${String(out.length + 1).padStart(5, '0')}`,
      date: iso(t),
      lat: +lat.toFixed(5),
      lng: +lng.toFixed(5),
      type,
      severity: SEVERITY[type],
      county: c,
      title: `【示範】${c}${LABEL[type]}`,
      source: 'demo',
    });
  };

  for (let i = 0; i < 1500; i++) {
    const c = pick(COUNTIES);
    const t = START + Math.floor(rand() * ((END - START) / DAY + 1)) * DAY;
    push(c.county, c.lat + gauss() * c.s, c.lng + gauss() * c.s, t);
  }
  for (const h of HOTSPOTS) {
    const s = Date.parse(h.start);
    for (let i = 0; i < h.n; i++) {
      const t = s + Math.floor(rand() * ((END - s) / DAY + 1)) * DAY;
      push(h.county, h.lat + gauss() * h.s, h.lng + gauss() * h.s, t);
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  out.forEach((d, i) => (d.id = `demo-${String(i + 1).padStart(5, '0')}`));
  return {
    meta: {
      name: '示範資料（隨機產生，非真實事件）',
      demo: true,
      generated: 'tools/generate-demo-data.mjs',
      disclaimer: '本檔案所有事件皆為程式隨機產生，僅供展示介面功能。',
    },
    incidents: out,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(JSON.stringify(generateDemo()));
}
