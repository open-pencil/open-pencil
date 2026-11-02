import * as v from 'valibot'

/** The `meta.json` Figma's "Save local copy…" writes: these keys, and only these. */
export const figArchiveMetaSchema = v.strictObject({
  client_meta: v.strictObject({
    background_color: v.strictObject({
      r: v.number(),
      g: v.number(),
      b: v.number(),
      a: v.number()
    }),
    thumbnail_size: v.strictObject({ width: v.number(), height: v.number() }),
    render_coordinates: v.strictObject({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number()
    })
  }),
  file_name: v.string(),
  developer_related_links: v.array(v.unknown()),
  exported_at: v.pipe(v.string(), v.isoTimestamp())
})
export type FigArchiveMetaJSON = v.InferOutput<typeof figArchiveMetaSchema>
