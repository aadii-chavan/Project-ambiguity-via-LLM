import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('UI crashed:', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 mb-5 text-muted">The page hit an unexpected error. Your saved analyses are safe.</p>
          <button onClick={() => location.assign('/')} className="h-10 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-white">Back to dashboard</button>
        </div>
      </div>
    )
  }
}
