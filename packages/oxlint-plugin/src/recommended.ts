import type { OxlintConfig } from 'oxlint'

// Typed by recommended.d.json.ts.
import config from '../recommended.json' with { type: 'json' }

/**
 * The configuration OpenPencil's repositories extend, for `oxlint.config.ts`. It does not load the
 * plugin; add `jsPlugins: ['@open-pencil/oxlint-plugin']` beside it.
 */
const recommended: OxlintConfig = config

export default recommended
