import { afterEach, describe, expect, it, vi } from 'vitest'

const desktopWindow = window as unknown as { hermesDesktop?: Window['hermesDesktop'] }

async function loadActions(platform?: 'web') {
  vi.resetModules()
  desktopWindow.hermesDesktop = (platform ? { platform } : {}) as Window['hermesDesktop']

  return import('./actions')
}

afterEach(() => {
  delete desktopWindow.hermesDesktop
})

describe('keybind defaults in a browser tab', () => {
  // A browser never lets a page have these: in a tab, ⌘W / Ctrl+W would close
  // the whole tab instead of a pane's tab.
  const reserved = ['mod+n', 'mod+t', 'mod+w', 'mod+shift+n', 'mod+shift+t', 'ctrl+tab']

  it('ships no browser-reserved chord in the web build', async () => {
    const { defaultBindings } = await loadActions('web')
    const combos = Object.values(defaultBindings()).flat()

    for (const combo of reserved) {
      expect(combos).not.toContain(combo)
    }

    // The actions stay, unbound, so they can be given a chord of their own.
    expect(defaultBindings()['view.closeTab']).toEqual([])
    expect(defaultBindings()['session.next']).toEqual([])
  })

  it('keeps them in Electron', async () => {
    const { defaultBindings } = await loadActions()

    expect(defaultBindings()['view.closeTab']).toEqual(['mod+w'])
    expect(defaultBindings()['session.new']).toEqual(['mod+n'])
  })
})
