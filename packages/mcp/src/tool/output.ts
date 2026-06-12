import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, basename, isAbsolute, join, parse, resolve, sep as osSep } from 'node:path'

import { ok } from '#mcp/result'
import type { MCPResult } from '#mcp/result'

/**
 * Resolve a file path and verify it stays within the allowed root directory.
 * Uses fs.realpath to resolve symlinks for the security check, preventing
 * traversal attacks where a symlink inside root points outside root.
 * Returns the resolved (normalized) path for display and file operations.
 */

/** Walk up from `p` until we find a path that realpath() can resolve. */
async function resolveRealAncestor(
  p: string
): Promise<{ realAncestor: string; remainder: string }> {
  let current = resolve(p)
  let remainder = ''
  let iterations = 0
  do {
    try {
      const real = await realpath(current)
      return { realAncestor: real, remainder }
    } catch {
      const parent = dirname(current)
      if (parent === current) return { realAncestor: current, remainder }
      remainder = osSep + basename(current) + remainder
      current = parent
    }
    iterations++
  } while (iterations < 64) // depth limit to prevent infinite loops
  return { realAncestor: current, remainder }
}

export async function resolveSafePath(filePath: string, root: string): Promise<string> {
  // Reject trivially broad roots that would pass all containment checks.
  // On Unix, "/" matches every absolute path; on Windows, "\" or "C:\" are
  // equally broad. Without this guard, resolveSafePath("/", "/") succeeds
  // because every Unix path starts with "/".
  const normalizedRoot = resolve(root)
  const parsedRoot = parse(normalizedRoot).root
  if (normalizedRoot === '/' || normalizedRoot === osSep || normalizedRoot === parsedRoot) {
    throw new Error(
      `Root path is too broad: "${root}" (resolved to "${normalizedRoot}"). ` +
        'Specify a narrower OPENPENCIL_MCP_ROOT directory.'
    )
  }

  // Resolve relative paths from the validated server root, not from CWD.
  // This ensures that a relative export path like "output/image.png" is
  // anchored to OPENPENCIL_MCP_ROOT instead of the server's working directory.
  const resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(normalizedRoot, filePath)

  // Resolve root to its real (symlink-aware) canonical form.
  let realRoot: string
  try {
    realRoot = await realpath(root)
  } catch {
    const { realAncestor, remainder } = await resolveRealAncestor(root)
    realRoot = realAncestor + remainder
  }

  const realSep = realRoot.endsWith('/') || realRoot.endsWith('\\') ? '' : osSep

  // Resolve the file path to its real canonical form for security validation.
  let realPath: string
  try {
    realPath = await realpath(resolved)
  } catch {
    // realpath failed — the file may not exist yet, or it may be a
    // dangling symlink. Check for dangling symlinks first: if the path
    // is a symlink whose target doesn't exist, we must still resolve
    // the symlink to validate the target is inside root.
    try {
      const stat = await lstat(resolved)
      if (stat.isSymbolicLink()) {
        // Dangling symlink — realpath already failed, which means the
        // target doesn't exist. This is a security risk: the symlink
        // could point outside root. Reject it.
        throw new Error(`Path is outside the allowed root: ${root}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('outside the allowed root')) throw e
      // lstat also failed (file doesn't exist at all) — fall through
    }

    // File doesn't exist yet (not a symlink). Resolve the parent directory
    // to validate it's inside root, then append the filename.
    const parentDir = dirname(resolved)
    const baseName = basename(resolved)
    try {
      const realParent = await realpath(parentDir)
      realPath = join(realParent, baseName)
    } catch {
      // Parent directory also doesn't exist — walk up to find the
      // nearest existing ancestor and re-append the non-existing path.
      const { realAncestor, remainder } = await resolveRealAncestor(parentDir)
      realPath = join(realAncestor, remainder.slice(1), baseName) // remainder starts with /
    }
  }

  if (!realPath.startsWith(realRoot + realSep) && realPath !== realRoot) {
    throw new Error(`Path is outside the allowed root: ${root}`)
  }
  return resolved
}

export async function writeToolOutput(
  toolName: string,
  result: Record<string, unknown>,
  filePath: string,
  root: string
): Promise<MCPResult | null> {
  const resolved = await resolveSafePath(filePath, root)
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
