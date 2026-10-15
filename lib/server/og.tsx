// 分享預覽圖（1200×630）。建置時靜態產生，字型用 app/fonts 的中文子集。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

const font = (w: number) => readFile(join(process.cwd(), 'app', 'fonts', `NotoSansTC-og-${w}.ttf`));

interface OgProps {
  eyebrow?: string;
  title: string;
  /** 大數字與說明，例如 329 / 近 90 天事件 */
  figure?: { value: string; label: string };
  lines: string[];
  footer: string;
  demo?: string;
  /** 事件位置（畫成點狀小地圖） */
  points: { lat: number; lng: number }[];
}

function dotMap(points: { lat: number; lng: number }[], w: number, h: number) {
  if (!points.length) return [];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180); // 經度依緯度縮放，形狀才不會被拉寬
  const x0 = Math.min(...lngs) * kx;
  const x1 = Math.max(...lngs) * kx;
  const y0 = Math.min(...lats);
  const y1 = Math.max(...lats);
  const span = Math.max(x1 - x0, y1 - y0, 0.02);
  const scale = (Math.min(w, h) - 64) / span;
  const ox = (w - (x1 - x0) * scale) / 2;
  const oy = (h - (y1 - y0) * scale) / 2;
  return points.slice(0, 900).map((p) => ({
    x: ox + (p.lng * kx - x0) * scale,
    y: oy + (y1 - p.lat) * scale,
  }));
}

export async function renderOg(p: OgProps) {
  const [regular, bold] = await Promise.all([font(400), font(700)]);
  const MAP = 470;
  const dots = dotMap(p.points, MAP, MAP);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f6f7f9', fontFamily: 'NotoSansTC', color: '#1d2330' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 0 52px 64px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, color: '#c0392b', fontWeight: 700, minHeight: 40 }}>
              {p.eyebrow}
              {p.demo && (
                <div style={{ display: 'flex', fontSize: 22, color: '#7a5a12', background: '#fff6e0', border: '2px solid #f0c36d', borderRadius: 10, padding: '2px 12px' }}>
                  {p.demo}
                </div>
              )}
            </div>
            {/* 左欄約 560px 寬：長標題縮小字級，維持一行 */}
            <div style={{ display: 'flex', fontSize: p.title.length > 6 ? 64 : 76, fontWeight: 700, marginTop: 12 }}>{p.title}</div>
          </div>
          {p.figure && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, lineHeight: 1 }}>{p.figure.value}</div>
              <div style={{ display: 'flex', fontSize: 34, color: '#5d6677' }}>{p.figure.label}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.lines.map((l) => (
              <div key={l} style={{ display: 'flex', fontSize: 34 }}>{l}</div>
            ))}
            <div style={{ display: 'flex', fontSize: 24, color: '#5d6677', marginTop: 10 }}>{p.footer}</div>
          </div>
        </div>
        <div style={{ width: MAP + 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: MAP, height: MAP, position: 'relative', display: 'flex', background: '#ffffff', borderRadius: 28, border: '2px solid #dde1e8' }}>
            {dots.map((d, i) => (
              <div
                key={i}
                style={{ position: 'absolute', left: d.x - 5, top: d.y - 5, width: 10, height: 10, borderRadius: 5, background: '#c0392b', opacity: 0.55 }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'NotoSansTC', data: regular, weight: 400, style: 'normal' },
        { name: 'NotoSansTC', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}
