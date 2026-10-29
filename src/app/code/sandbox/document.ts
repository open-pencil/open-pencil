const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
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

/** The sandbox frame's document: the bundled frame script (`frame.ts?script`) under a strict CSP. */
export function sandboxDocument(frameScript: string): string {
  // HTML ends a script at `</script` in any case.
  if (/<\/script/i.test(frameScript)) throw new Error('The sandbox frame script cannot be inlined.')
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"></head><body><script>${frameScript}</script></body></html>`
}
