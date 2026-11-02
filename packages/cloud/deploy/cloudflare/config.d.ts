// Wrangler bundles a deployment's TOML as text (`rules` in its wrangler.jsonc).
declare module '*.toml' {
  const source: string
  export default source
}
