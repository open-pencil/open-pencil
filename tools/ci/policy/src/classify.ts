import { execFileSync } from 'node:child_process'
import { appendFile } from 'node:fs/promises'

import { cloudInputs } from './cloud-inputs'
import { classifyPaths } from './policy'
import { isVerifiedTree } from './verified-tree/status'

const base = comparisonBase()
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
// The workflow runs this from the repository root, before dependencies are installed. Manifests
// that can't be read, such as a broken package.json, run the Cloud checks rather than skip them.
const inputs = await cloudInputs(process.cwd()).catch((error: unknown) => {
  console.log(`Could not read the Cloud inputs, so the Cloud checks run: ${String(error)}`)
  return 'all' as const
})
const scope = (await queuedTreeVerified()) ? 'verified' : classifyPaths(paths, inputs)
await appendFile(output, `scope=${scope}\n`)
console.log(`Selected ${scope} checks for ${paths.length} changed paths`)

/**
 * The commit a change is measured from. A pull request checks out GitHub's merge of it into the
 * base branch as it is now, so that merge's first parent is the base. The event's `base.sha` can
 * be older when the base branch moved, which would count the base's newer commits as the pull
 * request's own. The merge queue's `base_sha` is exact.
 */
function comparisonBase(): string | undefined {
  if (process.env.CI_EVENT !== 'pull_request') return process.env.CI_BASE_SHA
  const parents = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'])
    .toString('utf8')
    .trim()
    .split(' ')
  return parents.length === 3 ? parents[1] : process.env.CI_BASE_SHA
}

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
