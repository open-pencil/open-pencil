import * as v from 'valibot'

export async function responseJSON<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> {
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
}
