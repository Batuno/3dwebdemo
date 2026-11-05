import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { toCsv, toXlsx } from './sheets';
import { leadsSheet } from './exports';
import type { Lead } from './types';

const lead: Lead = {
  id: 7,
  kind: 'info',
  source: 'website',
  name: '=HYPERLINK("x")',
  phone: '99112233',
  unit_id: '804A-12-325',
  parking_bay: null,
  viewing_date: null,
  viewing_time: null,
  question: 'a,b "c"\nшинэ мөр',
  status: 'new',
  assigned_to: null,
  assigned_name: 'Сараа',
  next_action_at: '2026-11-10',
  session: null,
  created_at: '2026-11-05T06:30:00.000Z',
  updated_at: '2026-11-05T06:30:00.000Z',
  duplicates: 0,
};

describe('CSV', () => {
  it('starts with a byte-order mark, quotes what needs it and defuses formulas', () => {
    const csv = toCsv(leadsSheet([lead]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Нэр');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a,b ""c""\nшинэ мөр"');
    expect(csv).toContain('Шинэ');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});

describe('Excel', () => {
  it('writes a workbook with named, filtered sheets and real numbers', () => {
    const files = unzipSync(
      toXlsx([
        leadsSheet([lead]),
        { name: 'Байр: 804A/B [x]', header: ['Байр', 'Үнэ'], rows: [['804A', 429300000], ['<b>&', null]] },
      ]),
    );
    const workbook = strFromU8(files['xl/workbook.xml']);
    expect(workbook).toContain('name="Харилцагч"');
    expect(workbook).toContain('name="Байр  804A B  x "');
    const sheet = strFromU8(files['xl/worksheets/sheet2.xml']);
    expect(sheet).toContain('<v>429300000</v>');
    expect(sheet).toContain('&lt;b&gt;&amp;');
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
    expect(sheet).toContain('state="frozen"');
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/styles.xml', '_rels/.rels']));
  });
});
