import Prism from 'prismjs'

/**
 * Publish Prism as a global before any grammar file loads.
 *
 * `prismjs/components/*` are script-tag era files: they extend `Prism.languages`
 * through a bare global rather than importing anything. Prism's own UMD wrapper
 * only ever assigns `global.Prism`, and `global` does not exist in a browser
 * bundle — Vite's dev pre-bundle happens to paper over this, the production
 * build does not. The grammar therefore threw `ReferenceError: Prism is not
 * defined` while the router chunk was still evaluating, so the app never
 * mounted at all and the service worker kept serving the previous shell.
 *
 * This lives in its own module because imports are hoisted: assigning the
 * global next to the grammar import in one file would still run second. A
 * module boundary is what makes the order a guarantee rather than a hope.
 */
;(globalThis as typeof globalThis & { Prism?: typeof Prism }).Prism = Prism

export default Prism
