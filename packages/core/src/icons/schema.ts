import * as v from 'valibot'

/** One icon set in the Iconify catalogue, keeping only what pickers show. */
const collectionInfoSchema = v.object({
  name: v.string(),
  total: v.number(),
  category: v.optional(v.string()),
  license: v.optional(v.object({ title: v.string() })),
  /** True for sets drawn in their own colors, which an icon color cannot change. */
  palette: v.optional(v.boolean()),
  /** Iconify lists retired sets for old links; pickers leave them out. */
  hidden: v.optional(v.boolean())
})

/** `GET /collections`: every set by prefix. */
export const collectionsSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.record(v.string(), collectionInfoSchema)
)

/** `GET /collection?prefix=…`: the names in one set, loose or by category. */
export const collectionListSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    uncategorized: v.optional(v.array(v.string())),
    categories: v.optional(v.record(v.string(), v.array(v.string()))),
    hidden: v.optional(v.array(v.string()))
  })
)

/** An icon's box and turn, as an icon, an alias, or a whole set gives them. */
const iconPropsEntries = {
  left: v.optional(v.number()),
  top: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  rotate: v.optional(v.number()),
  hFlip: v.optional(v.boolean()),
  vFlip: v.optional(v.boolean())
}

/**
 * `GET /{prefix}.json?icons=…`: the asked-for icons and the aliases that lead to them, with the
 * set's default box, which `getIconData` resolves into one icon.
 */
export const iconSetSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    prefix: v.string(),
    left: v.optional(v.number()),
    top: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    icons: v.record(v.string(), v.object({ body: v.string(), ...iconPropsEntries })),
    aliases: v.optional(v.record(v.string(), v.object({ parent: v.string(), ...iconPropsEntries })))
  })
)

export type IconSet = v.InferOutput<typeof iconSetSchema>
