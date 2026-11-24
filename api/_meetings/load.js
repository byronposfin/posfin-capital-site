// Private helper. The _meetings folder is not a Vercel route.
// seed.json is the editable agenda. Live ticks are not stored in it.

import { readFileSync } from 'node:fs';

export function readMeetingsFile() {
  return JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
}
