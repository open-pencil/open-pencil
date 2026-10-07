import { execFileSync } from 'node:child_process'

import { recordVerifiedTree } from './verified-tree'

// Runs in the CI result job after the gate passed on a pull request, from its merge checkout.
const { CI_HEAD_SHA, GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env
if (!CI_HEAD_SHA || !GITHUB_REPOSITORY || !GITHUB_TOKEN) {
  throw new Error('Missing pull request head or token')
}
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString('utf8').trim()
await recordVerifiedTree({ repository: GITHUB_REPOSITORY, token: GITHUB_TOKEN }, CI_HEAD_SHA, tree)
console.log(`Recorded that ${CI_HEAD_SHA} passed CI on tree ${tree}`)
