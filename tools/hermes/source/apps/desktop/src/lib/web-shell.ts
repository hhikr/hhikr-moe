// The renderer also runs in a plain browser tab (Cosmo), where
// `window.hermesDesktop` is a bridge instead of the Electron preload, and on
// phones, where there is no pointer to hover with and no hardware keyboard.
// These are the two questions the shell asks to tell those apart.

/** The bridge, not Electron, provides `window.hermesDesktop`. */
export function isWebShell(): boolean {
  return typeof window !== 'undefined' && window.hermesDesktop?.platform === 'web'
}

/** Every input on this device is a finger: no hover, no right button. A
 *  touch-screen laptop with a trackpad answers false. */
export function isTouchOnly(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(any-hover: none)').matches)
}
