// Headless only: `./stylesheet` loads this module lazily where the browser's parser is missing.
// A namespace import, read at call time: browser builds resolve the package to a script that
// exports nothing, and a named import would fail those builds even though this never runs there.
import * as cssom from '@acemir/cssom'

import { createTokenValidator } from './validate'

export const tokenValidator = createTokenValidator((cssText) => cssom.parse(cssText))
