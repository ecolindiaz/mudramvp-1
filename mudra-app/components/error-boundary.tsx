import React from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to an error reporting service
        console.error('Error caught by boundary:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">Something went wrong</h2>
                        <p className="text-muted-foreground">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            this.setState({ hasError: false, error: null })
                            window.location.reload()
                        }}
                    >
                        Try again
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
} 