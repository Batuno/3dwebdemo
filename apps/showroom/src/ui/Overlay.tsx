import { useEffect, useMemo, useState } from 'react';
import { PHONE, PORTRAIT_PHONE, useMedia } from '@bair/ui';
import { useProgress } from '@react-three/drei';
import { blockById, garage, outdoorSpotById, projectConfig } from '@bair/project-data';
import { t } from '@bair/project-data';
import { formatPrice, unitNumber } from '@bair/project-data';
import { garageBays, countStatuses } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { Panel, primaryBtn, secondaryBtn, StatusBadge } from './common';
import { FloorPanel } from './Panels';
import { FloorSelect } from './FloorSelect';
import { FloorTicks } from './FloorTicks';
import { AmenityList } from './AmenityList';
import { BottomNav } from './BottomNav';
import { TopBar } from './Nav';
import { IntroStill } from './IntroStill';
import { Minimap, RoomPill } from './Minimap';
import { PlanSwitch, PlanView } from './PlanView';
import { TimeSlider } from './TimeSlider';
import { UnitPanel } from './UnitPanel';

function Toast() {
  const toast = useAppStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return undefined;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div role="status" className="scene-tip fade-in pointer-events-none fixed top-20 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 text-center whitespace-normal">
      {toast.text}
    </div>
  );
}

function GaragePanel() {
  const selected = useAppStore((s) => s.garageSelection);
  const select = useAppStore((s) => s.setGarageSelection);
  const parkingFor = useAppStore((s) => s.parkingFor);
  const setParking = useAppStore((s) => s.setParking);
  const setParkingFor = useAppStore((s) => s.setParkingFor);
  const navigate = useAppStore((s) => s.navigate);
  const bay = useMemo(() => garageBays.find((b) => b.id === selected), [selected]);
  const counts = useMemo(() => countStatuses(garageBays), []);
  const [block, storey, stack] = parkingFor ? parkingFor.split('-') : [];
  const back = () => {
    if (parkingFor) navigate({ view: 'unit', block, storey: Number(storey), stack: Number(stack) });
    else navigate({ view: 'overview' });
  };
  return (
    <Panel
      id="garage"
      title={t.garage.title}
      footer={
        <div className="grid gap-2">
          <button type="button" className={`${secondaryBtn} w-full`} onClick={() => navigate({ view: 'outdoor', spot: 'garage-entry' })}>
            {t.garage.seeEntrance}
          </button>
          <button type="button" className={`${secondaryBtn} w-full`} onClick={back}>
            {t.garage.exit}
          </button>
        </div>
      }
    >
      <p className="mb-2 text-[13px] text-[var(--ink-soft)]">{t.garage.hint}</p>
      <div className="mb-3 flex items-center gap-3 text-[12px] font-semibold">
        <span className="flex items-center gap-1">
          <span className="dot status-available" />
          {counts.available}
        </span>
        <span className="flex items-center gap-1">
          <span className="dot status-reserved" />
          {counts.reserved}
        </span>
        <span className="flex items-center gap-1">
          <span className="dot status-sold" />
          {counts.sold}
        </span>
        <span className="ml-auto text-[var(--ink-soft)]">{formatPrice(garage.bayPrice)}</span>
      </div>
      {bay ? (
        <div className="rounded-2xl bg-black/[0.035] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-base font-extrabold">
              {t.garage.bay} {bay.id}
            </span>
            <StatusBadge status={bay.status} />
          </div>
          <div className="mb-3 text-sm font-semibold">{formatPrice(bay.price)}</div>
          {parkingFor ? (
            <button
              type="button"
              className={`${primaryBtn} w-full`}
              disabled={bay.status !== 'available'}
              onClick={() => {
                setParking(parkingFor, bay.id);
                setParkingFor(null);
                select(null);
                navigate({ view: 'unit', block, storey: Number(storey), stack: Number(stack) });
              }}
            >
              {t.garage.addToUnit(unitNumber(Number(storey), Number(stack)))}
            </button>
          ) : (
            <p className="text-xs text-[var(--ink-soft)]">{t.garage.pickUnitFirst}</p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

function Loading() {
  const ready = useAppStore((s) => s.sceneReady);
  const progress = useProgress((p) => p.progress);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return undefined;
    const id = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(id);
  }, [ready]);
  if (gone) return null;
  return (
    <div className={`fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-[#dfe6ea] transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'}`}>
      <div className="text-2xl font-extrabold tracking-tight">{t.app.title}</div>
      <div className="text-sm text-[var(--ink-soft)]">{t.app.loading}</div>
      <div className="h-1 w-52 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${Math.max(6, progress)}%` }} />
      </div>
      <div className="text-xs text-[var(--ink-soft)]">{t.app.loadingHint}</div>
    </div>
  );
}

/** Short white fade when stepping inside a flat, so the cut never feels abrupt. */
function InteriorFade() {
  const key = useAppStore((s) => (s.route.view === 'unit' ? `${s.route.block}-${s.route.storey}-${s.route.stack}` : ''));
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) {
      setOn(false);
      return undefined;
    }
    setOn(true);
    const id = setTimeout(() => setOn(false), 380);
    return () => clearTimeout(id);
  }, [key]);
  return <div className={`pointer-events-none fixed inset-0 z-10 bg-white transition-opacity duration-500 ${on ? 'opacity-45' : 'opacity-0'}`} />;
}

export function Overlay() {
  const route = useAppStore((s) => s.route);
  const selectedStorey = useAppStore((s) => s.selectedStorey);
  const unitType = route.view === 'unit' ? blockById(route.block)?.stacks.find((x) => x.stack === route.stack)?.type : undefined;
  const navigate = useAppStore((s) => s.navigate);
  const povFade = useAppStore((s) => s.povFade);
  const planMode = useAppStore((s) => s.planMode);
  // Portrait phones dock the 3D / plan switch on the flat's sheet (see UnitPanel).
  const portrait = useMedia(PORTRAIT_PHONE);
  // The flat's minimap is a computer-only aid; on phones the plan switch covers it.
  const phone = useMedia(PHONE);
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <IntroStill />
      <InteriorFade />
      <TopBar />
      <BottomNav />
      {/* The floor plan is a line drawing, so the time of day has nothing to change there. */}
      {!(route.view === 'unit' && planMode) && <TimeSlider />}
      {route.view === 'block' && (
        <>
          <FloorTicks key={route.block} block={route.block} current={selectedStorey} />
          <FloorSelect block={route.block} />
        </>
      )}
      {route.view === 'floor' && (
        <>
          <FloorTicks key={route.block} block={route.block} current={route.storey} />
          <FloorPanel block={route.block} storey={route.storey} />
        </>
      )}
      {route.view === 'unit' && (
        <>
          <UnitPanel
            key={`${route.block}-${route.storey}-${route.stack}-${route.spot ? 'pov' : 'doll'}`}
            block={route.block}
            storey={route.storey}
            stack={route.stack}
            collapsed={route.spot !== undefined}
          />
          <PlanView key={`${route.block}-${route.stack}`} block={route.block} storey={route.storey} stack={route.stack} />
          {!route.spot && !portrait && <PlanSwitch />}
          {/* The room pill comes first so phones can drop the plan's tab below it (`.room-pill ~ .minimap`). */}
          {route.spot && unitType && (
            <RoomPill type={unitType} spot={route.spot} onExit={() => navigate({ ...route, spot: undefined })} />
          )}
          {!phone && !(planMode && !route.spot) && <Minimap block={route.block} stack={route.stack} spot={route.spot} />}
        </>
      )}
      {route.view === 'garage' && <GaragePanel />}
      {route.view === 'outdoor' && (
        <>
          <AmenityList current={route.spot} />
          <div className="room-pill glass pointer-events-auto">
            <strong>{t.amenity[outdoorSpotById(route.spot)?.labelKey ?? '']}</strong>
            <button type="button" onClick={() => navigate({ view: 'overview' })}>
              {t.pov.exitOutdoor}
            </button>
          </div>
        </>
      )}
      <div className={`pointer-events-none fixed inset-0 z-[9] bg-black transition-opacity duration-200 ${povFade ? 'opacity-100' : 'opacity-0'}`} />
      <Toast />
      <Loading />
      <footer className="fixed right-0 bottom-0 left-0 z-10 hidden justify-center pb-1 md:flex">
        <span className="rounded-full bg-black/35 px-3 py-1 text-center text-[11px] font-medium text-white backdrop-blur-sm">{t.app.disclaimer}
          {projectConfig.context.url && ` ${projectConfig.context.attribution}`}
        </span>
      </footer>
    </div>
  );
}
