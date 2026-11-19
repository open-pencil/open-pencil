import { noop } from 'es-toolkit'
import {
  computed,
  inject,
  provide,
  shallowRef,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'

interface SettingsFormGuard {
  dirty: Readonly<Ref<boolean>>
  busy: Readonly<Ref<boolean>>
  cancel: () => void
  /**
   * An editor that replaces a list names itself and the list, and the window's header shows them
   * as a breadcrumb with the way back, instead of the editor drawing its own title and back row.
   */
  crumb?: { parent: MaybeRefOrGetter<string>; title: MaybeRefOrGetter<string> }
}

/** One navigation policy for every editor in the Settings window. */
export function createSettingsNavigation() {
  const active = shallowRef<SettingsFormGuard | null>(null)
  const pending = shallowRef<{
    form: SettingsFormGuard
    action: () => void
    closesWindow: boolean
  } | null>(null)

  /**
   * Leaves the open editor. Closing the window instead keeps it, and the window as it was, until
   * the window has animated out and the editor unmounts and unregisters; cancelling it first
   * would slide it back to its list in front of the person.
   */
  function leave(form: SettingsFormGuard | null, action: () => void, closesWindow: boolean) {
    if (!closesWindow) {
      active.value = null
      form?.cancel()
    }
    action()
  }

  function request(action: () => void, { closesWindow = false } = {}) {
    const form = active.value
    if (form?.busy.value) return
    if (form?.dirty.value) pending.value = { form, action, closesWindow }
    else leave(form, action, closesWindow)
  }

  return {
    editing: computed(() => active.value !== null),
    crumb: computed(() => {
      const crumb = active.value?.crumb
      if (!crumb) return null
      return { parent: toValue(crumb.parent), title: toValue(crumb.title) }
    }),
    confirming: computed(() => pending.value !== null),
    register(form: SettingsFormGuard) {
      active.value = form
      return () => {
        if (active.value === form) active.value = null
        if (pending.value?.form === form) pending.value = null
      }
    },
    request,
    /** Leaves the open editor for its list, asking first when it holds unsaved changes. */
    back() {
      request(noop)
    },
    keepEditing() {
      pending.value = null
    },
    discard() {
      const request = pending.value
      if (!request || request.form !== active.value || request.form.busy.value) return
      pending.value = null
      leave(request.form, request.action, request.closesWindow)
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
