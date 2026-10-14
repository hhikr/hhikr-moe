import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CapRow, DetailColumn, ListColumn, MasterDetail } from './master-detail'

function Page() {
  return (
    <MasterDetail>
      <ListColumn>
        <CapRow active={false} enabled onSelect={() => {}} onToggle={() => {}} title="hermes-agent" />
      </ListColumn>
      <DetailColumn>
        <p>skill detail</p>
      </DetailColumn>
    </MasterDetail>
  )
}

const list = () => screen.getByText('hermes-agent').closest('aside')!
const detail = () => screen.getByText('skill detail').closest('main')!

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MasterDetail on a narrow screen', () => {
  it('shows the list, then the chosen detail on its own, then the list again', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      addEventListener: () => {},
      matches: query.startsWith('(max-width'),
      media: query,
      removeEventListener: () => {}
    }))
    render(<Page />)

    expect(list().classList.contains('hidden')).toBe(false)
    expect(detail().classList.contains('hidden')).toBe(true)

    // The switch is not a choice of row: it stays on the list.
    fireEvent.click(screen.getByRole('switch'))
    expect(detail().classList.contains('hidden')).toBe(true)

    fireEvent.click(screen.getByText('hermes-agent'))
    expect(list().classList.contains('hidden')).toBe(true)
    expect(detail().classList.contains('hidden')).toBe(false)

    fireEvent.click(screen.getByText('Back'))
    expect(list().classList.contains('hidden')).toBe(false)
    expect(detail().classList.contains('hidden')).toBe(true)
  })

  it('keeps both columns side by side on a wide screen', () => {
    render(<Page />)
    fireEvent.click(screen.getByText('hermes-agent'))

    expect(list().classList.contains('hidden')).toBe(false)
    expect(detail().classList.contains('hidden')).toBe(false)
    expect(screen.queryByText('Back')).toBeNull()
  })
})
