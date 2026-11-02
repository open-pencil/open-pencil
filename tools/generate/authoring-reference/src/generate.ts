import { writeReferences } from '#authoring-reference/artifacts'

import { resolveWorkspaceRoot } from '@lawha/package-artifacts-tools'

await writeReferences(await resolveWorkspaceRoot(process.cwd()))
