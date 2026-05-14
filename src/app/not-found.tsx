import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0f0a1e] px-4 text-white">
      <h1 className="mb-4 text-4xl font-bold">404</h1>
      <p className="mb-6 text-gray-300">Page not found</p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-500"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
