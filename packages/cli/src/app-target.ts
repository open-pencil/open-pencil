export type AppTargetCLIArgs = {
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

export function appTargetRPCArgs(args: AppTargetCLIArgs): {
  document_id?: string
  page_id?: string
} {
  const target: { document_id?: string; page_id?: string } = {}
  if (args['document-id']) target.document_id = args['document-id']
  if (args['page-id']) target.page_id = args['page-id']
  return target
}
