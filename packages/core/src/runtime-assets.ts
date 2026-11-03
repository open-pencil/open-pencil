/**
 * Core loads some files at run time: CanvasKit's WebAssembly, the bundled fonts, and HarfBuzz's
 * subsetter. A browser host serves them, and when it does not, a development server or an SPA
 * host answers with its HTML page, which would otherwise surface as a WebAssembly compile error
 * or an unreadable font.
 */

const SETUP_HINT =
  "Add openPencil() from '@open-pencil/core/node/vite' to the Vite config, or serve the file and point Core at it with"

/** Whether a response carries the file asked for, not an error or a fallback page. */
export function servesRuntimeAsset(response: Response): boolean {
  return response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')
}

/** What a host that does not serve one of Core's files is told, naming the locator to set. */
export function unservedRuntimeAssetMessage(
  file: string,
  url: string,
  response: Response,
  locator: string
): string {
  const answer = response.ok
    ? (response.headers.get('content-type') ?? 'no content type')
    : response.status
  return `${file} is not served at ${url} (it answered ${answer}). ${SETUP_HINT} ${locator}.`
}
