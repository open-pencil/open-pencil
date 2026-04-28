import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep as osSep } from 'node:path'

import { ok } from './result'

import type { MCPResult } from './result'

export function resolveSafePath(filePath: string, root: string): string {
  const resolved = resolve(filePath)
  const sep = root.endsWith('/') || root.endsWith('\\') ? '' : osSep
  if (!resolved.startsWith(root + sep) && resolved !== root) {
    throw new Error(`Path is outside the allowed root: ${root}`)
  }
  return resolved
}

export async function writeToolOutput(
  toolName: string,
  result: Record<string, unknown>,
  filePath: string,
  root: string,
): Promise<MCPResult | null> {
  const resolved = resolveSafePath(filePath, root)
  await mkdir(dirname(resolved), { recursive: true })
  if (toolName === 'export_svg' && typeof result.svg === 'string') {
    await writeFile(resolved, result.svg, 'utf8')
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.svg, 'utf8') })
  }
  if (toolName === 'export_image' && typeof result.base64 === 'string') {
    await writeFile(resolved, Buffer.from(result.base64, 'base64'))
    return ok({ written: resolved, byteLength: result.byteLength ?? null })
  }
  if (toolName === 'get_jsx' && typeof result.jsx === 'string') {
    await writeFile(resolved, result.jsx, 'utf8')
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.jsx, 'utf8') })
  }
  return null
}
