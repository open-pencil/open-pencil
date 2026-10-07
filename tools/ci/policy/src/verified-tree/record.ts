import { execFileSync } from 'node:child_process'

import { recordVerifiedTree } from './status'

// Runs in the CI result job after the gate passed on a pull request, from its merge checkout.
const { CI_HEAD_SHA, CI_RUN_URL, GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env
if (!CI_HEAD_SHA || !CI_RUN_URL || !GITHUB_REPOSITORY || !GITHUB_TOKEN) {
  throw new Error('Missing pull request head, run URL, or token')
}
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString('utf8').trim()
const access = { repository: GITHUB_REPOSITORY, token: GITHUB_TOKEN }
await recordVerifiedTree(access, CI_HEAD_SHA, tree, CI_RUN_URL)
console.log(`Recorded that ${CI_HEAD_SHA} passed CI on tree ${tree}`)
