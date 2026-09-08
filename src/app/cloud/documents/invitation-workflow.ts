import { ref } from 'vue'

import { cloudSignInURL, createCloudAPIClient, discoverCloud } from '@open-pencil/cloud/client'
import type { InvitationPreview } from '@open-pencil/cloud/contract'

import { createInvitationAcceptance } from './acceptance'

export type InvitationFailure =
  | 'invitationUnavailable'
  | 'invitationAcceptFailed'
  | 'invitationOpenFailed'
export type InvitationPhase = 'loading' | 'ready' | 'accepting' | 'opening' | 'failed' | 'complete'
export type InvitationWorkflowOptions = {
  serverURL: string
  invitationId: string
  token: string
  continuation?: string
  callbackURL: string
  navigate(url: string): void
  open(
    target: Awaited<ReturnType<ReturnType<typeof createInvitationAcceptance>['open']>>
  ): Promise<void>
  connect?: typeof connectInvitation
}

async function connectInvitation(serverURL: string) {
  const discovery = await discoverCloud(serverURL)
  return { discovery, client: createCloudAPIClient(discovery.apiURL) }
}

/** Owns invitation phases and retry decisions; no user-facing text is stored here. */
export function createInvitationWorkflow(options: InvitationWorkflowOptions) {
  const phase = ref<InvitationPhase>('loading')
  const failure = ref<InvitationFailure | null>(null)
  const invitation = ref<InvitationPreview | null>(null)
  let invitationId = options.invitationId
  let token = options.token
  let continuation = options.continuation
  let acceptance: ReturnType<typeof createInvitationAcceptance> | null = null
  let busy = false
  const connect = () => (options.connect ?? connectInvitation)(options.serverURL)

  async function run(action: () => Promise<void>, error: () => InvitationFailure) {
    if (busy) return
    busy = true
    failure.value = null
    try {
      await action()
    } catch {
      failure.value = error()
      phase.value = 'failed'
    } finally {
      busy = false
    }
  }

  function load() {
    return run(
      async () => {
        phase.value = 'loading'
        if (!options.serverURL || !invitationId || (!token && !continuation))
          throw new Error('Incomplete invitation')
        const { client } = await connect()
        if (continuation) {
          const restored = await client.consumeInvitationContinuation(continuation)
          invitationId = restored.invitationId
          token = restored.token
          continuation = undefined
        }
        invitation.value = await client.previewDocumentInvitation(invitationId, { token })
        phase.value = 'ready'
      },
      () => 'invitationUnavailable'
    )
  }

  function accept() {
    return run(
      async () => {
        phase.value = 'accepting'
        const cloud = await connect()
        if (!(await cloud.client.getSession())) {
          const result = await cloud.client.createInvitationContinuation({ invitationId, token })
          const callback = new URL(options.callbackURL)
          callback.hash = ''
          callback.searchParams.set('continuation', result.id)
          options.navigate(cloudSignInURL(cloud.discovery, callback.href))
          return
        }
        acceptance ??= createInvitationAcceptance(options.serverURL, invitationId, token)
        const target = await acceptance.open(cloud.client)
        phase.value = 'opening'
        await options.open(target)
        phase.value = 'complete'
      },
      () => (acceptance?.accepted ? 'invitationOpenFailed' : 'invitationAcceptFailed')
    )
  }

  return {
    phase,
    failure,
    invitation,
    load,
    accept,
    retry: () => (invitation.value ? accept() : load())
  }
}
