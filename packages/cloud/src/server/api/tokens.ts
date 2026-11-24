import {
  commentsContract,
  documentToolsContract,
  documentsContract,
  sessionContract,
  sharingContract,
  versionsContract,
  workspacesContract
} from '#cloud/contract'
import {
  contractTokenRoutes,
  tokenRoutes,
  type ContractTokenRoute,
  type TokenRoute
} from '#cloud/server/tokens'
import type { AnyProcedureContract } from '@orpc/contract'
import { getOpenAPIMeta } from '@orpc/openapi'

const { read, write } = tokenRoutes

/** What tokens each procedure of a contract takes; one left out takes a signed-in session alone. */
type TokenRoutesOf<Contract> = Partial<Record<keyof Contract & string, TokenRoute>>

export const documentTokenRoutes = {
  listShared: read.account,
  listTrash: read.account,
  restore: write.document,
  purge: write.document,
  list: read.workspace,
  usage: read.workspace,
  create: write.workspace,
  remove: write.document,
  access: read.document,
  summary: read.document,
  download: read.document,
  createUpload: write.document,
  commitUpload: write.upload,
  requestImageUploads: write.document,
  commitImageUploads: write.document,
  imageLinks: read.document
} satisfies TokenRoutesOf<typeof documentsContract>

export const documentToolTokenRoutes = {
  read: read.document,
  write: write.document
} satisfies TokenRoutesOf<typeof documentToolsContract>

export const versionTokenRoutes = {
  list: read.document,
  save: write.document,
  update: write.document,
  download: read.document,
  restore: write.document,
  duplicate: write.document
} satisfies TokenRoutesOf<typeof versionsContract>

export const commentTokenRoutes = {
  people: read.document,
  list: read.document,
  createThread: write.document,
  importThreads: write.document,
  get: read.document,
  markRead: write.document,
  updateThread: write.document,
  deleteThread: write.document,
  reply: write.document,
  updateComment: write.document,
  deleteComment: write.document
} satisfies TokenRoutesOf<typeof commentsContract>

/** Sharing is the person's own business: personal access tokens reach it, apps never do. */
export const sharingTokenRoutes = {
  userProfile: read.personal,
  listShares: read.personal,
  createShare: write.personal,
  updateShare: write.personal,
  rotateShare: write.personal,
  revokeShare: write.personal,
  listGrants: read.personal,
  putGrant: write.personal,
  revokeGrant: write.personal,
  listInvitations: read.personal,
  createInvitation: write.personal,
  revokeInvitation: write.personal,
  // A ticket lets its holder edit, so a token that may only read gets none.
  collaborationTicket: write.document
} satisfies TokenRoutesOf<typeof sharingContract>

export const workspaceTokenRoutes = {
  list: read.grant,
  create: write.personal,
  get: read.workspace,
  rename: write.personal,
  remove: write.personal,
  members: read.personal,
  invite: write.personal,
  resendInvitation: write.personal,
  revokeInvitation: write.personal,
  updateMember: write.personal,
  removeMember: write.personal,
  entitlements: read.workspace
} satisfies TokenRoutesOf<typeof workspacesContract>

export const sessionTokenRoutes = {
  session: read.grant
} satisfies TokenRoutesOf<typeof sessionContract>

/** The method and path of each declared procedure of `contract`, under `prefix`. */
function declared<Contract extends Record<string, AnyProcedureContract>>(
  contract: Contract,
  routes: TokenRoutesOf<Contract>,
  prefix: `/${string}`
): ContractTokenRoute[] {
  return Object.entries(routes).flatMap(([name, route]) => {
    const procedure = contract[name]
    const meta = procedure && getOpenAPIMeta(procedure)
    if (!route || !meta?.method || !meta.path) return []
    return [{ method: meta.method, path: `${prefix}${meta.path}`, route }]
  })
}

/**
 * The token declaration of the signed-in API's contract route a request reached, which the API
 * serves under `/api`, for `requireActiveActor` to hold a token to.
 */
export const declaredContractTokenRoute = contractTokenRoutes([
  ...declared(documentsContract, documentTokenRoutes, '/api'),
  ...declared(documentToolsContract, documentToolTokenRoutes, '/api'),
  ...declared(versionsContract, versionTokenRoutes, '/api'),
  ...declared(commentsContract, commentTokenRoutes, '/api'),
  ...declared(sharingContract, sharingTokenRoutes, '/api'),
  ...declared(workspacesContract, workspaceTokenRoutes, '/api'),
  ...declared(sessionContract, sessionTokenRoutes, '/api')
])
