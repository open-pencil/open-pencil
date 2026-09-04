import { readFile, writeFile } from 'node:fs/promises'

import { parseCloudDeploymentSource } from '@open-pencil/cloud/server'

import { generateCloudflareConfig } from './cloudflare-config'

const [sourcePath, wranglerPath, outputPath, environmentName] = process.argv.slice(2)
if (!sourcePath || !wranglerPath || !outputPath || !environmentName) {
  throw new Error(
    'Usage: cloud-deploy <deployment.toml> <wrangler.jsonc> <output.json> <environment>'
  )
}

const deployment = parseCloudDeploymentSource(await readFile(sourcePath, 'utf8'))
const generated = generateCloudflareConfig(
  deployment,
  await readFile(wranglerPath, 'utf8'),
  environmentName
)
await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, { mode: 0o600 })
