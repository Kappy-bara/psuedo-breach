import { requireUser } from "@/lib/session";
import { Terminal } from "@/components/Terminal";

export default async function TerminalPage() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">terminal</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Write <span className="text-accent-cyan">c-</span> on the left, run it, watch the
          console. <code className="text-ink">connect &lt;module&gt;</code> then{" "}
          <code className="text-ink">probe()</code> / <code className="text-ink">knock()</code>{" "}
          to talk to a module. Everything runs in your browser, sandboxed.
        </p>
      </div>
      <Terminal registerId={user.registerId} displayName={user.displayName} />
    </div>
  );
}
