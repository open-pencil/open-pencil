import { authorizeCollaborationRelay } from '#cloud/server/collaboration'
import { Server } from '@hocuspocus/server'

export type CloudCollaborationContext = Awaited<ReturnType<typeof authorizeCollaborationRelay>>

export type CloudCollaborationRelayOptions = {
  authSecret: string
}

export function createCloudCollaborationRelay(options: CloudCollaborationRelayOptions) {
  return new Server<CloudCollaborationContext>({
    name: 'OpenPencil Cloud collaboration',
    quiet: true,
    async onAuthenticate({ token, documentName, connectionConfig }) {
      const authorization = await authorizeCollaborationRelay(
        token,
        documentName,
        options.authSecret
      )
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
