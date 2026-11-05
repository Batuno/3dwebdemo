import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { LEAD_SOURCES, LEAD_STATUSES, ta, type LeadStatus } from '@bair/project-data';
import { useSession } from '../App';
import { ApiError, patch } from '../lib/api';
import { leadsSheet } from '../lib/exports';
import { day, unitLabel } from '../lib/format';
import { go, setQuery, useLocation } from '../lib/router';
import type { Lead, UserOption } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ExportButtons } from '../ui/ExportButtons';
import { Icon } from '../ui/icons';
import { Button, Empty, ErrorBox, PageHeader, Segmented, Spinner, useToast } from '../ui/kit';
import { AddLeadModal } from './leads/AddLeadModal';
import { LeadDrawer } from './leads/LeadDrawer';

const T = ta.leads;
const FILTER_KEYS = ['q', 'status', 'source', 'assigned', 'from', 'to', 'due', 'view'] as const;

export function StatusSelect({ value, onChange, label }: { value: LeadStatus; onChange: (s: LeadStatus) => void; label: string }) {
  return (
    <span className="relative inline-flex items-center">
      <span className="dot pointer-events-none absolute left-2.5" style={{ background: `var(--ls-${value})` }} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as LeadStatus)} className="field !min-h-8 !w-auto !pl-6 !text-[13px] font-semibold">
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ta.leadStatus[s]}
          </option>
        ))}
      </select>
    </span>
  );
}

export default function Leads() {
  const { parts, query } = useLocation();
  const { me, can } = useSession();
  const toast = useToast();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, query.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>;
  const view = f.view === 'board' ? 'board' : 'table';
  const [search, setSearch] = useState(f.q);
  const [adding, setAdding] = useState(false);

  // Debounced search into the address, so a filtered list can be bookmarked or shared.
  useEffect(() => {
    const id = setTimeout(() => search !== f.q && setQuery({ ...f, q: search }), 300);
    return () => clearTimeout(id);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverQuery = new URLSearchParams();
  for (const k of ['q', 'source', 'from', 'to'] as const) if (f[k]) serverQuery.set(k, f[k]);
  if (f.assigned) serverQuery.set('assigned', f.assigned === 'me' ? String(me.id) : f.assigned);
  if (f.due) serverQuery.set('dueBy', new Date().toISOString().slice(0, 10));
  const { data, error, loading, reload, setData } = useApi<{ leads: Lead[] }>(`/api/leads?${serverQuery}`);
  const users = useApi<{ users: UserOption[] }>('/api/users/options').data?.users ?? [];

  const all = useMemo(() => data?.leads ?? [], [data]);
  const counts = useMemo(() => Object.fromEntries(LEAD_STATUSES.map((s) => [s, all.filter((l) => l.status === s).length])), [all]);
  const shown = view === 'table' && f.status ? all.filter((l) => l.status === f.status) : all;
  const openId = parts[1] ? Number(parts[1]) : null;
  const set = (k: (typeof FILTER_KEYS)[number], v: string) => setQuery({ ...f, [k]: v });

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    setData((d) => (d ? { leads: d.leads.map((l) => (l.id === lead.id ? { ...l, status } : l)) } : d));
    try {
      await patch(`/api/leads/${lead.id}`, { status });
      toast(`${lead.name}: ${ta.leadStatus[status]}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.code : ta.app.error, 'error');
      void reload();
    }
  };

  const filterQuery = Object.fromEntries(Object.entries(f).filter(([, v]) => v));

  return (
    <div className="fade-in">
      <PageHeader title={T.title}>
        <Segmented
          label={T.title}
          value={view}
          onChange={(v) => set('view', v === 'board' ? 'board' : '')}
          options={[
            { value: 'table', label: T.table },
            { value: 'board', label: T.board },
          ]}
        />
        {can('admin') && <ExportButtons what="leads" filter={filterQuery} sheets={() => [leadsSheet(shown)]} />}
        <Button tone="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          {T.add}
        </Button>
      </PageHeader>

      <div className="card mb-4 grid gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ink-3)]">
              <Icon name="search" size={16} />
            </span>
            <input className="field !pl-9" type="search" placeholder={T.searchHint} aria-label={ta.app.search} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="field !w-auto" aria-label={T.source} value={f.source} onChange={(e) => set('source', e.target.value)}>
            <option value="">{T.allSources}</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {ta.leadSource[s]}
              </option>
            ))}
          </select>
          <select className="field !w-auto" aria-label={T.assigned} value={f.assigned} onChange={(e) => set('assigned', e.target.value)}>
            <option value="">{T.allAssignees}</option>
            <option value="me">{T.mine}</option>
            <option value="none">{T.unassigned}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input className="field !w-auto" type="date" aria-label={T.from} title={T.from} value={f.from} onChange={(e) => set('from', e.target.value)} />
          <input className="field !w-auto" type="date" aria-label={T.to} title={T.to} value={f.to} onChange={(e) => set('to', e.target.value)} />
          <label className="flex min-h-10 items-center gap-2 rounded-[10px] px-2 text-[13px] font-semibold">
            <input type="checkbox" checked={!!f.due} onChange={(e) => set('due', e.target.checked ? '1' : '')} className="h-4 w-4 accent-[var(--accent)]" />
            {T.due}
          </label>
        </div>
        {view === 'table' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={T.status}>
            <Chip active={!f.status} onClick={() => set('status', '')}>
              {T.allStatuses} <b className="tnum">{all.length}</b>
            </Chip>
            {LEAD_STATUSES.map((s) => (
              <Chip key={s} active={f.status === s} onClick={() => set('status', f.status === s ? '' : s)}>
                <span className="dot" style={{ background: `var(--ls-${s})` }} />
                {ta.leadStatus[s]} <b className="tnum">{counts[s]}</b>
              </Chip>
            ))}
          </div>
        )}
      </div>

      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Spinner />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {view === 'table' ? <LeadTable leads={shown} onStatus={changeStatus} /> : <LeadBoard leads={all} onStatus={changeStatus} />}
        </div>
      )}

      {openId && <LeadDrawer id={openId} users={users} onClose={() => go('leads', filterQuery)} onChanged={reload} />}
      {adding && (
        <AddLeadModal
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            void reload();
            go(`leads/${id}`, filterQuery);
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${
        active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Opens a lead's drawer and keeps the list's filters. */
function open(lead: Lead) {
  go(`leads/${lead.id}`, Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? '')));
}

function LeadTable({ leads, onStatus }: { leads: Lead[]; onStatus: (l: Lead, s: LeadStatus) => void }) {
  if (!leads.length) return <div className="card"><Empty>{T.empty}</Empty></div>;
  return (
    <div className="card scroll-x">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-[12px] text-[var(--ink-2)]">
            <th className="px-4 py-2.5 font-semibold">{T.created}</th>
            <th className="px-2 py-2.5 font-semibold">{T.name}</th>
            <th className="px-2 py-2.5 font-semibold">{T.unit}</th>
            <th className="px-2 py-2.5 font-semibold">{T.kind}</th>
            <th className="px-2 py-2.5 font-semibold">{T.status}</th>
            <th className="px-2 py-2.5 font-semibold">{T.assigned}</th>
            <th className="px-4 py-2.5 font-semibold">{T.nextAction}</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]" onClick={() => open(l)}>
              <td className="tnum px-4 py-2.5 whitespace-nowrap text-[var(--ink-2)]">{day(l.created_at)}</td>
              <td className="px-2 py-2.5">
                <a href={`#/leads/${l.id}`} onClick={(e) => e.stopPropagation()} className="font-bold hover:underline">
                  {l.name}
                </a>
                <div className="tnum text-xs text-[var(--ink-2)]">
                  {l.phone}
                  {l.duplicates > 0 && (
                    <span title={T.duplicate(l.duplicates)} className="ml-1.5 rounded bg-[var(--surface-3)] px-1 text-[11px] font-bold">
                      ×{l.duplicates + 1}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 whitespace-nowrap">{l.unit_id ? unitLabel(l.unit_id) : '—'}</td>
              <td className="px-2 py-2.5">
                <div className="whitespace-nowrap">{ta.leadKind[l.kind]}</div>
                <div className="text-xs text-[var(--ink-3)]">{ta.leadSource[l.source]}</div>
              </td>
              <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                <StatusSelect label={`${l.name}: ${T.status}`} value={l.status} onChange={(s) => onStatus(l, s)} />
              </td>
              <td className="px-2 py-2.5 whitespace-nowrap">{l.assigned_name ?? <span className="text-[var(--ink-3)]">—</span>}</td>
              <td className="tnum px-4 py-2.5 whitespace-nowrap">{l.next_action_at ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One column per stage. Drag a card to move it, or use the select on the card. */
function LeadBoard({ leads, onStatus }: { leads: Lead[]; onStatus: (l: Lead, s: LeadStatus) => void }) {
  const [over, setOver] = useState<LeadStatus | null>(null);
  const byId = new Map(leads.map((l) => [l.id, l]));
  const drop = (e: DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setOver(null);
    const lead = byId.get(Number(e.dataTransfer.getData('text/plain')));
    if (lead) onStatus(lead, status);
  };
  return (
    <div className="scroll-x -mx-4 px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1050px] grid-cols-5 gap-3">
        {LEAD_STATUSES.map((s) => {
          const list = leads.filter((l) => l.status === s);
          return (
            <section
              key={s}
              aria-label={ta.leadStatus[s]}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => drop(e, s)}
              className={`flex min-h-[300px] flex-col rounded-2xl border p-2 transition-colors ${over === s ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)]'}`}
            >
              <header className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="dot" style={{ background: `var(--ls-${s})` }} />
                  {ta.leadStatus[s]}
                </span>
                <span className="tnum text-xs font-bold text-[var(--ink-2)]">{list.length}</span>
              </header>
              <ul className="grid gap-2">
                {list.slice(0, 100).map((l) => (
                  <li
                    key={l.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(l.id))}
                    className="card cursor-grab p-2.5 active:cursor-grabbing"
                  >
                    <a href={`#/leads/${l.id}`} className="block text-sm font-bold hover:underline">
                      {l.name}
                    </a>
                    <div className="tnum mt-0.5 text-xs text-[var(--ink-2)]">
                      {l.phone} · {day(l.created_at)}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--ink-2)]">
                      {l.unit_id ? unitLabel(l.unit_id) : ta.leadKind[l.kind]} · <span className="text-[var(--ink-3)]">{l.assigned_name ?? T.unassigned}</span>
                    </div>
                    <div className="mt-2">
                      <StatusSelect label={`${l.name}: ${T.status}`} value={l.status} onChange={(st) => onStatus(l, st)} />
                    </div>
                  </li>
                ))}
              </ul>
              {!list.length && <p className="px-2 py-6 text-center text-xs text-[var(--ink-3)]">{T.dropHere}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
