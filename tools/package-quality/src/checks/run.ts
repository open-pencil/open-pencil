import { CommandError, runCommand, type CommandRequest } from '@open-pencil/package-artifacts'

/** Finish independent package checks, then report every failure with captured diagnostics. */
export async function runPackageChecks(
  requests: CommandRequest[],
  execute: typeof runCommand = runCommand
): Promise<void> {
  const failures: Error[] = []
  for (const request of requests) {
    try {
      await execute(request)
    } catch (error) {
      if (error instanceof CommandError) {
        failures.push(
          new Error([error.message, error.stdout, error.stderr].filter(Boolean).join('\n'))
        )
      } else {
        failures.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message).join('\n\n'))
  }
}
