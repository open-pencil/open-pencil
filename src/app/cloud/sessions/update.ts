import { computed, type Ref } from 'vue'

import { confirmAppExit } from '@/app/document/close/exit'
import { checkForAppUpdate } from '@/app/shell/updater/check'
import type { UpdaterMessages } from '@/app/shell/updater/messages'
import { canSelfUpdate } from '@/app/tauri/capabilities'
import { IS_TAURI } from '@/constants'

import { cloudServers } from '../servers/store'
import { cloudConnections } from './connection'

/** The first saved server that refused this editor as older than it supports, if any. */
export const cloudServerNeedingUpdate = computed(
  () =>
    cloudServers.value.find(
      (server) => cloudConnections.value[server.id]?.failure === 'editor-outdated'
    ) ?? null
)

/**
 * How this editor gets a newer version: the desktop updater, a reload in the browser, or nothing
 * it can start itself, in a package whose store delivers updates.
 */
export type EditorUpdateRoute = 'updater' | 'reload' | null

export function editorUpdateRoute(): EditorUpdateRoute {
  if (!IS_TAURI) return 'reload'
  return canSelfUpdate() ? 'updater' : null
}

/** Starts the update `editorUpdateRoute` names; a reload asks about unsaved documents first. */
export async function updateEditor(messages: Ref<UpdaterMessages>): Promise<void> {
  const route = editorUpdateRoute()
  if (route === 'updater') await checkForAppUpdate({ messages })
  else if (route === 'reload' && (await confirmAppExit())) window.location.reload()
}
