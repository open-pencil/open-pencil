export function createFigParseWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
  })
}
