export interface WaitlistEntry {
  email: string
}

/**
 * Adds a visitor to the OpenPencil Cloud waitlist. There is no backend yet, so every entry
 * succeeds and nothing leaves the page; the enrollment endpoint replaces only this function.
 */
export async function submitWaitlistEntry(_entry: WaitlistEntry): Promise<void> {}
