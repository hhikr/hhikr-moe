// Small effects shared by the home page and the management area. Each one
// answers something the visitor did, and does nothing under reduced motion.

const still = matchMedia('(prefers-reduced-motion: reduce)');
const running = new WeakMap<Element, { final: string; frame: number }>();

const stand = (ch: string) => {
  if (/\d/.test(ch)) return String(Math.floor(Math.random() * 10));
  if (/[A-Za-z]/.test(ch)) return String.fromCharCode((ch < 'a' ? 65 : 97) + Math.floor(Math.random() * 26));
  return ch;
};

/**
 * A readout settling: the figures spin and lock in from the left, the way a
 * counter on a panel does. Anything that is not a figure or a letter stays put.
 */
export function scramble(el: Element, ms = 360): void {
  if (still.matches) return;
  const before = running.get(el);
  if (before) cancelAnimationFrame(before.frame);
  const final = before?.final ?? el.textContent ?? '';
  if (!/[0-9A-Za-z]/.test(final)) return;
  const started = performance.now();
  const state = { final, frame: 0 };
  running.set(el, state);
  const step = (now: number) => {
    const done = Math.min(1, (now - started) / ms);
    const locked = Math.floor(done * final.length);
    el.textContent = final.slice(0, locked) + [...final.slice(locked)].map(stand).join('');
    if (done < 1) {
      state.frame = requestAnimationFrame(step);
    } else {
      el.textContent = final;
      running.delete(el);
    }
  };
  state.frame = requestAnimationFrame(step);
}

/**
 * Wires the readouts on a page:
 *   data-fx-load              settles once when the page opens
 *   data-fx-host              pointing at it (or reaching it by keyboard) settles every data-fx inside it
 *   data-fx-host="key"        the same, for every data-fx-of="key" anywhere on the page
 */
export function wireReadouts(root: ParentNode = document): void {
  root.querySelectorAll('[data-fx-load]').forEach((el, i) => setTimeout(() => scramble(el, 700), 120 + i * 40));
  root.querySelectorAll<HTMLElement>('[data-fx-host]').forEach((host) => {
    const key = host.dataset.fxHost;
    const run = () => (key ? root.querySelectorAll(`[data-fx-of="${key}"]`) : host.querySelectorAll('[data-fx]')).forEach((el) => scramble(el));
    host.addEventListener('pointerenter', run);
    host.addEventListener('focus', run);
  });
}
