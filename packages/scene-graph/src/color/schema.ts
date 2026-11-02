import * as v from 'valibot'

import { finiteNumberSchema } from '../primitives/schema'

export const colorSchema = v.object({
  r: finiteNumberSchema,
  g: finiteNumberSchema,
  b: finiteNumberSchema,
  a: finiteNumberSchema
})
