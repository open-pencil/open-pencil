import { appendFile } from 'node:fs/promises'

import * as v from 'valibot'

import { runCommand } from '@open-pencil/package-artifacts-tools'

import { isCloudTarget, isOnMaster, refusal, type CloudTarget } from './ref'

/** The environment whose deployments say what staging runs. */
const STAGING_ENVIRONMENT = 'cloud-staging'

const deploymentsSchema = v.array(v.object({ id: v.number(), sha: v.string() }))
const statusesSchema = v.array(v.object({ state: v.string() }))

/** Reads one GitHub REST path as JSON. */
export type GitHubGet = (path: string) => Promise<unknown>

export type DeployCommitOptions = {
  /** The commit the run was started from. */
  dispatched: string
  /** Redeploy what production serves instead of promoting staging: maintenance, or ending it. */
  keep: boolean
  github: GitHubGet
  /** The commit a target's Worker serves, from the tag each deploy gives it; none before tags. */
  serving: (target: CloudTarget) => Promise<string | undefined>
}

/**
 * The commit a target deploys. Staging deploys the commit it was started from. Production
 * promotes what staging runs: the commit of staging's newest deployment, once that deployment
 * succeeded, so nothing reaches production that has not served from staging first.
 *
 * Taking production off the air for a restore, and putting it back, must not wait on staging, so
 * those runs keep production's commit: the one its Worker serves, or, for a Worker deployed before
 * deploys were tagged, the one the run was started from.
 */
export async function deployCommit(
  target: CloudTarget,
  { dispatched, keep, github, serving }: DeployCommitOptions
): Promise<string> {
  if (target === 'staging') return dispatched
  if (keep) return (await serving('production')) ?? dispatched
  const get = github
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
  // A rollback in Cloudflare leaves GitHub's record behind, so staging must serve what it names.
  const staged = await serving('staging')
  if (staged !== newest.sha) {
    throw new Error(
      `Staging serves ${staged ?? 'an untagged version'}, not ${newest.sha} that its newest deployment names; deploy staging again`
    )
  }
  return newest.sha
}

const deploymentStatusSchema = v.object({
  versions: v.array(v.object({ version_id: v.string(), percentage: v.number() }))
})
const versionSchema = v.object({
  annotations: v.optional(v.object({ 'workers/tag': v.optional(v.string()) }))
})
const jsonSchema = v.pipe(v.string(), v.parseJson())

/**
 * The commit a Worker serves: the tag of the version its current deployment sends every request
 * to, or undefined for a version deployed before deploys were tagged. A gradual rollout that
 * splits traffic serves no one commit, which is an error rather than a fallback.
 */
export async function servingCommit(
  config: string,
  cwd: string,
  execute = runCommand
): Promise<string | undefined> {
  const wrangler = async (...args: string[]) =>
    v.parse(
      jsonSchema,
      (await execute({ command: 'bunx', args: ['wrangler', ...args, '--json', '-c', config], cwd }))
        .stdout
    )
  const { versions } = v.parse(deploymentStatusSchema, await wrangler('deployments', 'status'))
  const [only] = versions
  if (versions.length !== 1 || !only || only.percentage !== 100) {
    throw new Error(
      `${config} splits traffic between versions; finish or roll back that rollout first`
    )
  }
  const version = v.parse(versionSchema, await wrangler('versions', 'view', only.version_id))
  return version.annotations?.['workers/tag']
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
  const {
    GITHUB_OUTPUT,
    GITHUB_REF,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    GITHUB_TOKEN,
    MAINTENANCE,
    REDEPLOY
  } = process.env
  if (!GITHUB_OUTPUT || !GITHUB_REF || !GITHUB_REPOSITORY || !GITHUB_SHA || !GITHUB_TOKEN) {
    throw new Error('Run commit.ts <target> in a workflow step, with GITHUB_TOKEN set')
  }
  const refused = refusal(target, GITHUB_REF)
  if (refused || !isCloudTarget(target)) throw new Error(refused)
  const commit = await deployCommit(target, {
    dispatched: GITHUB_SHA,
    keep: MAINTENANCE === 'true' || REDEPLOY === 'true',
    github: gitHubGet(GITHUB_REPOSITORY, GITHUB_TOKEN),
    serving: (served) =>
      servingCommit(`packages/cloud/deploy/openpencil/${served}/wrangler.jsonc`, process.cwd())
  })
  if (!(await isOnMaster(process.cwd(), commit))) {
    throw new Error(`${commit} is not on master`)
  }
  await appendFile(GITHUB_OUTPUT, `commit=${commit}\n`)
  console.log(`Deploying ${commit} to ${target}`)
}
