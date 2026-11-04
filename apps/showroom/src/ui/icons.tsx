import type { ReactNode } from 'react';

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
export const IconMoon = () => (
  <Svg>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Svg>
);
export const IconAuto = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);
export const IconGarage = () => (
  <Svg>
    <path d="M3 21V9l9-5 9 5v12" />
    <path d="M7 21v-8h10v8M7 17h10" />
  </Svg>
);
export const IconFilter = () => (
  <Svg>
    <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />
  </Svg>
);
export const IconHeart = ({ filled = false }: { filled?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20.5s-8-4.7-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.3-8 11-8 11Z" />
  </svg>
);
export const IconReset = () => (
  <Svg>
    <path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5" />
    <path d="M4 4v4.5h4.5" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = () => (
  <Svg>
    <path d="M5 12h14" />
  </Svg>
);
export const IconLayers = () => (
  <Svg>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);
export const IconUp = () => (
  <Svg>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);
export const IconDown = () => (
  <Svg>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconChevron = () => (
  <Svg size={14}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconShare = () => (
  <Svg>
    <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </Svg>
);
export const IconPhone = () => (
  <Svg>
    <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />
  </Svg>
);
export const IconChat = () => (
  <Svg>
    <path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 0 16 8 8 0 0 1-3.5-.8L4 20l1-4a8 8 0 0 1-1-4Z" />
  </Svg>
);
export const IconWindow = () => (
  <Svg>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M12 3v18M4 12h16" />
  </Svg>
);
export const IconWalk = () => (
  <Svg>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="M9 21l2.5-6-2.5-2 1-5 3.5 1 2 3 3 1M13.5 15l2 6M9.5 8.5 6.5 11" />
  </Svg>
);
export const IconCalendar = () => (
  <Svg>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </Svg>
);
export const IconInfo = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const IconChart = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Svg>
);
export const IconMenu = () => (
  <Svg>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />
    </svg>
  );
}

export function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
    </svg>
  );
}

export function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" />
    </svg>
  );
}

export function IconTree() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21v-7M12 3a5.5 5.5 0 0 0-5.3 7A4.5 4.5 0 0 0 8 19h8a4.5 4.5 0 0 0 1.3-9A5.5 5.5 0 0 0 12 3Z" />
    </svg>
  );
}

export function IconCar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16v-3l2-5.5A2 2 0 0 1 7.9 6h8.2A2 2 0 0 1 18 7.5l2 5.5v3M4 13h16M4 16h16v2.5M4 16v2.5M7.5 16v0M16.5 16v0" />
    </svg>
  );
}

export function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </svg>
  );
}

export function IconPlan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16v16H4V4Zm0 9h6v7M10 4v5M14 20v-7h6" />
    </svg>
  );
}
