// `pnpm --filter @bair/api dev` (watch) or `start` (built): the API on this computer.
import { startServer } from './node/server';

startServer().catch((e) => {
  console.error(e);
  process.exit(1);
});
