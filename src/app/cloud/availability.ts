import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import { isEditorVersionAtLeast } from '@open-pencil/cloud/contract'

import { APP_VERSION } from '@/app/runtime/version'
import { IS_BROWSER, IS_CLOUD_SITE, OFFICIAL_CLOUD_URL } from '@/constants'

import { discoverCloudServer } from './sessions/connection'

/** `?cloud=preview` shows Cloud on this device before it is listed; `?cloud=off` stops that. */
const PREVIEW_PARAM = 'cloud'

/**
 * The editor version from which the official server lists itself, as it last said. Kept, so an
 * offline start shows what the last online one did.
 */
const listedFrom = IS_BROWSER
  ? useLocalStorage<string | null>('open-pencil:cloud-listed-from', null)
  : ref<string | null>(null)
const preview = IS_BROWSER ? useLocalStorage('open-pencil:cloud-preview', false) : ref(false)

/**
 * Whether the official server is open to this editor, being previewed here, or serving this
 * editor itself; until then Settings offers its waitlist.
 */
export const cloudOfficialListed = computed(
  () =>
    IS_CLOUD_SITE ||
    preview.value ||
    (listedFrom.value !== null && isEditorVersionAtLeast(APP_VERSION, listedFrom.value))
)

/** Reads the preview switch from the address and asks the official server whether it is listed. */
export async function checkCloudAvailability(address: string): Promise<void> {
  const choice = new URL(address).searchParams.get(PREVIEW_PARAM)
  if (choice === 'preview') preview.value = true
  else if (choice === 'off') preview.value = false
  // Unreachable, or not public yet: the last answer stands.
  const discovery = await discoverCloudServer(OFFICIAL_CLOUD_URL).catch(() => null)
  if (discovery) listedFrom.value = discovery.listing?.minimumEditorVersion ?? null
}
