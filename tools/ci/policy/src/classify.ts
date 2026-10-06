import { execFileSync } from 'node:child_process'
import { appendFile } from 'node:fs/promises'

import { classifyPaths } from './policy'

const base = process.env.CI_BASE_SHA
const output = process.env.GITHUB_OUTPUT
if (!base || !/^[a-f0-9]{40}$/.test(base) || !output)
  throw new Error('Missing CI base SHA or output file')

// Disable rename detection so both the old and new paths participate in routing.
const paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, 'HEAD'], {
  maxBuffer: 32 * 1024 * 1024
})
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
const scope = classifyPaths(paths)
await appendFile(output, `scope=${scope}\n`)
console.log(`Selected ${scope} checks for ${paths.length} changed paths`)
