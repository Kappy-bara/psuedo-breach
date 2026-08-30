import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-extrabold text-accent">404</p>
      <p className="mt-3 text-ink-dim">
        That route doesn&apos;t resolve. Maybe the module is locked, or maybe it
        never existed.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 border border-accent px-5 py-2 font-bold text-accent hover:bg-accent hover:text-bg transition-colors"
      >
        ← back to modules
      </Link>
    </div>
  );
}
