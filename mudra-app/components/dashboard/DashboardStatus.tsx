'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  Settings, 
  BarChart3,
  Users,
  Target
} from 'lucide-react'

interface OnboardingStatus {
  hasCompletedOnboarding: boolean
  hasRunInitialAnalysis: boolean
  nextSteps: string[]
  brandProfileId?: string
}

interface DashboardStatusProps {
  className?: string
}

export function DashboardStatus({ className }: DashboardStatusProps) {
  const { data: session } = useSession()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetchOnboardingStatus()
    }
  }, [session])

  const fetchOnboardingStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/onboarding/complete')
      
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status')
      }
      
      const result = await response.json()
      setStatus(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getCompletionPercentage = (): number => {
    if (!status) return 0
    
    let completed = 0
    if (status.hasCompletedOnboarding) completed += 50
    if (status.hasRunInitialAnalysis) completed += 50
    
    return completed
  }

  const getStatusColor = (): string => {
    const percentage = getCompletionPercentage()
    if (percentage === 100) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusIcon = () => {
    const percentage = getCompletionPercentage()
    if (percentage === 100) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (percentage >= 50) return <Clock className="h-5 w-5 text-yellow-500" />
    return <AlertCircle className="h-5 w-5 text-red-500" />
  }

  const getStatusText = (): string => {
    const percentage = getCompletionPercentage()
    if (percentage === 100) return 'Setup Complete'
    if (percentage >= 50) return 'Setup In Progress'
    return 'Setup Required'
  }

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'Complete the onboarding process':
        window.location.href = '/onboarding'
        break
      case 'Run your first AI visibility analysis':
        window.location.href = '/dashboard/insights'
        break
      case 'Review your dashboard metrics':
        window.location.href = '/dashboard'
        break
      default:
        break
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            Dashboard Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-2 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Error Loading Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchOnboardingStatus} variant="outline" size="sm">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const completionPercentage = getCompletionPercentage()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Dashboard Status
          </div>
          <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'}>
            {getStatusText()}
          </Badge>
        </CardTitle>
        <CardDescription>
          Track your setup progress and get personalized recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Setup Progress</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Status Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                <Settings className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Brand Profile Setup</p>
                <p className="text-xs text-gray-500">Configure your company details</p>
              </div>
            </div>
            {status.hasCompletedOnboarding ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className="h-5 w-5 text-gray-400" />
            )}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Initial Analysis</p>
                <p className="text-xs text-gray-500">Run your first AI visibility scan</p>
              </div>
            </div>
            {status.hasRunInitialAnalysis ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Next Steps */}
        {status.nextSteps.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-900">Next Steps</h4>
            <div className="space-y-2">
              {status.nextSteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => handleActionClick(step)}
                  className="flex items-center justify-between w-full p-2 text-left text-sm border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>{step}</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {completionPercentage === 100 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-900">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="justify-start"
                onClick={() => window.location.href = '/dashboard/insights'}
              >
                <Target className="h-4 w-4 mr-2" />
                View Insights
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="justify-start"
                onClick={() => window.location.href = '/dashboard/brand-monitor'}
              >
                <Users className="h-4 w-4 mr-2" />
                Monitor Brand
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
