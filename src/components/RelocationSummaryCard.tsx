import type { RelocationProfile } from '../types/timeline'

interface RelocationSummaryCardProps {
  profile: RelocationProfile
  activeServices: string[]
}

export function RelocationSummaryCard({ profile, activeServices }: RelocationSummaryCardProps) {
  const hasRoute = profile.fromCity || profile.toCity
  const origin = profile.fromCity ?? 'Your origin'
  const destination = profile.toCity ?? 'Your destination'

  return (
    <section className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-slate-100 shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Relocation Overview</p>
          <h2 className="text-2xl font-semibold text-white">
            {origin}
            <span className="mx-2 text-sky-300">→</span>
            {destination}
          </h2>
        </div>
        {profile.moveDate ? (
          <div className="rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-xs font-medium text-sky-200">
            Target move: {new Date(profile.moveDate).toLocaleDateString()}
          </div>
        ) : null}
      </header>

      <div className="mt-6 space-y-4">
        {hasRoute ? (
          <p className="text-sm text-slate-300/90">
            Tell the assistant more about timelines, family needs, or blockers. It will keep expanding the cards below with the next best steps.
          </p>
        ) : (
          <p className="text-sm text-slate-300/80">
            Share where you&apos;re moving from and to. The assistant will capture it and start building the journey for you.
          </p>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300/60">Active services</p>
          {activeServices.length ? (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm text-slate-100">
              {activeServices.map((label) => (
                <li key={label} className="rounded-full bg-slate-800/70 px-3 py-1">
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Ask the voice assistant about topics like immigration, housing, or shipping to activate their timelines.
            </p>
          )}
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 bottom-0 h-24 rounded-t-full bg-sky-400/30 blur-3xl"
      />
    </section>
  )
}

