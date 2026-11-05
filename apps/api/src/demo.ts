// Fills the local database with made-up buyers, sales and six weeks of showroom visits, so the admin panel
// has something to show while it is being built. Only touches the local SQLite file; never Cloudflare.
//   pnpm --filter @bair/api demo
import { allUnits, blocks, deriveLoginKey, interiors, LEAD_STATUSES, newSalt, outdoorSpots, type TrackEvent } from '@bair/project-data';
import { createUser, userCount } from './auth';
import { migrate, nowIso } from './db';
import { addDays, dayStartIso, localDay } from './lib/time';
import { ingest } from './services/analytics';
import { planUpdate } from './services/inventory';
import { createLead } from './services/leads';
import { configFromEnv } from './node/server';
import { openSqlite } from './node/sqlite';

const NAMES = [
  'Бат-Эрдэнэ', 'Сарангэрэл', 'Тэмүүлэн', 'Номин', 'Энхжин', 'Ганбаатар', 'Мөнх-Очир', 'Оюунчимэг', 'Билгүүн', 'Ариунаа',
  'Төгөлдөр', 'Солонго', 'Анударь', 'Баярмаа', 'Дөлгөөн', 'Хулан', 'Эрдэнэбат', 'Цэлмэг', 'Мишээл', 'Гантулга',
  'Нандин', 'Отгонбаяр', 'Золзаяа', 'Батзориг', 'Хонгорзул', 'Тэнгис', 'Ууганбаяр', 'Сэлэнгэ',
];
const QUESTIONS = ['Урьдчилгаа хэдэн хувь вэ?', 'Ипотекийн зээлд хамрагдах уу?', 'Хэзээ ашиглалтад орох вэ?', 'Зогсоол тусдаа үнэтэй юу?', 'Хямдрал хэзээ хүртэл үргэлжлэх вэ?'];

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const phone = () => `${pick(['88', '89', '94', '95', '99', '80'])}${String(Math.floor(rand() * 1e6)).padStart(6, '0')}`;
const session = () => `demo${Math.floor(rand() * 1e12).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`.padEnd(12, 'x');

async function main() {
  const cfg = configFromEnv();
  const db = openSqlite(cfg.dbFile);
  await migrate(db);

  // Users: a superadmin unless one exists, and two salespeople.
  const users: number[] = [];
  if ((await userCount(db)) === 0) {
    const salt = newSalt();
    users.push(await createUser(db, { email: 'admin@demo.mn', name: 'Ерөнхий админ', role: 'superadmin', salt, key: await deriveLoginKey('demo-admin-1', salt) }));
    console.log('Superadmin: admin@demo.mn / demo-admin-1');
  }
  for (const [email, name] of [
    ['sara@demo.mn', 'Сараа'],
    ['tuvshin@demo.mn', 'Төвшин'],
  ]) {
    const existing = await db.get<{ id: number }>('SELECT id FROM users WHERE email = ?', email);
    if (existing) users.push(existing.id);
    else {
      const salt = newSalt();
      users.push(await createUser(db, { email, name, role: 'sales', salt, key: await deriveLoginKey('demo-sales-1', salt) }));
      console.log(`Salesperson: ${email} / demo-sales-1`);
    }
  }
  const owner = (await db.get<{ id: number }>("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id"))!.id;

  // Six weeks of visits: more at weekends and in the evening, higher floors and the 4-room flats favoured.
  const today = localDay();
  const outdoor = outdoorSpots.map((s) => s.id);
  let leads = 0;
  for (let d = -41; d <= 0; d++) {
    const day = addDays(today, d);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const visitors = Math.round((weekday === 0 || weekday === 6 ? 70 : 40) * (0.7 + rand() * 0.6) * (1 + (d + 41) / 60));
    for (let v = 0; v < visitors; v++) {
      const hour = pick([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22]);
      const at = new Date(Date.parse(dayStartIso(day)) + hour * 3600_000 + rand() * 3600_000);
      const s = session();
      const device = rand() < 0.62 ? 'mobile' : rand() < 0.2 ? 'tablet' : 'desktop';
      const events: TrackEvent[] = [{ type: 'view', view: 'overview' }];
      if (rand() < 0.25) events.push({ type: 'view', view: 'outdoor', spot: pick(outdoor) });
      if (rand() < 0.82) {
        const block = rand() < 0.57 ? blocks[0] : blocks[1];
        events.push({ type: 'view', view: 'block', block: block.id });
        if (rand() < 0.8) {
          const storey = Math.min(block.storeys, Math.max(2, Math.round(6 + rand() * 12 + (rand() < 0.3 ? 6 : 0))));
          events.push({ type: 'view', view: 'floor', block: block.id, storey });
          const flats = rand() < 0.75 ? 1 + Math.floor(rand() * 3) : 0;
          for (let f = 0; f < flats; f++) {
            const st = rand() < 0.55 ? pick(block.stacks.filter((x) => x.type === '4R')) : pick(block.stacks);
            events.push({ type: 'view', view: 'unit', block: block.id, storey, stack: st.stack });
            for (const h of interiors[st.type].hotspots.filter(() => rand() < 0.35).slice(0, 4)) {
              events.push({ type: 'view', view: 'unit', block: block.id, storey, stack: st.stack, spot: h.id });
            }
            if (rand() < 0.15) events.push({ type: 'action', action: 'plan', block: block.id, storey, stack: st.stack });
            if (rand() < 0.07) {
              const kind = rand() < 0.6 ? 'viewing' : 'info';
              events.push({ type: 'action', action: 'lead_open', kind, block: block.id, storey, stack: st.stack });
              if (rand() < 0.55) {
                await ingest(db, { session: s, device, events: events.splice(0) }, at);
                const id = await createLead(db, {
                  kind,
                  source: 'showroom',
                  name: pick(NAMES),
                  phone: phone(),
                  unitId: `${block.id}-${storey}-${st.stack}`,
                  date: kind === 'viewing' ? addDays(day, 2 + Math.floor(rand() * 7)) : undefined,
                  time: kind === 'viewing' ? pick(['10:00', '11:00', '14:00', '16:00']) : undefined,
                  question: kind === 'info' ? pick(QUESTIONS) : undefined,
                  session: s,
                  status: d < -3 ? pick(LEAD_STATUSES) : 'new',
                  assignedTo: d < -1 && rand() < 0.8 ? pick(users) : null,
                  nextActionAt: rand() < 0.4 ? addDays(today, Math.floor(rand() * 6) - 2) : null,
                });
                await db.run('UPDATE leads SET created_at = ?, updated_at = ? WHERE id = ?', at.toISOString(), at.toISOString(), id);
                leads++;
              }
            }
          }
        }
      }
      if (rand() < 0.08) events.push({ type: 'action', action: pick(['call', 'share', 'messenger'] as const) });
      if (events.length) await ingest(db, { session: s, device, events }, at);
    }
    // A few contact requests from the website each week.
    if (rand() < 0.45) {
      const at = new Date(Date.parse(dayStartIso(day)) + (10 + rand() * 10) * 3600_000);
      const id = await createLead(db, { kind: 'contact', source: 'website', name: pick(NAMES), phone: phone(), status: d < -3 ? pick(LEAD_STATUSES) : 'new' });
      await db.run('UPDATE leads SET created_at = ?, updated_at = ? WHERE id = ?', at.toISOString(), at.toISOString(), id);
      leads++;
    }
  }

  // A spring sale on the low floors and a price rise on the top three, then sales spread over the weeks.
  const low = allUnits.filter((u) => u.storey <= 4 && u.status === 'available').map((u) => u.id);
  const top = allUnits.filter((u) => u.storey >= 22).map((u) => u.id);
  for (const plan of [
    await planUpdate(db, 'unit', low, { discountPct: 7, saleUntil: addDays(today, 25) }, owner),
    await planUpdate(db, 'unit', top, { listPriceChangePct: 3 }, owner),
  ]) {
    await db.batch(plan.statements);
  }
  const sold = allUnits.filter((u) => u.status === 'sold').slice(0, 60);
  for (const [i, u] of sold.entries()) {
    await db.run(
      "INSERT INTO inventory_history (item_id, field, old_value, new_value, user_id, created_at) VALUES (?, 'status', 'reserved', 'sold', ?, ?)",
      u.id,
      pick(users),
      new Date(Date.now() - (i % 8) * 7 * 86400_000 - rand() * 6 * 86400_000).toISOString(),
    );
  }
  const reserved = allUnits.filter((u) => u.status === 'reserved').slice(0, 6).map((u) => u.id);
  await db.batch((await planUpdate(db, 'unit', reserved, { reservedUntil: addDays(today, 2) }, owner)).statements);
  await db.run("DELETE FROM meta WHERE key = 'snapshot'");

  console.log(`Demo data written to ${cfg.dbFile}: ${leads} leads and six weeks of visits (${nowIso()}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
