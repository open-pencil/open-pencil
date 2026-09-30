import { mapAsync } from 'es-toolkit'

import { CommandError, runCommand, type CommandRequest } from '@open-pencil/package-artifacts-tools'

/** Drain every check before reporting failures, so callers can safely remove shared fixtures. */
export async function runPackageChecks(
  requests: CommandRequest[],
  execute: typeof runCommand = runCommand,
  concurrency = 1
): Promise<void> {
  const results = await mapAsync(
    requests,
    async (request) => {
      try {
        await execute(request)
        return undefined
      } catch (error) {
        if (error instanceof CommandError) {
          return new Error([error.message, error.stdout, error.stderr].filter(Boolean).join('\n'))
        }
        return error instanceof Error ? error : new Error(String(error))
      }
    },
    { concurrency }
  )
  const failures = results.filter((result) => result instanceof Error)
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message).join('\n\n'))
  }
}
