export {}

const mod = await import('../dist/index.js')

if (typeof mod.parseDeckBuffer !== 'function') {
  throw new Error('Expected parseDeckBuffer export from built @open-pencil/deck')
}
if (typeof mod.writeDeckArchive !== 'function') {
  throw new Error('Expected writeDeckArchive export from built @open-pencil/deck')
}
if (typeof mod.createEmptyDeckGraph !== 'function') {
  throw new Error('Expected createEmptyDeckGraph export from built @open-pencil/deck')
}
