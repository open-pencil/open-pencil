export {}

const mod = await import('../dist/index.js')

if (typeof mod.parseDeckBuffer !== 'function') {
  throw new TypeError('Expected parseDeckBuffer export from built @open-pencil/deck')
}
if (typeof mod.writeDeckArchive !== 'function') {
  throw new TypeError('Expected writeDeckArchive export from built @open-pencil/deck')
}
if (typeof mod.createEmptyDeckGraph !== 'function') {
  throw new TypeError('Expected createEmptyDeckGraph export from built @open-pencil/deck')
}
