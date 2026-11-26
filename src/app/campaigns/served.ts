import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed, ref } from 'vue'

import { pingAnswerSchema, readCampaigns, type Campaign } from '@open-pencil/feedback/contract'

import { IS_BROWSER } from '@/constants'

const SERVED_CAMPAIGNS_KEY = 'open-pencil:campaigns'

/** The campaigns the last ping answered with, kept for launches that send no ping. */
const stored = !IS_BROWSER
  ? ref<unknown>(null)
  : useLocalStorage<unknown>(SERVED_CAMPAIGNS_KEY, null, {
      serializer: StorageSerializers.object,
      writeDefaults: false
    })

/** The served campaigns this build can read, for placements it has. */
export const servedCampaigns = computed<Campaign[]>(() => {
  const parsed = v.safeParse(pingAnswerSchema, stored.value)
  return parsed.success ? readCampaigns(parsed.output) : []
})

/** Keeps a ping's answer; an answer that is not one, such as an older service's, changes nothing. */
export function receiveCampaigns(answer: unknown): void {
  if (v.is(pingAnswerSchema, answer)) stored.value = answer
}
