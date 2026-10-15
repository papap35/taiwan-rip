import { TYPES, type Incident } from '@/lib/data.ts';
import { LEVELS, type RiskCell } from '@/lib/risk.ts';
import { gmapLink, nearestTemples, type Temple } from '@/lib/temples.ts';

const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

export function NearbyTemples({ at, temples }: { at: { lat: number; lng: number }; temples: Temple[] }) {
  const list = nearestTemples(at, temples);
  if (!list.length) return null;
  return (
    <div className="mt-1.5">
      <b>附近可收驚／祈福</b>
      <ul className="list-disc pl-4">
        {list.map((t) => (
          <li key={`${t.name}-${t.lat}`}>
            <a href={gmapLink(t)} target="_blank" rel="noopener">{t.name}</a> {t.km.toFixed(1)} km
            {t.shoujing ? '・收驚' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncidentPopup({ incident: d, temples }: { incident: Incident; temples: Temple[] }) {
  const ty = TYPES[d.type];
  return (
    <div>
      <h3 className="mb-1 pr-4 text-[15px] font-bold">{d.title}</h3>
      <div>
        {fmt(d.t)}
        {d.time ? ` ${d.time.slice(0, 5)}` : ''}・{ty.label}・嚴重度 {d.severity}/5
      </div>
      {d.deaths != null && (
        <div>
          死亡 {d.deaths} 人{d.injuries ? `、受傷 ${d.injuries} 人` : ''}
        </div>
      )}
      {d.cause && <div>初步肇因：{d.cause}</div>}
      {d.vehicles && <div>車種：{d.vehicles}</div>}
      {d.county && <div>{d.county}</div>}
      {/^https?:\/\//.test(d.source) && (
        <a href={d.source} target="_blank" rel="noopener">資料來源</a>
      )}
      <NearbyTemples at={d} temples={temples} />
    </div>
  );
}

export function riskReasons(c: RiskCell): string[] {
  const top = Object.entries(c.types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${TYPES[k as keyof typeof TYPES]?.label ?? k} ${n}`)
    .join('、');
  const reasons = [`時間窗內 ${c.count} 起事件（${top}）`];
  if (c.fatal) reasons.push(`其中 ${c.fatal} 起為死亡或重大事件`);
  if (c.count >= 4 && c.trend > 0.45) reasons.push(`近期 1/3 時段集中了 ${Math.round(c.trend * 100)}% 的事件，有升溫趨勢`);
  return reasons;
}

export function RiskPopup({ cell, temples }: { cell: RiskCell; temples: Temple[] }) {
  const lvl = LEVELS[cell.level];
  const center = { lat: (cell.south + cell.north) / 2, lng: (cell.west + cell.east) / 2 };
  return (
    <div>
      <h3 className="mb-1 pr-4 text-[15px] font-bold">
        AI 危險分級{' '}
        <span className="rounded-md px-2 font-bold text-white" style={{ background: lvl.color }}>
          {lvl.label}
        </span>
      </h3>
      <div>{lvl.advice}</div>
      <ul className="my-1 list-disc pl-4">
        {riskReasons(cell).map((r) => <li key={r}>{r}</li>)}
      </ul>
      <NearbyTemples at={center} temples={temples} />
    </div>
  );
}

export function TemplePopup({ temple: t }: { temple: Temple }) {
  return (
    <div>
      <h3 className="mb-1 pr-4 text-[15px] font-bold">{t.name}</h3>
      {t.deity && <div>主祀：{t.deity}</div>}
      {t.shoujing && (
        <div>
          <b>✓ 提供收驚</b>（時段請先確認）
        </div>
      )}
      {t.note && <div>{t.note}</div>}
      <a href={gmapLink(t)} target="_blank" rel="noopener">導航前往</a>
      {t.id && (
        <>
          {'・'}
          <a href={`/temples/${t.id}`}>宮廟資訊</a>
        </>
      )}
    </div>
  );
}
