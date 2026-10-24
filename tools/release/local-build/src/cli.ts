import { homedir } from 'node:os'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

import { buildLocal, parseOptions } from './build'

const options = parseOptions(process.argv.slice(2), process.platform)
if (options.help) {
  console.log('Usage: bun run build:local [--install]')
  console.log('Build isolated local bundles; --install copies the app to ~/Applications on macOS.')
} else {
  await buildLocal({
    root: await resolveWorkspaceRoot(process.cwd()),
    home: homedir(),
    platform: process.platform,
    install: options.install
  })
}
