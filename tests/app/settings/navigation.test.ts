import { expect, test } from 'bun:test'

import { ref } from 'vue'

import { createSettingsNavigation } from '@/app/settings/navigation/use'

test('pristine editors can leave; dirty editors ask before navigation', () => {
  const navigation = createSettingsNavigation()
  const dirty = ref(false)
  const busy = ref(false)
  let cancelled = 0
  let navigated = 0
  const form = {
    dirty,
    busy,
    cancel: () => {
      cancelled++
    }
  }
  navigation.register(form)
  navigation.request(() => {
    navigated++
  })
  expect([cancelled, navigated]).toEqual([1, 1])
  dirty.value = true
  navigation.register(form)
  navigation.request(() => {
    navigated++
  })
  expect(navigation.confirming.value).toBe(true)
  navigation.keepEditing()
  expect(navigation.editing.value).toBe(true)
  expect([cancelled, navigated]).toEqual([1, 1])
  navigation.request(() => {
    navigated++
  })
  navigation.discard()
  expect([cancelled, navigated]).toEqual([2, 2])
  expect(navigation.confirming.value).toBe(false)
  expect(navigation.editing.value).toBe(false)
})

test('busy and replaced editors cannot be discarded by stale requests', () => {
  const navigation = createSettingsNavigation()
  const busy = ref(true)
  let cancelled = false
  let navigated = false
  const unregister = navigation.register({
    dirty: ref(true),
    busy,
    cancel: () => {
      cancelled = true
    }
  })
  navigation.request(() => {
    navigated = true
  })
  expect(navigation.confirming.value).toBe(false)
  busy.value = false
  navigation.request(() => {
    navigated = true
  })
  unregister()
  navigation.register({
    dirty: ref(true),
    busy: ref(false),
    cancel: () => {
      cancelled = true
    }
  })
  navigation.discard()
  expect(cancelled).toBe(false)
  expect(navigated).toBe(false)
  expect(navigation.editing.value).toBe(true)
})

test('closing the window leaves an editor without cancelling it back to its list', () => {
  const navigation = createSettingsNavigation()
  const dirty = ref(false)
  let cancelled = 0
  let closed = 0
  const form = {
    dirty,
    busy: ref(false),
    cancel: () => {
      cancelled++
    }
  }
  const close = () => {
    closed++
  }
  const unregister = navigation.register(form)
  navigation.request(close, { closesWindow: true })
  expect([cancelled, closed]).toEqual([0, 1])
  // The window keeps showing the editor until it unmounts with the closed window.
  expect(navigation.editing.value).toBe(true)
  unregister()
  expect(navigation.editing.value).toBe(false)

  dirty.value = true
  navigation.register(form)
  navigation.request(close, { closesWindow: true })
  navigation.discard()
  expect([cancelled, closed]).toEqual([0, 2])
})
