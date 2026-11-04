import { getExportBytes, saveExportedFile } from '@/app/document/export/files'
import { downloadBlob } from '@/app/document/io/browser'

import { diagnosticsEnvironment } from './environment'
import { diagnostics } from './recorder'

/** Saves the diagnostics report Copy diagnostics copies; `false` means the person cancelled. */
export async function saveDiagnosticsReport(): Promise<boolean> {
  return saveExportedFile(
    getExportBytes(await diagnostics.export(diagnosticsEnvironment())),
    'OpenPencil diagnostics.json',
    'JSON',
    '.json',
    'application/json',
    downloadBlob
  )
}
