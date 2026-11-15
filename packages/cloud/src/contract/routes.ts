import type { TypedResponse } from 'hono'
import type { BlankInput, ToSchema } from 'hono/types'

/** A route's input, and the JSON it answers with a 200, as a contract's typed Hono schema names it. */
export type JSONRoute<
  Method extends string,
  Path extends string,
  Input extends BlankInput,
  Output
> = ToSchema<Method, Path, Input, TypedResponse<Output, 200, 'json'>>
