import { encodeParam, parseURL, withFragment, withQuery } from 'ufo'

/** The two kinds of Cloud link that carry a secret: invitations and documents shared by link. */
export type CloudLinkKind = 'invitations' | 'share'

/** Every kind of Cloud link: those that carry a secret, and a document's address for members. */
export type CloudLinkPathKind = CloudLinkKind | 'documents'

const CLOUD_LINK_PATH = /^\/(invitations|share|documents)\/([^/]+)$/

/**
 * A link on the server's own editor. The server is the link's own address, so the link needs
 * nothing else to name it; a secret travels in the fragment, so it never reaches access logs or
 * `Referer` headers.
 */
function serverLink(
  serverURL: string,
  path: string,
  query: Record<string, string | undefined> = {},
  secret?: string
): string {
  const { protocol, host } = parseURL(serverURL)
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('A Cloud server address must use HTTP or HTTPS')
  }
  const link = withQuery(`${protocol}//${host}${path}`, query)
  return secret ? withFragment(link, secret) : link
}

/** An invitation to a document or a workspace, `/invitations/:id#token`. */
export function cloudInvitationURL(serverURL: string, invitationId: string, token: string): string {
  return serverLink(serverURL, `/invitations/${encodeParam(invitationId)}`, {}, token)
}

/** A document shared by link, `/share/:id#secret`. */
export function cloudShareURL(serverURL: string, shareId: string, secret: string): string {
  return serverLink(serverURL, `/share/${encodeParam(shareId)}`, {}, secret)
}

/**
 * A document's address for its members, `/documents/:id`, or one of its versions with
 * `?version=…`. It carries no secret: whoever opens it signs in, and the server decides.
 */
export function cloudDocumentURL(
  serverURL: string,
  documentId: string,
  versionId: string | null = null
): string {
  return serverLink(serverURL, cloudDocumentPath(documentId), {
    version: versionId ?? undefined
  })
}

export function cloudDocumentPath(documentId: string): string {
  return `/documents/${encodeParam(documentId)}`
}

/**
 * The kind and ID of a Cloud link's path, or null for any other path. The ID is decoded; a broken
 * escape such as `%E0` is no link.
 */
export function parseCloudLinkPath(
  pathname: string
): { kind: CloudLinkPathKind; id: string } | null {
  const [, kind, id] = pathname.match(CLOUD_LINK_PATH) ?? []
  if ((kind !== 'invitations' && kind !== 'share' && kind !== 'documents') || !id) return null
  try {
    return { kind, id: decodeURIComponent(id) }
  } catch {
    return null
  }
}

/**
 * The desktop app's form of a Cloud link, `openpencil://cloud?url=<link>#secret`: the web link,
 * whose address names the server, with its secret kept in the fragment.
 * `desktop/src/launch/links.rs` validates it before the editor sees it.
 */
export function cloudDesktopLinkURL(
  kind: CloudLinkKind,
  id: string,
  serverURL: string,
  secret: string
): string {
  const link = serverLink(serverURL, `/${kind}/${encodeParam(id)}`)
  return withFragment(withQuery('openpencil://cloud', { url: link }), secret)
}
