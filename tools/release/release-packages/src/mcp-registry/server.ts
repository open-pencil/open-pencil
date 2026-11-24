import * as v from 'valibot'

export const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io'

/** The domain whose DNS record proves we own the `dev.openpencil/*` names. */
export const MCP_REGISTRY_DOMAIN = 'openpencil.dev'

/** The npm package the registry entry describes, and the entry's metadata beside it. */
export const MCP_PACKAGE_DIRECTORY = 'packages/mcp'

const manifestSchema = v.object({
  name: v.string(),
  version: v.string(),
  mcpName: v.string()
})

const serverSchema = v.looseObject({
  name: v.string(),
  packages: v.pipe(
    v.array(v.looseObject({ registryType: v.literal('npm'), identifier: v.string() })),
    v.length(1)
  )
})

const jsonText = <T extends v.GenericSchema>(schema: T) => v.pipe(v.string(), v.parseJson(), schema)

/**
 * The registry entry for one npm release. `server.json` holds everything but the version, which
 * the release supplies for the entry and its package alike: a published version is permanent, so
 * the entry always names the npm version it starts.
 */
export function releaseServer(serverText: string, manifestText: string) {
  const server = v.parse(jsonText(serverSchema), serverText)
  const manifest = v.parse(jsonText(manifestSchema), manifestText)
  const [npmPackage] = server.packages
  if (manifest.mcpName !== server.name) {
    throw new Error(`mcpName ${manifest.mcpName} does not match the registry name ${server.name}`)
  }
  if (npmPackage.identifier !== manifest.name) {
    throw new Error(`server.json describes ${npmPackage.identifier}, not ${manifest.name}`)
  }
  return {
    ...server,
    version: manifest.version,
    packages: [{ ...npmPackage, version: manifest.version }]
  }
}

/** Where the registry answers for one published version of an entry. */
export function serverVersionURL(name: string, version: string): string {
  return `${MCP_REGISTRY_URL}/v0.1/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`
}
