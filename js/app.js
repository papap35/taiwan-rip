import { TYPES, normalizeIncident, parseIncidentFile } from './data.js';
import { analyzeRisk, LEVELS, haversineKm } from './risk.js';

const DAY = 86400000;
const $ = (id) => document.getElementById(id);
const fmt = (t) => new Date(t).toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  all: [],
  demo: [],
  minT: 0,
  maxT: 0,
  endT: 0,
  windowDays: 90,
  types: new Set(Object.keys(TYPES)),
  temples: [],
  osmTemples: [],
  cells: [],
  playing: null,
};

// ── 地圖 ──────────────────────────────────────────────
const map = L.map('map', { zoomControl: false, preferCanvas: true });
map.fitBounds([[21.9, 120.0], [25.35, 122.0]], { paddingTopLeft: [0, 10], paddingBottomRight: [0, 130] });
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const riskLayer = L.layerGroup().addTo(map);
const incidentLayer = L.layerGroup().addTo(map);
const templeLayer = L.layerGroup().addTo(map);
const meLayer = L.layerGroup().addTo(map);

// ── 初始化 ────────────────────────────────────────────
init();

async function init() {
  buildTypeFilters();
  $('riskLegend').innerHTML = LEVELS.map((l) => `<li style="background:${l.color}">${l.label}</li>`).join('');
  bindUI();

  const [inc, tmp] = await Promise.all([
    fetch('data/incidents.json').then((r) => r.json()),
    fetch('data/temples.json').then((r) => r.json()),
  ]);
  state.demo = inc.incidents.map(normalizeIncident).filter(Boolean);
  state.defaultIsDemo = inc.meta?.demo !== false;
  state.temples = tmp.temples;
  setData(state.demo, state.defaultIsDemo);
  renderTemples();
}

function setData(list, isDemo) {
  state.all = list.slice().sort((a, b) => a.t - b.t);
  state.minT = state.all[0]?.t ?? Date.now();
  state.maxT = state.all.at(-1)?.t ?? Date.now();
  state.endT = state.maxT;
  const slider = $('dateSlider');
  slider.max = Math.round((state.maxT - state.minT) / DAY);
  slider.value = slider.max;
  $('dataNotice').hidden = !isDemo;
  update();
}

// ── 篩選與繪製 ────────────────────────────────────────
function filtered() {
  const start = state.windowDays ? state.endT - (state.windowDays - 1) * DAY : -Infinity;
  return state.all.filter((d) => d.t <= state.endT && d.t >= start && state.types.has(d.type));
}

let raf = 0;
function update() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const list = filtered();
    const windowDays = state.windowDays || Math.max(1, Math.round((state.endT - state.minT) / DAY) + 1);
    state.cells = analyzeRisk(list, { endT: state.endT, windowDays });
    renderIncidents(list);
    renderRisk();
    renderTimelineLabel(list);
    drawHistogram();
  });
}

function renderIncidents(list) {
  incidentLayer.clearLayers();
  if (!$('layerIncidents').checked) return;
  for (const d of list) {
    const ty = TYPES[d.type];
    L.circleMarker([d.lat, d.lng], {
      radius: 3 + d.severity,
      color: '#fff',
      weight: 1,
      fillColor: ty.color,
      fillOpacity: 0.85,
    })
      .bindPopup(() => `
        <h3>${esc(d.title)}</h3>
        <div>${fmt(d.t)}${d.time ? ` ${esc(d.time.slice(0, 5))}` : ''}・${esc(ty.label)}・嚴重度 ${d.severity}/5</div>
        ${d.deaths != null ? `<div>死亡 ${d.deaths} 人${d.injuries ? `、受傷 ${d.injuries} 人` : ''}</div>` : ''}
        ${d.cause ? `<div>初步肇因：${esc(d.cause)}</div>` : ''}
        ${d.vehicles ? `<div>車種：${esc(d.vehicles)}</div>` : ''}
        ${d.county ? `<div>${esc(d.county)}</div>` : ''}
        ${/^https?:\/\//.test(d.source) ? `<a href="${esc(d.source)}" target="_blank" rel="noopener">資料來源</a>` : ''}
        ${nearbyTemplesHTML(d)}`)
      .addTo(incidentLayer);
  }
}

function renderRisk() {
  riskLayer.clearLayers();
  const counts = LEVELS.map(() => 0);
  for (const c of state.cells) counts[c.level]++;
  $('riskStats').textContent = state.cells.length
    ? `共 ${state.cells.length} 個有事件的網格：` + LEVELS.map((l, i) => `${l.label} ${counts[i]}`).join('、')
    : '目前時間窗內沒有事件。';
  if (!$('layerRisk').checked) return;
  for (const c of state.cells) {
    const lvl = LEVELS[c.level];
    L.rectangle([[c.south, c.west], [c.north, c.east]], {
      color: lvl.color,
      weight: c.level >= 2 ? 1.5 : 0.5,
      fillColor: lvl.color,
      fillOpacity: 0.12 + c.level * 0.1,
    })
      .bindPopup(() => riskPopup(c))
      .addTo(riskLayer);
  }
}

function riskPopup(c) {
  const lvl = LEVELS[c.level];
  const top = Object.entries(c.types).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => `${TYPES[k].label} ${n}`).join('、');
  const reasons = [];
  reasons.push(`時間窗內 ${c.count} 起事件（${top}）`);
  if (c.fatal) reasons.push(`其中 ${c.fatal} 起為死亡或重大事件`);
  if (c.count >= 4 && c.trend > 0.45) reasons.push(`近期 1/3 時段集中了 ${Math.round(c.trend * 100)}% 的事件，有升溫趨勢`);
  const center = { lat: (c.south + c.north) / 2, lng: (c.west + c.east) / 2 };
  return `
    <h3>AI 危險分級 <span class="lvl" style="background:${lvl.color}">${lvl.label}</span></h3>
    <div>${esc(lvl.advice)}</div>
    <ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    ${nearbyTemplesHTML(center)}`;
}

// ── 宮廟 ──────────────────────────────────────────────
function templeIcon(t) {
  const small = t.osm || map.getZoom() < 10; // 縮小檢視時圖示變小，避免蓋住危險網格
  const cls = ['temple-icon', t.shoujing ? 'shoujing' : '', small ? 'small' : ''].join(' ');
  return L.divIcon({ className: '', html: `<div class="${cls}">🏮</div>`, iconSize: small ? [20, 20] : [28, 28] });
}

function gmapLink(t) {
  return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
}

function renderTemples() {
  templeLayer.clearLayers();
  if (!$('layerTemples').checked) return;
  const zoomedOut = map.getZoom() < 9;
  for (const t of [...state.osmTemples, ...state.temples]) {
    if (zoomedOut && !t.shoujing) continue; // 全台視野只顯示有收驚的宮廟
    L.marker([t.lat, t.lng], { icon: templeIcon(t), zIndexOffset: t.osm ? 0 : 500 })
      .bindPopup(`
        <h3>${esc(t.name)}</h3>
        ${t.deity ? `<div>主祀：${esc(t.deity)}</div>` : ''}
        ${t.shoujing ? '<div><b>✓ 提供收驚</b>（時段請先確認）</div>' : ''}
        ${t.note ? `<div>${esc(t.note)}</div>` : ''}
        <a href="${gmapLink(t)}" target="_blank" rel="noopener">導航前往</a>`)
      .addTo(templeLayer);
  }
}

function nearestTemples(pt, n = 3) {
  return [...state.temples, ...state.osmTemples]
    .map((t) => ({ ...t, km: haversineKm(pt, t) }))
    // 精選收驚宮廟優先（距離打 7 折）
    .sort((a, b) => a.km * (a.shoujing ? 0.7 : 1) - b.km * (b.shoujing ? 0.7 : 1))
    .slice(0, n);
}

function nearbyTemplesHTML(pt) {
  const list = nearestTemples(pt);
  if (!list.length) return '';
  return `<div style="margin-top:6px"><b>附近可收驚／祈福</b><ul>${list
    .map((t) => `<li><a href="${gmapLink(t)}" target="_blank" rel="noopener">${esc(t.name)}</a> ${t.km.toFixed(1)} km${t.shoujing ? '・收驚' : ''}</li>`)
    .join('')}</ul></div>`;
}

async function searchOSMTemples() {
  const btn = $('overpassBtn');
  if (map.getZoom() < 11) {
    $('templeHint').textContent = '請先放大地圖（到鄉鎮範圍）再搜尋附近宮廟。';
    return;
  }
  const b = map.getBounds();
  const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((v) => v.toFixed(4)).join(',');
  const q = `[out:json][timeout:25];
    nwr["amenity"="place_of_worship"]["religion"~"taoist|buddhist|chinese_folk|folk"](${bbox});
    out center 300;`;
  btn.disabled = true;
  $('templeHint').textContent = '搜尋中…';
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) });
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    state.osmTemples = json.elements
      .map((e) => ({
        name: e.tags?.['name:zh'] || e.tags?.name || '未命名宮廟',
        lat: e.lat ?? e.center?.lat,
        lng: e.lon ?? e.center?.lon,
        deity: e.tags?.['subject:zh'] || '',
        note: e.tags?.religion === 'buddhist' ? '佛寺' : '宮廟',
        osm: true,
      }))
      .filter((t) => Number.isFinite(t.lat) && t.name !== '未命名宮廟');
    $('templeHint').textContent = `從 OpenStreetMap 找到 ${state.osmTemples.length} 間宮廟／寺院（收驚服務請先電話詢問）。`;
    renderTemples();
  } catch (err) {
    $('templeHint').textContent = `宮廟搜尋失敗（${err.message}），請稍後再試。`;
  } finally {
    btn.disabled = false;
  }
}

function locateMe() {
  if (!navigator.geolocation) {
    $('templeHint').textContent = '此瀏覽器不支援定位。';
    return;
  }
  $('templeHint').textContent = '定位中…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      meLayer.clearLayers();
      L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="me-icon"></div>', iconSize: [16, 16] }) }).addTo(meLayer);
      map.setView([me.lat, me.lng], 13);
      const cell = state.cells.find((c) => me.lat >= c.south && me.lat < c.north && me.lng >= c.west && me.lng < c.east);
      $('templeHint').textContent = cell
        ? `你所在區域的 AI 危險分級：${LEVELS[cell.level].label}。${LEVELS[cell.level].advice}`
        : '你所在區域在目前時間窗內沒有紀錄事件。';
      $('nearbyList').innerHTML = nearestTemples(me, 5)
        .map((t) => `<li><a href="${gmapLink(t)}" target="_blank" rel="noopener">${esc(t.name)}</a> ${t.km.toFixed(1)} km${t.shoujing ? '・收驚' : ''}</li>`)
        .join('');
    },
    (err) => ($('templeHint').textContent = `無法取得位置：${err.message}`),
    { enableHighAccuracy: false, timeout: 10000 },
  );
}

// ── 時間軸 ────────────────────────────────────────────
function renderTimelineLabel(list) {
  const start = state.windowDays ? state.endT - (state.windowDays - 1) * DAY : state.minT;
  $('rangeLabel').textContent = `${fmt(Math.max(start, state.minT))} ～ ${fmt(state.endT)}`;
  const fatal = list.filter((d) => d.severity >= 4).length;
  $('countLabel').textContent = `${list.length} 起事件，其中 ${fatal} 起死亡／重大`;
}

function drawHistogram() {
  const cv = $('histogram');
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const weeks = Math.max(1, Math.ceil((state.maxT - state.minT + DAY) / (7 * DAY)));
  const bins = new Array(weeks).fill(0);
  for (const d of state.all) if (state.types.has(d.type)) bins[Math.floor((d.t - state.minT) / (7 * DAY))]++;
  const max = Math.max(1, ...bins);
  const bw = w / weeks;
  const start = state.windowDays ? state.endT - (state.windowDays - 1) * DAY : state.minT;
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const muted = styles.getPropertyValue('--border').trim();
  bins.forEach((n, i) => {
    const t0 = state.minT + i * 7 * DAY;
    const inWin = t0 + 7 * DAY > start && t0 <= state.endT;
    ctx.fillStyle = inWin ? accent : muted;
    const bh = Math.max(1, (n / max) * (h - 2));
    ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh);
  });
}

function togglePlay() {
  const btn = $('playBtn');
  if (state.playing) {
    clearInterval(state.playing);
    state.playing = null;
    btn.textContent = '▶';
    btn.setAttribute('aria-label', '播放');
    return;
  }
  const slider = $('dateSlider');
  if (+slider.value >= +slider.max) slider.value = Math.min(+slider.max, state.windowDays || 30);
  btn.textContent = '❚❚';
  btn.setAttribute('aria-label', '暫停');
  state.playing = setInterval(() => {
    const next = Math.min(+slider.max, +slider.value + 7);
    slider.value = next;
    state.endT = state.minT + next * DAY;
    update();
    if (next >= +slider.max) togglePlay();
  }, 400);
}

// ── UI 綁定 ───────────────────────────────────────────
function buildTypeFilters() {
  $('typeFilters').innerHTML = Object.entries(TYPES)
    .map(([k, t]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="true"><span class="dot" style="background:${t.color}"></span>${t.label}</button>`)
    .join('');
  $('typeFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const k = chip.dataset.type;
    const on = !state.types.has(k);
    on ? state.types.add(k) : state.types.delete(k);
    chip.setAttribute('aria-pressed', String(on));
    update();
  });
}

function bindUI() {
  $('dateSlider').addEventListener('input', (e) => {
    state.endT = state.minT + +e.target.value * DAY;
    update();
  });
  $('windowSel').addEventListener('change', (e) => {
    state.windowDays = +e.target.value;
    update();
  });
  $('playBtn').addEventListener('click', togglePlay);
  $('layerIncidents').addEventListener('change', update);
  $('layerRisk').addEventListener('change', update);
  $('layerTemples').addEventListener('change', renderTemples);
  $('overpassBtn').addEventListener('click', searchOSMTemples);
  $('locateBtn').addEventListener('click', locateMe);
  $('resetData').addEventListener('click', () => setData(state.demo, state.defaultIsDemo));

  $('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const list = parseIncidentFile(file.name, await file.text());
      if (!list.length) throw new Error('找不到有效資料列（需要日期與經緯度）');
      setData(list, false);
      alert(`已匯入 ${list.length} 筆事件`);
    } catch (err) {
      alert(`匯入失敗：${err.message}`);
    }
    e.target.value = '';
  });

  const panel = $('panel');
  const toggle = $('panelToggle');
  const setOpen = (open) => {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  };
  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  map.on('click', () => setOpen(false));
  const zoomBand = () => (map.getZoom() < 9 ? 0 : map.getZoom() < 10 ? 1 : 2);
  let band = zoomBand();
  map.on('zoomend', () => {
    if (zoomBand() !== band) { band = zoomBand(); renderTemples(); }
  });
  window.addEventListener('resize', () => {
    map.invalidateSize();
    drawHistogram();
  });
}
