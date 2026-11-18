/**
 * What independent sources answer, merged: one that fails, by rejecting or throwing, leaves only
 * its own names out, and the call fails only when every source does, with the first failure.
 */
export async function settledAnswers<T>(
  asks: readonly (() => Promise<ReadonlyMap<string, T>>)[]
): Promise<Map<string, T>> {
  // Each ask runs inside an async call, so one that throws at once fails like one that rejects.
  const parts = await Promise.allSettled(asks.map(async (ask) => ask()))
  const failed = parts.find((part) => part.status === 'rejected')
  if (failed && parts.every((part) => part.status === 'rejected')) throw failed.reason
  return new Map(parts.flatMap((part) => (part.status === 'fulfilled' ? [...part.value] : [])))
}
