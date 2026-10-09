import { useLocalStorage } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import * as v from 'valibot'

import { ICON_NAME } from '@open-pencil/scene-graph'

const MAX_RECENT_ICONS = 24
const RECENT_ICONS_STORAGE_KEY = 'open-pencil:recent-icons'
const ICON_SET_STORAGE_KEY = 'open-pencil:icon-set'

/** Stored icon names; anything unreadable reads as none rather than failing the picker. */
const RecentIconsJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.array(v.pipe(v.string(), v.regex(ICON_NAME)))
)

/** The icons this person picked last, newest first, across documents. */
export const recentIcons = useLocalStorage<string[]>(RECENT_ICONS_STORAGE_KEY, [], {
  serializer: {
    read: (raw) => {
      const parsed = v.safeParse(RecentIconsJSON, raw)
      return parsed.success ? parsed.output : []
    },
    write: (names) => JSON.stringify(names)
  }
})

/** The set the picker searched last, by prefix; empty for every set. */
export const lastIconSet = useLocalStorage<string>(ICON_SET_STORAGE_KEY, '')

/** Puts `name` first among the recent icons. */
export function rememberIcon(name: string): void {
  recentIcons.value = uniq([name, ...recentIcons.value]).slice(0, MAX_RECENT_ICONS)
}
