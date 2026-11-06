import { writeFile } from 'node:fs/promises'

/**
 * The Worker's secrets as wrangler's `--secrets-file` takes them: each named environment variable
 * by its name. A secret the environment lacks or leaves empty is an error, not an empty secret.
 */
export function workerSecrets(names: string[], env: NodeJS.ProcessEnv): Record<string, string> {
  if (names.length === 0) throw new Error('Name at least one secret')
  const missing = names.filter((name) => !env[name])
  if (missing.length > 0) throw new Error(`Missing secrets: ${missing.join(', ')}`)
  return Object.fromEntries(names.map((name) => [name, env[name] ?? '']))
}

/** Writes the secrets file readable only by its owner. */
export async function writeWorkerSecrets(
  path: string,
  names: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  await writeFile(path, JSON.stringify(workerSecrets(names, env)), { mode: 0o600 })
}

if (import.meta.main) {
  const [path, ...names] = process.argv.slice(2)
  if (!path) throw new Error('Usage: secrets.ts <file> <NAME>...')
  await writeWorkerSecrets(path, names)
}
