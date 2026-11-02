import * as v from 'valibot'

export const fitInputSchema = v.optional(
  v.pipe(
    v.picklist(['contain', 'cover']),
    v.description(
      'contain: scale the design to fit entirely inside (may leave margins). cover: scale to fill, cropping the overflow. Default contain.'
    )
  ),
  'contain'
)
