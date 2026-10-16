'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeIncident, parseIncidentFile, TYPE_KEYS, type Incident, type IncidentType } from '@/lib/data.ts';
import { LEVELS } from '@/lib/risk.ts';
import { nearestTemples, searchOsmTemples, type Temple } from '@/lib/temples.ts';
import { DEFAULT_WINDOW, parseUrlState, serializeUrlState } from '@/lib/url-state.ts';
import { useRiskCells } from '@/hooks/useRiskCells.ts';
import { effectiveWindow, filterView } from '@/lib/view.ts';
import Panel, { type Layers } from './panel/Panel';
import Timeline from './timeline/Timeline';
import SiteNav from './SiteNav';
import { Wordmark } from './Logo';
import type { MapViewHandle } from './map/MapView';
import type { ExplainView } from './map/Popups';

// 地圖只能在瀏覽器執行
const MapView = dynamic(() => import('./map/MapView'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-muted">地圖載入中…</div>,
});

const DAY = 86400000;
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
type View = { lat: number; lng: number; zoom: number };
type Dataset = { list: Incident[]; isDemo: boolean };

const sortByTime = (list: Incident[]) => list.slice().sort((a, b) => a.t - b.t);

export default function MapApp() {
  const mapApi = useRef<MapViewHandle | null>(null);
  const [defaults, setDefaults] = useState<Dataset | null>(null);
  const [data, setData] = useState<Dataset>({ list: [], isDemo: true });
  const [temples, setTemples] = useState<Temple[]>([]);
  const [osmTemples, setOsmTemples] = useState<Temple[]>([]);
  const [endT, setEndT] = useState(0);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [types, setTypes] = useState<Set<IncidentType>>(() => new Set(TYPE_KEYS));
  const [layers, setLayers] = useState<Layers>({ incidents: true, risk: true, temples: true });
  const [initialView, setInitialView] = useState<View>();
  const [view, setView] = useState<View>();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [templeHint, setTempleHint] = useState('精選宮廟座標為概略位置；收驚時段請以各宮廟公告為準。');
  const [nearby, setNearby] = useState<(Temple & { km: number })[]>([]);
  const [searching, setSearching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState('');

  const minT = data.list[0]?.t ?? 0;
  const maxT = data.list.at(-1)?.t ?? 0;

  // ── 初始載入：資料 + 網址狀態 ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [inc, tmp] = await Promise.all([
          fetch('/data/incidents.json').then((r) => r.json()),
          fetch('/data/temples.json').then((r) => r.json()),
        ]);
        const list = sortByTime(inc.incidents.map(normalizeIncident).filter(Boolean));
        const ds = { list, isDemo: inc.meta?.demo !== false };
        const url = parseUrlState(window.location.search);
        const last = list.at(-1)?.t ?? 0;
        const first = list[0]?.t ?? 0;
        const urlEnd = url.end ? Date.parse(url.end) : NaN;
        setDefaults(ds);
        setData(ds);
        setTemples(tmp.temples);
        setEndT(Number.isFinite(urlEnd) ? Math.min(last, Math.max(first, urlEnd)) : last);
        if (url.window !== undefined) setWindowDays(url.window);
        if (url.types) setTypes(new Set(url.types));
        setInitialView(url.view);
        setReady(true);
      } catch (err) {
        setLoadError(`資料載入失敗：${(err as Error).message}`);
      }
    })();
  }, []);

  const applyDataset = useCallback((ds: Dataset) => {
    const list = sortByTime(ds.list);
    setData({ list, isDemo: ds.isDemo });
    setEndT(list.at(-1)?.t ?? 0);
  }, []);

  // ── 篩選與分級 ─────────────────────────────────
  const filtered = useMemo(() => filterView(data.list, { endT, windowDays, types }), [data.list, endT, windowDays, types]);

  const typeTimes = useMemo(() => data.list.filter((d) => types.has(d.type)).map((d) => d.t), [data.list, types]);
  const cells = useRiskCells(filtered, endT, effectiveWindow(minT, endT, windowDays));
  const fatal = useMemo(() => filtered.filter((d) => d.severity >= 4).length, [filtered]);
  // 只有網站提供的資料能請伺服器重算；自行匯入的資料不提供 AI 解說
  const official = Boolean(defaults && data.list.length === defaults.list.length && data.list.at(-1)?.id === defaults.list.at(-1)?.id);
  const explainView = useMemo<ExplainView>(
    () => (official ? { end: fmt(endT), window: windowDays, types: TYPE_KEYS.filter((t) => types.has(t)) } : null),
    [official, endT, windowDays, types],
  );
  const allTemples = useMemo(() => [...temples, ...osmTemples], [temples, osmTemples]);

  // ── 網址同步（不新增瀏覽紀錄） ─────────────────────
  useEffect(() => {
    if (!ready || !data.list.length) return;
    const id = setTimeout(() => {
      const q = serializeUrlState(
        { end: fmt(endT), window: windowDays, types: TYPE_KEYS.filter((t) => types.has(t)), view },
        fmt(maxT),
      );
      window.history.replaceState(null, '', `${window.location.pathname}${q}`);
    }, 300);
    return () => clearTimeout(id);
  }, [ready, data.list.length, endT, windowDays, types, view, maxT]);

  // ── 播放時間軸 ─────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setEndT((t) => Math.min(maxT, t + 7 * DAY)), 400);
    return () => clearInterval(id);
  }, [playing, maxT]);

  useEffect(() => {
    if (playing && endT >= maxT) setPlaying(false);
  }, [playing, endT, maxT]);

  function togglePlay() {
    if (playing) return setPlaying(false);
    if (endT >= maxT) {
      const totalDays = Math.round((maxT - minT) / DAY);
      setEndT(minT + Math.min(totalDays, windowDays || 30) * DAY);
    }
    setPlaying(true);
  }

  // ── 宮廟 ──────────────────────────────────────
  function locateMe() {
    if (!navigator.geolocation) return setTempleHint('此瀏覽器不支援定位。');
    setTempleHint('定位中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(at);
        mapApi.current?.flyTo(at.lat, at.lng, 13);
        const cell = cells.find((c) => at.lat >= c.south && at.lat < c.north && at.lng >= c.west && at.lng < c.east);
        setTempleHint(
          cell
            ? `你所在區域的 AI 危險分級：${LEVELS[cell.level].label}。${LEVELS[cell.level].advice}`
            : '你所在區域在目前時間窗內沒有紀錄事件。',
        );
        setNearby(nearestTemples(at, allTemples, 5));
      },
      (err) => setTempleHint(`無法取得位置：${err.message}`),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function searchTemples() {
    const bounds = mapApi.current?.getBounds();
    if (!bounds || (mapApi.current?.getZoom() ?? 0) < 11) {
      return setTempleHint('請先放大地圖（到鄉鎮範圍）再搜尋附近宮廟。');
    }
    setSearching(true);
    setTempleHint('搜尋中…');
    try {
      const found = await searchOsmTemples(bounds);
      setOsmTemples(found);
      setTempleHint(`從 OpenStreetMap 找到 ${found.length} 間宮廟／寺院（收驚服務請先電話詢問）。`);
    } catch (err) {
      setTempleHint(`宮廟搜尋失敗（${(err as Error).message}），請稍後再試。`);
    } finally {
      setSearching(false);
    }
  }

  // ── 匯入與分享 ─────────────────────────────────
  async function importFile(file: File) {
    try {
      const list = parseIncidentFile(file.name, await file.text());
      if (!list.length) throw new Error('找不到有效資料列（需要日期與經緯度）');
      applyDataset({ list, isDemo: false });
      alert(`已匯入 ${list.length} 筆事件`);
    } catch (err) {
      alert(`匯入失敗：${(err as Error).message}`);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('已複製目前畫面的連結');
    } catch {
      setToast('無法自動複製，請直接複製網址列');
    }
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden grid-rows-[48px_1fr] md:grid-cols-[340px_1fr] md:grid-rows-[52px_1fr]">
      <header className="z-40 col-span-full flex items-center justify-between gap-2 border-b border-line bg-surface px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Wordmark as="h1" />
          <SiteNav className="hidden lg:flex" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={share} className="h-[38px] rounded-lg border border-line bg-surface px-3 text-sm text-ink">
            分享
          </button>
          <button
            type="button"
            aria-controls="panel"
            aria-expanded={panelOpen}
            aria-label={panelOpen ? '關閉設定面板' : '開啟設定面板'}
            onClick={() => setPanelOpen((o) => !o)}
            className="size-[38px] rounded-lg border border-line bg-surface text-base text-ink md:hidden"
          >
            {panelOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <div className="md:col-start-1 md:row-start-2 md:min-h-0 md:overflow-y-auto">
        <Panel
          open={panelOpen}
          isDemo={data.isDemo}
          layers={layers}
          onLayers={setLayers}
          types={types}
          onToggleType={(t) =>
            setTypes((prev) => {
              const next = new Set(prev);
              if (next.has(t)) next.delete(t);
              else next.add(t);
              return next;
            })
          }
          cells={cells}
          templeHint={templeHint}
          nearby={nearby}
          searching={searching}
          onLocate={locateMe}
          onSearchTemples={searchTemples}
          onImport={importFile}
          onReset={() => defaults && applyDataset(defaults)}
        />
      </div>

      <main className="relative row-start-2 min-h-0 md:col-start-2">
        {loadError && <div className="absolute inset-0 grid place-items-center p-4 text-sm text-accent">{loadError}</div>}
        {ready && (
          <MapView
            apiRef={mapApi}
            incidents={filtered}
            cells={cells}
            explainView={explainView}
            temples={allTemples}
            layers={layers}
            me={me}
            initialView={initialView}
            onViewChange={setView}
            onBackgroundClick={() => setPanelOpen(false)}
          />
        )}
        {ready && data.list.length > 0 && (
          <Timeline
            minT={minT}
            maxT={maxT}
            endT={endT}
            windowDays={windowDays}
            times={typeTimes}
            count={filtered.length}
            fatal={fatal}
            playing={playing}
            onEnd={setEndT}
            onWindow={setWindowDays}
            onTogglePlay={togglePlay}
          />
        )}
        {toast && (
          <div role="status" className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm text-surface shadow-float">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
