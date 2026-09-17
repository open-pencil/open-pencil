import { computed, inject, provide, shallowRef, watch, type InjectionKey, type Ref } from 'vue'

interface SettingsFormGuard {
  dirty: Readonly<Ref<boolean>>
  busy: Readonly<Ref<boolean>>
  cancel: () => void
}

/** One navigation policy for every editor in the Settings window. */
export function createSettingsNavigation() {
  const active = shallowRef<SettingsFormGuard | null>(null)
  const pending = shallowRef<{ form: SettingsFormGuard; action: () => void } | null>(null)

  function leave(form: SettingsFormGuard | null, action: () => void) {
    active.value = null
    form?.cancel()
    action()
  }

  return {
    editing: computed(() => active.value !== null),
    confirming: computed(() => pending.value !== null),
    register(form: SettingsFormGuard) {
      active.value = form
      return () => {
        if (active.value === form) active.value = null
        if (pending.value?.form === form) pending.value = null
      }
    },
    request(action: () => void) {
      const form = active.value
      if (form?.busy.value) return
      if (form?.dirty.value) pending.value = { form, action }
      else leave(form, action)
    },
    keepEditing() {
      pending.value = null
    },
    discard() {
      const request = pending.value
      if (!request || request.form !== active.value || request.form.busy.value) return
      pending.value = null
      leave(request.form, request.action)
    }
  }
}

const navigationKey: InjectionKey<ReturnType<typeof createSettingsNavigation>> =
  Symbol('settings-navigation')

export function provideSettingsNavigation() {
  const navigation = createSettingsNavigation()
  provide(navigationKey, navigation)
  return navigation
}

export function useSettingsFormGuard(form: SettingsFormGuard, when?: Readonly<Ref<boolean>>) {
  const navigation = inject(navigationKey, null)
  if (!navigation) return
  watch(
    () => when?.value ?? true,
    (enabled, _previous, onCleanup) => {
      if (enabled) onCleanup(navigation.register(form))
    },
    { immediate: true, flush: 'sync' }
  )
}
