export const CLOUD_DEFAULT_MAX_COLLABORATION_MESSAGE_BYTES = 1024 * 1024
export const CLOUD_DEFAULT_MAX_CONNECTIONS_PER_ROOM = 1000

export type CloudTechnicalLimits = {
  maximumUploadBytes: number
  maximumCollaborationMessageBytes: number
  maximumConnectionsPerRoom: number
}
