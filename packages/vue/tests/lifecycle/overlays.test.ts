import { describe, expect, test } from 'bun:test'

import { createApp, effectScope, ref, type Ref } from 'vue'

import {
  createOpenOverlaysPlugin,
  useOpenOverlays,
  useOverlayOpen,
  type OpenOverlays,
  type OverlayKind
} from '#vue/lifecycle/overlays'
import { useRetainedPopup } from '#vue/lifecycle/retention'

/** An app with the plugin, an overlay registered in its own scope, and the app's registry. */
function appWithOverlay(
  kind: OverlayKind = 'overlay',
  register: (open: Ref<boolean>, kind: OverlayKind) => void = useOverlayOpen
) {
  const app = createApp({ render: () => null })
  app.use(createOpenOverlaysPlugin())
  const open = ref(false)
  const scope = effectScope()
  const overlays = app.runWithContext(() => {
    scope.run(() => register(open, kind))
    return useOpenOverlays()
  })
  if (!overlays) throw new Error('No open overlays in the app')
  return { open, scope, overlays }
}

function holds(overlays: OpenOverlays) {
  return { shortcuts: overlays.holdsKeys(), history: overlays.holdsKeys(true) }
}

describe('open overlays', () => {
  test('an overlay holds the canvas keys while it is open', () => {
    const { open, overlays } = appWithOverlay()
    expect(holds(overlays)).toEqual({ shortcuts: false, history: false })

    open.value = true
    expect(holds(overlays)).toEqual({ shortcuts: true, history: true })

    open.value = false
    expect(holds(overlays)).toEqual({ shortcuts: false, history: false })
  })

  test('a picker leaves undo and redo to the document', () => {
    const { open, overlays } = appWithOverlay('picker')
    open.value = true

    expect(holds(overlays)).toEqual({ shortcuts: true, history: false })
  })

  test('an overlay that goes away while open stops counting', () => {
    const { open, scope, overlays } = appWithOverlay()
    open.value = true
    scope.stop()

    expect(holds(overlays)).toEqual({ shortcuts: false, history: false })
  })

  test('one overlay closing or going away keeps the other counting', () => {
    const app = createApp({ render: () => null })
    app.use(createOpenOverlaysPlugin())
    const picker = ref(true)
    const pickerScope = effectScope()
    const overlays = app.runWithContext(() => {
      pickerScope.run(() => useOverlayOpen(picker, 'picker'))
      effectScope().run(() => useOverlayOpen(ref(true)))
      return useOpenOverlays()
    })
    if (!overlays) throw new Error('No open overlays in the app')

    picker.value = false
    expect(holds(overlays)).toEqual({ shortcuts: true, history: true })
    picker.value = true
    pickerScope.stop()
    expect(holds(overlays)).toEqual({ shortcuts: true, history: true })
  })

  test('a retained popup counts while it is open', () => {
    const { open, overlays } = appWithOverlay('overlay', (popupOpen, kind) => {
      useRetainedPopup(popupOpen, undefined, kind)
    })
    open.value = true

    expect(holds(overlays)).toEqual({ shortcuts: true, history: true })
  })

  test('without the plugin nothing is tracked', () => {
    const app = createApp({ render: () => null })
    const scope = effectScope()
    const overlays = app.runWithContext(() => {
      scope.run(() => useOverlayOpen(ref(true)))
      return useOpenOverlays()
    })

    expect(overlays).toBeUndefined()
  })
})
