import dedent from 'dedent'

import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import behavior from './system-prompt.md?raw'

/** Chat and ACP share scene-authoring knowledge without copying the renderer reference. */
const SYSTEM_PROMPT = dedent`
${behavior.trim()}

${JSX_REFERENCE}
`

export default SYSTEM_PROMPT
