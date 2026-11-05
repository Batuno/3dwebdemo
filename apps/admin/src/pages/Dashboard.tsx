import { LEAD_STATUSES, t, ta } from '@bair/project-data';
import { BarList, ChartCard, ColumnChart, SegmentedBar } from '../charts/charts';
import { bigMoney, compact, day, shortDay, unitLabel } from '../lib/format';
import { go } from '../lib/router';
import type { DashboardData } from '../lib/types';
import { useApi } from '../lib/useApi';
import { Card, Empty, ErrorBox, LeadStatusBadge, PageHeader, Spinner, Stat, UnitStatusBadge } from '../ui/kit';

const D = ta.dashboard;

function delta(now: number, before: number): { text: string; good: boolean | null } {
  if (!before) return { text: D.vsPrev(now ? `+${now}` : '0'), good: now ? true : null };
  const change = Math.round(((now - before) / before) * 100);
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return { text: D.vsPrev(`${sign}${Math.abs(change)}%`), good: change === 0 ? null : change > 0 };
}

const statusParts = (c: { available: number; reserved: number; sold: number }) => [
  { key: 'available', label: ta.unitStatus.available, value: c.available, color: 'var(--st-available)' },
  { key: 'reserved', label: ta.unitStatus.reserved, value: c.reserved, color: 'var(--st-reserved)' },
  { key: 'sold', label: ta.unitStatus.sold, value: c.sold, color: 'var(--st-sold)' },
];

export default function Dashboard() {
  const { data: d, error, reload } = useApi<DashboardData>('/api/dashboard');
  if (!d) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;

  return (
    <div className="fade-in">
      <PageHeader title={D.title} />
      <ErrorBox error={error} retry={reload} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={D.available} value={`${d.units.available} / ${d.units.total}`} hint={d.units.onSale ? D.onSale(d.units.onSale) : undefined} />
        <Stat label={D.reserved} value={d.units.reserved} hint={bigMoney(d.units.reservedValue)} />
        <Stat label={D.sold} value={d.units.sold} hint={`${D.soldValue}: ${bigMoney(d.units.soldValue)}`} />
        <Stat label={D.newLeads7} value={d.leads.last7} delta={delta(d.leads.last7, d.leads.prev7)} hint={d.leads.unassignedNew ? D.unassigned(d.leads.unassignedNew) : undefined} />
        <Stat label={D.visitors7} value={compact(d.visitors.last7)} delta={delta(d.visitors.last7, d.visitors.prev7)} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          title={D.leadsPerDay}
          className="xl:col-span-2"
          table={[[ta.export.columns.day, ta.export.columns.leads, ta.export.columns.visitors], ...d.days.map((x) => [x.day, x.leads, x.visitors])]}
        >
          <ColumnChart ariaLabel={D.leadsPerDay} data={d.days.map((x) => ({ key: x.day, label: shortDay(x.day), value: x.leads, tip: x.day }))} />
        </ChartCard>
        <ChartCard title={D.pipeline} table={[[ta.leads.status, ta.app.total], ...LEAD_STATUSES.map((s) => [ta.leadStatus[s], d.leads.byStatus[s]])]}>
          <BarList
            items={LEAD_STATUSES.map((s) => ({
              key: s,
              label: ta.leadStatus[s],
              mark: `var(--ls-${s})`,
              value: d.leads.byStatus[s],
              onClick: () => go('leads', { status: s }),
            }))}
          />
        </ChartCard>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title={D.byBlock}>
          <div className="grid gap-4">
            {d.units.byBlock.map((b) => (
              <div key={b.block}>
                <div className="mb-1.5 text-[13px] font-bold">{t.nav.block(b.block)}</div>
                <SegmentedBar tall parts={statusParts(b)} />
              </div>
            ))}
            <div>
              <div className="mb-1.5 text-[13px] font-bold">{D.parking}</div>
              <SegmentedBar parts={statusParts(d.bays)} />
            </div>
          </div>
        </Card>
        <ChartCard title={D.soldWeeks} table={[[ta.export.columns.day, ta.unitStatus.sold], ...d.soldWeeks.map((w) => [w.from, w.sold])]}>
          <ColumnChart ariaLabel={D.soldWeeks} height={180} data={d.soldWeeks.map((w) => ({ key: w.from, label: shortDay(w.from), value: w.sold, tip: `${w.from} –` }))} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card title={D.followUps} pad={false}>
          {d.followUps.length ? (
            <ul>
              {d.followUps.map((f) => (
                <li key={f.id} className="border-b border-[var(--line)] last:border-0">
                  <a href={`#/leads/${f.id}`} className="block px-4 py-2.5 hover:bg-[var(--surface-2)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">{f.name}</span>
                      <span className={`tnum text-xs font-semibold ${f.nextActionAt < d.today ? 'text-[var(--danger)]' : 'text-[var(--ink-2)]'}`}>{f.nextActionAt}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-[var(--ink-2)]">
                      <span className="tnum">{f.phone}</span>
                      <LeadStatusBadge status={f.status} />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{D.followUpsEmpty}</Empty>
          )}
        </Card>

        <Card title={D.reservations} pad={false}>
          {d.reservations.length ? (
            <ul>
              {d.reservations.map((r) => (
                <li key={r.id} className="border-b border-[var(--line)] last:border-0">
                  <a href={`#/units/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--surface-2)]">
                    <span className="text-sm font-bold">{unitLabel(r.id)}</span>
                    <span className={`text-xs font-semibold ${r.expired ? 'text-[var(--danger)]' : 'text-[var(--warn-ink)]'}`}>{r.expired ? D.expired : D.until(r.reservedUntil)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{D.reservationsEmpty}</Empty>
          )}
        </Card>

        <Card title={D.recentLeads} pad={false} action={<a href="#/leads" className="text-xs font-semibold text-[var(--accent)]">{D.seeAll}</a>}>
          <ul>
            {d.recentLeads.map((l) => (
              <li key={l.id} className="border-b border-[var(--line)] last:border-0">
                <a href={`#/leads/${l.id}`} className="block px-4 py-2.5 hover:bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{l.name}</span>
                    <LeadStatusBadge status={l.status} />
                  </div>
                  <div className="mt-0.5 flex justify-between gap-2 text-xs text-[var(--ink-2)]">
                    <span>
                      {ta.leadSource[l.source]} · {l.unitId ? unitLabel(l.unitId) : ta.leadKind[l.kind]}
                    </span>
                    <span className="tnum">{day(l.createdAt)}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {!d.recentLeads.length && <Empty>{ta.app.noData}</Empty>}
        </Card>

        <Card title={D.topUnits}>
          <BarList
            format={ta.analytics.sessionsLabel}
            items={d.topUnits.map((u) => ({
              key: u.id,
              label: unitLabel(u.id),
              mark: u.status ? `var(--st-${u.status})` : undefined,
              value: u.visitors,
              onClick: () => go(`units/${u.id}`),
            }))}
          />
          {d.topUnits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(['available', 'reserved', 'sold'] as const).map((s) => (
                <UnitStatusBadge key={s} status={s} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
