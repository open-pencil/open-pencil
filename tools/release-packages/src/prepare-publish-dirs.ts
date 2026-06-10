import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DEFAULT_PACKAGES, preparePublishDirectories } from './publish-dirs'

const root = process.cwd()
const corePackageJSON = JSON.parse(
  await readFile(join(root, 'packages/core/package.json'), 'utf8')
) as {
  version: string
}

await preparePublishDirectories({
  coreVersion: corePackageJSON.version,
  packages: DEFAULT_PACKAGES,
  root,
  log: (message) => process.stdout.write(`${message}\n`)
})
