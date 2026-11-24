import { openapi, type OpenAPIMeta } from '@orpc/openapi'

/**
 * A route at `method` and `path`, whose input comes as `params`, `query`, and `body`, so a route
 * parameter that fails its schema can answer 404 while a body that does answers 400.
 */
export function at(
  method: NonNullable<OpenAPIMeta['method']>,
  path: `/${string}`,
  options: Pick<OpenAPIMeta, 'successStatus' | 'outputStructure'> = {}
) {
  return openapi({ method, path, inputStructure: 'detailed', ...options })
}
