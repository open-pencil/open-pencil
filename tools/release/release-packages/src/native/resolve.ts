import { appendFile } from 'node:fs/promises'

import { NIGHTLY_TAG } from '#release/version'
import * as v from 'valibot'

import { checkoutSources, planNightly } from '../nightly/plan.ts'
import { desktopBuilds } from './catalog.ts'
import { releaseCommands } from './commands.ts'
import { commitSchema, releaseVersion } from './context.ts'

/**
 * What the run builds: the release its tag names, or with `NIGHTLY=true` tonight's nightly of
 * master. `kind` tells later jobs which steps apply; `skip` ends a nightly with nothing new.
 */
const { git, github } = releaseCommands(process.cwd())
const output = process.env.GITHUB_OUTPUT
if (!output) throw new Error('Missing GITHUB_OUTPUT')

const nightly = process.env.NIGHTLY === 'true'
let plan: { kind: string; tag: string; version: string; source: string; skip: boolean }

if (nightly) {
  const repository = process.env.GITHUB_REPOSITORY ?? ''
  const { source, version, skip } = await planNightly(
    checkoutSources(git, github, repository),
    new Date()
  )
  plan = { kind: 'nightly', tag: NIGHTLY_TAG, version, source, skip }
} else {
  const tag = process.env.RELEASE_TAG ?? ''
  const version = releaseVersion(tag)
  const source = v.parse(
    commitSchema,
    await git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
  )
  // Release signing/publishing never checks out a caller-supplied arbitrary branch.
  await git('merge-base', '--is-ancestor', source, 'origin/master')
  plan = { kind: 'release', tag, version, source, skip: false }
}

await appendFile(
  output,
  [
    `kind=${plan.kind}`,
    `tag=${plan.tag}`,
    `version=${plan.version}`,
    `source=${plan.source}`,
    `skip=${plan.skip}`,
    `matrix=${JSON.stringify({ include: desktopBuilds })}`,
    ''
  ].join('\n')
)

console.log(
  plan.skip
    ? `Nightly: master is still ${plan.source}, which the last nightly built`
    : `${plan.kind} ${plan.version}: source ${plan.source}; workflow ${process.env.WORKFLOW_COMMIT}`
)
