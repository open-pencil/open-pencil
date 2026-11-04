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
      // Reaching the bottom resumes following however it happened; only the reader leaves it.
      if (arrivedState.bottom) following.value = true
      else if (userScrolling) following.value = false
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

  /**
   * Only a gesture away from the bottom stops following; reaching the bottom resumes it. A
   * gesture that cannot move the viewport changes nothing: downward at the bottom, or upward
   * while the transcript has nothing above it. No scroll event would follow to undo it.
   */
  function leaveBottom() {
    if (!viewport.value || viewport.value.scrollTop <= 0) return
    userScrolling = true
    following.value = false
  }

  let touchY: number | undefined
  useEventListener(
    viewport,
    'wheel',
    (event) => {
      if (event.deltaY < 0) leaveBottom()
    },
    { passive: true }
  )
  useEventListener(viewport, 'touchstart', (event) => (touchY = event.touches.item(0)?.clientY), {
    passive: true
  })
  useEventListener(
    viewport,
    'touchmove',
    (event) => {
      const y = event.touches.item(0)?.clientY
      // A finger moving down drags the content down, scrolling toward the top.
      if (y !== undefined && touchY !== undefined && y > touchY) leaveBottom()
      touchY = y
    },
    { passive: true }
  )
  useEventListener(viewport, 'keydown', (event) => {
    if (
      ['ArrowUp', 'PageUp', 'Home'].includes(event.code) ||
      (event.code === 'Space' && event.shiftKey)
    )
      leaveBottom()
  })
  // Scrollbar dragging is an explicit navigation gesture; ordinary content clicks are not.
  useEventListener(viewport, 'pointerdown', (event) => {
    if (event.target === viewport.value) leaveBottom()
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
