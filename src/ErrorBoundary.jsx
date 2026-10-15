import { Component } from 'react'

// Renders `fallback` instead of children if they throw (a chunk that fails to
// download, a model that won't load, a browser that can't make a WebGL context)
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('[portal]', error)
    this.props.onError?.(error)
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
