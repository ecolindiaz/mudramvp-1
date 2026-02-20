"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowRight, Copy, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { useOnboarding } from "./onboarding-context"
import { signIn } from "next-auth/react"

export function AccountForm() {
  const router = useRouter()
  const { updateData } = useOnboarding()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [userId, setUserId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Generate a secure random password
  const generatePassword = () => {
    const length = 16
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const handleCreateAccount = async () => {
    if (!username.trim()) {
      setError("Please enter a username")
      return
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Generate password
      const password = generatePassword()
      setGeneratedPassword(password)

      // Create account
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create account")
      }

      const data = await response.json()
      console.log("✅ Account created:", data)
      
      setUserId(data.userId)
      
      // Store userId in onboarding context
      updateData({ userId: data.userId, username })

      // Send credentials email
      try {
        const emailResponse = await fetch("/api/auth/send-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password })
        })
        
        if (emailResponse.ok) {
          setEmailSent(true)
          console.log("✅ Credentials email sent")
        }
      } catch (emailErr) {
        console.error("Failed to send email:", emailErr)
        // Don't block the flow if email fails
      }

      // Auto-login the user
      const signInResult = await signIn("credentials", {
        username,
        password,
        redirect: false
      })

      if (signInResult?.error) {
        console.error("Auto-login failed:", signInResult.error)
        setError("Account created but login failed. Please log in manually.")
      } else {
        console.log("✅ User automatically logged in")
      }

    } catch (err: any) {
      console.error("Registration error:", err)
      setError(err.message)
      setIsLoading(false)
    }
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNext = () => {
    // Navigate to brand profile creation
    router.push("/welcome/basics")
  }

  const isAccountCreated = userId !== null && generatedPassword !== ""

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          {isAccountCreated ? "Account Created! 🎉" : "Create Your Account"}
        </CardTitle>
        <CardDescription className="text-white/70">
          {isAccountCreated 
            ? "Save your credentials - you'll need them to log in"
            : "Choose a username to get started with Mudra Beta"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAccountCreated ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  className="bg-white/5 border-[1.5px] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
                  disabled={isLoading}
                />
                <p className="text-xs text-white/50">
                  This will be your login username
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="bg-white/5 border-[1.5px] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
                  disabled={isLoading}
                />
                <p className="text-xs text-white/50">
                  We'll send your beta password to this email
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

              <Button
                onClick={handleCreateAccount}
                disabled={isLoading || !username.trim() || !email.trim()}
              className="w-full h-9 bg-white text-black border border-white hover:bg-white/90 shadow-none disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start space-x-2">
                <div className="text-white/70 text-sm mt-0.5">ℹ️</div>
                <div className="text-white/70 text-sm">
                  <p className="font-medium text-white mb-1">Beta Access</p>
                  <p>We'll generate a secure password for you. Make sure to save it!</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              {/* Username Display */}
              <div className="space-y-2">
                <Label className="text-white">Username</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    value={username}
                    readOnly
                    className="bg-white/5 border-white/20 text-white"
                  />
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>

              {/* Password Display */}
              <div className="space-y-2">
                <Label className="text-white">Generated Password</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={generatedPassword}
                      readOnly
                      className="bg-white/5 border-white/20 text-white pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleCopyPassword}
                    variant="outline"
                    size="icon"
                    className="border-white/20 hover:bg-white/10"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-white/50">
                  {copied ? "Copied to clipboard!" : "Click to copy and save this password"}
                </p>
              </div>

              {/* Email Sent Confirmation */}
              {emailSent && (
                <Alert className="bg-green-500/10 border-green-500/30">
                  <AlertDescription className="text-green-200 text-sm">
                    ✅ <strong>Email sent!</strong> We've sent your login credentials to {email}
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning */}
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertDescription className="text-yellow-200 text-sm">
                  ⚠️ <strong>Important:</strong> Save this password now! {emailSent ? "Check your email for a copy." : "You'll need it to log in later."}
                </AlertDescription>
              </Alert>
            </div>

              <Button
                onClick={handleNext}
              className="w-full h-9 bg-white text-black border border-white hover:bg-white/90 shadow-none disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
              >
                Continue to Brand Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
