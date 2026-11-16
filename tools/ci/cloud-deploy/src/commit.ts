import { appendFile } from 'node:fs/promises'

import * as v from 'valibot'

import { isCloudTarget, isOnMaster, refusal, type CloudTarget } from './ref'

/** The environment whose deployments say what staging runs. */
const STAGING_ENVIRONMENT = 'cloud-staging'

const deploymentsSchema = v.array(v.object({ id: v.number(), sha: v.string() }))
const statusesSchema = v.array(v.object({ state: v.string() }))

/** Reads one GitHub REST path as JSON. */
export type GitHubGet = (path: string) => Promise<unknown>

/**
 * The commit a target deploys. Staging deploys the commit it was started from. Production
 * promotes what staging runs: the commit of staging's newest deployment, once that deployment
 * succeeded, so nothing reaches production that has not served from staging first.
 */
export async function deployCommit(
  target: CloudTarget,
  dispatched: string,
  get: GitHubGet
): Promise<string> {
  if (target === 'staging') return dispatched
  const [newest] = v.parse(
    deploymentsSchema,
    await get(`deployments?environment=${STAGING_ENVIRONMENT}&per_page=1`)
  )
  if (!newest) throw new Error('Staging has never been deployed; deploy it first')
  // Statuses come newest first: a deployment that is waiting, running, or failed is not one to promote.
  const [status] = v.parse(
    statusesSchema,
    await get(`deployments/${newest.id}/statuses?per_page=1`)
  )
  if (status?.state !== 'success') {
    throw new Error(
      `Staging's newest deployment, of ${newest.sha}, is ${status?.state ?? 'without a status'}; wait for it to succeed or deploy staging again`
    )
  }
  return newest.sha
}

/** A `GitHubGet` for this repository through the REST API, with the workflow's token. */
export function gitHubGet(repository: string, token: string): GitHubGet {
  return async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`)
    return (await response.json()) as unknown
  }
}

/**
 * Run with the dispatched ref's own checkout, so the rules that apply are this workflow's even
 * when production promotes an older commit whose tooling had others.
 */
if (import.meta.main) {
  const [target = ''] = process.argv.slice(2)
  const { GITHUB_OUTPUT, GITHUB_REF, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_TOKEN } = process.env
  if (!GITHUB_OUTPUT || !GITHUB_REF || !GITHUB_REPOSITORY || !GITHUB_SHA || !GITHUB_TOKEN) {
    throw new Error('Run commit.ts <target> in a workflow step, with GITHUB_TOKEN set')
  }
  const refused = refusal(target, GITHUB_REF)
  if (refused || !isCloudTarget(target)) throw new Error(refused)
  const commit = await deployCommit(target, GITHUB_SHA, gitHubGet(GITHUB_REPOSITORY, GITHUB_TOKEN))
  if (!(await isOnMaster(process.cwd(), commit))) {
    throw new Error(`${commit} is not on master`)
  }
  await appendFile(GITHUB_OUTPUT, `commit=${commit}\n`)
  console.log(`Deploying ${commit} to ${target}`)
}
