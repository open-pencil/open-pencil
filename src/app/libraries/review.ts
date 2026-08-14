import { shallowRef } from 'vue'

export interface LibraryReviewRequest {
  libraryId: string
  assetKey: string
  instanceIds: string[]
  initialInstanceId: string
}

export const libraryReviewRequest = shallowRef<LibraryReviewRequest | null>(null)

export function openLibraryReview(request: LibraryReviewRequest): void {
  libraryReviewRequest.value = request
}

export function closeLibraryReview(): void {
  libraryReviewRequest.value = null
}
