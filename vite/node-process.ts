/**
 * `node:process` for the browser: unifont reads proxy settings from `env` when it starts, which a
 * page has none of.
 */
export const env: Record<string, string | undefined> = {}

export default { env }
