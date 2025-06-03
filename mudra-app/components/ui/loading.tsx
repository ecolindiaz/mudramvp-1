import { Skeleton } from '@/components/ui/skeleton'

interface LoadingProps {
    type?: 'card' | 'list' | 'table'
    count?: number
}

export function Loading({ type = 'card', count = 3 }: LoadingProps) {
    if (type === 'list') {
        return (
            <div className="space-y-3">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (type === 'table') {
        return (
            <div className="space-y-3">
                <div className="flex space-x-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-[150px]" />
                    ))}
                </div>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex space-x-4">
                        {Array.from({ length: 4 }).map((_, j) => (
                            <Skeleton key={j} className="h-12 w-[150px]" />
                        ))}
                    </div>
                ))}
            </div>
        )
    }

    // Default card loading
    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                    <div className="mt-4 space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    )
} 