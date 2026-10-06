import { rpcResponse } from '#cli/app/client'
import type { AppTarget } from '#cli/app/target'
import { entity, fmtList, printError } from '#cli/format'

function targetDetails(target: AppTarget): Record<string, string> {
  return {
    document: entity('document', target.documentName, target.documentId),
    page: `${target.pageName} (${target.pageId})`,
    ...(target.path ? { path: target.path } : {})
  }
}

/**
 * Send one command to the running app and print its outcome: the whole response with
 * `--json`, otherwise `message(result)` followed by the document it ran against.
 */
export async function runAppCommand(
  command: string,
  args: Record<string, unknown>,
  options: { json?: boolean; message: (result: unknown) => string }
): Promise<void> {
  try {
    const response = await rpcResponse(command, args)
    if (options.json) {
      console.log(JSON.stringify(response, null, 2))
      return
    }
    const header = options.message(response.result)
    const details = response.target ? targetDetails(response.target) : undefined
    console.log('')
    console.log(fmtList([{ header, details }], { compact: true }))
    console.log('')
  } catch (error) {
    printError(error)
    process.exit(1)
  }
}
