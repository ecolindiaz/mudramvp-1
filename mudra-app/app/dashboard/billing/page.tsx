"use client"

import React, { useState, useEffect } from "react"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, Check, CreditCard, Download, ExternalLink, Sparkles, Zap } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { format } from "date-fns"

interface BillingInfo {
  plan: "free" | "starter" | "pro" | "enterprise"
  billingCycle: "monthly" | "yearly"
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  paymentMethod?: {
    type: string
    last4: string
    brand: string
  }
}

interface Invoice {
  id: string
  date: Date
  amount: number
  status: "paid" | "pending" | "failed"
  invoiceUrl: string
}

const plans = [
  {
    name: "Free",
    id: "free",
    price: { monthly: 0, yearly: 0 },
    description: "Perfect for trying out Mudra",
    features: [
      "100 AI visibility tests",
      "Basic technical analysis",
      "1 brand profile",
      "Email support"
    ],
  },
  {
    name: "Starter",
    id: "starter",
    price: { monthly: 49, yearly: 470 },
    description: "For growing startups",
    features: [
      "1,000 AI visibility tests per month",
      "Advanced technical analysis",
      "3 brand profiles",
      "Priority email support",
      "30-day data retention",
      "Custom prompts",
      "Competitor tracking",
      "Weekly reports"
    ],
    popular: true
  },
  {
    name: "Pro",
    id: "pro",
    price: { monthly: 149, yearly: 1430 },
    description: "For scaling businesses",
    features: [
      "Unlimited AI visibility tests",
      "Full technical analysis suite",
      "10 brand profiles",
      "Priority support + Slack",
      "Unlimited data retention",
      "Advanced custom prompts",
      "Competitive intelligence",
      "Daily reports",
      "API access",
      "White-label reports",
      "Team collaboration"
    ]
  },
  {
    name: "Enterprise",
    id: "enterprise",
    price: { monthly: null, yearly: null },
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "Unlimited brand profiles",
      "Dedicated account manager",
      "24/7 phone support",
      "Custom integrations",
      "SLA guarantee",
      "On-premise deployment option",
      "Custom contracts",
      "Advanced security features"
    ],
    cta: "Contact Sales"
  }
]

function BillingPageInner() {
  const [loading, setLoading] = useState(false)
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    plan: "free",
    billingCycle: "monthly",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false
  })
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    fetchBillingInfo()
    fetchInvoices()
  }, [])

  const fetchBillingInfo = async () => {
    try {
      const response = await fetch("/api/billing/info")
      const result = await response.json()
      
      if (response.ok && result.data) {
        setBillingInfo({
          ...result.data,
          currentPeriodEnd: new Date(result.data.currentPeriodEnd)
        })
      }
    } catch (error) {
      console.error("Error fetching billing info:", error)
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/billing/invoices")
      const result = await response.json()
      
      if (response.ok && result.data) {
        setInvoices(result.data.map((inv: any) => ({
          ...inv,
          date: new Date(inv.date)
        })))
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
    }
  }

  const handleUpgrade = async (planId: string) => {
    setSelectedPlan(planId)
    setShowUpgradeDialog(true)
  }

  const confirmUpgrade = async () => {
    if (!selectedPlan) return
    
    setLoading(true)

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan,
          billingCycle
        }),
      })

      const result = await response.json()

      if (response.ok) {
        if (result.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = result.checkoutUrl
        } else {
          toast.success("Plan upgraded successfully")
          await fetchBillingInfo()
          setShowUpgradeDialog(false)
        }
      } else {
        toast.error(result.error?.message || "Failed to upgrade plan")
      }
    } catch (error) {
      console.error("Error upgrading plan:", error)
      toast.error("An error occurred while upgrading your plan")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll continue to have access until the end of your billing period.")) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
      })

      const result = await response.json()

      if (response.ok) {
        toast.success("Subscription cancelled successfully")
        await fetchBillingInfo()
      } else {
        toast.error(result.error?.message || "Failed to cancel subscription")
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error)
      toast.error("An error occurred while cancelling your subscription")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePaymentMethod = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/billing/payment-method", {
        method: "POST",
      })

      const result = await response.json()

      if (response.ok && result.sessionUrl) {
        window.location.href = result.sessionUrl
      } else {
        toast.error("Failed to update payment method")
      }
    } catch (error) {
      console.error("Error updating payment method:", error)
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const currentPlanDetails = plans.find(p => p.id === billingInfo.plan)
  const yearlyDiscount = 20 // 20% discount for yearly
  const simpleFeatures = (list: string[]) => list.slice(0, 4)

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="@container/main flex flex-1 flex-col">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-6 pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Billing & Plans</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Keep your subscription simple and up to date.
                  </p>
                </div>
              </div>
            </div>

            {/* Divider Line */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content */}
            <div className="flex-1 px-4 lg:px-6 py-6 space-y-6">
              {/* Current Plan */}
              <Card className="bg-transparent border-white/[0.04]">
                <CardHeader className="flex flex-col gap-2">
                      <CardTitle className="text-white">Current Plan</CardTitle>
                  <CardDescription className="text-white/60">
                    You’re on the {currentPlanDetails?.name} plan.
                      </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-white/[0.04] p-3">
                    <p className="text-xs text-white/50">Billing cycle</p>
                      <p className="text-lg font-semibold text-white capitalize">{billingInfo.billingCycle}</p>
                    </div>
                  <div className="rounded-lg border border-white/[0.04] p-3">
                    <p className="text-xs text-white/50">Next billing</p>
                      <p className="text-lg font-semibold text-white">
                        {format(billingInfo.currentPeriodEnd, "MMM d, yyyy")}
                      </p>
                    </div>
                  <div className="rounded-lg border border-white/[0.04] p-3">
                    <p className="text-xs text-white/50">Amount</p>
                      <p className="text-lg font-semibold text-white">
                        ${currentPlanDetails?.price[billingInfo.billingCycle] || 0}/{billingInfo.billingCycle === "monthly" ? "mo" : "yr"}
                      </p>
                  </div>
                  <div className="col-span-1 md:col-span-3 flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleUpdatePaymentMethod}
                      disabled={loading}
                      className="h-9 border-white/20 text-white hover:bg-white/10"
                    >
                      Update payment method
                    </Button>
                    {billingInfo.plan !== "free" && (
                      <Button
                        variant="ghost"
                        onClick={handleCancelSubscription}
                        disabled={loading}
                        className="h-9 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        Cancel subscription
                      </Button>
                    )}
                    </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              {billingInfo.paymentMethod && (
                <Card className="bg-transparent border-white/[0.04]">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 bg-white rounded-md flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-black" />
                        </div>
                        <div>
                          <p className="text-white font-medium capitalize">{billingInfo.paymentMethod.brand}</p>
                          <p className="text-sm text-white/50">•••• •••• •••• {billingInfo.paymentMethod.last4}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdatePaymentMethod}
                        disabled={loading}
                      className="h-9 border-white/20 text-white hover:bg-white/10"
                      >
                        Update
                      </Button>
                  </CardContent>
                </Card>
              )}

              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center gap-2 py-2">
                {(["monthly", "yearly"] as const).map((cycle) => (
                <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${
                      billingCycle === cycle
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                    {cycle === "yearly" ? `Yearly · Save ${yearlyDiscount}%` : "Monthly"}
                </button>
                ))}
              </div>

              {/* Available Plans */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const price = plan.price[billingCycle]
                  const isCurrentPlan = plan.id === billingInfo.plan
                  
                  return (
                    <Card
                      key={plan.id}
                      className={`bg-transparent border-white/[0.04] ${isCurrentPlan ? "ring-1 ring-white/30" : ""}`}
                    >
                      <CardHeader>
                        <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                        <CardDescription className="text-white/60">
                          {plan.description}
                        </CardDescription>
                        <div className="pt-4">
                          {price !== null ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold text-white">${price}</span>
                              <span className="text-white/60">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                            </div>
                          ) : (
                            <div className="text-2xl font-bold text-white">Custom</div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-1">
                          {simpleFeatures(plan.features).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-white/80">
                              <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {!isCurrentPlan && (
                          <Button
                            onClick={() => plan.id === "enterprise" ? window.location.href = "mailto:sales@mudra.ai" : handleUpgrade(plan.id)}
                            disabled={loading || isCurrentPlan}
                            className="w-full h-9 bg-white text-black border border-white hover:bg-white/90 shadow-none"
                          >
                            {plan.cta || "Upgrade"}
                            {plan.id !== "enterprise" && <Zap className="h-4 w-4 ml-2" />}
                          </Button>
                        )}
                        {isCurrentPlan && (
                          <Button
                            variant="outline"
                            disabled
                            className="w-full h-9 border-white/20 text-white/70"
                          >
                            Current plan
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Invoices */}
              <Card className="bg-transparent border-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-white">Billing History</CardTitle>
                  <CardDescription className="text-white/60">
                    Past invoices and receipts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invoices.length > 0 ? (
                    <div className="space-y-2">
                      {invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-white/[0.04]"
                        >
                            <div>
                              <p className="text-white font-medium">
                              {format(invoice.date, "MMM d, yyyy")}
                              </p>
                              <p className="text-sm text-white/50">${invoice.amount.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                invoice.status === "paid"
                                  ? "border-emerald-500/20 text-emerald-400"
                                  : invoice.status === "pending"
                                  ? "border-amber-500/20 text-amber-400"
                                  : "border-red-500/20 text-red-400"
                              }
                            >
                              {invoice.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(invoice.invoiceUrl, "_blank")}
                              className="h-9 border-white/20 text-white hover:bg-white/10"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-white/50">
                      <p>No billing history yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="bg-[#1a1a1a] border-white/[0.04]">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Upgrade</DialogTitle>
            <DialogDescription className="text-white/60">
              You're about to upgrade to the {plans.find(p => p.id === selectedPlan)?.name} plan
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-white/5 border-white/[0.04]">
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="text-white">What happens next?</AlertTitle>
              <AlertDescription className="text-white/60">
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>You'll be redirected to our secure payment page</li>
                  <li>Your new plan will be active immediately</li>
                  <li>You'll be charged on a {billingCycle} basis</li>
                  <li>You can cancel or change your plan anytime</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
              disabled={loading}
              className="border-white/[0.04] text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmUpgrade}
              disabled={loading}
              className="bg-white text-black hover:bg-white/90"
            >
              {loading ? "Processing..." : "Continue to Payment"}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

export default function BillingPage() {
  return (
    <BrandProfileProvider>
      <BillingPageInner />
    </BrandProfileProvider>
  )
}
