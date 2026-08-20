export {
  createCapabilityService,
  type CapabilityService,
  type CapabilityServiceOptions
} from './capabilities/service'

export {
  capabilityHashMatches,
  decryptContinuationToken,
  encryptContinuationToken,
  hashCapability
} from './crypto'
export { DocumentShareInvalidError, InvitationDeliveryError } from './errors'
export { createGrantService, type GrantService } from './grants/service'

export { createPublicDocumentRoutes } from './document-routes'
export {
  createDocumentSharingRoutes,
  createPublicSharingRoutes,
  type SharingRouteEnvironment
} from './routes'
export {
  createDocumentSharingService,
  type DocumentShareCapability,
  type DocumentSharingServiceOptions,
  type DocumentSharingService,
  type ResolvedDocumentShare,
  type ResolvedSharePrincipal
} from './service'
