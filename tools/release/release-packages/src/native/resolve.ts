import { appendFile } from 'node:fs/promises'

import * as v from 'valibot'

import { desktopBuilds } from './catalog.ts'
import { releaseCommands } from './commands.ts'
import { commitSchema, releaseVersion } from './context.ts'

const tag = process.env.RELEASE_TAG ?? ''
const version = releaseVersion(tag)
const { git } = releaseCommands(process.cwd())
const sourceCommit = v.parse(
  commitSchema,
  await git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
)

// Release signing/publishing never checks out a caller-supplied arbitrary branch.
await git('merge-base', '--is-ancestor', sourceCommit, 'origin/master')

const output = process.env.GITHUB_OUTPUT
if (!output) throw new Error('Missing GITHUB_OUTPUT')

await appendFile(
  output,
  [
    `tag=${tag}`,
    `version=${version}`,
    `source=${sourceCommit}`,
    `matrix=${JSON.stringify({ include: desktopBuilds })}`,
    ''
  ].join('\n')
)

console.log(`Release ${tag}: source ${sourceCommit}; workflow ${process.env.WORKFLOW_COMMIT}`)
