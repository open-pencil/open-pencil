import { execFileSync } from 'node:child_process'
import { appendFile } from 'node:fs/promises'

import { classifyPaths } from './policy'
import { isVerifiedTree } from './verified-tree/status'

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
const scope = (await queuedTreeVerified()) ? 'verified' : classifyPaths(paths)
await appendFile(output, `scope=${scope}\n`)
console.log(`Selected ${scope} checks for ${paths.length} changed paths`)

/** In the merge queue, whether the queued commit's tree already passed its pull request's CI. */
async function queuedTreeVerified(): Promise<boolean> {
  const { CI_EVENT, CI_HEAD_REF, GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env
  if (CI_EVENT !== 'merge_group' || !CI_HEAD_REF || !GITHUB_REPOSITORY || !GITHUB_TOKEN) {
    return false
  }
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString('utf8').trim()
  try {
    const access = { repository: GITHUB_REPOSITORY, token: GITHUB_TOKEN }
    const verified = await isVerifiedTree(access, CI_HEAD_REF, tree)
    if (verified) console.log(`Tree ${tree} already passed its pull request's CI`)
    return verified
  } catch (error) {
    // A failed lookup only costs the full run.
    console.log(`Could not look up a verified tree: ${String(error)}`)
    return false
  }
}
