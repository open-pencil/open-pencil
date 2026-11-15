import { tooltips } from '@codemirror/view'

/**
 * An editor's tooltips, such as its completion list, live in the surrounding dialog and keep
 * within it: a scrolling panel would clip them, and a modal dialog takes no pointer events
 * outside itself. Outside a dialog they are fixed to the window.
 */
export function dialogTooltips(host: HTMLElement | null) {
  const container = host?.closest<HTMLElement>('[role="dialog"]')
  if (!container) return tooltips({ position: 'fixed' })
  return tooltips({
    position: 'absolute',
    parent: container,
    tooltipSpace: () => container.getBoundingClientRect()
  })
}
