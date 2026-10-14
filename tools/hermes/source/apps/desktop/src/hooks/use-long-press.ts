import { type MouseEvent, type PointerEvent, useCallback, useEffect, useRef } from 'react'

const HOLD_MS = 500
// A finger drifts a little while it holds still; more than this is a scroll.
const SLOP_PX = 10

/** Touch-and-hold for a surface whose desktop gesture is a right-click. iOS
 *  never sends `contextmenu` for a long press, and Android sends it only once
 *  it has selected text, so a finger needs its own path to the same action.
 *  Mouse and pen are left to `contextmenu`. Spread the returned handlers on
 *  the element; the click the lifted finger produces is swallowed, so a hold
 *  on a button does not also press it. */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<null | number>(null)
  const origin = useRef<null | { x: number; y: number }>(null)
  const fired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }

    origin.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      fired.current = false
      cancel()

      if (!onLongPress || event.pointerType !== 'touch') {
        return
      }

      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = window.setTimeout(() => {
        timer.current = null
        fired.current = true
        onLongPress()
      }, HOLD_MS)
    },
    [cancel, onLongPress]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const start = origin.current

      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) {
        cancel()
      }
    },
    [cancel]
  )

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (fired.current) {
      fired.current = false
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  return { onClickCapture, onPointerCancel: cancel, onPointerDown, onPointerMove, onPointerUp: cancel }
}
