import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Where the copied shadcn/ui sources live, beside the tool's own. */
export const SHADCN_UPSTREAM = dirname(
  fileURLToPath(import.meta.resolve('#upstream/shadcn/index.css'))
)

/** The shadcn/ui components the kit draws; `sources.ts` copies these and what they use. */
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
  'toggle-group'
]
