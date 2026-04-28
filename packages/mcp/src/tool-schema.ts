import { z } from 'zod'

import type { ParamDef, ParamType } from '@open-pencil/core/tools'

export function paramToZod(param: ParamDef): z.ZodType {
  const typeMap: Record<ParamType, () => z.ZodType> = {
    string: () =>
      param.enum
        ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
        : z.string().describe(param.description),
    number: () => {
      let schema = z.coerce.number()
      if (param.min !== undefined) schema = schema.min(param.min)
      if (param.max !== undefined) schema = schema.max(param.max)
      return schema.describe(param.description)
    },
    boolean: () => z.boolean().describe(param.description),
    color: () => z.string().describe(param.description),
    'string[]': () => z.array(z.string()).min(1).describe(param.description),
  }

  const schema = typeMap[param.type]()
  return param.required ? schema : schema.optional()
}
