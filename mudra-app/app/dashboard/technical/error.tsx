"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function TechnicalStructureErrorPage({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string }; 
  reset: () => void 
}) {
  useEffect(() => {
    console.error("Technical Structure page error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-grey p-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="text-white">Technical Structure Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-white/60">
            There was a problem loading the Technical Structure page.
          </p>
          
          {error.digest && (
            <p className="text-center text-xs text-white/40">
              Error ID: {error.digest}
            </p>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm font-mono text-red-400 break-all">
                {error.name}: {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
