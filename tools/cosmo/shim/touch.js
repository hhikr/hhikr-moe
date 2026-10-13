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
  // not also a tap on whatever was under the finger.
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
      close(open)
    },
    true
  )

  // Choosing a destination is the end of the errand the sidebar was opened for.
  document.addEventListener('click', event => {
    const open = phone.matches && overlay()
    const target = event.target

    if (open && target instanceof Element && open.contains(target) && target.closest(DESTINATION)) {
      close(open)
    }
  })
})()
