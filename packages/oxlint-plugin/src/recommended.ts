import type { OxlintConfig } from 'oxlint'

// Typed by recommended.d.json.ts.
import config from '../recommended.json' with { type: 'json' }

/**
 * The configuration OpenPencil's repositories extend, for `oxlint.config.ts`. It does not load the
 * plugins; list each `@open-pencil/oxlint-plugin/<domain>` in `jsPlugins` beside it.
 */
const recommended: OxlintConfig = config

export default recommended
