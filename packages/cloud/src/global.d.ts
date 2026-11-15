// Single-file components as plain TypeScript sees them; vue-tsc reads the components themselves
// (`bun run typecheck`).
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
