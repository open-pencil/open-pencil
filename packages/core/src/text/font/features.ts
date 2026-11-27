import { getParsedFont } from './glyphs'

/** An OpenType feature a face offers, with the name the face gives it, if it names it. */
export interface FontFeatureInfo {
  tag: string
  name: string | null
}

const TABLES = ['GSUB', 'GPOS'] as const

/** The name the face gives a feature, as its stylistic sets and character variants carry one. */
function featureName(
  parsed: NonNullable<ReturnType<typeof getParsedFont>>,
  table: (typeof TABLES)[number],
  index: number
): string | null {
  const nameId = parsed.face.getFeatureNameIds(table, index)?.uiLabelNameId
  if (nameId === undefined) return null
  const languages = parsed.face
    .listNames()
    .filter((entry) => entry.nameId === nameId)
    .map((entry) => entry.language)
  const language = languages.find((code) => code.startsWith('en')) ?? languages.at(0)
  const name = language === undefined ? '' : parsed.face.getName(nameId, language).trim()
  return name || null
}

/** Features a face can name for its users: stylistic sets and character variants. */
const NAMED_FEATURE = /^(?:ss|cv)\d\d$/

/**
 * The OpenType features a loaded face offers, each once, in the order its tables list them, as
 * Figma lists a font's features; null while the face or HarfBuzz is not loaded.
 */
export function fontFeaturesSync(family: string, style: string): FontFeatureInfo[] | null {
  const parsed = getParsedFont(family, style)
  if (!parsed) return null
  // A feature listed for several scripts, or in both tables, is one feature with one name.
  const byTag = new Map<string, FontFeatureInfo>()
  for (const table of TABLES) {
    for (const [index, tag] of parsed.face.getTableFeatureTags(table).entries()) {
      const known = byTag.get(tag)
      if (known?.name || (known && !NAMED_FEATURE.test(tag))) continue
      const name = NAMED_FEATURE.test(tag) ? featureName(parsed, table, index) : null
      if (known) known.name = name
      else byTag.set(tag, { tag, name })
    }
  }
  return [...byTag.values()]
}
