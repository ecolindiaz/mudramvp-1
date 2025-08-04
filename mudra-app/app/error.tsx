
"use client";
import React from "react";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div style={{ padding: 40 }}>
      <h2>Something went wrong</h2>
      <p style={{ color: "red" }}>{error?.message || "An unexpected error occurred."}</p>
    </div>
  );
}
