import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/structure/story-titles'
const story = (title: string) => `export default { title: '${title}' }\n`

test('places Design System and App stories under a listed family or area, in Title Case', async () => {
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      {
        'src/Family.stories.ts': story('Design System/Feedback/Drop Overlay'),
        'src/Area.stories.ts': story('App/Cloud/Portal/Console'),
        'src/Minor.stories.ts': story('App/Cloud/Report a Shared File'),
        'src/Sdk.stories.ts': story('Vue SDK/BindableValue'),
        'src/Other.ts': story('App/Nowhere'),
        'src/Leaf.stories.ts': story('App/Document Viewer'),
        'src/Unlisted.stories.ts': story('App/Save To/Dialog'),
        'src/Lowercase.stories.ts': story('Design System/Lists/Data table'),
        // CSF metadata named and exported, as most stories do; a nested `title` is not a story's.
        'src/Named.stories.ts': `const meta = { title: 'App/Settings', args: { title: 'App/Settings' } } satisfies object\nexport default meta\n`,
        'src/Nested.stories.ts': `export default { title: 'App/Cloud/Portal', args: { title: 'App/Settings' } }\n`
      },
      { [rule]: 'error' }
    ),
    rule
  )
  expect(
    diagnostics.map((item) => `${item.filename?.split('/').pop()}: ${item.message}`).toSorted()
  ).toEqual([
    "Leaf.stories.ts: 'App/Document Viewer' needs an area and a component: 'App/<Area>/<Component>'.",
    "Lowercase.stories.ts: 'Design System/Lists/Data table' must be in Title Case.",
    "Named.stories.ts: 'App/Settings' needs an area and a component: 'App/<Area>/<Component>'.",
    expect.stringMatching(/^Unlisted.stories.ts: 'Save To' is not one of the App areas/)
  ])
})
