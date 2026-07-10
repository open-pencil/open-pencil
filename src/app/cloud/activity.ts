import { ref } from 'vue'

/** Short user-facing label for in-progress cloud I/O (null = none). */
export const cloudActivityMessage = ref<string | null>(null)

export function setCloudActivity(message: string | null) {
  cloudActivityMessage.value = message
}

export async function withCloudActivity<T>(message: string, run: () => Promise<T>): Promise<T> {
  setCloudActivity(message)
  try {
    return await run()
  } finally {
    setCloudActivity(null)
  }
}
