import { partition, uniq } from 'es-toolkit/array'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

import type {
  DesignTokenBundle,
  DesignTokenIssue,
  DesignTokenSourceFile
} from '@open-pencil/core/io/formats/design-tokens'

import { saveExportedFile } from '@/app/document/export/files'
import { downloadBlob } from '@/app/document/io/browser'
import type { EditorStore } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

/** Files a token import reads: JSON token files, or archives of them. */
export const DESIGN_TOKEN_FILE_ACCEPT = '.json,.tokens,.zip'

/**
 * Whether a file is a design token file by its name: the `.tokens` and `.tokens.json` token
 * files and the `.resolver.json` resolvers of the W3C format. Other JSON may be anything.
 */
export function isDesignTokenFileName(name: string): boolean {
  return /\.(tokens|tokens\.json|resolver\.json)$/i.test(name)
}

function isTokenFile(path: string): boolean {
  return /\.(json|tokens)$/i.test(path) && !path.split('/').some((part) => part.startsWith('.'))
}

function issueName(issue: DesignTokenIssue): string {
  if (issue.kind === 'unsupported-effect' || issue.kind === 'ambiguous-reference')
    return issue.style
  return issue.token
}

/** The W3C token reader and writer load with the first import or export. */
const loadDesignTokens = () => import('@open-pencil/core/io/formats/design-tokens')

/**
 * Saves the document's variables and styles as W3C design tokens: a zip of one file per
 * collection mode, the styles, and the resolver that combines them.
 */
export async function exportDesignTokenArchive(store: EditorStore): Promise<void> {
  const { exportDesignTokens } = await loadDesignTokens()
  const { files, issues } = exportDesignTokens(store.graph)
  const entries: Zippable = {}
  for (const file of files)
    entries[file.path] = strToU8(`${JSON.stringify(file.content, null, 2)}\n`)
  await saveExportedFile(
    zipSync(entries),
    `${store.state.documentName || 'Design'} tokens.zip`,
    'Design tokens',
    '.zip',
    'application/zip',
    downloadBlob
  )
  const [ambiguous, leftOut] = partition(issues, (issue) => issue.kind === 'ambiguous-reference')
  const names = (list: DesignTokenIssue[]) => uniq(list.map(issueName)).join(', ')
  if (leftOut.length > 0)
    toast.warning(notificationMessages.get().designTokensLeftOut({ names: names(leftOut) }))
  if (ambiguous.length > 0)
    toast.warning(notificationMessages.get().designTokensAmbiguous({ names: names(ambiguous) }))
}

/**
 * Picked files as token sources: JSON as it is, archives unpacked. A folder's files keep their
 * paths inside it, which is how a resolver's `$ref`s and per-folder collections find them.
 */
async function readDesignTokenFiles(files: readonly File[]): Promise<DesignTokenSourceFile[]> {
  const sources: DesignTokenSourceFile[] = []
  for (const file of files) {
    const path = file.webkitRelativePath || file.name
    if (/\.zip$/i.test(file.name)) {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => isTokenFile(entry.name)
      })
      for (const [name, bytes] of Object.entries(archive))
        sources.push({ path: name, text: strFromU8(bytes) })
    } else if (isTokenFile(path)) {
      sources.push({ path, text: await file.text() })
    }
  }
  return sources
}

/** What picked token files, folders, or archives of them would define in the document. */
export async function readDesignTokenImport(files: readonly File[]): Promise<DesignTokenBundle> {
  // Files that cannot be read leave the reader unloaded.
  const sources = await readDesignTokenFiles(files)
  const { readDesignTokens } = await loadDesignTokens()
  return readDesignTokens(sources)
}
