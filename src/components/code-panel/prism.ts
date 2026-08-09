import Prism from '@/components/code-panel/prism-global'
import 'prismjs/components/prism-jsx'

/**
 * Prism with the JSX grammar attached.
 *
 * Import order here is load-bearing and specified: a module's dependencies are
 * evaluated depth-first in declaration order, so `prism-global` has already
 * published the global by the time the grammar file runs. Import the grammar
 * directly and it resolves against nothing.
 */
export default Prism
