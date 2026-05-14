"use client";
// @ts-nocheck

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  const msg = error.message?.toLowerCase() ?? "";
  const isApiError =
    msg.includes("api") ||
    msg.includes("key") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("403");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0f0a1e] px-4 text-white">
      <h1 className="mb-4 text-3xl font-bold">
        {isApiError ? "Configuration Error" : "Something went wrong"}
      </h1>
      <p className="mb-6 max-w-md text-center text-gray-300">
        {isApiError
          ? "An API key may be missing or invalid. Check your .env.local file."
          : error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-500"
      >
        Try again
      </button>
    </div>
  );
}
