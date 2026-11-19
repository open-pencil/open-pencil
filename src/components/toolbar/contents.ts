import { computed } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'

import type { EditorStore } from '@/app/editor/active-store'
import {
  hiddenToolbarActions,
  shownToolbarActions,
  toolbarItems,
  toolbarLayoutFor
} from '@/app/editor/toolbar/layout'
import { toolShortcutLabels } from '@/app/editor/toolbar/shortcuts'
import { appPreferences } from '@/app/settings/preferences/store'

import { useToolLabels } from './labels'

/** What the editor's toolbar shows: the saved layout, narrowed to the tools the document offers. */
export function useToolbarContents(store: EditorStore) {
  const toolLabels = useToolLabels()
  const profile = computed(() => resolveEditorProfile(store.state))
  const toolShortcuts = computed(() => toolShortcutLabels(profile.value.toolKeys))
  const items = computed(() =>
    toolbarItems(
      toolbarLayoutFor(appPreferences.value.toolbar, profile.value.tools),
      toolLabels.value,
      toolShortcuts.value
    )
  )
  const tools = computed(() =>
    items.value.flatMap((item) => (item.kind === 'tool' ? [item.tool] : []))
  )
  const actions = computed(() => shownToolbarActions(items.value))
  const hiddenActions = computed(() => hiddenToolbarActions(items.value, profile.value.edits))
  /** A profile that fixes the tools, as a board's does, has nothing to customize, as in FigJam. */
  const customizable = computed(() => profile.value.tools === null)

  return { toolLabels, toolShortcuts, items, tools, actions, hiddenActions, customizable }
}
