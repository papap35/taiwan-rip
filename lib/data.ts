// 事件資料：類別定義、正規化、CSV / JSON 解析。
// 只用可被 Node 直接去除型別的語法（tools/*.mjs 會直接 import 這個檔案）。

export type IncidentType =
  | 'homicide' | 'traffic_fatal' | 'accident_fatal' | 'robbery' | 'assault' | 'drugs' | 'theft' | 'other';

export interface Incident {
  id: string;
  /** UTC 當日 00:00 的毫秒時間 */
  t: number;
  lat: number;
  lng: number;
  type: IncidentType;
  severity: number;
  title: string;
  county: string;
  source: string;
  time?: string;
  deaths?: number;
  injuries?: number;
  cause?: string;
  vehicles?: string;
}

export const TYPES: Record<IncidentType, { label: string; color: string; severity: number }> = {
  homicide: { label: '他殺命案', color: '#8e24aa', severity: 5 },
  traffic_fatal: { label: '交通事故死亡', color: '#e53935', severity: 4 },
  accident_fatal: { label: '意外死亡', color: '#f4511e', severity: 4 },
  robbery: { label: '強盜搶奪', color: '#fb8c00', severity: 3 },
  assault: { label: '傷害鬥毆', color: '#fdd835', severity: 2 },
  drugs: { label: '毒品案件', color: '#00897b', severity: 2 },
  theft: { label: '竊盜', color: '#546e7a', severity: 1 },
  other: { label: '其他', color: '#9e9e9e', severity: 1 },
};

export const TYPE_KEYS = Object.keys(TYPES) as IncidentType[];

// 中文類別名稱 → 代碼（方便直接匯入政府開放資料）
const ALIASES: Record<string, IncidentType> = {
  命案: 'homicide', 他殺: 'homicide', 殺人: 'homicide', 他殺命案: 'homicide',
  交通事故: 'traffic_fatal', 交通死亡: 'traffic_fatal', 車禍: 'traffic_fatal', 交通事故死亡: 'traffic_fatal', A1: 'traffic_fatal',
  意外: 'accident_fatal', 意外死亡: 'accident_fatal', 溺水: 'accident_fatal', 火災: 'accident_fatal', 墜落: 'accident_fatal',
  強盜: 'robbery', 搶奪: 'robbery', 搶劫: 'robbery', 強盜搶奪: 'robbery',
  傷害: 'assault', 鬥毆: 'assault', 傷害鬥毆: 'assault', 重傷害: 'assault',
  毒品: 'drugs', 毒品案件: 'drugs',
  竊盜: 'theft', 汽車竊盜: 'theft', 機車竊盜: 'theft', 住宅竊盜: 'theft', 自行車竊盜: 'theft',
};

export function normalizeType(raw: unknown): IncidentType {
  const s = String(raw ?? '').trim();
  if (s in TYPES) return s as IncidentType;
  if (ALIASES[s]) return ALIASES[s];
  for (const [k, v] of Object.entries(ALIASES)) if (s.includes(k)) return v;
  return 'other';
}

const optNum = (v: unknown) => (v == null || v === '' || !Number.isFinite(+(v as number)) ? undefined : +(v as number));

type RawRecord = Record<string, any>;

/** 把任意來源的一筆紀錄轉成內部格式；不合法回傳 null */
export function normalizeIncident(r: RawRecord, idx: number): Incident | null {
  const lat = parseFloat(r.lat ?? r.latitude ?? r.緯度);
  const lng = parseFloat(r.lng ?? r.lon ?? r.longitude ?? r.經度);
  const dateStr = String(r.date ?? r.發生日期 ?? r.日期 ?? '').trim().replace(/\//g, '-');
  const t = Date.parse(dateStr.length === 8 && /^\d+$/.test(dateStr)
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}` : dateStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(t)) return null;
  // 粗略限制在台澎金馬範圍內
  if (lat < 21.8 || lat > 26.5 || lng < 118 || lng > 122.2) return null;
  const type = normalizeType(r.type ?? r.類別 ?? r.案類);
  const sev = parseInt(r.severity, 10);
  return {
    id: r.id ?? `row-${idx}`,
    t: Date.parse(new Date(t).toISOString().slice(0, 10)), // 對齊到 UTC 當日 00:00
    lat, lng, type,
    severity: Number.isFinite(sev) ? Math.min(5, Math.max(1, sev)) : TYPES[type].severity,
    title: r.title ?? r.標題 ?? TYPES[type].label,
    county: r.county ?? r.縣市 ?? '',
    source: r.source ?? r.url ?? '',
    // A1 交通事故等來源的附加欄位（沒有就是 undefined）
    time: r.time || undefined,
    deaths: optNum(r.deaths),
    injuries: optNum(r.injuries),
    cause: r.cause || r.肇因 || undefined,
    vehicles: Array.isArray(r.vehicles) ? r.vehicles.join('、') : r.vehicles || undefined,
  };
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}

/** 解析使用者上傳的檔案內容 */
export function parseIncidentFile(name: string, text: string): Incident[] {
  let records: RawRecord[];
  if (/\.json$/i.test(name) || /^\s*[[{]/.test(text)) {
    const j = JSON.parse(text);
    records = Array.isArray(j) ? j : j.incidents ?? j.features?.map((f: any) => ({
      ...f.properties, lng: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1],
    })) ?? [];
  } else {
    records = parseCSV(text);
  }
  return records.map(normalizeIncident).filter((d): d is Incident => d !== null);
}
