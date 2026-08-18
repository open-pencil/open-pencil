import type { CollaborationStateStore } from '#cloud/server/collaboration'
import { authorizeCollaborationRelay } from '#cloud/server/collaboration'
import { Server } from '@hocuspocus/server'

export type CloudCollaborationContext = Awaited<ReturnType<typeof authorizeCollaborationRelay>>

export type CloudCollaborationRelayOptions = {
  authSecret: string
  stateStore?: CollaborationStateStore
  maximumParticipants?: (documentId: string) => Promise<number | null>
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
    name: 'OpenPencil Cloud collaboration',
    quiet: true,
    async onLoadDocument({ documentName }) {
      return options.stateStore?.load(documentName) ?? null
    },
    async onStoreDocument({ documentName, document }) {
      await options.stateStore?.store(documentName, document)
    },
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
        state.identity = {
          documentId: context.documentId,
          permission: context.permission,
          roomEpoch: context.roomEpoch
        }
      }
    }
  })
}
