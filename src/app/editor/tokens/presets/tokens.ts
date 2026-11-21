import {
  OPENPENCIL_EXTENSION,
  type DesignTokenGroup,
  type DesignTokenSourceFile
} from '@open-pencil/core/io/formats/design-tokens'
import type { VariableScope } from '@open-pencil/scene-graph'

/** A DTCG color: its space and components, such as `oklch` or `srgb`, `none` for no hue. */
export interface PresetColor {
  colorSpace: string
  components: (number | 'none')[]
}

/** OpenPencil's own fields on a token: its name, unit, scopes, and name in code. */
interface OwnFields {
  name?: string
  unit?: string
  scopes?: VariableScope[]
  /** The CSS that names the token in the framework, such as `var(--color-red-500)`. */
  web?: string
}

/** Where padding, gaps, and sizes offer spacing tokens. */
export const SPACING_SCOPES: VariableScope[] = ['GAP', 'WIDTH_HEIGHT']

/** A preset as one design token file: a collection of one mode holding `groups`. */
export function presetTokenFile(
  collection: string,
  description: string,
  groups: DesignTokenGroup
): DesignTokenSourceFile[] {
  const document: DesignTokenGroup = {
    $description: description,
    $extensions: { [OPENPENCIL_EXTENSION]: { collection, mode: 'Default' } },
    ...groups
  }
  return [{ path: `${collection.toLowerCase()}.tokens.json`, text: JSON.stringify(document) }]
}

export function colorToken(value: PresetColor | string, web?: string): DesignTokenGroup {
  return { $type: 'color', $value: value, ...ownExtension({ web }) }
}

/** A token whose value is another's, by its DTCG path, such as `color.blue.500`. */
export function aliasToken(path: string, web?: string): DesignTokenGroup {
  return { $type: 'color', $value: `{${path}}`, ...ownExtension({ web }) }
}

/** A spacing step named `spacing/<step>`, offered for gaps, padding, and sizes. */
export function spacingToken(
  step: string,
  value: { value: number; unit: 'px' | 'rem' },
  web?: string
): DesignTokenGroup {
  return {
    $type: 'dimension',
    $value: value,
    ...ownExtension({ name: `spacing/${step}`, unit: value.unit, scopes: SPACING_SCOPES, web })
  }
}

/** A DTCG key cannot hold a dot, so a step such as `0.5` is keyed `0_5` and named apart. */
export function stepKey(step: string): string {
  return step.replace('.', '_')
}

function ownExtension({ web, ...fields }: OwnFields): DesignTokenGroup {
  const own = { ...fields, ...(web ? { codeSyntax: { WEB: web } } : {}) }
  if (Object.keys(own).length === 0) return {}
  return { $extensions: { [OPENPENCIL_EXTENSION]: own } }
}
