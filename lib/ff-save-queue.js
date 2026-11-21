// Continue must not be dropped while a save is already running.
export function createSingleFlight(perform) {
  let tail = Promise.resolve();
  return function run(arg) {
    const result = tail.then(() => perform(arg));
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
