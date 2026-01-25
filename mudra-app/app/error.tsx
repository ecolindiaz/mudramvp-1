
"use client";
import React, { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#dc2626' }}>Something went wrong</h2>
      <p style={{ color: "#666" }}>An unexpected error occurred. Please try again later.</p>
      
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: 20, padding: 16, background: '#fee2e2', borderRadius: 8 }}>
          <p style={{ fontWeight: 'bold', color: '#991b1b' }}>{error.name}: {error.message}</p>
          <pre style={{ fontSize: 12, overflow: 'auto', marginTop: 8, color: '#7f1d1d' }}>
            {error.stack}
          </pre>
        </div>
      )}
      
      {error.digest && (
        <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
          Error ID: {error.digest}
        </p>
      )}
      
      <button
        onClick={reset}
        style={{
          marginTop: 20,
          padding: '10px 20px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 500
        }}
      >
        Try Again
      </button>
    </div>
  );
}
