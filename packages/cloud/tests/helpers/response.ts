import * as v from 'valibot'

/** A response's body through `schema`: a `Response`, or what a typed Hono client answers. */
export async function responseJSON<TSchema extends v.GenericSchema>(
  response: Pick<Response, 'text'>,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> {
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
}
