import * as v from 'valibot'

const cloudErrorResponseSchema = v.object({
  error: v.object({ code: v.string() })
})

/** The part of a fetch or Hono client response the client reads. */
export type CloudResponse = Pick<Response, 'ok' | 'status' | 'json'>

export type CloudClientDiagnostic = (message: string, error: unknown) => void

export class CloudAPIError extends Error {
  override readonly name = 'CloudAPIError'

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
  }
}

export async function responseBody(
  response: CloudResponse,
  onDiagnostic?: CloudClientDiagnostic
): Promise<unknown> {
  if (response.ok) return response.status === 204 ? null : response.json()
  let code: string | undefined
  try {
    const body = v.safeParse(cloudErrorResponseSchema, await response.json())
    if (body.success) code = body.output.error.code
  } catch (error) {
    onDiagnostic?.('Cloud API error response was not JSON', error)
  }
  throw new CloudAPIError(
    `OpenPencil Cloud request failed with HTTP ${response.status}`,
    response.status,
    code
  )
}

export async function parseResponse<
  TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
>(
  request: Promise<CloudResponse>,
  schema: TSchema,
  onDiagnostic?: CloudClientDiagnostic
): Promise<v.InferOutput<TSchema>> {
  return v.parse(schema, await responseBody(await request, onDiagnostic))
}

/**
 * The JSON a service deployed apart from Cloud answered, parsed with `schema` rather than trusted;
 * a refusal throws what `refused` makes of its status and body.
 */
export async function serviceJSON<TSchema extends v.GenericSchema>(
  response: Pick<Response, 'ok' | 'status' | 'text'>,
  schema: TSchema,
  refused: (status: number, body: string) => Error
): Promise<v.InferOutput<TSchema>> {
  if (!response.ok) {
    // An unreadable body still leaves the status, which callers tell refusals apart by.
    const body = await response.text().catch((failure: unknown) => {
      const error = refused(response.status, '')
      error.cause = failure
      throw error
    })
    throw refused(response.status, body)
  }
  return v.parse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
}
