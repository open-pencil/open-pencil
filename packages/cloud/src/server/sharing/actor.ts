import type { CloudActor, CloudSessionResolver } from '#cloud/server/auth'

/**
 * Who follows a link: the person signed in to the server, if any, whom the server lets in where
 * it turns guests away.
 */
export async function shareActor(
  request: Request,
  resolveSession?: CloudSessionResolver
): Promise<CloudActor | undefined> {
  return resolveSession ? ((await resolveSession(request)) ?? undefined) : undefined
}
