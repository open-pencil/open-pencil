import type { CollaborationStateStore } from '#cloud/server/collaboration'
import { authorizeCollaborationRelay } from '#cloud/server/collaboration'
import { Database } from '@hocuspocus/extension-database'
import type { Extension } from '@hocuspocus/server'
import { Server } from '@hocuspocus/server'

type AwarenessUserState = Record<string, unknown>

function awarenessUser(value: unknown): AwarenessUserState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value))
}

export type CloudCollaborationContext = Awaited<ReturnType<typeof authorizeCollaborationRelay>>

export type CloudCollaborationRelayOptions = {
  authSecret: string
  stateStore?: CollaborationStateStore
  maximumParticipants?: (documentId: string) => Promise<number | null>
  maximumMessageBytes?: number
  extensions?: Extension[]
}

export class CollaborationParticipantLimitError extends Error {
  readonly code = 4409
  readonly reason = 'Collaboration participant limit reached'
  override readonly name = 'CollaborationParticipantLimitError'

  constructor() {
    super('Collaboration participant limit reached')
  }
}

export function createCloudCollaborationRelay(options: CloudCollaborationRelayOptions) {
  return new Server<CloudCollaborationContext>({
    extensions: [
      ...(options.stateStore
        ? [
            new Database({
              fetch: ({ documentName }) =>
                options.stateStore?.load(documentName) ?? Promise.resolve(null),
              store: ({ documentName, state }) =>
                options.stateStore?.storeState(documentName, new Uint8Array(state)) ??
                Promise.resolve()
            })
          ]
        : []),
      ...(options.extensions ?? [])
    ],
    websocketOptions: {
      maxPayload: options.maximumMessageBytes ?? 0
    },
    name: 'OpenPencil Cloud collaboration',
    quiet: true,
    async onAuthenticate({ token, documentName, connectionConfig, instance }) {
      const authorization = await authorizeCollaborationRelay(
        token,
        documentName,
        options.authSecret
      )
      const document = instance.documents.get(documentName)
      const maximum = await options.maximumParticipants?.(authorization.documentId)
      if (
        maximum !== undefined &&
        maximum !== null &&
        (document?.getConnectionsCount() ?? 0) >= maximum
      ) {
        throw new CollaborationParticipantLimitError()
      }
      connectionConfig.readOnly = authorization.readOnly
      return authorization
    },
    async onTokenSync({ token, documentName, connectionConfig }) {
      const authorization = await authorizeCollaborationRelay(
        token,
        documentName,
        options.authSecret
      )
      connectionConfig.readOnly = authorization.readOnly
      return authorization
    },
    async beforeHandleAwareness({ states, context }) {
      if (!context) return
      for (const state of states.values()) {
        const user = awarenessUser(state.user)
        state.user = {
          ...user,
          identity: {
            source: 'cloud',
            principal: context.principal,
            permission: context.permission,
            serverEnforcedWrites: true
          }
        }
      }
    }
  })
}
