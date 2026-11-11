import type { AutomationDocumentSummary } from '@open-pencil/core/rpc'

import { rpc } from '#cli/app/client'
import { printError } from '#cli/format'

/** The document and page the running app resolved for a command. */
export type AppTarget = {
  documentId: string
  documentName: string
  path?: string
  pageId: string
  pageName: string
}

export type AppTargetCLIArgs = {
  'document-id'?: string
  'page-id'?: string
}

/** A page named by `--page` or by `--page-id`, as a command that runs on one page takes it. */
export type PageCLIArgs = AppTargetCLIArgs & { page?: string }

/** A page `--page` names by its name, or `--page-id` by its ID. */
export type RequestedPage = { name: string } | { id: string }

export type AppTargetRPCArgs = {
  document_id?: string
  page_id?: string
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

/**
 * The app target options plus `--page`, for a command that runs on one page of a file or of the
 * running app alike; `fallback` is what the command reads without either page option.
 */
export function pageOptions(fallback: string) {
  return {
    ...appTargetOptions,
    page: {
      type: 'string',
      description: `Page name (default: ${fallback})`,
      required: false
    },
    'page-id': {
      type: 'string',
      description: `Page ID, as \`openpencil pages\` lists it (default: ${fallback})`,
      required: false
    }
  } as const
}

/** The page `--page` or `--page-id` names; passing both is an error. */
export function requestedPage(args: PageCLIArgs): RequestedPage | undefined {
  if (args.page && args['page-id']) {
    printError('--page and --page-id cannot be used together.')
    process.exit(1)
  }
  if (args['page-id']) return { id: args['page-id'] }
  if (args.page) return { name: args.page }
  return undefined
}

export function appTargetRPCArgs(args: AppTargetCLIArgs): AppTargetRPCArgs {
  const target: AppTargetRPCArgs = {}
  if (args['document-id']) target.document_id = args['document-id']
  if (args['page-id']) target.page_id = args['page-id']
  return target
}

/** The app addresses pages by ID, so a `--page` name is looked up in the target document. */
async function appPageId(documentId: string | undefined, pageName: string): Promise<string> {
  const { documents } = await rpc<{ documents: AutomationDocumentSummary[] }>('list_documents')
  const document = documents.find((doc) => (documentId ? doc.id === documentId : doc.active))
  if (!document) {
    printError(documentId ? `Document "${documentId}" not found.` : 'No active document.')
    process.exit(1)
  }
  const page = document.pages.find((candidate) => candidate.name === pageName)
  if (!page) {
    const available = document.pages.map((candidate) => `"${candidate.name}"`).join(', ')
    printError(`Page "${pageName}" not found. Available pages: ${available || 'none'}.`)
    process.exit(1)
  }
  return page.id
}

/** The app target of a command that takes `--page` or `--page-id`, with a page name made an ID. */
export async function appPageTargetRPCArgs(args: PageCLIArgs): Promise<AppTargetRPCArgs> {
  const target = appTargetRPCArgs(args)
  const page = requestedPage(args)
  if (page && 'name' in page) target.page_id = await appPageId(args['document-id'], page.name)
  return target
}
