import { hasInjectionContext, inject, provide } from 'vue'
import type { App, InjectionKey, Ref } from 'vue'

const RETAINED_ACTIVITY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('retained-activity')
const RETAINED_SCOPES_INSTALLED: InjectionKey<boolean> = Symbol('retained-scopes-installed')

export function installRetainedScopes(app: App): void {
  app.provide(RETAINED_SCOPES_INSTALLED, true)
}

/** Opt a bounded KeepAlive subtree into suspended work while it is inactive. */
export function provideRetainedActivity(active: Readonly<Ref<boolean>>): void {
  if (!inject(RETAINED_SCOPES_INSTALLED, false)) {
    throw new Error('Retained activity requires createRetainedScopePlugin')
  }
  provide(RETAINED_ACTIVITY, active)
}

export function useRetainedActivity(): Readonly<Ref<boolean>> | undefined {
  return hasInjectionContext() ? inject(RETAINED_ACTIVITY, undefined) : undefined
}
