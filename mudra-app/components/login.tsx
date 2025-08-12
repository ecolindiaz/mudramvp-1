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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema)
    })

    const onSubmit = async (data: LoginFormData) => {
        try {
            setIsLoading(true)
            // TODO: Implement login logic
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                throw new Error('Login failed')
            }

            // Handle successful login
            toast.success('Login successful')
        } catch (error) {
            toast.error('Login failed. Please try again.')
            console.error('Login error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <section className="flex min-h-screen bg-black px-4 py-16 md:py-32">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-black m-auto h-fit w-full max-w-sm rounded-lg border border-[#222222] p-6">
                <div className="space-y-8">
                    <div className="flex flex-col items-center space-y-2 text-center">
                        <div className="mb-6">
                            <Image
                                src="/images/mudra-logo.png"
                                alt="Mudra"
                                width={100}
                                height={100}
                                className="mx-auto drop-shadow-sm"
                                priority
                            />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">Sign in to Mudra</h1>
                        <p className="text-base text-gray-400">Welcome back! Sign in to continue</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-12 border-[#222222] text-white hover:bg-[#111111]"
                            disabled={isLoading}>
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
                            <span>Google</span>
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[#222222]" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-6 text-gray-400 text-base">
                                OR CONTINUE WITH
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label
                                htmlFor="email"
                                className="text-base text-white">
                                Email
                            </Label>
                            <Input
                                type="email"
                                {...register('email')}
                                id="email"
                                disabled={isLoading}
                                className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
                                aria-describedby="email-error"
                            />
                            {errors.email && (
                                <p id="email-error" className="text-sm text-red-500">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="password"
                                    className="text-base text-white">
                                    Password
                                </Label>
                                <Button
                                    asChild
                                    variant="link"
                                    size="sm"
                                    className="text-gray-400 hover:text-white"
                                    disabled={isLoading}>
                                    <Link href="/forgot-password">
                                        Forgot your Password?
                                    </Link>
                                </Button>
                            </div>
                            <Input
                                type="password"
                                {...register('password')}
                                id="password"
                                disabled={isLoading}
                                className="h-12 bg-[#111111] border-[#222222] text-white placeholder:text-gray-500"
                                aria-describedby="password-error"
                            />
                            {errors.password && (
                                <p id="password-error" className="text-sm text-red-500">{errors.password.message}</p>
                            )}
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-12 bg-white text-black hover:bg-gray-100"
                            disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-400">
                        Don't have an account?{" "}
                        <Button
                            asChild
                            variant="link"
                            className="text-gray-400 hover:text-white"
                            disabled={isLoading}>
                            <Link href="/signup">Create Account</Link>
                        </Button>
                    </p>
                </div>
            </form>
        </section>
    )
}
