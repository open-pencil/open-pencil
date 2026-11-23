/** The frame's script: its own file in a build, its text in development (`?script-file`). */
export type SandboxFrameScript = { src: string } | { text: string }

/**
 * The frame's own policy. The editor's policy applies to it as well, since a `srcdoc` frame
 * inherits its parent's: a build loads the script from the app's files, which both allow, and
 * development, where the editor has no policy, inlines it.
 */
function contentSecurityPolicy(scriptSource: string): string {
  return [
    "default-src 'none'",
    `script-src ${scriptSource} 'unsafe-eval'`,
    "connect-src 'none'",
    "img-src 'none'",
    "media-src 'none'",
    "font-src 'none'",
    "style-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    'worker-src blob:',
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}

const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

/**
 * The sandbox frame's document: the bundled frame script (`frame.ts?script-file`) under a strict
 * CSP. `base` resolves a script file's address, as the frame has an opaque origin and its policy
 * must name the file in full.
 */
export function sandboxDocument(script: SandboxFrameScript, base: string): string {
  if ('src' in script) {
    const src = escapeAttribute(new URL(script.src, base).href)
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(src)}"></head><body><script src="${src}"></script></body></html>`
  }
  // HTML ends a script at `</script` in any case.
  if (/<\/script/i.test(script.text)) {
    throw new Error('The sandbox frame script cannot be inlined.')
  }
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy("'unsafe-inline'")}"></head><body><script>${script.text}</script></body></html>`
}
