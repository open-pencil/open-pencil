import { writeReferences } from '#authoring-reference/artifacts'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

await writeReferences(await resolveWorkspaceRoot(process.cwd()))
