import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { assembleUnreleased, readFragments, removeFragments } from './fragments'
import { validateChangelog } from './validate'

const root = resolve(process.argv[2] ?? '.')
const changelogPath = resolve(root, 'CHANGELOG.md')
const changesPath = resolve(root, 'changes')

const { fragments, errors } = await readFragments(changesPath)
if (errors.length > 0) {
  process.stderr.write(`Fix these fragments first:\n${errors.map((e) => `- ${e}`).join('\n')}\n`)
  process.exit(1)
}

const assembled = assembleUnreleased(await readFile(changelogPath, 'utf8'), fragments)
const { errors: changelogErrors } = validateChangelog(assembled)
if (changelogErrors.length > 0) {
  process.stderr.write(
    `The assembled changelog is invalid:\n${changelogErrors.map((e) => `- ${e}`).join('\n')}\n`
  )
  process.exit(1)
}

await writeFile(changelogPath, assembled)
await removeFragments(changesPath, fragments)
process.stdout.write(
  `Moved ${fragments.length} fragments from ${new Set(fragments.map((f) => f.source)).size} pull requests into Unreleased. Curate the section before the release commit.\n`
)
