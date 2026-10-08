import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import codegen from './codegen.md?raw'

/**
 * Keep frontend-code generation instructions distinct from scene-authoring syntax. The
 * reference is joined verbatim: dedenting it would flatten its indented code examples.
 */
export const CODEGEN_PROMPT = [codegen.trim(), JSX_REFERENCE].join('\n\n')
