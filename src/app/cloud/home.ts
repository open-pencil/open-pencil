import { joinURL } from 'ufo'
import { computed } from 'vue'

import type { WorkspaceSummary } from '@open-pencil/cloud/contract'
import { useAutoRefresh } from '@open-pencil/vue/shared/refresh'

import { openExternalLink } from '@/app/shell/ui'
import { IS_CLOUD_SITE } from '@/constants'

import { openCloudConnect } from './connect/flow'
import { cloudServerHost } from './servers/address'
import { homeCloudServer } from './servers/store'
import { cloudConnection, refreshCloudConnection } from './sessions/connection'
import { signOutOfCloud } from './sessions/sign-out'
import { openNewWorkspace } from './workspaces/manage'

/** A workspace Home lists, and whether anyone may open what is in it: the server's gallery. */
export type HomeCloudWorkspace = WorkspaceSummary & { public: boolean }

/** How often Home asks its server again while shown, as it does for a workspace's files. */
const HOME_CLOUD_REFRESH_MS = 60_000

/**
 * Asks the server Home shows again, keeping what Home shows until it answers: a workspace made or
 * left elsewhere, on the server's pages or another device, then appears or goes.
 */
export async function refreshHomeCloud(): Promise<void> {
  const server = homeCloudServer.value
  if (server) await refreshCloudConnection(server, { background: true })
}

/**
 * The server Home shows: who is signed in to it, and its workspaces, asked again when the window
 * regains focus, when the browser comes back online, and every minute while Home is visible.
 */
export function useHomeCloud() {
  const { refresh } = useAutoRefresh(refreshHomeCloud, { interval: HOME_CLOUD_REFRESH_MS })
  const connection = computed(() => {
    const server = homeCloudServer.value
    return server ? { server, ...cloudConnection(server.id) } : null
  })
  const signedIn = computed(() =>
    connection.value?.state === 'signed-in' ? connection.value : null
  )
  return {
    signedIn: computed(() => signedIn.value !== null),
    // On a Cloud site the server's own connection is on its way before startup adds it.
    checking: computed(() =>
      connection.value ? connection.value.state === 'checking' : IS_CLOUD_SITE
    ),
    account: computed(() => {
      const current = signedIn.value
      if (!current?.account) return null
      return { ...current.account, host: cloudServerHost(current.server.url) }
    }),
    workspaces: computed((): HomeCloudWorkspace[] => {
      const current = signedIn.value
      const gallery = current?.discovery?.community?.workspaceId
      return (current?.workspaces ?? []).map((workspace) => ({
        ...workspace,
        public: workspace.id === gallery
      }))
    }),
    serverId: computed(() => signedIn.value?.server.id ?? null),
    // Signing back in goes straight to the server Home shows; without one, choose a server.
    connect: () => openCloudConnect({ serverId: homeCloudServer.value?.id }),
    /** The server's own account pages, in the browser. */
    openAccount: () => {
      const server = signedIn.value?.server
      if (server) void openExternalLink(joinURL(server.url, '/account'))
    },
    newWorkspace: () => {
      const server = signedIn.value?.server
      if (server) openNewWorkspace(server.id)
    },
    signOut: async () => {
      const current = signedIn.value
      if (current?.discovery) await signOutOfCloud(current.server.id, current.discovery)
    },
    /** Asks the server again now, as the refresh buttons do. */
    refresh
  }
}
