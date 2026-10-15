import { TYPES, type IncidentType } from '@/lib/data.ts';

/** 類別分布：單一色相的橫條（比大小），數值標在條尾；色點只用來對照地圖圖例 */
export default function TypeBars({ data, title }: { data: { type: IncidentType; count: number }[]; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-muted">這段期間沒有事件。</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((d) => (
            <li key={d.type} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-[13px]">
              <span className="flex items-center gap-1.5 truncate">
                <span className="size-2 flex-none rounded-full" style={{ background: TYPES[d.type].color }} aria-hidden="true" />
                {TYPES[d.type].label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="h-3.5 rounded-r-[4px] bg-chart"
                  style={{ width: `${(d.count / max) * 85}%`, minWidth: 2 }}
                  aria-hidden="true"
                />
                <span className="text-ink tabular-nums">{d.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
