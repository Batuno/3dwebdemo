import { useState } from 'react';
import { PORTRAIT_PHONE, useMedia } from '@bair/ui';
import { blockById, garage, interiors, mirroredInteriors, projectConfig, roomLabel, site, unitTypes } from '@bair/project-data';
import { t } from '@bair/project-data';
import { discountPercent, formatPrice, formatPriceShort, unitNumber } from '@bair/project-data';
import { compassKey, facingDeg } from '@bair/project-data';
import { getUnit, garageBays } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { Panel, primaryBtn, secondaryBtn, Stat, StatusBadge } from './common';
import { IconCalendar, IconChat, IconInfo, IconPhone, IconPlan, IconShare } from './icons';
import { LeadModal } from './LeadModal';
import { TopViewModal } from './TopViewModal';
import { PlanSwitch } from './PlanView';
import type { LeadKind } from '../lib/leads';
import { trackAction } from '../lib/analytics';

function Compass({ deg }: { deg: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }}>
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeOpacity=".25" />
        <path d="M12 4l3.4 8.4L12 11l-3.4 1.4L12 4Z" fill="#c9472f" />
      </svg>
      {t.compass[compassKey(deg)]}
    </span>
  );
}

export function UnitPanel({ block, storey, stack, collapsed }: { block: string; storey: number; stack: number; collapsed?: boolean }) {
  const unit = getUnit(block, storey, stack)!;
  // Live statuses and prices change `unit` in place; this re-renders the panel when they do.
  useAppStore((s) => s.inventoryTick);
  const def = blockById(block)!;
  const st = def.stacks.find((s) => s.stack === stack)!;
  const type = unitTypes[unit.type];
  const navigate = useAppStore((s) => s.navigate);
  const showToast = useAppStore((s) => s.showToast);
  const parkingBay = useAppStore((s) => s.parking[unit.id]);
  const setParking = useAppStore((s) => s.setParking);
  const setParkingFor = useAppStore((s) => s.setParkingFor);
  const [lead, setLead] = useState<LeadKind | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const fittings = useAppStore((s) => s.fittings);
  const setFitting = useAppStore((s) => s.setFitting);
  // On portrait phones the 3D / plan switch rides on top of this sheet instead of floating over it.
  const portrait = useMedia(PORTRAIT_PHONE);

  const number = unitNumber(storey, stack);
  const at = { block, storey, stack };
  const sale = discountPercent(unit.price, unit.listPrice);
  const openLead = (kind: LeadKind) => {
    trackAction('lead_open', { ...at, kind });
    setLead(kind);
  };
  const bay = parkingBay ? garageBays.find((b) => b.id === parkingBay) : undefined;
  const total = unit.price + (bay ? bay.price : 0);
  const facing = facingDeg(st, site.northOffsetDeg);

  const share = async () => {
    trackAction('share', at);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t.unit.linkCopied);
    } catch {
      window.prompt(t.unit.share, url);
    }
  };

  return (
    <>
      <Panel
        id={collapsed ? 'unit-pov' : 'unit'}
        initial={collapsed ? 'collapsed' : 'open'}
        initialOnPhone="collapsed"
        fold
        dock={portrait && !collapsed ? <PlanSwitch /> : undefined}
        pill={
          <span className="unit-peek">
            <span className="text-base font-extrabold">{number}</span>
            <StatusBadge status={unit.status} />
            <span className="unit-peek__price">
              <span className="unit-peek__type">{t.unitType[unit.type]} · </span>
              {formatPriceShort(unit.price)}
              {sale > 0 && <span className="sale-badge">{t.price.sale(sale)}</span>}
            </span>
          </span>
        }
        title={
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold">{number}</span>
            <StatusBadge status={unit.status} />
          </div>
        }
        footer={
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={primaryBtn} onClick={() => openLead('viewing')} disabled={unit.status === 'sold'}>
                <IconCalendar />
                {t.unit.book}
              </button>
              <button type="button" className={secondaryBtn} onClick={() => openLead('info')}>
                <IconInfo />
                {t.unit.info}
              </button>
            </div>
            {showContact ? (
              <div className="grid grid-cols-2 gap-2">
                <a className={secondaryBtn} href={`tel:${projectConfig.contact.phone}`} onClick={() => trackAction('call', at)}>
                  <IconPhone />
                  {projectConfig.contact.phoneLabel}
                </a>
                <a className={secondaryBtn} href={projectConfig.contact.messenger} target="_blank" rel="noreferrer" onClick={() => trackAction('messenger', at)}>
                  <IconChat />
                  {t.unit.messenger}
                </a>
              </div>
            ) : (
              <button type="button" className={secondaryBtn} onClick={() => setShowContact(true)}>
                <IconPhone />
                {t.unit.contact}
              </button>
            )}
          </div>
        }
      >
        <div className="mb-3">
          <div className="text-[13px] font-semibold text-[var(--ink-soft)]">
            {t.nav.block(block)} · {t.unitType[unit.type]}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-extrabold tracking-tight">
            {formatPrice(unit.price)}
            {sale > 0 && (
              <span className="sale-badge" aria-label={t.price.saleLabel(sale)}>
                {t.price.sale(sale)}
              </span>
            )}
          </div>
          {sale > 0 && (
            <div className="text-xs text-[var(--ink-soft)]">
              {t.price.was}: <s>{formatPrice(unit.listPrice)}</s>
            </div>
          )}
          <div className="text-xs text-[var(--ink-soft)]">
            {t.price.perM2}: {formatPrice(unit.pricePerM2)}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <Stat label={t.unit.totalArea} value={`${type.totalArea} ${t.unit.m2}`} />
          <Stat label={t.unit.internalArea} value={`${type.internalArea} ${t.unit.m2}`} />
          <Stat label={t.unit.storey} value={storey} />
          <Stat label={t.unit.orientation} value={<Compass deg={facing} />} />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <button type="button" className={`${secondaryBtn} flex-col gap-0.5 px-1 py-1.5 text-[10.5px] leading-tight`} onClick={share}>
            <IconShare />
            {t.unit.share}
          </button>
          <button type="button" className={`${secondaryBtn} flex-col gap-0.5 px-1 py-1.5 text-[10.5px] leading-tight`} onClick={() => {
              trackAction('plan', at);
              setShowPlan(true);
            }}>
            <IconPlan />
            {t.unit.plan}
          </button>
        </div>

        {type.id === '3R' && (
          <label className="mb-3 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-black/[0.035] px-3 text-[13px] font-semibold">
            {t.unit.optionPartition}
            <input type="checkbox" className="h-5 w-5" checked={fittings.partition} onChange={(e) => setFitting('partition', e.target.checked)} />
          </label>
        )}

        <section className="mb-3">
          <h3 className="mb-1 flex items-baseline justify-between text-[13px] font-bold">
            {t.unit.rooms}
            <span className="text-[11px] font-medium text-[var(--ink-soft)]">{t.unit.approx}</span>
          </h3>
          <ul className="text-[12.5px]">
            {type.rooms.map((r) => (
              <li key={r.room} className="flex justify-between border-b border-black/[0.04] py-1">
                <span>{roomLabel(type.id, r.room)}</span>
                <span className="font-semibold">
                  {r.area} {t.unit.m2}
                </span>
              </li>
            ))}
            <li className="flex justify-between py-1 text-[var(--ink-soft)]">
              <span>+ {t.room.acLedge}</span>
              <span className="font-semibold">
                {type.ledge} {t.unit.m2}
              </span>
            </li>
          </ul>
        </section>

        <section className="mb-3 rounded-2xl bg-black/[0.035] p-3">
          <h3 className="text-[13px] font-bold">{t.unit.parkingTitle}</h3>
          <p className="mb-2 text-xs text-[var(--ink-soft)]">{formatPrice(bay ? bay.price : garage.bayPrice)}</p>
          {bay ? (
            <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
              <span>{t.unit.parkingChosen(bay.id)}</span>
              <button type="button" className={`${secondaryBtn} text-xs`} onClick={() => setParking(unit.id, null)}>
                {t.garage.removeFromUnit}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${secondaryBtn} w-full`}
              onClick={() => {
                setParkingFor(unit.id);
                navigate({ view: 'garage' });
              }}
            >
              {t.unit.parkingChoose}
            </button>
          )}
          {bay && (
            <div className="mt-2 flex justify-between border-t border-black/5 pt-2 text-[13px]">
              <span className="font-semibold text-[var(--ink-soft)]">{t.price.withParking}</span>
              <span className="font-extrabold">{formatPrice(total)}</span>
            </div>
          )}
        </section>
      </Panel>
      {showPlan && (
        <TopViewModal
          layout={(st.mirror ? mirroredInteriors : interiors)[st.type]}
          turnDeg={st.rot}
          fileName={`${block}-${number.replace('#', '')}`}
          onClose={() => setShowPlan(false)}
        />
      )}
      {lead && <LeadModal kind={lead} unit={unit} parkingBay={parkingBay} onClose={() => setLead(null)} />}
    </>
  );
}
