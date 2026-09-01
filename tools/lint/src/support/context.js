export function normalizedPath(path) {
  return path.replaceAll('\\', '/')
}

export function normalizedFilename(context) {
  return normalizedPath(
    context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? ''
  )
}

export function importSource(node) {
  return typeof node.source?.value === 'string' ? node.source.value : null
}
