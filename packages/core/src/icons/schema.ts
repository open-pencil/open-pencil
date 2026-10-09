import * as v from 'valibot'

/** One icon set in the Iconify catalogue, keeping only what pickers show. */
const CollectionInfo = v.object({
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
export const CollectionsJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.record(v.string(), CollectionInfo)
)

/** `GET /collection?prefix=…`: the names in one set, loose or by category. */
export const CollectionListJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    uncategorized: v.optional(v.array(v.string())),
    categories: v.optional(v.record(v.string(), v.array(v.string()))),
    hidden: v.optional(v.array(v.string()))
  })
)
