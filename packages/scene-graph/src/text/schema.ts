import * as v from 'valibot'

/** A line height or letter spacing as files carry it: pixels, or a percent of the font size. */
export const textLengthSchema = v.object({
  value: v.number(),
  unit: v.picklist(['PIXELS', 'PERCENT'])
})
