import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import behavior from './system-prompt.md?raw'

/**
 * Chat and ACP share scene-authoring knowledge without copying the renderer reference. The
 * reference is joined verbatim: dedenting it would flatten its indented code examples.
 */
const SYSTEM_PROMPT = [behavior.trim(), JSX_REFERENCE].join('\n\n')

export default SYSTEM_PROMPT
