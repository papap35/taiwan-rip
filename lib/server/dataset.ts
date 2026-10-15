// 建置時讀取 public/data 的資料（只在伺服器端使用）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeIncident, type Incident } from '../data.ts';
import { validateTemples, type TempleRecord } from '../temple-schema.ts';

const dataPath = (f: string) => join(process.cwd(), 'public', 'data', f);

let incidents: Promise<{ meta: Record<string, any>; list: Incident[] }> | undefined;
let temples: Promise<TempleRecord[]> | undefined;

export function loadIncidents() {
  incidents ??= readFile(dataPath('incidents.json'), 'utf8').then((text) => {
    const json = JSON.parse(text);
    const list = (json.incidents as Record<string, any>[])
      .map(normalizeIncident)
      .filter((d): d is Incident => d !== null)
      .sort((a, b) => a.t - b.t);
    return { meta: json.meta ?? {}, list };
  });
  return incidents;
}

/** 宮廟資料格式錯誤時直接丟出錯誤，讓建置失敗 */
export function loadTemples() {
  temples ??= readFile(dataPath('temples.json'), 'utf8').then((text) => {
    const { temples: list, errors } = validateTemples(JSON.parse(text));
    if (errors.length) throw new Error(`public/data/temples.json 格式錯誤：\n${errors.join('\n')}`);
    return list;
  });
  return temples;
}
