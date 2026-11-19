import { DESIGN_JSX_SUPPORTED_PROPERTY_NAMES } from '../definitions'
import { DESIGN_JSX_ELEMENTS } from '../elements'
import { DESIGN_JSX_HELPERS } from '../helpers'
import authoring from './authoring.md?raw'
import { AUTHORING_EXAMPLES } from './examples'

export { AUTHORING_EXAMPLES, type AuthoringExample } from './examples'

/** Canonical scene-authoring guidance shared by runtime prompts and generated skill references. */
export const JSX_REFERENCE = [
  authoring.trim(),
  // Examples are written verbatim; dedenting them again would flatten their nesting.
  ...AUTHORING_EXAMPLES.map(({ title, jsx }) => `## ${title}\n\n\`\`\`jsx\n${jsx}\n\`\`\``),
  '## Supported syntax inventory',
  'Generated from the renderer metadata. This inventory lists accepted names, not arbitrary browser CSS support.',
  `**Elements:** ${DESIGN_JSX_ELEMENTS.map(({ name }) => `\`${name}\``).join(', ')}.`,
  `**Helpers:** ${DESIGN_JSX_HELPERS.map(({ name }) => `\`${name}\``).join(', ')}.`,
  `**Properties:** ${DESIGN_JSX_SUPPORTED_PROPERTY_NAMES.map((name) => `\`${name}\``).join(', ')}.`
].join('\n\n')
