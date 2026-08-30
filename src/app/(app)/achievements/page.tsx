import { requireUser } from "@/lib/session";
import { getAchievements } from "@/lib/achievements";
import { Markdown } from "@/components/Markdown";

export default async function AchievementsPage() {
  const user = await requireUser();
  const list = await getAchievements(user.id, user.eventId);
  const got = list.filter((a) => a.unlocked).length;
  const shown = list.filter((a) => a.unlocked || !a.hidden);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="mt-1 text-sm text-ink-dim">
          <span className="text-accent">{got}</span> / {list.length} earned. The highest-priority
          one you hold becomes the title next to your name.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <div
            key={a.key}
            className={`panel p-4 ${a.unlocked ? "border-verified/40" : "opacity-60"}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl grayscale-[0.2]" style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>
                {a.icon}
              </span>
              <div className="min-w-0">
                <div className="font-display font-bold">{a.name}</div>
                <Markdown className="mt-0.5 text-sm text-ink-dim">{a.descriptionMd}</Markdown>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                  {a.credReward > 0 && <span>💰 {a.credReward}</span>}
                  {a.title && <span>title: “{a.title}”</span>}
                  {a.unlocked && a.unlockedAt && (
                    <span className="text-verified">
                      ✓ {new Date(a.unlockedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {list.some((a) => a.hidden && !a.unlocked) && (
          <div className="panel flex items-center justify-center p-4 text-sm text-ink-faint">
            + {list.filter((a) => a.hidden && !a.unlocked).length} hidden
          </div>
        )}
      </div>
    </div>
  );
}
