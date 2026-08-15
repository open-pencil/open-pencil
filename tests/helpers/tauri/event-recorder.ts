export type NativeEventTarget = {
  tag: string
  testId: string | null
  slot: string | null
  nodeId: string | null
  editable: boolean
}

export type NativeEventRecord = {
  sequence: number
  type: string
  timeStamp: number
  isTrusted: boolean
  defaultPrevented: boolean
  target: NativeEventTarget | null
  pointerId?: number
  pointerType?: string
  button?: number
  buttons?: number
  clientX?: number
  clientY?: number
  detail?: number
  key?: string
  code?: string
  repeat?: boolean
  inputType?: string
  data?: string | null
  isComposing?: boolean
}

export type NativeEventRecorder = {
  clear: () => Promise<void>
  read: () => Promise<NativeEventRecord[]>
  stop: () => Promise<void>
}

type NativeEventRecorderState = {
  events: NativeEventRecord[]
  listeners: Array<{ type: string; listener: EventListener }>
  sequence: number
}

type NativeEventRecorderWindow = Window & {
  __OPENPENCIL_NATIVE_EVENT_RECORDER__?: NativeEventRecorderState
}

const EVENT_TYPES = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'click',
  'dblclick',
  'dragstart',
  'dragenter',
  'dragover',
  'drop',
  'dragend',
  'focusin',
  'focusout',
  'keydown',
  'keyup',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'copy',
  'cut',
  'paste'
] as const

const MAX_EVENT_RECORDS = 2_000

async function installRecorder(): Promise<void> {
  await browser.execute(
    (eventTypes, maxRecords) => {
      const recorderWindow = window as NativeEventRecorderWindow
      const existing = recorderWindow.__OPENPENCIL_NATIVE_EVENT_RECORDER__
      if (existing) {
        for (const { type, listener } of existing.listeners) {
          window.removeEventListener(type, listener, true)
        }
      }

      const state = {
        events: [] as NativeEventRecord[],
        listeners: [] as Array<{ type: string; listener: EventListener }>,
        sequence: 0
      }

      const targetSummary = (target: EventTarget | null): NativeEventTarget | null => {
        if (!(target instanceof Element)) return null
        const editable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.closest('[contenteditable="true"], .cm-editor') !== null
        const identityTarget =
          target.closest('[data-test-id], [data-slot], [data-node-id]') ?? target
        return {
          tag: target.tagName,
          testId: identityTarget.getAttribute('data-test-id'),
          slot: identityTarget.getAttribute('data-slot'),
          nodeId: identityTarget.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null,
          editable
        }
      }

      const record = (event: Event) => {
        const pointer = event instanceof PointerEvent ? event : null
        const mouse = event instanceof MouseEvent ? event : null
        const keyboard = event instanceof KeyboardEvent ? event : null
        const input = event instanceof InputEvent ? event : null
        const composition = event instanceof CompositionEvent ? event : null
        const entry: NativeEventRecord = {
          sequence: state.sequence++,
          type: event.type,
          timeStamp: event.timeStamp,
          isTrusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented,
          target: targetSummary(event.target)
        }
        if (pointer) {
          entry.pointerId = pointer.pointerId
          entry.pointerType = pointer.pointerType
        }
        if (mouse) {
          entry.button = mouse.button
          entry.buttons = mouse.buttons
          entry.clientX = mouse.clientX
          entry.clientY = mouse.clientY
          entry.detail = mouse.detail
        }
        if (keyboard) {
          entry.key = keyboard.key
          entry.code = keyboard.code
          entry.repeat = keyboard.repeat
          entry.isComposing = keyboard.isComposing
        }
        if (input) {
          entry.inputType = input.inputType
          entry.data = input.data
          entry.isComposing = input.isComposing
        } else if (composition) {
          entry.data = composition.data
        }
        state.events.push(entry)
        if (state.events.length > maxRecords) state.events.shift()
      }

      for (const type of eventTypes) {
        const listener: EventListener = record
        window.addEventListener(type, listener, true)
        state.listeners.push({ type, listener })
      }
      recorderWindow.__OPENPENCIL_NATIVE_EVENT_RECORDER__ = state
    },
    EVENT_TYPES,
    MAX_EVENT_RECORDS
  )
}

export async function startNativeEventRecorder(): Promise<NativeEventRecorder> {
  await installRecorder()
  return {
    async clear() {
      await browser.execute(() => {
        const state = (window as NativeEventRecorderWindow).__OPENPENCIL_NATIVE_EVENT_RECORDER__
        if (!state) return
        state.events.length = 0
        state.sequence = 0
      })
    },
    async read() {
      return browser.execute(() => {
        const state = (window as NativeEventRecorderWindow).__OPENPENCIL_NATIVE_EVENT_RECORDER__
        return structuredClone(state?.events ?? [])
      })
    },
    async stop() {
      await browser.execute(() => {
        const recorderWindow = window as NativeEventRecorderWindow
        const state = recorderWindow.__OPENPENCIL_NATIVE_EVENT_RECORDER__
        if (!state) return
        for (const { type, listener } of state.listeners) {
          window.removeEventListener(type, listener, true)
        }
        delete recorderWindow.__OPENPENCIL_NATIVE_EVENT_RECORDER__
      })
    }
  }
}

export async function withNativeEventRecorder<T>(
  run: (recorder: NativeEventRecorder) => Promise<T>
): Promise<T> {
  const recorder = await startNativeEventRecorder()
  try {
    return await run(recorder)
  } finally {
    await recorder.stop()
  }
}
