import { requireUser } from "@/lib/session";
import { Terminal } from "@/components/Terminal";

export default async function TerminalPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="kicker">{"// field kit"}</div>
        <h1 className="mt-1 font-display text-2xl font-bold">Toolkit</h1>
        <p className="mt-1 text-sm text-ink-dim">
          A little box of <span className="text-accent">c-</span> that decodes things for
          you. Totally optional — no room needs it. Type <code className="text-ink">help</code>.
        </p>
      </div>
      <Terminal />
    </div>
  );
}
