import * as v from 'valibot'
// Keeps the designs open in this browser tab across a reload: their recovery copies' IDs, in tab
// order, go to `sessionStorage` as tabs change, and the next load reopens them in that order.
import { watch } from 'vue'

import { errorMessage } from '@open-pencil/std/errors'

import { getRecoveryStore } from '@/app/document/recovery'
import { restoreRecoverySnapshot } from '@/app/tabs/open/recovery'
import {
  activeTab,
  allTabs,
  createHomeTab,
  getTabsSnapshot,
  switchTab,
  type Tab
} from '@/app/tabs/state'

import { readKeptTabsText, writeKeptTabsText } from './storage'

const keptTabsSchema = v.object({
  /** The recovery copy IDs of the open designs, in tab order. */
  designs: v.array(v.pipe(v.string(), v.nonEmpty()))
})

type KeptTabs = v.InferOutput<typeof keptTabsSchema>

function readKeptTabs(): KeptTabs {
  const text = readKeptTabsText()
  if (text === null) return { designs: [] }
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), keptTabsSchema), text)
  return parsed.success ? parsed.output : { designs: [] }
}

function writeKeptTabs(kept: KeptTabs): void {
  try {
    writeKeptTabsText(kept.designs.length === 0 ? null : JSON.stringify(kept))
  } catch (error) {
    console.warn(`[Kept tabs] Could not keep the open designs: ${errorMessage(error)}`)
  }
}

/**
 * Reopens the designs this browser tab had open, in their order, and `activeDesignId`'s with them
 * when it was not among them. The tab in front is then that design's, or the one in front before,
 * such as Home. A design whose copy is gone is skipped.
 */
export async function restoreKeptTabs(
  activeDesignId: string | null,
  designIdOf: (tab: Tab) => string | null
): Promise<void> {
  const before = activeTab.value
  const { designs } = readKeptTabs()
  const ids =
    activeDesignId && !designs.includes(activeDesignId) ? [...designs, activeDesignId] : designs
  for (const id of ids) {
    if (getTabsSnapshot().some((tab) => designIdOf(tab) === id)) continue
    try {
      if (await getRecoveryStore().read(id)) await restoreRecoverySnapshot(id)
    } catch (error) {
      console.error(`[Kept tabs] Could not reopen ${id}: ${errorMessage(error)}`)
    }
  }
  const front = activeDesignId
    ? getTabsSnapshot().find((tab) => designIdOf(tab) === activeDesignId)
    : undefined
  if (front) switchTab(front.id)
  else if (!before || !switchTab(before.id)) createHomeTab()
}

/**
 * Writes the open designs to `sessionStorage` whenever the tabs change, from when `ready` says the
 * kept ones have been reopened, so a reload partway through does not forget the rest.
 */
export function keepOpenTabs(designIdOf: (tab: Tab) => string | null, ready: () => boolean) {
  return watch(
    // `allTabs` follows the tabs, their order, and their loading, after which a restored tab
    // carries its copy's ID.
    () => (ready() ? allTabs.value : null),
    (tabs) => {
      if (!tabs) return
      const designs = getTabsSnapshot().flatMap((tab) => {
        const id = designIdOf(tab)
        return id ? [id] : []
      })
      writeKeptTabs({ designs })
    },
    { immediate: true }
  )
}
