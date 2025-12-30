'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Image from 'next/image'

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    
    const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema)
    })

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setIsLoading(true)
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.email }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send reset email')
            }

            setEmailSent(true)
            toast.success('Password reset email sent!')
        } catch (error: any) {
            toast.error(error.message || 'An error occurred')
            console.error('Forgot password error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (emailSent) {
        return (
            <section className="flex min-h-screen bg-black px-4 py-16 md:py-32">
                <div className="bg-black m-auto h-fit w-full max-w-sm rounded-lg border border-[#222222] p-6">
                    <div className="space-y-6 text-center">
                        <div className="mb-4">
                            <Image
                                src="/images/MudraMainLogo.png"
                                alt="Mudra"
                                width={80}
                                height={80}
                                className="mx-auto"
                                priority
                            />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-white">Check your email</h1>
                            <p className="text-base text-gray-400">
                                We've sent a password reset link to your email address. Click the link to reset your password.
                            </p>
                        </div>
                        <Button 
                            asChild
                            className="w-full h-12 bg-white text-black hover:bg-gray-100">
                            <Link href="/login">Back to Sign In</Link>
                        </Button>
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
                                src="/images/MudraMainLogo.png"
                                alt="Mudra"
                                width={80}
                                height={80}
                                className="mx-auto"
                                priority
                            />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
                        <p className="text-base text-gray-400">
                            Enter your email and we'll send you a link to reset your password
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-base text-white">
                                Email
                            </Label>
                            <Input
                                type="email"
                                {...register('email')}
                                id="email"
                                disabled={isLoading}
                                placeholder="you@example.com"
                                className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
                                aria-describedby="email-error"
                            />
                            {errors.email && (
                                <p id="email-error" className="text-sm text-red-500">{errors.email.message}</p>
                            )}
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-12 bg-white text-black hover:bg-gray-100"
                            disabled={isLoading}>
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
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
