import { useMemo, useState } from 'react';
import { blocks, t, ta } from '@bair/project-data';
import { useSession } from '../App';
import { BarList, ChartCard, ColumnChart, heatColor, heatInk, HeatLegend, heatStep, SegmentedBar } from '../charts/charts';
import { analyticsSheets } from '../lib/exports';
import { compact, pct, shortDay, unitLabel } from '../lib/format';
import { outdoorLabel, roomName, typeName } from '../lib/labels';
import { go } from '../lib/router';
import type { AnalyticsData } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ExportButtons } from '../ui/ExportButtons';
import { Empty, ErrorBox, PageHeader, Segmented, Spinner, Stat } from '../ui/kit';

const A = ta.analytics;
const C = ta.export.columns;
const RANGES = ['7', '30', '90', '0'] as const;
const DEVICE_COLOR: Record<string, string> = { mobile: 'var(--series-1)', tablet: 'var(--series-2)', desktop: 'var(--series-3)' };

export default function Analytics() {
  const { can } = useSession();
  const [days, setDays] = useState<(typeof RANGES)[number]>('30');
  const { data: a, error, loading, reload } = useApi<AnalyticsData>(`/api/analytics?days=${days}`);

  const floorMax = useMemo(() => Math.max(1, ...(a?.floors ?? []).map((f) => f.views)), [a]);
  if (!a) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;

  const conversion = a.totals.visitors ? a.totals.showroomLeads / a.totals.visitors : 0;
  const funnelSteps = ['visitors', 'block', 'floor', 'unit', 'leadOpen', 'lead'] as const;

  return (
    <div className="fade-in">
      <PageHeader title={A.title}>
        <Segmented label={A.range} value={days} onChange={setDays} options={RANGES.map((r) => ({ value: r, label: r === '0' ? A.allTime : A.days(Number(r)) }))} />
        {can('admin') && <ExportButtons what="analytics" csv={false} filter={{ days }} sheets={() => analyticsSheets(a)} />}
      </PageHeader>
      <ErrorBox error={error} retry={reload} />
      <p className="mb-3 text-xs text-[var(--ink-3)]">
        {a.range.from} – {a.range.to}
      </p>

      <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label={A.visitors} value={compact(a.totals.visitors)} />
          <Stat label={A.views} value={compact(a.totals.views)} />
          <Stat label={A.unitViews} value={compact(a.totals.unitViews)} />
          <Stat label={A.leadOpens} value={compact(a.totals.leadOpens)} />
          <Stat label={A.leads} value={compact(a.totals.leads)} />
          <Stat label={A.conversion} value={pct(conversion, 1)} hint={A.conversionHint} />
        </div>

        {!a.totals.visitors && <div className="card mb-4"><Empty>{A.empty}</Empty></div>}

        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <ChartCard title={A.perDay} className="xl:col-span-2" table={[[C.day, C.visitors, C.views, C.leads], ...a.byDay.map((d) => [d.day, d.visitors, d.views, d.leads])]}>
            <ColumnChart ariaLabel={A.perDay} data={a.byDay.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.visitors, tip: `${d.day} · ${A.leads.toLowerCase()} ${d.leads}` }))} />
          </ChartCard>
          <ChartCard title={A.funnel} table={[[C.step, C.count], ...funnelSteps.map((k) => [A.funnelSteps[k], a.funnel[k]])]}>
            <ul className="grid gap-2.5">
              {funnelSteps.map((k, i) => {
                const v = a.funnel[k];
                const share = a.funnel.visitors ? v / a.funnel.visitors : 0;
                return (
                  <li key={k}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-semibold">{A.funnelSteps[k]}</span>
                      <span className="tnum">
                        <b>{v.toLocaleString('en-US')}</b> <span className="text-[var(--ink-3)]">{pct(share)}</span>
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[var(--surface-2)]">
                      {/* Ordinal ramp: later steps are darker. */}
                      <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, v ? 1 : 0)}%`, background: `var(--heat-${Math.min(7, 3 + i)})` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </ChartCard>
        </div>

        <ChartCard
          title={A.floorHeat}
          className="mb-4"
          table={[[C.block, C.storey, C.views, C.visitors], ...[...a.floors].sort((x, y) => x.block.localeCompare(y.block) || y.storey - x.storey).map((f) => [f.block, f.storey, f.views, f.visitors])]}
        >
          <p className="mb-3 text-xs text-[var(--ink-2)]">{A.floorHeatHint}</p>
          <FloorHeat floors={a.floors} max={floorMax} />
          <div className="mt-3">
            <HeatLegend max={floorMax} label={A.views.toLowerCase()} />
          </div>
        </ChartCard>

        <div className="mb-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartCard title={A.topUnits} table={[[C.unit, C.views, C.visitors], ...a.topUnits.map((u) => [unitLabel(u.key), u.views, u.visitors])]}>
            <BarList format={A.sessionsLabel} items={a.topUnits.slice(0, 12).map((u) => ({ key: u.key, label: unitLabel(u.key), value: u.visitors, sub: `· ${A.viewsLabel(u.views)}`, onClick: () => go(`units/${u.key}`) }))} />
          </ChartCard>
          <ChartCard title={A.byBlock} table={[[C.block, C.views, C.visitors], ...a.byBlock.map((b) => [b.key, b.views, b.visitors])]}>
            <BarList format={A.sessionsLabel} items={a.byBlock.map((b) => ({ key: b.key, label: t.nav.block(b.key), value: b.visitors, sub: `· ${A.viewsLabel(b.views)}` }))} />
            <h3 className="mt-5 mb-2 text-[13px] font-bold">{A.byType}</h3>
            <BarList format={A.sessionsLabel} items={a.byType.map((b) => ({ key: b.key, label: typeName(b.key), value: b.visitors, sub: `· ${A.viewsLabel(b.views)}` }))} />
          </ChartCard>
          <ChartCard title={A.byRoom} table={[[C.name2, C.views], ...a.byRoom.map((r) => [roomName(r.key), r.views])]}>
            <BarList format={A.viewsLabel} items={a.byRoom.map((r) => ({ key: r.key, label: roomName(r.key), value: r.views }))} />
          </ChartCard>
          <ChartCard title={A.outdoor} table={[[C.name2, C.views], ...a.outdoor.map((o) => [outdoorLabel(o.key), o.views])]}>
            <BarList format={A.viewsLabel} items={a.outdoor.map((o) => ({ key: o.key, label: outdoorLabel(o.key), value: o.views }))} />
          </ChartCard>
          <ChartCard title={A.hours} table={[[C.hour, C.views], ...a.hours.map((h) => [h.hour, h.views])]}>
            <ColumnChart ariaLabel={A.hours} height={170} every={3} data={a.hours.map((h) => ({ key: String(h.hour), label: String(h.hour), value: h.views, tip: `${String(h.hour).padStart(2, '0')}:00` }))} />
          </ChartCard>
          <ChartCard title={A.devices} table={[[C.name2, C.visitors], ...a.devices.map((d) => [ta.device[d.key] ?? d.key, d.visits])]}>
            <SegmentedBar tall parts={a.devices.map((d) => ({ key: d.key, label: ta.device[d.key] ?? d.key, value: d.visits, color: DEVICE_COLOR[d.key] ?? 'var(--st-sold)' }))} />
            <h3 className="mt-5 mb-2 text-[13px] font-bold">{A.actions}</h3>
            <BarList items={a.actions.map((x) => ({ key: x.key, label: ta.action[x.key] ?? x.key, value: x.views, sub: `· ${A.sessionsLabel(x.visitors)}` }))} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

/** Rows are storeys (top floor first), one column per block; darker means more views of the floor and its flats. */
function FloorHeat({ floors, max }: { floors: AnalyticsData['floors']; max: number }) {
  const at = new Map(floors.map((f) => [`${f.block}:${f.storey}`, f]));
  const top = Math.max(...blocks.map((b) => b.storeys));
  const storeys = Array.from({ length: top - 1 }, (_, i) => top - i);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="scroll-x">
      <table className="tnum border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr>
            <th />
            {blocks.map((b) => (
              <th key={b.id} className="px-1 pb-1 text-[12px] font-bold">
                {b.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {storeys.map((s) => (
            <tr key={s}>
              <th className="pr-2 text-right font-semibold text-[var(--ink-3)]">
                {A.storeyShort}
                {s}
              </th>
              {blocks.map((b) => {
                const f = at.get(`${b.id}:${s}`);
                const v = f?.views ?? 0;
                const step = heatStep(v, max);
                const key = `${b.id}:${s}`;
                const label = `${t.nav.block(b.id)} · ${t.nav.storey(s)}: ${A.viewsLabel(v)}, ${A.sessionsLabel(f?.visitors ?? 0)}`;
                return (
                  <td key={b.id} className="p-0">
                    <div
                      tabIndex={0}
                      role="img"
                      aria-label={label}
                      title={label}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(key)}
                      onBlur={() => setHover(null)}
                      className={`flex h-6 w-28 items-center justify-end rounded-[4px] px-2 font-semibold outline-none sm:w-40 ${hover === key ? 'ring-2 ring-[var(--ink)]' : ''}`}
                      style={{ background: heatColor(v, max), color: heatInk(step) }}
                    >
                      {v > 0 && (hover === key || step >= 4) ? v : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
