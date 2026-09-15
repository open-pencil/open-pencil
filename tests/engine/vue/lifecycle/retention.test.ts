import { expect, test } from 'bun:test'

import { defineComponent, h, KeepAlive, nextTick, ref, watchEffect } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { usePropScrub } from '#vue/controls/prop-scrub/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { provideRetainedActivity } from '#vue/lifecycle/retention/context'
import { createRetainedScopePlugin } from '#vue/lifecycle/retention/plugin'
import { useRetainedPopup } from '#vue/lifecycle/retention/popup'
import { useFontPicker } from '#vue/primitives/FontPicker/useFontPicker'

import { expectDefined } from '#tests/helpers/assert'
import { createTestRenderer, hostNode } from '#tests/helpers/vue/renderer'

async function flushRetention() {
  await nextTick()
  await nextTick()
}

test('suspends descendant scopes, cancels previews, closes popups and refreshes on activation', async () => {
  const editor = createEditor()
  const shape = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
  editor.select([shape.id])
  const active = ref(true),
    value = ref(0)
  let mounts = 0,
    renders = 0,
    effects = 0
  const popup = ref(false)
  const Field = defineComponent({
    setup() {
      mounts++
      useRetainedPopup(popup)
      const scrub = usePropScrub(editor)
      scrub.updateProp([shape], 'x', 50)
      watchEffect(() => {
        void value.value
        effects++
      })
      return () => {
        renders++
        return h('span', `${value.value}:${popup.value}`)
      }
    }
  })
  const Panel = defineComponent({ setup: () => () => h(Field) })
  const root = hostNode()
  const app = createTestRenderer()
    .createApp({
      setup() {
        provideRetainedActivity(active)
        return () => h(KeepAlive, { max: 1 }, { default: () => (active.value ? h(Panel) : null) })
      }
    })
    .use(createRetainedScopePlugin())
  try {
    app.mount(root)
    popup.value = true
    await flushRetention()
    active.value = false
    await flushRetention()
    expect(editor.isInteractiveEditing()).toBe(false)
    expect(shape.x).toBe(10)
    expect(popup.value).toBe(false)
    const before = { renders, effects }
    value.value = 42
    await flushRetention()
    expect({ renders, effects }).toEqual(before)
    active.value = true
    await flushRetention()
    expect(mounts).toBe(1)
    expect(renders).toBeGreaterThan(before.renders)
    expect(effects).toBe(before.effects + 1)
    expect(root.children[0]?.text).toBe('42:false')
    expect(popup.value).toBe(false)
  } finally {
    app.unmount()
    editor.dispose()
  }
})

test('finishes applied property-list batches and releases their interaction lease', async () => {
  const editor = createEditor()
  const shape = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 10 })
  const active = ref(true)
  const Field = defineComponent({
    setup() {
      const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)
      batch.ensure('property', 'Change property')
      editor.updateNodeWithUndo(shape.id, { x: 50 })
      return () => h('span')
    }
  })
  const app = createTestRenderer()
    .createApp({
      setup() {
        provideRetainedActivity(active)
        return () => h(KeepAlive, { max: 1 }, { default: () => (active.value ? h(Field) : null) })
      }
    })
    .use(createRetainedScopePlugin())
  try {
    app.mount(hostNode())
    expect(editor.undo.isBatching).toBe(true)
    active.value = false
    await flushRetention()
    expect(editor.undo.isBatching).toBe(false)
    expect(editor.isInteractiveEditing()).toBe(false)
    expect(shape.x).toBe(50)
    editor.undoAction()
    expect(shape.x).toBe(10)
    expect(editor.undo.canUndo).toBe(false)
  } finally {
    app.unmount()
    editor.dispose()
  }
})

test('discards pending font results on deactivation and disposal, and permits a fresh request', async () => {
  const first = Promise.withResolvers<string[]>()
  const second = Promise.withResolvers<string[]>()
  const active = ref(true)
  const state: { picker?: ReturnType<typeof useFontPicker> } = {}
  let requests = 0
  const Field = defineComponent({
    setup() {
      const picker = useFontPicker({
        modelValue: ref('Inter'),
        listFamilies: () => (++requests === 1 ? first.promise : second.promise)
      })
      useRetainedPopup(picker.open)
      state.picker = picker
      picker.open.value = true
      return () => h('span')
    }
  })
  const app = createTestRenderer()
    .createApp({
      setup() {
        provideRetainedActivity(active)
        return () => h(KeepAlive, { max: 1 }, { default: () => (active.value ? h(Field) : null) })
      }
    })
    .use(createRetainedScopePlugin())
  try {
    app.mount(hostNode())
    await flushRetention()
    const picker = expectDefined(state.picker, 'font picker')
    expect(picker.loading.value).toBe(true)
    active.value = false
    await flushRetention()
    first.resolve(['Stale font'])
    await flushRetention()
    expect(picker.families.value).toEqual([])
    expect(picker.loading.value).toBe(false)
    expect(picker.open.value).toBe(false)
    active.value = true
    await flushRetention()
    picker.open.value = true
    await flushRetention()
    expect(requests).toBe(2)
    expect(picker.loading.value).toBe(true)
  } finally {
    app.unmount()
    second.resolve(['Disposed font'])
  }
  await flushRetention()
  expect(state.picker?.families.value).toEqual([])
  expect(state.picker?.loading.value).toBe(false)
})

test('an interrupted deactivation does not pause a reactivated or unmounted scope', async () => {
  const active = ref(true),
    value = ref(0)
  let renders = 0
  const Field = defineComponent({
    setup: () => () => {
      renders++
      return h('span', String(value.value))
    }
  })
  const app = createTestRenderer()
    .createApp({
      setup() {
        provideRetainedActivity(active)
        return () => h(KeepAlive, { max: 1 }, { default: () => (active.value ? h(Field) : null) })
      }
    })
    .use(createRetainedScopePlugin())
  try {
    app.mount(hostNode())
    active.value = false
    await nextTick()
    active.value = true
    await flushRetention()
    const before = renders
    value.value++
    await flushRetention()
    expect(renders).toBe(before + 1)
    active.value = false
    await nextTick()
  } finally {
    app.unmount()
  }
  await flushRetention()
  const before = renders
  value.value++
  await flushRetention()
  expect(renders).toBe(before)
})
