import { appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { releaseTagSchema, releaseVersionSchema } from '#release/version'
import * as v from 'valibot'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { releaseCommands } from '../native/commands.ts'
import { commitSchema } from '../native/context.ts'
import { chromiumBuilds } from './catalog.ts'
import { assertChromiumSource } from './source.ts'

// Without a tag the run only builds, for testing; with one it publishes onto that release.
const tag = v.parse(v.optional(releaseTagSchema), process.env.RELEASE_TAG || undefined)
const root = await resolveWorkspaceRoot(process.cwd())
const { git } = releaseCommands(root)

const config = v.parse(
  v.pipe(v.string(), v.parseJson(), v.object({ version: releaseVersionSchema })),
  await readFile(join(root, 'desktop/tauri.conf.json'), 'utf8')
)
const source = v.parse(commitSchema, await git('rev-parse', 'HEAD'))

let tagCommit = ''
if (tag) {
  await git(
    'fetch',
    '--no-tags',
    'origin',
    `+refs/tags/${tag}:refs/tags/${tag}`,
    '+refs/heads/master:refs/remotes/origin/master'
  )
  tagCommit = v.parse(commitSchema, await git('rev-parse', `refs/tags/${tag}^{commit}`))
  assertChromiumSource({
    configVersion: config.version,
    tag,
    tagCommit,
    masterBase: await git('merge-base', 'HEAD', 'refs/remotes/origin/master')
  })
}

const output = process.env.GITHUB_OUTPUT
if (!output) throw new Error('Missing GITHUB_OUTPUT')

await appendFile(
  output,
  [
    `version=${config.version}`,
    `source=${source}`,
    `tag-commit=${tagCommit}`,
    `matrix=${JSON.stringify({ include: chromiumBuilds })}`,
    ''
  ].join('\n')
)

console.log(
  `OpenPencil Chromium ${config.version} from ${source}${tag ? `, for ${tag}` : ', build only'}`
)
