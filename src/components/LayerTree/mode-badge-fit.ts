import { type MaybeComputedElementRef, unrefElement, useResizeObserver } from '@vueuse/core'
import { type WatchSource, ref, watch } from 'vue'

interface ModeBadgeElements {
  label: MaybeComputedElementRef
  name: MaybeComputedElementRef
  badge: MaybeComputedElementRef
  fullForm: MaybeComputedElementRef
  actions: MaybeComputedElementRef
}

function inlineChrome(element: Element) {
  const style = getComputedStyle(element)
  return [
    style.paddingInlineStart,
    style.paddingInlineEnd,
    style.borderInlineStartWidth,
    style.borderInlineEndWidth
  ].reduce((sum, value) => sum + Number.parseFloat(value), 0)
}

/** `scrollWidth` rounds to whole pixels, so the name may be up to this much wider. */
const SCROLL_WIDTH_ROUNDING = 1

function columnGap(element: Element | null) {
  return element ? Number.parseFloat(getComputedStyle(element).columnGap) || 0 : 0
}

function shownOnlyOnHover(actions: Element) {
  return (
    !actions.hasAttribute('data-persistent') && getComputedStyle(actions).position !== 'absolute'
  )
}

function widthHoverActionsTake(actions: Element | null | undefined) {
  if (!actions || !shownOnlyOnHover(actions)) {
    return 0
  }
  const gapBefore = actions.previousElementSibling ? columnGap(actions.parentElement) : 0
  return actions.getBoundingClientRect().width + gapBefore
}

export function useFullModeBadgeFitsBesideName(
  elements: ModeBadgeElements,
  content: WatchSource<unknown>[]
) {
  const fits = ref(true)

  function measure() {
    const label = unrefElement(elements.label)
    const name = unrefElement(elements.name)
    const badge = unrefElement(elements.badge)
    const fullForm = unrefElement(elements.fullForm)
    if (!label || !name || !badge || !fullForm) {
      return
    }
    const fullBadgeWidth = fullForm.getBoundingClientRect().width + inlineChrome(badge)
    const idleRoom =
      label.getBoundingClientRect().width + widthHoverActionsTake(unrefElement(elements.actions))
    const nameWidth = name.scrollWidth + SCROLL_WIDTH_ROUNDING
    fits.value = nameWidth + columnGap(label) + fullBadgeWidth <= idleRoom
  }

  useResizeObserver(() => [unrefElement(elements.label), unrefElement(elements.fullForm)], measure)
  watch(content, measure, { flush: 'post' })

  return fits
}
