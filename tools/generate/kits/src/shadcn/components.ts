/** The shadcn CLI that installs the kit; its registry serves the components as of the build. */
export const SHADCN_CLI = 'shadcn@4.23.1'

/** Where the documentation of shadcn/ui's Radix components is, one Markdown page each. */
export const SHADCN_DOCS = 'https://ui.shadcn.com/docs/components/radix'

/** The shadcn/ui components the kit draws, which the CLI installs with what they use. */
export const SHADCN_COMPONENTS = [
  'accordion',
  'alert',
  'avatar',
  'badge',
  'button',
  'card',
  'checkbox',
  'collapsible',
  'input',
  'kbd',
  'label',
  'progress',
  'radio-group',
  'separator',
  'skeleton',
  'slider',
  'switch',
  'tabs',
  'textarea',
  'toggle',
  'toggle-group',
  // Its provider wraps the page, as an app wraps itself, for the examples that show tooltips.
  'tooltip'
]
