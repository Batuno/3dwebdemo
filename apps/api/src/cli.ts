// Admin accounts from the command line, for when nobody can sign in.
//   pnpm --filter @bair/api user list
//   pnpm --filter @bair/api user add <email> <superadmin|admin|sales> [name]
//   pnpm --filter @bair/api user password <email>
// These act on the local database (data/bair.sqlite, or DB_FILE). Add --sql to print the SQL instead, then run it on
// Cloudflare with: npx wrangler d1 execute bair-songolt --remote --command "<the SQL>"
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { deriveLoginKey, LOGIN_KDF, newSalt } from '@bair/project-data';
import { createUser, MIN_PASSWORD, ROLES, verifierFor, type Role } from './auth';
import { migrate, nowIso } from './db';
import { configFromEnv } from './node/server';
import { openSqlite } from './node/sqlite';

const args = process.argv.slice(2).filter((a) => a !== '--sql');
const sqlOnly = process.argv.includes('--sql');
const [command, email, roleArg, ...nameParts] = args;

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    if (hidden) {
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => write.call(rl, s.startsWith(question) ? s : '*');
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) stdout.write('\n');
      resolve(answer);
    });
  });
}

async function askPassword(): Promise<string> {
  const pw = process.env.PASSWORD ?? (await ask('New password: ', true));
  if (pw.length < MIN_PASSWORD) throw new Error(`The password needs at least ${MIN_PASSWORD} characters.`);
  if (!process.env.PASSWORD && (await ask('Again: ', true)) !== pw) throw new Error('The passwords do not match.');
  return pw;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  if (command === 'add' || command === 'password') {
    if (!email) throw new Error('Give an email.');
    const role = (roleArg ?? 'admin') as Role;
    if (command === 'add' && !ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(', ')}.`);
    const password = await askPassword();
    const salt = newSalt();
    const key = await deriveLoginKey(password, salt);
    const verifier = await verifierFor(key);
    if (sqlOnly) {
      console.log(
        command === 'add'
          ? `INSERT INTO users (email, name, role, salt, iterations, verifier, created_at) VALUES (${q(email.toLowerCase())}, ${q(nameParts.join(' ') || email)}, ${q(role)}, ${q(salt)}, ${LOGIN_KDF.iterations}, ${q(verifier)}, ${q(nowIso())});`
          : `UPDATE users SET salt = ${q(salt)}, iterations = ${LOGIN_KDF.iterations}, verifier = ${q(verifier)}, active = 1 WHERE email = ${q(email.toLowerCase())}; DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ${q(email.toLowerCase())});`,
      );
      return;
    }
    const db = openSqlite(configFromEnv().dbFile);
    await migrate(db);
    if (command === 'add') {
      await createUser(db, { email, name: nameParts.join(' ') || email, role, salt, key });
      console.log(`Added ${email} as ${role}.`);
    } else {
      const r = await db.run('UPDATE users SET salt = ?, iterations = ?, verifier = ?, active = 1 WHERE email = ?', salt, LOGIN_KDF.iterations, verifier, email.toLowerCase());
      if (!r.changes) throw new Error(`No user ${email}.`);
      await db.run('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)', email.toLowerCase());
      console.log(`New password set for ${email}; their sessions were signed out.`);
    }
    return;
  }
  if (command === 'list') {
    const db = openSqlite(configFromEnv().dbFile);
    await migrate(db);
    console.table(await db.all('SELECT id, email, name, role, active, last_login_at FROM users ORDER BY id'));
    return;
  }
  console.log('Usage: user list | user add <email> <role> [name] | user password <email>   (add --sql for Cloudflare D1)');
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
