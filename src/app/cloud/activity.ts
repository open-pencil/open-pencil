import { ref } from 'vue'

/** Short user-facing label for in-progress cloud I/O (null = none). */
export const cloudActivityMessage = ref<string | null>(null)

export type CloudActivityScope = {
  update: (message: string) => void
  end: () => void
}

type ActivityEntry = { message: string }

// Overlapping operations stack: the newest message shows, and ending one scope
// restores the next, so a finished op can never hide one still in flight.
const activityStack: ActivityEntry[] = []

function renderActivity() {
  cloudActivityMessage.value =
    activityStack.length > 0 ? activityStack[activityStack.length - 1].message : null
}

export function beginCloudActivity(message: string): CloudActivityScope {
  const entry: ActivityEntry = { message }
  activityStack.push(entry)
  renderActivity()
  return {
    update(next: string) {
      entry.message = next
      renderActivity()
    },
    end() {
      const index = activityStack.indexOf(entry)
      if (index !== -1) activityStack.splice(index, 1)
      renderActivity()
    }
  }
}

export async function withCloudActivity<T>(message: string, run: () => Promise<T>): Promise<T> {
  const scope = beginCloudActivity(message)
  try {
    return await run()
  } finally {
    scope.end()
  }
}
