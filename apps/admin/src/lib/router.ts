import { useEffect, useState } from 'react';

/** "#/leads/12?status=new" → { parts: ['leads', '12'], query } */
export interface Location {
  parts: string[];
  query: URLSearchParams;
}

const read = (): Location => {
  const [path, q] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q ?? '') };
};

export function useLocation(): Location {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export function go(path: string, query?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  location.hash = `#/${path.replace(/^\//, '')}${s ? `?${s}` : ''}`;
}

/** Changes the query without adding a history entry, for filters. */
export function setQuery(query: Record<string, string | undefined>) {
  const { parts } = read();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v);
  const s = q.toString();
  history.replaceState(null, '', `#/${parts.map(encodeURIComponent).join('/')}${s ? `?${s}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
