import type { Plugin } from 'vite'

export function rawMarkdownPlugin(): Plugin {
  return {
    name: 'raw-md',
    transform(code: string, id: string) {
      if (id.endsWith('.md')) {
        return { code: `export default ${JSON.stringify(code)}`, map: null }
      }
    }
  }
}
