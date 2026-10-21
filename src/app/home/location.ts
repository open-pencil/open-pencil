import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed, ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

const homeLocationSchema = v.variant('kind', [
  v.object({ kind: v.literal('recent') }),
  v.object({ kind: v.literal('storage') }),
  v.object({ kind: v.literal('shared') }),
  /** Settings, shown in the place of the documents. */
  v.object({ kind: v.literal('settings') }),
  /** A workspace of the server Home shows. */
  v.object({ kind: v.literal('workspace'), id: v.string() })
])

export type HomeLocation = v.InferOutput<typeof homeLocationSchema>

const RECENT: HomeLocation = { kind: 'recent' }

const stored = !IS_BROWSER
  ? ref<unknown>(null)
  : useLocalStorage<unknown>('open-pencil:home-location', null, {
      serializer: StorageSerializers.object,
      writeDefaults: false
    })

/** Where Home lists documents from; Recent until the person picks another place. */
export const homeLocation = computed<HomeLocation>({
  get() {
    const parsed = v.safeParse(homeLocationSchema, stored.value)
    return parsed.success ? parsed.output : RECENT
  },
  set(location) {
    stored.value = location
  }
})

type LeaveGuard = (proceed: () => void) => void

let leaveGuard: LeaveGuard | null = null

/** Lets the shown Home page ask before it is left, for edits that are not saved yet. */
export function setHomeLeaveGuard(guard: LeaveGuard | null): void {
  leaveGuard = guard
}

/** Runs a change of Home's place after the shown page agrees to be left. */
export function whenHomeMayChange(action: () => void): void {
  if (leaveGuard) leaveGuard(action)
  else action()
}
