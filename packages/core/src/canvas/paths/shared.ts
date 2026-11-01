import type { Path } from 'canvaskit-wasm'

import type { NodePathCaches } from './cache'

export function sharedPath(
  caches: NodePathCaches,
  ownKey: string,
  scope: string,
  inputs: Path[],
  build: () => Path | null
): Path | null {
  const previousKey = caches.sharedKeys.get(ownKey)
  const previous = previousKey === undefined ? null : builtFrom(caches, previousKey, inputs)
  if (previous) {
    return previous.copy()
  }
  const key = `${scope}|${pathsDigest(inputs)}`
  const matching = builtFrom(caches, key, inputs)
  if (matching) {
    caches.sharedKeys.set(ownKey, key)
    return matching.copy()
  }
  const result = build()
  if (!result) {
    return null
  }
  if (previousKey !== undefined && previousKey !== key) {
    caches.shared.delete(previousKey)
  }
  caches.store(caches.shared, key, [...inputs.map((input) => input.copy()), result.copy()])
  caches.sharedKeys.set(ownKey, key)
  return result
}

function builtFrom(caches: NodePathCaches, key: string, inputs: Path[]): Path | null {
  const cached = caches.shared.get(key)
  if (!cached || cached.length !== inputs.length + 1) {
    return null
  }
  return inputs.every((input, index) => cached[index].equals(input)) ? cached[inputs.length] : null
}

function pathsDigest(paths: Path[]): string {
  return paths.map(pathDigest).join('|')
}

function pathDigest(path: Path): string {
  const points = path.countPoints()
  const ends = points > 0 ? [...path.getPoint(0), ...path.getPoint(points - 1)].join(',') : ''
  return `${path.getFillType().value}:${points}:${path.getBounds().join(',')}:${ends}`
}
