'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

function ResetPasswordContent() {
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams?.get('token')
    
    const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema)
    })

    useEffect(() => {
        if (!token) {
            toast.error('Invalid reset link')
            router.push('/forgot-password')
        }
    }, [token, router])

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) return

        try {
            setIsLoading(true)
            
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token, 
                    password: data.password 
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to reset password')
            }

            setIsSuccess(true)
            toast.success('Password reset successful!')
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push('/login')
            }, 2000)
        } catch (error: any) {
            toast.error(error.message || 'An error occurred')
            console.error('Reset password error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <section className="flex min-h-screen bg-black px-4 py-16 md:py-32">
                <div className="bg-black m-auto h-fit w-full max-w-sm rounded-lg border border-[#222222] p-6">
                    <div className="space-y-6 text-center">
                        <div className="mb-4">
                            <Image
                                src="/images/mudra-logo.png"
                                alt="Mudra"
                                width={80}
                                height={80}
                                className="mx-auto"
                                priority
                            />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-white">Password reset successful</h1>
                            <p className="text-base text-gray-400">
                                Your password has been reset. Redirecting to sign in...
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="flex min-h-screen bg-black px-4 py-16 md:py-32">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-black m-auto h-fit w-full max-w-sm rounded-lg border border-[#222222] p-6">
                <div className="space-y-6">
                    <div className="flex flex-col items-center space-y-2 text-center">
                        <div className="mb-4">
                            <Image
                                src="/images/mudra-logo.png"
                                alt="Mudra"
                                width={80}
                                height={80}
                                className="mx-auto"
                                priority
                            />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">Set new password</h1>
                        <p className="text-base text-gray-400">
                            Enter your new password below
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-base text-white">
                                New Password
                            </Label>
                            <Input
                                type="password"
                                {...register('password')}
                                id="password"
                                disabled={isLoading}
                                placeholder="••••••••"
                                className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
                                aria-describedby="password-error"
                            />
                            {errors.password && (
                                <p id="password-error" className="text-sm text-red-500">{errors.password.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-base text-white">
                                Confirm New Password
                            </Label>
                            <Input
                                type="password"
                                {...register('confirmPassword')}
                                id="confirmPassword"
                                disabled={isLoading}
                                placeholder="••••••••"
                                className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
                                aria-describedby="confirmPassword-error"
                            />
                            {errors.confirmPassword && (
                                <p id="confirmPassword-error" className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                            )}
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-12 bg-white text-black hover:bg-gray-100"
                            disabled={isLoading}>
                            {isLoading ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Button
                        asChild
                        variant="link"
                        className="text-gray-400 hover:text-white"
                        disabled={isLoading}>
                        <Link href="/login">Back to Sign In</Link>
                    </Button>
                </div>
            </form>
        </section>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen bg-black items-center justify-center">
            <div className="text-white">Loading...</div>
        </div>}>
            <ResetPasswordContent />
        </Suspense>
    )
}
