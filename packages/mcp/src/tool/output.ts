import { constants } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  readlink,
  realpath,
  writeFile,
  type FileHandle
} from 'node:fs/promises'
import { dirname, basename, isAbsolute, join, parse, resolve, sep as osSep } from 'node:path'

import { compact } from 'es-toolkit/array'
import { toUint8Array } from 'js-base64'

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
  const segments = compact(remainder.split(osSep))
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

/**
 * The tools whose `path` names a file to write their result to, and the bytes each writes. Other
 * tools' `path` is their own data, such as `create_vector`'s SVG path, and never touches disk.
 */
const FILE_OUTPUTS: Record<
  string,
  (result: Record<string, unknown>) => string | Uint8Array | null
> = {
  export_svg: (result) => (typeof result.svg === 'string' ? result.svg : null),
  get_jsx: (result) => (typeof result.jsx === 'string' ? result.jsx : null),
  export_image: (result) =>
    typeof result.base64 === 'string' ? toUint8Array(result.base64) : null,
  export_pdf: (result) => (typeof result.base64 === 'string' ? toUint8Array(result.base64) : null)
}

/** Whether a tool's `path` argument names a file it writes, rather than data of its own. */
export function writesFileOutput(toolName: string): boolean {
  return toolName in FILE_OUTPUTS
}

/** The largest document `/files` passes either way, as the app caps documents it fetches. */
export const MAX_FILE_TRANSFER_BYTES = 64 * 1024 * 1024

/** Write `content` to a path inside `root`, creating its folders, and return where it landed. */
export async function writeInsideRoot(
  filePath: string,
  root: string,
  content: string | Uint8Array
): Promise<{ written: string; byteLength: number }> {
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
  await writeFile(realPath, content)
  await resolveSafePath(realPath, root)
  const byteLength =
    typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength
  return { written: resolved, byteLength }
}

const READ_CHUNK_BYTES = 1024 * 1024

/**
 * Read an open file to its end in chunks, refusing it as soon as it passes the cap, so a file
 * that grows while it is read is never buffered whole.
 */
async function readBounded(handle: FileHandle, name: string): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const chunk = new Uint8Array(READ_CHUNK_BYTES)
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, total)
    if (bytesRead === 0) break
    total += bytesRead
    if (total > MAX_FILE_TRANSFER_BYTES) {
      throw new Error(`"${name}" is larger than ${MAX_FILE_TRANSFER_BYTES} bytes`)
    }
    chunks.push(chunk.subarray(0, bytesRead))
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

/** Read a file inside `root`, refusing one larger than `MAX_FILE_TRANSFER_BYTES`. */
export async function readInsideRoot(
  filePath: string,
  root: string
): Promise<Uint8Array<ArrayBuffer>> {
  const { realPath } = await resolveSafePath(filePath, root)
  // One descriptor for the checks and the read, so the file cannot be swapped between them; a
  // symlink in its place is refused, and a folder swapped above it is caught by the re-check.
  // Windows has no O_NOFOLLOW (it is undefined there), so only the re-check guards it.
  const handle = await open(realPath, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stats = await handle.stat()
    if (!stats.isFile()) throw new Error(`"${basename(realPath)}" is not a file`)
    if (stats.size > MAX_FILE_TRANSFER_BYTES) {
      throw new Error(`"${basename(realPath)}" is larger than ${MAX_FILE_TRANSFER_BYTES} bytes`)
    }
    await resolveSafePath(realPath, root)
    return await readBounded(handle, basename(realPath))
  } finally {
    await handle.close()
  }
}

export async function writeToolOutput(
  toolName: string,
  result: Record<string, unknown>,
  filePath: string,
  root: string
): Promise<MCPResult | null> {
  const content = FILE_OUTPUTS[toolName]?.(result)
  if (content == null) return null
  return ok(await writeInsideRoot(filePath, root, content))
}
