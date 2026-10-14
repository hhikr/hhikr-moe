// What a phone needs from the renderer's slide-over sidebar and a window never
// did: the renderer pins the sidebar open until its title bar button is pressed
// again, which on a phone leaves it covering most of the conversation.
//
// Both ways out go through the renderer's own reveal event, so its state stays
// the one source of truth.
;(() => {
  'use strict'

  const phone = window.matchMedia('(max-width: 40rem)')
  const REVEAL_EVENT = 'hermes:pane-toggle-reveal'
  // Menus, dialogs and tooltips the sidebar opens are rendered at the end of
  // <body>, outside the sidebar's own element; a tap in one is not a tap away.
  const FLOATING = '[role="menu"], [role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper], [data-pane-overlay]'
  // The rows that take the user somewhere: a session, or one of the pages.
  const DESTINATION = '[data-slot="row-button"], [data-sidebar="menu-button"]'

  const overlay = () => document.querySelector('[data-narrow-overlay]')

  const close = el => {
    window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: { id: el.dataset.narrowOverlay, mode: 'close' } }))
  }

  // A tap on the conversation beside the sidebar puts the sidebar away, and is
  // not also a tap on whatever was under the finger. Cancelling the
  // pointerdown is not enough for that: the browser still sends the click
  // (and, for a finger, the focus that raises the keyboard) when the finger
  // lifts. So the rest of that one gesture is swallowed as well.
  let swallowUntil = 0
  const swallowing = () => performance.now() < swallowUntil

  const swallow = event => {
    if (swallowing()) {
      event.preventDefault()
      event.stopPropagation()

      if (event.type === 'click') {
        swallowUntil = 0
      }
    }
  }

  document.addEventListener(
    'pointerdown',
    event => {
      const open = phone.matches && overlay()
      const target = event.target

      if (!open || !(target instanceof Element)) {
        return
      }

      if (open.contains(target) || target.closest(`[data-titlebar-cluster], ${FLOATING}`)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      // Long enough for a slow tap to end; a click that never comes (the
      // finger moved, the browser made it a scroll) must not eat a later one.
      swallowUntil = performance.now() + 1000
      close(open)
    },
    true
  )

  for (const type of ['pointerup', 'mousedown', 'mouseup', 'click']) {
    document.addEventListener(type, swallow, true)
  }

  // Cancelling touchend is what stops a tap from focusing a field and from
  // being turned into a click at all.
  document.addEventListener('touchend', swallow, { capture: true, passive: false })

  // iOS Safari neither honours interactive-widget=resizes-content nor shrinks
  // 100dvh when the keyboard opens: the keyboard covers the composer, or
  // scrolls the whole page and the title bar with it. The visual viewport is
  // the part of the page the keyboard leaves visible; the shell is sized to it
  // (--app-height in cosmo.css) and kept at the top.
  const viewport = window.visualViewport

  if (viewport) {
    const fit = () => {
      document.documentElement.style.setProperty('--app-height', `${Math.round(viewport.height)}px`)
      // iOS may still pan the visible part down to the caret; the pinned
      // shell (cosmo.css) moves with it.
      document.documentElement.style.setProperty('--app-top', `${Math.max(0, Math.round(viewport.offsetTop))}px`)

      if (window.scrollY !== 0 && viewport.height < window.innerHeight) {
        window.scrollTo(0, 0)
      }
    }

    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    fit()
  }

  // Choosing a destination is the end of the errand the sidebar was opened for.
  document.addEventListener('click', event => {
    const open = phone.matches && overlay()
    const target = event.target

    if (open && target instanceof Element && open.contains(target) && target.closest(DESTINATION)) {
      close(open)
    }
  })
})()
