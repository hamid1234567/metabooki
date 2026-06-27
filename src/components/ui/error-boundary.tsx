import React from 'react'
import { recoverFromDynamicImportError } from '@/lib/version-cache'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    void recoverFromDynamicImportError(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4">خطا در بارگذاری</h1>
            <p className="text-muted-foreground mb-2">مشکلی در اجرای برنامه رخ داد.</p>
            <p className="text-sm text-muted-foreground/70 mb-4 font-mono text-left bg-muted p-3 rounded-lg overflow-auto max-h-32">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              بارگذاری مجدد
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
