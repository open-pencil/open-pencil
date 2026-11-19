import { computed } from 'vue'

import { useHomeCloud } from '@/app/cloud/integration'
import { recentFilesAvailable } from '@/app/recent-files/preferences'
import { openSettingsDialog } from '@/app/settings/dialog'

import { homeLocation, homeLocationChosen, type HomeLocation } from './location'

/** The places only a Cloud session can show. */
const CLOUD_PLACES: ReadonlySet<HomeLocation['kind']> = new Set(['workspace', 'shared', 'trash'])

/** A Home location as the sidebar and the phone menu name it. */
export type HomeLocationView =
  | { kind: 'recent'; id: 'recent' }
  | { kind: 'workspace'; id: string }
  | { kind: 'shared'; id: 'shared' }
  | { kind: 'trash'; id: 'trash' }
  | { kind: 'storage'; id: 'storage' }

const VIEWS = {
  recent: { kind: 'recent', id: 'recent' },
  shared: { kind: 'shared', id: 'shared' },
  trash: { kind: 'trash', id: 'trash' },
  storage: { kind: 'storage', id: 'storage' }
} as const satisfies Record<Exclude<HomeLocation['kind'], 'workspace'>, HomeLocationView>

function toView(location: HomeLocation): HomeLocationView {
  return location.kind === 'workspace' ? location : VIEWS[location.kind]
}

function fromView(location: HomeLocationView): HomeLocation {
  return location.kind === 'workspace' ? location : { kind: location.kind }
}

/**
 * Where Home can list documents from: Recent, the workspaces, shared documents, and Trash of the
 * server Home shows when signed in to it, and storage. Until the person picks a place, Home shows
 * Recent, or the first workspace where this app keeps no recent files. A Cloud location the
 * account can no longer reach falls back to Recent.
 */
export function useHomeLocations() {
  const cloud = useHomeCloud()
  const workspaces = cloud.workspaces

  const defaultsToWorkspace = computed(() => !homeLocationChosen.value && !recentFilesAvailable())
  // A Cloud place stays chosen while Cloud checks the session: it has no workspaces yet only
  // because it has not answered, so Home waits rather than show Recent and then jump. Recent and
  // storage do not depend on the session.
  const waitsForCloud = computed(
    () =>
      cloud.checking.value &&
      (defaultsToWorkspace.value || CLOUD_PLACES.has(homeLocation.value.kind))
  )
  const location = computed<HomeLocation>(() => {
    const first = workspaces.value.at(0)
    if (defaultsToWorkspace.value && first) return { kind: 'workspace', id: first.id }
    const chosen = homeLocation.value
    if (waitsForCloud.value) return chosen
    if ((chosen.kind === 'shared' || chosen.kind === 'trash') && !cloud.signedIn.value) {
      return { kind: 'recent' }
    }
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
    account: cloud.account,
    workspaces,
    location,
    /** Whether Home waits for Cloud to say which place it opens on, rather than show Recent. */
    settling: waitsForCloud,
    /** Whether Cloud has yet to say if this app is signed in. */
    checking: cloud.checking,
    workspace,
    serverId: cloud.serverId,
    active: computed(() => toView(location.value)),
    select(next: HomeLocationView) {
      homeLocation.value = fromView(next)
    },
    connect: cloud.connect,
    openAccount: cloud.openAccount,
    newWorkspace: cloud.newWorkspace,
    storageSettings: () => openSettingsDialog('storage'),
    signOut: cloud.signOut
  }
}
