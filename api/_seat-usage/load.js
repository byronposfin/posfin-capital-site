// Private helper. The _seat-usage folder is not a Vercel route.
// snapshot.json is the versioned seat-usage snapshot. Replace the file to refresh it.

import { readFileSync } from 'node:fs';

export function readSeatUsageFile() {
  return JSON.parse(readFileSync(new URL('./snapshot.json', import.meta.url), 'utf8'));
}
