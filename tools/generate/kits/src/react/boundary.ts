/**
 * Runs inside the kit's module graph, as `mark.ts` does, so it imports nothing but React.
 */
import { Component, createElement, type ReactNode } from 'react'

interface BoundaryProps {
  /** What the boundary holds, named in the message it draws when that fails to render. */
  name: string
  children?: ReactNode
}

/**
 * Draws a short message in place of what it holds when that fails to render, such as an example
 * that needs a browser feature the mount lacks, so the rest of the kit still draws.
 */
interface BoundaryState {
  /** Why what it holds failed to render, once it has. */
  failed: string | null
}

export class RenderBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { failed: String(error) }
  }

  override render(): ReactNode {
    const { failed } = this.state
    if (failed === null) return this.props.children
    return createElement('p', null, `${this.props.name} could not be drawn: ${failed}`)
  }
}
