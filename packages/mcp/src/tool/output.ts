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
  // Fail closed: if we exceeded the depth limit, the path may contain
  // unresolved symlink components (e.g., circular symlinks). Returning a
  // partially-resolved path would allow it to pass containment checks
  // even though the fully-resolved path could be outside root.
  throw new Error(`Path resolution depth limit exceeded (possible circular symlinks): ${p}`)
}

/**
 * Walks the non-existent path segments (remainder) from the real ancestor and
 * rejects any that are dangling symlinks. A symlink whose target doesn't exist
 * could point outside the allowed root — when the file is eventually written,
 * the OS follows the symlink chain and the write lands outside root.
 */
async function assertNoDanglingSymlinks(realAncestor: string, remainder: string): Promise<void> {
  if (!remainder) return
  const segments = remainder.split(osSep).filter(Boolean)
  let current = realAncestor
  for (const seg of segments) {
    current = join(current, seg)
    try {
      const stat = await lstat(current)
      if (stat.isSymbolicLink()) {
        throw new Error(`Path is outside the allowed root: dangling symlink at ${current}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('outside the allowed root')) throw e
      // lstat failed — the component doesn't exist at all, which is expected
      // since we're creating a new file. No symlink to worry about.
    }
  }
}

export interface SafePathResult {
  /** The user-provided normalized path (for display/error messages). */
  resolved: string
  /** The canonical realpath-validated path (for filesystem operations). */
  realPath: string
}

export async function resolveSafePath(filePath: string, root: string): Promise<SafePathResult> {
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
    // Use join instead of concatenation to avoid double-slash issues
    // (e.g. when realAncestor is "/" and remainder starts with "/name").
    realRoot = remainder ? join(realAncestor, remainder.slice(osSep.length)) : realAncestor
  }

  // Re-check the broad-root guard after resolving symlinks. A root like
  // "/home" could be a symlink to "/", which would pass the earlier
  // normalizedRoot check but resolve to the filesystem root here.
  const parsedRealRoot = parse(realRoot).root
  if (realRoot === '/' || realRoot === osSep || realRoot === parsedRealRoot) {
    throw new Error(
      `Root path is too broad: "${root}" (resolved to "${realRoot}"). ` +
        'Specify a narrower OPENPENCIL_MCP_ROOT directory.'
    )
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
      await assertNoDanglingSymlinks(realAncestor, remainder)
      realPath = join(realAncestor, remainder.slice(osSep.length), baseName)
    }
  }

  if (!realPath.startsWith(realRoot + realSep) && realPath !== realRoot) {
    throw new Error(`Path is outside the allowed root: ${root}`)
  }
  return { resolved, realPath }
}

export async function writeToolOutput(
  toolName: string,
  result: Record<string, unknown>,
  filePath: string,
  root: string
): Promise<MCPResult | null> {
  const { resolved, realPath } = await resolveSafePath(filePath, root)
  // Use the canonical realPath for filesystem operations to prevent TOCTOU:
  // an attacker could swap a directory component with a symlink between
  // resolveSafePath's validation and the writeFile call. Writing to the
  // realpath-validated path ensures the write lands inside root.
  await mkdir(dirname(realPath), { recursive: true })
  if (toolName === 'export_svg' && typeof result.svg === 'string') {
    await writeFile(realPath, result.svg, 'utf8')
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.svg, 'utf8') })
  }
  if (toolName === 'export_image' && typeof result.base64 === 'string') {
    await writeFile(realPath, Buffer.from(result.base64, 'base64'))
    return ok({ written: resolved, byteLength: result.byteLength ?? null })
  }
  if (toolName === 'get_jsx' && typeof result.jsx === 'string') {
    await writeFile(realPath, result.jsx, 'utf8')
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.jsx, 'utf8') })
  }
  return null
}
