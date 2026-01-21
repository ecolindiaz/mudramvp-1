
"use client";
import React, { useEffect } from "react";

export default function ErrorPage({ error }: { error: Error }) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Something went wrong</h2>
      <p style={{ color: "#666" }}>An unexpected error occurred. Please try again later.</p>
    </div>
  );
}
