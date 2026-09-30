import { staleReferences } from '#authoring-reference/artifacts'
import dedent from 'dedent'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const stale = await staleReferences(await resolveWorkspaceRoot(process.cwd()))
if (stale.length > 0) {
  console.error(dedent`
Stale authoring references:
${stale.join('\n')}
Run bun run generate:authoring-reference.
  `)
  process.exitCode = 1
}
