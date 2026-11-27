// A resume code in the address bar is removed before the Meta pixel loads.
// Use it for that load, and again on refresh. A later visit, such as /apply?lane=land, starts fresh.
export function resumeTokenForLoad({ query = "", handedOff = "", stored = "", navigation = "navigate" } = {}) {
  if (query) return { token: String(query), clearStored: false };
  if (handedOff) return { token: String(handedOff), clearStored: false };
  if (navigation === "reload" && stored) return { token: String(stored), clearStored: false };
  return { token: "", clearStored: !!stored };
}

// Continue must not be dropped while a save is already running.
export function createSingleFlight(perform) {
  let tail = Promise.resolve();
  return function run(arg) {
    const result = tail.then(() => perform(arg));
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
