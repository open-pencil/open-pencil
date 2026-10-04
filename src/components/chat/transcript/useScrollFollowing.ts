import { useEventListener, useResizeObserver, useScroll } from '@vueuse/core'
import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** Output following is a user-controlled mode, not a distance threshold. */
export function useScrollFollowing(
  viewport: Ref<HTMLElement | undefined>,
  content: Ref<HTMLElement | undefined>,
  submitted: Ref<boolean>
) {
  const following = ref(true)
  let frame: number | undefined
  let userScrolling = false
  const { arrivedState, measure } = useScroll(viewport, {
    onScroll: () => {
      if (userScrolling) following.value = arrivedState.bottom
    },
    onStop: () => {
      userScrolling = false
    }
  })

  function scheduleFollow() {
    if (!following.value || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (!following.value || !viewport.value) return
      viewport.value.scrollTop = viewport.value.scrollHeight
      measure()
    })
  }

  function resumeFollowing() {
    following.value = true
    userScrolling = false
    scheduleFollow()
  }

  function beginUserScroll() {
    userScrolling = true
    following.value = false
  }

  useEventListener(viewport, 'wheel', beginUserScroll, { passive: true })
  useEventListener(viewport, 'touchmove', beginUserScroll, { passive: true })
  useEventListener(viewport, 'keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(event.code))
      beginUserScroll()
  })
  // Scrollbar dragging is an explicit navigation gesture; ordinary content clicks are not.
  useEventListener(viewport, 'pointerdown', (event) => {
    if (event.target === viewport.value) beginUserScroll()
  })
  useEventListener(
    content,
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return
      // Opening reasoning or a tool call is reading, not new output: following would pin the
      // bottom on every frame of the animation and slide the opened content away.
      if (event.target.closest('[aria-expanded]')) following.value = false
    },
    { capture: true }
  )

  useResizeObserver([viewport, content], () => {
    scheduleFollow()
    measure()
  })
  watch(submitted, (value) => {
    if (value) resumeFollowing()
  })
  watch(viewport, scheduleFollow, { flush: 'post' })
  onScopeDispose(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return { following, arrivedState, resumeFollowing }
}
