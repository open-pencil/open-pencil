import * as v from 'valibot'

export const webmcpModeSchema = v.picklist(['off', 'inspect', 'edit'])
export type WebMCPMode = v.InferOutput<typeof webmcpModeSchema>
