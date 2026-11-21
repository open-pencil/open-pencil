import { type MaybeComputedElementRef, unrefElement, useResizeObserver } from '@vueuse/core'
import { type WatchSource, ref, watch } from 'vue'

import { useLayerTreeGeometry } from './geometry'
import { shortestNameWidth } from './width'

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

/** Room the lock and eye buttons take from the label once hovered; 0 when they always show. */
function widthHoverActionsTake(actions: Element | null | undefined) {
  if (!actions || actions.hasAttribute('data-persistent')) {
    return 0
  }
  const gapBefore = actions.previousElementSibling ? columnGap(actions.parentElement) : 0
  return actions.getBoundingClientRect().width + gapBefore
}

function shownNow(actions: Element | null | undefined) {
  return !!actions && getComputedStyle(actions).position !== 'absolute'
}

/**
 * Whether the full badge fits after the whole name while idle, and after the name cut to its
 * fade once hovered, so the badge keeps its form either way and never runs under the buttons.
 */
export function useFullModeBadgeFitsBesideName(
  elements: ModeBadgeElements,
  content: WatchSource<unknown>[]
) {
  const fits = ref(true)
  const { nameFadeWidth } = useLayerTreeGeometry()

  function measure() {
    const label = unrefElement(elements.label)
    const name = unrefElement(elements.name)
    const badge = unrefElement(elements.badge)
    const fullForm = unrefElement(elements.fullForm)
    if (!label || !name || !badge || !fullForm) {
      return
    }
    const actions = unrefElement(elements.actions)
    const hoverTake = widthHoverActionsTake(actions)
    const idleRoom = label.getBoundingClientRect().width + (shownNow(actions) ? hoverTake : 0)
    const nameWidth = name.scrollWidth + SCROLL_WIDTH_ROUNDING
    const cutNameWidth = shortestNameWidth(nameWidth, nameFadeWidth.value)
    const fullBadgeWidth =
      columnGap(label) + fullForm.getBoundingClientRect().width + inlineChrome(badge)
    fits.value =
      nameWidth + fullBadgeWidth <= idleRoom &&
      cutNameWidth + fullBadgeWidth <= idleRoom - hoverTake
  }

  useResizeObserver(() => [unrefElement(elements.label), unrefElement(elements.fullForm)], measure)
  watch(content, measure, { flush: 'post' })

  return fits
}
