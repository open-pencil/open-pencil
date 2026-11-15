export function createFigSessionWorker(): Worker {
  if (typeof Worker === 'undefined') throw new Error('FIG session workers are unavailable')
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
}
