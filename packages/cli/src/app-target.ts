export type AppTargetCliArgs = {
  'document-id'?: string
  'page-id'?: string
}

export const appTargetOptions = {
  'document-id': {
    type: 'string',
    description: 'Target OpenPencil document/tab ID when connected to the running app',
    required: false
  },
  'page-id': {
    type: 'string',
    description: 'Target page ID when connected to the running app',
    required: false
  }
} as const

export function appTargetRpcArgs(args: AppTargetCliArgs): {
  document_id?: string
  page_id?: string
} {
  return {
    ...(args['document-id'] ? { document_id: args['document-id'] } : {}),
    ...(args['page-id'] ? { page_id: args['page-id'] } : {})
  }
}
