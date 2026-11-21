const initial = () => ({ standingApproval: true, paused: false, updatedBy: '' });

let control = initial();

export function resetBrokaState() {
  control = initial();
}

export function getSearchControl() {
  return { ...control };
}

export function setSearchPaused(seatCode, paused) {
  if (seatCode !== 'byron') return { ok: false, error: 'byron_only' };
  control = { standingApproval: true, paused: !!paused, updatedBy: 'byron' };
  return { ok: true, control: getSearchControl() };
}
