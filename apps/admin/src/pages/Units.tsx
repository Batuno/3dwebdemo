import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { blocks, t, ta, unitNumber, unitTypeOrder, unitTypes, type BlockDef, type UnitStatus } from '@bair/project-data';
import { useSession } from '../App';
import { heatColor, heatInk, HeatLegend, heatStep } from '../charts/charts';
import { ApiError, patch } from '../lib/api';
import { unitsSheet } from '../lib/exports';
import { millions, money, today } from '../lib/format';
import { typeName } from '../lib/labels';
import { go, useLocation } from '../lib/router';
import type { UnitsResponse, UnitView } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ExportButtons } from '../ui/ExportButtons';
import { Icon } from '../ui/icons';
import { Badge, Button, ErrorBox, PageHeader, Segmented, Spinner, UnitStatusBadge, useToast } from '../ui/kit';
import { UnitDrawer } from './units/UnitDrawer';

const U = ta.units;
type ColorBy = 'status' | 'interest' | 'type';
const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];
const shortType = (type: string) => type.replace('2RF_T', '2F');

export default function Units() {
  const { parts } = useLocation();
  const { can } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<UnitsResponse>('/api/units?days=30');
  const [colorBy, setColorBy] = useState<ColorBy>('status');
  const [view, setView] = useState<'chess' | 'table'>('chess');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [multi, setMulti] = useState(false);
  const [anchor, setAnchor] = useState<UnitView | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = !!data?.canEdit;

  const byId = useMemo(() => new Map((data?.units ?? []).map((u) => [u.id, u])), [data]);
  const maxVisitors = useMemo(() => Math.max(1, ...Object.values(data?.interest ?? {}).map((i) => i.visitors)), [data]);
  const openId = parts[1] && byId.has(parts[1]) ? parts[1] : null;

  const toggle = (ids: string[], on?: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const add = on ?? !ids.every((id) => next.has(id));
      for (const id of ids) {
        if (add) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const onCell = (u: UnitView, e: MouseEvent) => {
    if (e.shiftKey && anchor && anchor.block === u.block && canEdit) {
      const [s0, s1] = [Math.min(anchor.storey, u.storey), Math.max(anchor.storey, u.storey)];
      const def = blocks.find((b) => b.id === u.block)!;
      const cols = def.stacks.map((s) => s.stack);
      const [c0, c1] = [Math.min(cols.indexOf(anchor.stack), cols.indexOf(u.stack)), Math.max(cols.indexOf(anchor.stack), cols.indexOf(u.stack))];
      const ids = data!.units.filter((x) => x.block === u.block && x.storey >= s0 && x.storey <= s1 && cols.indexOf(x.stack) >= c0 && cols.indexOf(x.stack) <= c1).map((x) => x.id);
      toggle(ids, true);
      setMulti(true);
      return;
    }
    if ((multi || e.ctrlKey || e.metaKey || e.shiftKey) && canEdit) {
      toggle([u.id]);
      setAnchor(u);
      return;
    }
    go(`units/${u.id}`);
  };

  const selectMany = (ids: string[]) => {
    if (!canEdit) return;
    toggle(ids);
    setMulti(true);
  };

  const apply = async (set: Record<string, unknown>) => {
    const ids = [...selected];
    if (ids.length > 20 && !confirm(U.confirmBulk(ids.length))) return;
    setBusy(true);
    try {
      const r = await patch<{ changed: string[] }>('/api/units', { ids, set });
      toast(r.changed.length ? U.updated(r.changed.length) : U.noChanges);
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? (e.code === 'sale_not_lower' ? U.salePriceHigh : `${ta.app.error}: ${e.code}`) : ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;

  return (
    <div className="fade-in pb-40">
      <PageHeader title={U.title}>
        <Segmented
          label={U.title}
          value={view}
          onChange={setView}
          options={[
            { value: 'chess', label: U.chess },
            { value: 'table', label: U.table },
          ]}
        />
        {can('admin') && <ExportButtons what="units" sheets={() => [unitsSheet(data)]} />}
      </PageHeader>
      <ErrorBox error={error} retry={reload} />

      {view === 'chess' ? (
        <>
          <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
            <Segmented
              label={U.colorBy}
              value={colorBy}
              onChange={setColorBy}
              options={[
                { value: 'status', label: U.byStatus },
                { value: 'interest', label: U.byInterest },
                { value: 'type', label: U.byType },
              ]}
            />
            <Legend colorBy={colorBy} units={data.units} max={maxVisitors} />
            {canEdit && (
              <Button small tone={multi ? 'primary' : 'secondary'} aria-pressed={multi} onClick={() => setMulti(!multi)} className="ml-auto">
                <Icon name="select" size={16} />
                {U.multiSelect}
              </Button>
            )}
          </div>
          {canEdit ? <p className="mb-3 text-xs text-[var(--ink-3)]">{U.selectHint}</p> : <p className="mb-3 text-xs text-[var(--ink-3)]">{U.readOnly}</p>}
          <div className={`grid gap-4 2xl:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
            {blocks.map((b) => (
              <BlockGrid
                key={b.id}
                def={b}
                units={data.units.filter((u) => u.block === b.id)}
                colorBy={colorBy}
                interest={data.interest}
                maxVisitors={maxVisitors}
                selected={selected}
                onCell={onCell}
                onMany={selectMany}
              />
            ))}
          </div>
        </>
      ) : (
        <UnitTable data={data} />
      )}

      {canEdit && selected.size > 0 && <BulkBar units={[...selected].map((id) => byId.get(id)!).filter(Boolean)} busy={busy} onApply={apply} onClear={() => setSelected(new Set())} />}
      {openId && <UnitDrawer id={openId} interest={data.interest[openId]} canEdit={canEdit} onClose={() => go('units')} onChanged={reload} />}
    </div>
  );
}

function Legend({ colorBy, units, max }: { colorBy: ColorBy; units: UnitView[]; max: number }) {
  if (colorBy === 'interest') return <HeatLegend max={max} label={ta.analytics.visitors.toLowerCase()} />;
  if (colorBy === 'type')
    return (
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {unitTypeOrder.map((ty) => (
          <li key={ty} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: unitTypes[ty].color }} />
            {typeName(ty)}
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {STATUSES.map((s) => (
        <li key={s}>
          <Badge color={`var(--st-${s})`}>
            {ta.unitStatus[s]} <b className="tnum">{units.filter((u) => u.status === s).length}</b>
          </Badge>
        </li>
      ))}
      <li>
        <Badge color="var(--danger)">
          % {U.onSale} <b className="tnum">{units.filter((u) => u.price < u.listPrice).length}</b>
        </Badge>
      </li>
    </ul>
  );
}

function BlockGrid({
  def,
  units,
  colorBy,
  interest,
  maxVisitors,
  selected,
  onCell,
  onMany,
}: {
  def: BlockDef;
  units: UnitView[];
  colorBy: ColorBy;
  interest: UnitsResponse['interest'];
  maxVisitors: number;
  selected: Set<string>;
  onCell: (u: UnitView, e: MouseEvent) => void;
  onMany: (ids: string[]) => void;
}) {
  const storeys = [...new Set(units.map((u) => u.storey))].sort((a, b) => b - a);
  const at = new Map(units.map((u) => [`${u.storey}-${u.stack}`, u]));
  const cols = def.stacks;
  const counts = { available: 0, reserved: 0, sold: 0 };
  for (const u of units) counts[u.status]++;
  return (
    <section className="card p-3" aria-label={t.nav.block(def.id)}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-base font-extrabold">{t.nav.block(def.id)}</h2>
        <span className="text-xs text-[var(--ink-2)]">
          {STATUSES.map((s) => `${ta.unitStatus[s]} ${counts[s]}`).join(' · ')}
        </span>
      </header>
      <div className="scroll-x">
        <table className="tnum border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)]" />
              {cols.map((c) => (
                <th key={c.stack} className="p-0">
                  <button
                    type="button"
                    title={U.selectColumn(c.stack)}
                    onClick={() => onMany(units.filter((u) => u.stack === c.stack).map((u) => u.id))}
                    className="w-full min-w-[50px] rounded-md px-1 py-1 font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                  >
                    {c.stack}
                    <span className="block text-[10px] font-semibold text-[var(--ink-3)]">{shortType(c.type)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {storeys.map((s) => (
              <tr key={s}>
                <th className="sticky left-0 z-10 bg-[var(--surface)] p-0">
                  <button
                    type="button"
                    title={U.selectRow(s)}
                    onClick={() => onMany(units.filter((u) => u.storey === s).map((u) => u.id))}
                    className="w-9 rounded-md py-1 text-right font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                  >
                    {s}
                  </button>
                </th>
                {cols.map((c) => {
                  const u = at.get(`${s}-${c.stack}`);
                  if (!u) return <td key={c.stack} />;
                  const visitors = interest[u.id]?.visitors ?? 0;
                  const sale = u.price < u.listPrice;
                  const isSel = selected.has(u.id);
                  let style: CSSProperties | undefined;
                  let cls = '';
                  let label: string = millions(u.price).replace(' сая', '');
                  if (colorBy === 'status') cls = `cell-${u.status}`;
                  else if (colorBy === 'interest') {
                    const step = heatStep(visitors, maxVisitors);
                    style = { background: heatColor(visitors, maxVisitors), color: heatInk(step) };
                    label = String(visitors);
                  } else {
                    style = { background: unitTypes[u.type].color, color: '#15191c' };
                    label = shortType(u.type);
                  }
                  return (
                    <td key={c.stack} className="p-0">
                      <button
                        type="button"
                        onClick={(e) => onCell(u, e)}
                        aria-pressed={isSel}
                        aria-label={`${def.id} ${unitNumber(u.storey, u.stack)}, ${ta.unitStatus[u.status]}, ${money(u.price)}${sale ? `, ${U.onSale}` : ''}, ${U.visitorsShort(visitors)}`}
                        title={`${def.id} ${unitNumber(u.storey, u.stack)} · ${ta.unitStatus[u.status]} · ${money(u.price)}${sale ? ` (${U.onSale})` : ''} · ${U.visitorsShort(visitors)}`}
                        className={`relative h-[30px] w-full min-w-[50px] rounded-[5px] px-1 font-semibold transition-[filter] hover:brightness-110 ${cls} ${isSel ? 'outline-[3px] outline-offset-[-3px] outline-[var(--ink)] outline-solid' : ''}`}
                        style={style}
                      >
                        {label}
                        {sale && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--danger)] text-[9px] font-extrabold text-white" aria-hidden="true">
                            %
                          </span>
                        )}
                        {isSel && (
                          <span className="absolute -bottom-1 -left-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--bg)]" aria-hidden="true">
                            <Icon name="check" size={10} />
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** What can be done to every selected flat at once. */
function BulkBar({ units, busy, onApply, onClear }: { units: UnitView[]; busy: boolean; onApply: (set: Record<string, unknown>) => void; onClear: () => void }) {
  const [pct, setPct] = useState('5');
  const [until, setUntil] = useState(today(30));
  const [change, setChange] = useState('3');
  const total = units.reduce((s, u) => s + u.listPrice, 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:left-60">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <div className="min-w-[150px]">
          <div className="text-sm font-extrabold">{U.selected(units.length)}</div>
          <div className="text-xs text-[var(--ink-2)]">{U.listValue(millions(total))}</div>
          <button type="button" onClick={onClear} className="mt-0.5 text-xs font-semibold text-[var(--accent)] hover:underline">
            {U.clear}
          </button>
          {units.length === 1 && (
            <a href={`#/units/${units[0].id}`} className="ml-3 text-xs font-semibold text-[var(--accent)] hover:underline">
              {U.details}
            </a>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-[var(--ink-2)]">{U.setStatus}</div>
          <div className="flex gap-1.5">
            {STATUSES.map((s) => (
              <Button key={s} small disabled={busy} onClick={() => onApply({ status: s })}>
                <span className="dot" style={{ background: `var(--st-${s})` }} />
                {ta.unitStatus[s]}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-[var(--ink-2)]">{U.discount}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input className="field !min-h-8 !w-16 !px-2" type="number" min={1} max={90} value={pct} aria-label={U.discountPct} onChange={(e) => setPct(e.target.value)} />
            <span className="text-sm">%</span>
            <input className="field !min-h-8 !w-auto !px-2" type="date" value={until} aria-label={U.saleUntil} title={U.saleUntil} onChange={(e) => setUntil(e.target.value)} />
            <Button small tone="primary" disabled={busy || !(Number(pct) > 0)} onClick={() => onApply({ discountPct: Number(pct), saleUntil: until || null })}>
              <Icon name="tag" size={15} />
              {U.applyDiscount}
            </Button>
            <Button small tone="ghost" disabled={busy} onClick={() => onApply({ clearSale: true })}>
              {U.clearSale}
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-[var(--ink-2)]" title={U.priceChangeHint}>
            {U.priceChange}
          </div>
          <div className="flex items-center gap-1.5">
            <input className="field !min-h-8 !w-20 !px-2" type="number" min={-50} max={100} step={0.5} value={change} aria-label={U.priceChange} onChange={(e) => setChange(e.target.value)} />
            <Button small disabled={busy || !Number(change)} onClick={() => onApply({ listPriceChangePct: Number(change) })}>
              {U.applyPriceChange}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitTable({ data }: { data: UnitsResponse }) {
  const [block, setBlock] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [sale, setSale] = useState(false);
  const rows = data.units.filter((u) => (!block || u.block === block) && (!type || u.type === type) && (!status || u.status === status) && (!sale || u.price < u.listPrice));
  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <select className="field !w-auto" aria-label={U.block} value={block} onChange={(e) => setBlock(e.target.value)}>
          <option value="">{U.all}</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {t.nav.block(b.id)}
            </option>
          ))}
        </select>
        <select className="field !w-auto" aria-label={U.type} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{U.filterType}</option>
          {unitTypeOrder.map((ty) => (
            <option key={ty} value={ty}>
              {typeName(ty)}
            </option>
          ))}
        </select>
        <select className="field !w-auto" aria-label={U.status} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{U.filterStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ta.unitStatus[s]}
            </option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-2 px-2 text-[13px] font-semibold">
          <input type="checkbox" checked={sale} onChange={(e) => setSale(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          {U.onlyOnSale}
        </label>
        <span className="ml-auto text-xs text-[var(--ink-2)]">{rows.length}</span>
      </div>
      <div className="card scroll-x">
        <table className="tnum w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--ink-2)]">
              <th className="px-4 py-2.5 font-semibold">{U.stack}</th>
              <th className="px-2 py-2.5 font-semibold">{U.type}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{U.area}</th>
              <th className="px-2 py-2.5 font-semibold">{U.status}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{U.price}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{U.listPrice}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{U.visitors30}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{ta.nav.leads}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]" onClick={() => go(`units/${u.id}`)}>
                <td className="px-4 py-2 font-bold whitespace-nowrap">
                  {u.block} {unitNumber(u.storey, u.stack)}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{typeName(u.type)}</td>
                <td className="px-2 py-2 text-right">{u.totalArea} м²</td>
                <td className="px-2 py-2">
                  <UnitStatusBadge status={u.status} />
                </td>
                <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                  {money(u.price)}
                  {u.price < u.listPrice && <span className="ml-1 text-xs font-bold text-[var(--danger)]">−{Math.round((1 - u.price / u.listPrice) * 100)}%</span>}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap text-[var(--ink-2)]">{money(u.listPrice)}</td>
                <td className="px-2 py-2 text-right">{data.interest[u.id]?.visitors ?? 0}</td>
                <td className="px-4 py-2 text-right">{data.leadCounts[u.id] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
