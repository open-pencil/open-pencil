import { StorageSerializers, useLocalStorage } from '@vueuse/core'

const STORAGE_PREFIX = 'open-pencil:'
const MODEL_SETTINGS_KEY = `${STORAGE_PREFIX}ai-model-settings`

const modelSettings = useLocalStorage<unknown>(MODEL_SETTINGS_KEY, null, {
  serializer: StorageSerializers.object,
  writeDefaults: false
})

const legacyValues = {
  'ai-provider': useLocalStorage<string | null>(`${STORAGE_PREFIX}ai-provider`, null, {
    serializer: StorageSerializers.string,
    writeDefaults: false
  }),
  'ai-model': useLocalStorage<string | null>(`${STORAGE_PREFIX}ai-model`, null, {
    serializer: StorageSerializers.string,
    writeDefaults: false
  }),
  'ai-custom-model': useLocalStorage<string | null>(`${STORAGE_PREFIX}ai-custom-model`, null, {
    serializer: StorageSerializers.string,
    writeDefaults: false
  }),
  'ai-base-url': useLocalStorage<string | null>(`${STORAGE_PREFIX}ai-base-url`, null, {
    serializer: StorageSerializers.string,
    writeDefaults: false
  }),
  'ai-api-type': useLocalStorage<string | null>(`${STORAGE_PREFIX}ai-api-type`, null, {
    serializer: StorageSerializers.string,
    writeDefaults: false
  }),
  'ai-max-output-tokens': useLocalStorage<string | null>(
    `${STORAGE_PREFIX}ai-max-output-tokens`,
    null,
    {
      serializer: StorageSerializers.string,
      writeDefaults: false
    }
  )
}

export type LegacyAIModelStorageKey = keyof typeof legacyValues

export function readLegacyAIModelStorage(key: LegacyAIModelStorageKey): string | null {
  return legacyValues[key].value
}

export function readAIModelSettingsStorage(): unknown {
  return modelSettings.value
}

export function writeAIModelSettingsStorage(value: unknown): void {
  modelSettings.value = value
}
