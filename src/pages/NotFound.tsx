import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-slate-500 mb-4">The page you requested does not exist.</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Return home
        </Link>
      </div>
    </div>
  );
}
