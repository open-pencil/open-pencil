import { resolve } from 'node:path'

import { validateChangelogFile } from './changelog'

const path = resolve(process.argv[2] ?? 'CHANGELOG.md')
const { errors } = await validateChangelogFile(path)

if (errors.length > 0) {
  process.stderr.write(
    `Changelog validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}\n`
  )
  process.exit(1)
}

process.stdout.write(`Changelog validation passed: ${path}\n`)
