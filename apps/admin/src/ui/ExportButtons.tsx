import { useState } from 'react';
import { ta } from '@bair/project-data';
import type { Sheet } from '../lib/sheets';
import { saveExport, type ExportWhat } from '../lib/exports';
import { Button, useToast } from './kit';
import { Icon } from './icons';

/** CSV and Excel buttons for admins. `sheets` is called on click, so it builds from the data on screen. */
export function ExportButtons({ what, sheets, filter, csv = true }: { what: ExportWhat; sheets: () => Sheet[] | null; filter?: Record<string, string>; csv?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (format: 'csv' | 'xlsx') => {
    const s = sheets();
    if (!s) return;
    setBusy(true);
    try {
      await saveExport(what, format, s, filter);
    } catch {
      toast(ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inline-flex gap-1.5">
      {csv && (
        <Button small onClick={() => run('csv')} disabled={busy} title={`${ta.export.download} CSV`}>
          <Icon name="download" size={16} />
          {ta.export.csv}
        </Button>
      )}
      <Button small onClick={() => run('xlsx')} disabled={busy} title={`${ta.export.download} Excel`}>
        <Icon name="download" size={16} />
        {ta.export.xlsx}
      </Button>
    </div>
  );
}
