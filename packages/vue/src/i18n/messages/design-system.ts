import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Building a design system from the design. */
export const designSystemMessageDefaults = {
  section: 'Design system',
  build: 'Build design system',
  buildPage: 'From this page',
  buildSelection: 'From the selection',
  buildHint:
    'Turn the colours, type, spacing and radii in use into variables, link them to the layers and document them on a Design System page',
  done: params('{tokens} tokens created, {bound} layers linked'),
  duplicates: params('{count} near-duplicate colours found: their layers keep their own colour'),
  failed: params('Could not build the design system: {error}')
} as const

export const designSystemMessages = i18n('designSystem', designSystemMessageDefaults)
