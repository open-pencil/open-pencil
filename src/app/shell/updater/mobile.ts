import { getVersion } from '@tauri-apps/api/app'
import * as v from 'valibot'
import type { Ref } from 'vue'

import { IS_MOBILE_APP } from '@lawha/core/constants'

import { openExternalLink, toast } from '@/app/shell/ui'

import type { UpdaterMessages } from './messages'

/**
 * The phone app has no self-installer, so it checks the release the build workflow publishes
 * and offers the newer APK. GitHub's API answers browsers (release files do not), and the
 * release name carries the version: "Lawha 0.17.42 (preview)".
 */
const RELEASE_API =
  'https://api.github.com/repos/aliaaldihnayn-lab/design/releases/tags/desktop-preview'
const APK_NAME = 'Lawha-android.apk'

const releaseSchema = v.object({
  name: v.nullable(v.string()),
  assets: v.array(v.object({ name: v.string(), browser_download_url: v.string() }))
})

/** Compares dotted versions numerically: 0.17.10 is newer than 0.17.9. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (Number.isNaN(x) || Number.isNaN(y)) return false
    if (x !== y) return x > y
  }
  return false
}

export async function checkForMobileUpdate(messages: Ref<UpdaterMessages>): Promise<void> {
  if (!IS_MOBILE_APP) return
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), releaseSchema),
      await response.text()
    )
    if (!parsed.success) return
    const latest = /(\d+\.\d+\.\d+)/.exec(parsed.output.name ?? '')?.[1]
    const apk = parsed.output.assets.find((asset) => asset.name === APK_NAME)
    if (!latest || !apk || !isNewerVersion(latest, await getVersion())) return
    toast.info(messages.value.available({ version: latest }), {
      label: messages.value.download,
      run: () => void openExternalLink(apk.browser_download_url)
    })
  } catch (error) {
    // Offline or rate-limited: try again next launch.
    console.warn('[updates] mobile update check failed', error)
  }
}
