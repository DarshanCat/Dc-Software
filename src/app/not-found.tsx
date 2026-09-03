import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900">404</h1>
        <h2 className="text-lg font-semibold text-slate-700">Page Not Found</h2>
        <p className="text-xs text-slate-500">
          The page or operational queue you are looking for does not exist or you may not have authorization to view it.
        </p>
        <div>
          <Link
            href="/"
            className="inline-block rounded-md bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
