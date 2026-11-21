import { OWNERS } from './cockpit.js';
import { pilotSpine } from './case-spine.js';

export function createSpineStore(seed = pilotSpine()) {
  const source = structuredClone(seed);
  const done = new Map();
  const audit = [];

  function view() {
    const spine = structuredClone(source);
    spine.actions = spine.actions.map((item) => ({ ...item, done: done.has(item.id) ? done.get(item.id) : item.done }));
    return spine;
  }

  return {
    get() {
      return view();
    },
    auditFor(id) {
      return audit.filter((row) => row.subjectId === id);
    },
    setDone(actionId, next, actor, now) {
      if (!OWNERS.includes(actor)) return { error: 'bad_actor' };
      const current = view().actions.find((item) => item.id === actionId);
      if (!current) return { error: 'not_found' };
      const value = next === true;
      if (current.done === value) return { ok: true, unchanged: true, spine: view() };
      done.set(actionId, value);
      audit.push({
        subjectType: 'spine_action',
        subjectId: actionId,
        caseRef: source.ref,
        actor,
        field: 'done',
        oldValue: String(current.done),
        newValue: String(value),
        at: now,
      });
      return { ok: true, spine: view() };
    },
    revert(actor, now) {
      if (!OWNERS.includes(actor)) return { error: 'bad_actor' };
      const changed = [...done.keys()];
      done.clear();
      audit.push({
        subjectType: 'spine',
        subjectId: source.ref,
        caseRef: source.ref,
        actor,
        field: 'source',
        oldValue: changed.join(',') || 'overlay',
        newValue: 'fixture',
        at: now,
      });
      return { ok: true, spine: view() };
    },
  };
}

const memory = globalThis.__posfinSpineMemory || { store: null };
globalThis.__posfinSpineMemory = memory;

export function sharedSpineStore() {
  if (!memory.store) memory.store = createSpineStore();
  return memory.store;
}

export function resetSharedSpineStore() {
  memory.store = null;
}
