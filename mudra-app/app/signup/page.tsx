'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import Image from 'next/image'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics/posthog-events'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const signupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignupFormData = z.infer<typeof signupSchema>

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

function SignUpForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState<boolean>(false)
  const router = useRouter()
  
  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema)
  })

  async function onSubmit(data: SignupFormData) {
    setIsLoading(true)
    trackEvent.signupAttempted('credentials')

    // Clear any cached data from previous user session
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mudra_brand_profile')
      localStorage.removeItem('onboardingData')
      localStorage.removeItem('mudra_active_profile_id')
      localStorage.removeItem('mudra_active_country')
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const msg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Failed to create account'
        throw new Error(msg)
      }

      trackEvent.signupSucceeded('credentials')
      toast.success('Account created successfully!')
      
      // Auto-login after registration
      const signInResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (signInResult?.ok) {
        router.push('/welcome')
        router.refresh()
      } else {
        // Auto-login failed — show the error and send to login
        toast.error(signInResult?.error || 'Sign-in failed after registration. Please log in manually.')
        router.push('/login')
      }
    } catch (error: any) {
      trackEvent.signupFailed('credentials', error.message || 'Failed to create account')
      toast.error(error.message || 'Failed to create account')
      console.error('Signup error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true)
      trackEvent.signupAttempted('google')

      // Clear any cached data from previous user session
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mudra_brand_profile')
        localStorage.removeItem('onboardingData')
        localStorage.removeItem('mudra_active_profile_id')
        localStorage.removeItem('mudra_active_country')
      }

      await signIn('google', { callbackUrl: '/welcome' })
    } catch (error) {
      trackEvent.signupFailed('google', 'Failed to sign up with Google')
      toast.error('Failed to sign up with Google')
      console.error('Google sign up error:', error)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className={cn('grid gap-10', className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6">
          <div className="grid gap-4">
            <Label htmlFor="name" className="text-base text-white">Username</Label>
            <Input
              {...register('name')}
              id="name"
              placeholder="johndoe"
              type="text"
              autoCapitalize="none"
              autoComplete="name"
              autoCorrect="off"
              disabled={isLoading}
              className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
            
            <Label htmlFor="email" className="text-base text-white">Email</Label>
            <Input
              {...register('email')}
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
            
            <Label htmlFor="password" className="text-base text-white">Password</Label>
            <Input
              {...register('password')}
              id="password"
              placeholder="••••••••"
              type="password"
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect="off"
              disabled={isLoading}
              className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isLoading} className="h-12 text-base mt-4 bg-white text-black hover:bg-gray-100">
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Account
          </Button>
        </div>
      </form>

      <div className="flex justify-center text-xs uppercase">
        <span className="bg-black px-6 text-gray-400 text-base">
          OR CONTINUE WITH
        </span>
      </div>

      <Button 
        variant="outline" 
        type="button" 
        onClick={handleGoogleSignUp}
        disabled={isLoading || isGoogleLoading} 
        className="h-12 border-[#222222] text-white hover:bg-[#111111]">
        {isGoogleLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
          >
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
        )}{' '}
        Google
      </Button>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-black">
      <div className="relative hidden h-full flex-col bg-black text-white lg:flex overflow-hidden">
        <Image
          src="/images/SignUp.png"
          alt="Mudra signup illustration"
          fill
          className="object-cover object-center scale-105"
          priority
          quality={100}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20" />
      </div>
      <div className="lg:p-8 bg-black">
        <div className="mx-auto flex w-full flex-col justify-center space-y-10 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <div className="mb-6">
              <Image
                src="/images/MudraMainLogo.png"
                alt="Mudra"
                width={80}
                height={80}
                className="mx-auto"
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2 text-white">
              Create an account
            </h1>
            <p className="text-base text-gray-400">
              Sign up to get started with Mudra
            </p>
          </div>

          <SignUpForm />

          <div className="space-y-4">
            <p className="text-center text-sm text-gray-400">
              Already have an account?{' '}
              <a
                href="/login"
                className="text-white hover:underline"
              >
                Sign in
              </a>
            </p>
            <p className="text-center text-xs text-gray-500">
              By continuing, you agree to our{' '}
              <a
                href="https://www.trymudra.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="https://www.trymudra.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
