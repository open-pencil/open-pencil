import { computed } from 'vue'

import { openCloudConnect } from '@/app/cloud/connect/flow'
import { cloudServerHost } from '@/app/cloud/servers/address'
import { homeCloudServer } from '@/app/cloud/servers/store'
import { cloudConnection } from '@/app/cloud/sessions/connection'
import { signOutOfCloud } from '@/app/cloud/sessions/sign-out'
import { openSettingsDialog } from '@/app/settings/dialog'

import { homeLocation, type HomeLocation } from './location'

/** A Home location as the sidebar and the phone menu name it. */
export type HomeLocationView =
  | { kind: 'recent'; id: 'recent' }
  | { kind: 'workspace'; id: string }
  | { kind: 'shared'; id: 'shared' }
  | { kind: 'storage'; id: 'storage' }

const VIEWS = {
  recent: { kind: 'recent', id: 'recent' },
  shared: { kind: 'shared', id: 'shared' },
  storage: { kind: 'storage', id: 'storage' }
} as const satisfies Record<Exclude<HomeLocation['kind'], 'workspace'>, HomeLocationView>

function toView(location: HomeLocation): HomeLocationView {
  return location.kind === 'workspace' ? location : VIEWS[location.kind]
}

function fromView(location: HomeLocationView): HomeLocation {
  return location.kind === 'workspace' ? location : { kind: location.kind }
}

/**
 * Where Home can list documents from: Recent, the workspaces and shared documents of the server
 * Home shows when signed in to it, and storage. A Cloud location the account can no longer
 * reach falls back to Recent.
 */
export function useHomeLocations() {
  const connection = computed(() => {
    const server = homeCloudServer.value
    return server ? { server, ...cloudConnection(server.id) } : null
  })
  const signedIn = computed(() =>
    connection.value?.state === 'signed-in' ? connection.value : null
  )
  const account = computed(() => {
    const current = signedIn.value
    if (!current?.account) return null
    return { ...current.account, host: cloudServerHost(current.server.url) }
  })
  const workspaces = computed(() => signedIn.value?.workspaces ?? [])

  const location = computed<HomeLocation>(() => {
    const chosen = homeLocation.value
    if (chosen.kind === 'shared' && !signedIn.value) return { kind: 'recent' }
    if (chosen.kind === 'workspace' && !workspaces.value.some((entry) => entry.id === chosen.id)) {
      return { kind: 'recent' }
    }
    return chosen
  })
  const workspace = computed(() => {
    const current = location.value
    return current.kind === 'workspace'
      ? (workspaces.value.find((entry) => entry.id === current.id) ?? null)
      : null
  })

  return {
    account,
    workspaces,
    location,
    workspace,
    serverId: computed(() => signedIn.value?.server.id ?? null),
    active: computed(() => toView(location.value)),
    select(next: HomeLocationView) {
      homeLocation.value = fromView(next)
    },
    connect: () => openCloudConnect(),
    accountSettings: () => openSettingsDialog('cloud'),
    storageSettings: () => openSettingsDialog('storage'),
    async signOut() {
      const current = signedIn.value
      if (current?.discovery) await signOutOfCloud(current.server.id, current.discovery)
    }
  }
}
