import type { Context } from 'hono'
import { validator } from 'hono/validator'
import { ValiError } from 'valibot'

export function validatedJSON<T>(parse: (input: unknown) => T) {
  return validator('json', (value, context: Context) => {
    try {
      return parse(value)
    } catch (error) {
      if (error instanceof ValiError) {
        return context.json({ error: { code: 'invalid_request' as const } }, 400)
      }
      throw error
    }
  })
}
