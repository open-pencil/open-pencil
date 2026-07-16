import { lstat, mkdir, readlink, realpath, writeFile } from 'node:fs/promises'
import { dirname, basename, isAbsolute, join, parse, resolve, sep as osSep } from 'node:path'

import { ok } from '#mcp/result'
import type { MCPResult } from '#mcp/result'

/** Returns true for filesystem errors that indicate a missing or unresolvable path (ENOENT, ENOTDIR, ELOOP). */
function isMissingPathError(e: unknown): boolean {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: unknown }).code : undefined
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP'
}

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
    } catch (e) {
      if (!isMissingPathError(e)) throw e
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
 * rejects any that are symlinks. A symlink in a non-existent path segment
 * could point outside the allowed root — when the file is eventually written,
 * the OS follows the symlink chain and the write lands outside root.
 */
async function assertNoSymlinksInRemainder(realAncestor: string, remainder: string): Promise<void> {
  if (!remainder) return
  const segments = remainder.split(osSep).filter(Boolean)
  let current = realAncestor
  for (const seg of segments) {
    current = join(current, seg)
    try {
      const stat = await lstat(current)
      if (stat.isSymbolicLink()) {
        throw new Error(`Path is outside the allowed root: symlink at ${current}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('outside the allowed root')) throw e
      if (!isMissingPathError(e)) throw e
      // lstat failed — the component doesn't exist at all, which is expected
      // since we're creating a new file. No symlink to worry about.
    }
  }
}

/** Throw if `rootPath` is trivially broad (e.g. "/" or "C:\"). */
function assertNarrowRoot(rootPath: string, original: string): void {
  const normalized = resolve(rootPath)
  const parsedRoot = parse(normalized).root
  if (normalized === '/' || normalized === osSep || normalized === parsedRoot) {
    throw new Error(
      `Root path is too broad: "${original}" (resolved to "${normalized}"). ` +
        'Specify a narrower OPENPENCIL_MCP_ROOT directory.'
    )
  }
}

/** Resolve `p` to its realpath-validated canonical form, handling non-existent paths. */
async function resolveRealPath(p: string): Promise<string> {
  try {
    return await realpath(p)
  } catch (e) {
    if (!isMissingPathError(e)) throw e
    const parentDir = dirname(p)
    const baseName = basename(p)
    try {
      const realParent = await realpath(parentDir)
      return join(realParent, baseName)
    } catch (e) {
      if (!isMissingPathError(e)) throw e
      const { realAncestor, remainder } = await resolveRealAncestor(parentDir)
      await assertNoSymlinksInRemainder(realAncestor, remainder)
      return join(realAncestor, remainder.slice(osSep.length), baseName)
    }
  }
}

export interface SafePathResult {
  /** The user-provided normalized path (for display/error messages). */
  resolved: string
  /** The canonical realpath-validated path (for filesystem operations). */
  realPath: string
}

const MAX_SYMLINK_DEPTH = 16

/**
 * Resolve a dangling symlink's target. When realpath fails on a symlink,
 * read the link target and recursively validate it is inside root.
 * Returns the canonical realPath of the target, or undefined if `resolved`
 * is not a symlink.
 */
async function resolveDanglingSymlink(
  resolved: string,
  root: string,
  realRoot: string,
  symlinkDepth: number
): Promise<string | undefined> {
  try {
    const stat = await lstat(resolved)
    if (!stat.isSymbolicLink()) return undefined
    // Dangling symlink — realpath already failed, which means the
    // target doesn't exist. Read the symlink target and validate it
    // is inside root. Absolute-path targets pointing outside root are
    // rejected. Relative targets are resolved relative to the symlink
    // directory and checked against root.
    const linkTarget = await readlink(resolved)
    const linkDir = dirname(resolved)
    const resolvedTarget = isAbsolute(linkTarget) ? linkTarget : resolve(linkDir, linkTarget)
    // Recursively validate the target (handles nested symlinks).
    // Pass the already-canonical realRoot so the recursive call skips
    // redundant assertNarrowRoot + realpath(root) work.
    const targetResult = await resolveSafePathInternal(
      resolvedTarget,
      root,
      symlinkDepth + 1,
      realRoot
    )
    return targetResult.realPath
  } catch (e) {
    if (e instanceof Error) {
      // Re-throw security, root-scope, and depth-limit errors — these must
      // not be swallowed. They indicate genuine validation failures, not
      // the expected "path doesn't exist" case.
      if (
        e.message.includes('outside the allowed root') ||
        e.message.includes('Root path is too broad') ||
        e.message.includes('depth limit exceeded')
      )
        throw e
    }
    if (!isMissingPathError(e)) throw e
    // lstat failed (file doesn't exist at all) — not a symlink
    return undefined
  }
}

async function resolveSafePathInternal(
  filePath: string,
  root: string,
  symlinkDepth: number,
  realRoot?: string
): Promise<SafePathResult> {
  if (symlinkDepth >= MAX_SYMLINK_DEPTH) {
    throw new Error(
      `Symlink resolution depth limit exceeded (possible circular symlinks): ${filePath}`
    )
  }

  const normalizedRoot = resolve(root)
  const resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(normalizedRoot, filePath)

  if (!realRoot) {
    assertNarrowRoot(root, root)

    try {
      realRoot = await realpath(root)
    } catch (e) {
      if (!isMissingPathError(e)) throw e
      const { realAncestor, remainder } = await resolveRealAncestor(root)
      realRoot = remainder ? join(realAncestor, remainder.slice(osSep.length)) : realAncestor
    }

    assertNarrowRoot(realRoot, root)
  }

  const realSep = realRoot.endsWith('/') || realRoot.endsWith('\\') ? '' : osSep

  let realPath: string
  try {
    realPath = await realpath(resolved)
  } catch (e) {
    if (!isMissingPathError(e)) throw e
    const symlinkRealPath = await resolveDanglingSymlink(resolved, root, realRoot, symlinkDepth)
    realPath = symlinkRealPath ?? (await resolveRealPath(resolved))
  }

  if (!realPath.startsWith(realRoot + realSep) && realPath !== realRoot) {
    throw new Error(`Path is outside the allowed root: ${root}`)
  }
  return { resolved, realPath }
}

export async function resolveSafePath(filePath: string, root: string): Promise<SafePathResult> {
  return resolveSafePathInternal(filePath, root, 0)
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
  const parentDir = dirname(realPath)
  await mkdir(parentDir, { recursive: true })
  // TOCTOU mitigation: re-verify the parent directory still resolves inside
  // the root after mkdir. An attacker who replaces an ancestor directory
  // with a symlink between resolveSafePath and the write would be detected
  // here — realpath follows the ancestor symlink and resolves outside root.
  await resolveSafePath(parentDir, root)
  if (toolName === 'export_svg' && typeof result.svg === 'string') {
    await writeFile(realPath, result.svg, 'utf8')
    await resolveSafePath(realPath, root)
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.svg, 'utf8') })
  }
  if (toolName === 'export_image' && typeof result.base64 === 'string') {
    const buffer = Buffer.from(result.base64, 'base64')
    await writeFile(realPath, buffer)
    await resolveSafePath(realPath, root)
    return ok({ written: resolved, byteLength: buffer.length })
  }
  if (toolName === 'get_jsx' && typeof result.jsx === 'string') {
    await writeFile(realPath, result.jsx, 'utf8')
    await resolveSafePath(realPath, root)
    return ok({ written: resolved, byteLength: Buffer.byteLength(result.jsx, 'utf8') })
  }
  return null
}
