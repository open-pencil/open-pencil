/** Official releases always target public npm with provenance; ambient npmrc cannot redirect them. */
export const NPM_RELEASE_POLICY = {
  access: 'public',
  provenance: true,
  registry: 'https://registry.npmjs.org/'
} as const
