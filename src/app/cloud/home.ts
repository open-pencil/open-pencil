import { joinURL } from 'ufo'
import { computed } from 'vue'

import type { WorkspaceSummary } from '@open-pencil/cloud/contract'

import { openExternalLink } from '@/app/shell/ui'
import { IS_CLOUD_SITE } from '@/constants'

import { openCloudConnect } from './connect/flow'
import { cloudServerHost } from './servers/address'
import { homeCloudServer } from './servers/store'
import { cloudConnection } from './sessions/connection'
import { signOutOfCloud } from './sessions/sign-out'
import { openNewWorkspace } from './workspaces/manage'

/** A workspace Home lists, and whether anyone may open what is in it: the server's gallery. */
export type HomeCloudWorkspace = WorkspaceSummary & { public: boolean }

/** The server Home shows: who is signed in to it, and its workspaces. */
export function useHomeCloud() {
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
    }
  }
}
