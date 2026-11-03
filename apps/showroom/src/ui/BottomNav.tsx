// The main navigation: Home, Block, Amenities, Garage, Contact, plus floor steps and a settings gear.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { restorePanels } from '@bair/ui';
import { blocks, countStatuses, outdoorSpots, projectConfig, t, unitsInBlock } from '@bair/project-data';
import { useAppStore, type Quality } from '../store/useAppStore';
import { IconCar, IconChat, IconDown, IconGear, IconHome, IconLayers, IconPhone, IconTree, IconUp } from './icons';

type Menu = 'block' | 'amenities' | 'contact' | 'settings' | null;

function Tab({ label, icon, active, onClick }: { label: string; icon: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`nav-tab ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function BottomNav() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const resetView = useAppStore((s) => s.resetView);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const [menu, setMenu] = useState<Menu>(null);
  const toggle = (m: Menu) => setMenu((cur) => (cur === m ? null : m));

  const counts = useMemo(
    () => Object.fromEntries(blocks.map((b) => [b.id, countStatuses(unitsInBlock(b.id)).available])),
    [],
  );

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const canStep = route.view === 'floor' || route.view === 'unit';
  const step = (d: number) => {
    if (route.view !== 'floor' && route.view !== 'unit') return;
    const next = route.storey + d;
    if (next >= 2 && next <= 24) navigate({ ...route, storey: next });
  };

  return (
    <nav className="bottom-nav pointer-events-none" aria-label={t.nav.main}>
      {menu && (
        <div className="glass nav-menu pointer-events-auto">
          {menu === 'block' &&
            blocks.map((b) => (
              <button
                type="button"
                key={b.id}
                className="nav-menu__row"
                onClick={() => {
                  setMenu(null);
                  navigate({ view: 'block', block: b.id });
                }}
              >
                <span className="dot" style={{ background: b.labelColor }} />
                {b.id} · {counts[b.id]}
              </button>
            ))}
          {menu === 'amenities' &&
            outdoorSpots.map((spot) => (
              <button
                type="button"
                key={spot.id}
                className="nav-menu__row"
                onClick={() => {
                  setMenu(null);
                  navigate({ view: 'outdoor', spot: spot.id });
                }}
              >
                {t.amenity[spot.labelKey]}
              </button>
            ))}
          {menu === 'contact' && (
            <>
              <a className="nav-menu__row" href={`tel:${projectConfig.contact.phone}`}>
                <IconPhone />
                {projectConfig.contact.phoneLabel}
              </a>
              <a className="nav-menu__row" href={projectConfig.contact.messenger} target="_blank" rel="noreferrer">
                <IconChat />
                {t.unit.messenger}
              </a>
            </>
          )}
          {menu === 'settings' &&
            (['high', 'medium', 'low'] as Quality[]).map((q) => (
              <button
                type="button"
                key={q}
                className={`nav-menu__row ${q === quality ? 'is-active' : ''}`}
                aria-pressed={q === quality}
                onClick={() => {
                  setQuality(q);
                  setMenu(null);
                }}
              >
                <IconLayers />
                {t.quality[q]}
              </button>
            ))}
          {menu === 'settings' && (
            <button
              type="button"
              className="nav-menu__row"
              onClick={() => {
                restorePanels();
                setMenu(null);
              }}
            >
              {t.panel.restore}
            </button>
          )}
          {menu === 'settings' && <p className="nav-menu__note">{t.app.disclaimer}</p>}
        </div>
      )}
      <div className="glass nav-bar pointer-events-auto">
        <Tab
          label={t.nav.home}
          icon={<IconHome />}
          active={route.view === 'overview'}
          onClick={() => {
            setMenu(null);
            if (route.view === 'overview') resetView();
            else navigate({ view: 'overview' });
          }}
        />
        <Tab label={t.nav.blocks} icon={<IconLayers />} active={menu === 'block' || 'block' in route} onClick={() => toggle('block')} />
        <Tab label={t.nav.amenities} icon={<IconTree />} active={menu === 'amenities' || route.view === 'outdoor'} onClick={() => toggle('amenities')} />
        <Tab
          label={t.nav.garage}
          icon={<IconCar />}
          active={route.view === 'garage'}
          onClick={() => {
            setMenu(null);
            navigate(route.view === 'garage' ? { view: 'overview' } : { view: 'garage' });
          }}
        />
        <Tab label={t.nav.contact} icon={<IconPhone />} active={menu === 'contact'} onClick={() => toggle('contact')} />
        {canStep && (
          <>
            <button type="button" className="nav-icon" aria-label={t.nav.floorUp} onClick={() => step(1)}>
              <IconUp />
            </button>
            <button type="button" className="nav-icon" aria-label={t.nav.floorDown} onClick={() => step(-1)}>
              <IconDown />
            </button>
          </>
        )}
        <button type="button" className="nav-icon" aria-label={t.nav.quality} aria-pressed={menu === 'settings'} onClick={() => toggle('settings')}>
          <IconGear />
        </button>
      </div>
    </nav>
  );
}
