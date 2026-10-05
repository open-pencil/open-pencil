import { readFile } from 'node:fs/promises'

/** Read a text file, or standard input when the source is `-`. */
export async function readTextSource(source: string): Promise<string> {
  if (source !== '-') return readFile(source, 'utf-8')
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}
