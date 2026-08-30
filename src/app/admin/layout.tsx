import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { signOut } from "@/auth";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="border-b border-accent-amber/30 bg-panel/70 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4 text-sm">
          <span className="font-bold tracking-widest text-accent-amber">ADMIN</span>
          <nav className="flex gap-4 text-ink-dim">
            <Link href="/admin" className="hover:text-ink">
              control
            </Link>
            <Link href="/admin/users" className="hover:text-ink">
              users
            </Link>
            <Link href="/dashboard" className="hover:text-ink">
              ↪ participant view
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-ink-dim">
            <span>{admin.displayName}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="hover:text-accent-red">exit</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
