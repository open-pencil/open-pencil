import dedent from 'dedent'

import authoring from './reference/authoring.md?raw'
import { AUTHORING_EXAMPLES } from './reference/examples'
import {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_HELPERS,
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES
} from './schema'

export { AUTHORING_EXAMPLES, type AuthoringExample } from './reference/examples'

/** Canonical scene-authoring guidance shared by runtime prompts and generated skill references. */
export const JSX_REFERENCE = [
  authoring.trim(),
  ...AUTHORING_EXAMPLES.map(
    ({ title, jsx }) => dedent`
## ${title}

\`\`\`jsx
${jsx}
\`\`\`
`
  ),
  '## Supported syntax inventory',
  'Generated from the renderer metadata. This inventory lists accepted names, not arbitrary browser CSS support.',
  `**Elements:** ${DESIGN_JSX_ELEMENTS.map(({ name }) => `\`${name}\``).join(', ')}.`,
  `**Helpers:** ${DESIGN_JSX_HELPERS.map(({ name }) => `\`${name}\``).join(', ')}.`,
  `**Properties:** ${DESIGN_JSX_SUPPORTED_PROPERTY_NAMES.map((name) => `\`${name}\``).join(', ')}.`
].join('\n\n')
