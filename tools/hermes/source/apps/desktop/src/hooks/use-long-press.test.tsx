import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useLongPress } from './use-long-press'

function Target({ onClick, onLongPress }: { onClick: () => void; onLongPress?: () => void }) {
  return (
    <div {...useLongPress(onLongPress)}>
      <button onClick={onClick} type="button">
        bubble
      </button>
    </div>
  )
}

function press(button: HTMLElement, pointerType: string, init: { clientX?: number; clientY?: number } = {}) {
  fireEvent.pointerDown(button, { clientX: 0, clientY: 0, pointerType, ...init })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useLongPress', () => {
  it('fires for a finger held still and swallows the click it lifts into', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    const onLongPress = vi.fn()
    const { getByText } = render(<Target onClick={onClick} onLongPress={onLongPress} />)
    const button = getByText('bubble')

    press(button, 'touch')
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerUp(button)
    fireEvent.click(button)

    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()

    // The next, ordinary tap is a tap again.
    press(button, 'touch')
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('leaves a short tap, a scroll and a mouse alone', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    const onLongPress = vi.fn()
    const { getByText } = render(<Target onClick={onClick} onLongPress={onLongPress} />)
    const button = getByText('bubble')

    press(button, 'touch')
    act(() => vi.advanceTimersByTime(200))
    fireEvent.pointerUp(button)

    press(button, 'touch')
    fireEvent.pointerMove(button, { clientX: 0, clientY: 30 })
    act(() => vi.advanceTimersByTime(600))

    press(button, 'mouse')
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(button)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a handler', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    const { getByText } = render(<Target onClick={onClick} />)
    const button = getByText('bubble')

    press(button, 'touch')
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
