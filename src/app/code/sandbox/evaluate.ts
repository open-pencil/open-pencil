import { IS_BROWSER } from '@open-pencil/core/constants'
import {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_HELPERS,
  transformDesignJSXExpression
} from '@open-pencil/core/design-jsx'

import { sandboxDocument } from '@/app/code/sandbox/document'
import {
  DESIGN_JSX_DEFAULT_READY_TIMEOUT_MS,
  DESIGN_JSX_DEFAULT_TIMEOUT_MS,
  DESIGN_JSX_MAX_SOURCE_BYTES,
  resolveDesignJSXValidationLimits,
  type DesignJSXSandboxLimits,
  type DesignJSXSandboxResult
} from '@/app/code/sandbox/types'
import { validateDesignJSXOutput } from '@/app/code/sandbox/validate'

function sourceByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength
}

export async function evaluateDesignJSX(
  source: string,
  limits: DesignJSXSandboxLimits = {}
): Promise<DesignJSXSandboxResult> {
  if (!IS_BROWSER) {
    return { ok: false, error: 'Design JSX execution requires a browser.' }
  }
  const sourceBytes = limits.sourceBytes ?? DESIGN_JSX_MAX_SOURCE_BYTES
  if (sourceByteLength(source) > sourceBytes) {
    return { ok: false, error: 'Design JSX source is too large.' }
  }

  let code: string
  try {
    code = transformDesignJSXExpression(source)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const validationLimits = resolveDesignJSXValidationLimits(limits)
  const iframe = document.createElement('iframe')
  iframe.hidden = true
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.srcdoc = sandboxDocument({
    elements: Object.fromEntries(
      DESIGN_JSX_ELEMENTS.map(({ name, runtimeType }) => [name, runtimeType])
    ),
    helpers: DESIGN_JSX_HELPERS.map(({ name }) => name),
    limits: validationLimits
  })
  document.body.append(iframe)

  return new Promise((resolve) => {
    const id = crypto.randomUUID()
    const timeoutMs = limits.timeoutMs ?? DESIGN_JSX_DEFAULT_TIMEOUT_MS
    const readyTimeoutMs = limits.readyTimeoutMs ?? DESIGN_JSX_DEFAULT_READY_TIMEOUT_MS
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const finish = (result: DesignJSXSandboxResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      iframe.remove()
      // eslint-disable-next-line promise/no-multiple-resolved -- settled guard makes completion single-shot
      resolve(result)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.origin !== 'null') return
      const message = event.data as {
        type?: string
        id?: string
        ok?: boolean
        value?: unknown
        error?: string
      }
      if (message.type === 'open-pencil-design-jsx-ready') {
        clearTimeout(timer)
        // eslint-disable-next-line promise/no-multiple-resolved -- finish has a settled guard
        timer = setTimeout(
          () => finish({ ok: false, error: 'Design JSX execution timed out.' }),
          timeoutMs
        )
        iframe.contentWindow?.postMessage({ type: 'open-pencil-design-jsx-run', id, code }, '*')
        return
      }
      if (message.type !== 'open-pencil-design-jsx-result' || message.id !== id) return
      if (!message.ok) {
        finish({ ok: false, error: message.error ?? 'Design JSX execution failed.' })
        return
      }
      try {
        const roots = validateDesignJSXOutput(message.value, validationLimits)
        finish({ ok: true, roots })
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
    timer = setTimeout(
      () => finish({ ok: false, error: 'Design JSX sandbox did not become ready.' }),
      readyTimeoutMs
    )
    window.addEventListener('message', onMessage)
  })
}
