import { fallback, splitRoles, type PlayerMeta } from '@/lib/player'

interface Props {
  meta: PlayerMeta
  career: string
}

export function PlayerHeader({ meta, career }: Props) {
  const roles = splitRoles(meta.RoleLast || meta.Role)
  const isRetired = meta.IsRetired === '1'

  return (
    <section className="mb-12 flex flex-col items-start justify-between gap-8 border-b border-border pb-8 min-[900px]:flex-row">
      <div className="min-w-0">
        <h1 className="m-0 text-[64px] font-extrabold leading-none tracking-[-0.02em]">
          {fallback(meta.ID)}
        </h1>
        <div className="mt-2 text-[20px] font-medium text-text-muted">
          {fallback(meta.NativeName)} <span>·</span> {fallback(meta.Name)}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[14px] text-text-muted">
          <span>{fallback(meta.Country)}</span>
          <span className="text-border">·</span>
          <span>Age {fallback(meta.Age)}</span>
          <span className="text-border">·</span>
          <span>{fallback(meta.Birthdate)}</span>
          <span className="text-border">·</span>
          <span>Career {career}</span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 min-[900px]:items-end">
        <div className="flex flex-wrap justify-start gap-2 min-[900px]:justify-end">
          {meta.Team && (
            <span className="inline-flex items-center rounded-full border border-accent-gold/[0.35] bg-accent-gold/[0.12] px-3 py-[6px] text-[13px] font-semibold leading-none text-accent-gold">
              {meta.Team}
            </span>
          )}
          {roles.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-full border border-accent-sky/[0.35] bg-accent-sky/[0.12] px-3 py-[6px] text-[13px] font-semibold leading-none text-accent-sky"
            >
              {r}
            </span>
          ))}
          {isRetired && (
            <span className="inline-flex items-center rounded-full border border-danger/[0.35] bg-danger/[0.12] px-3 py-[6px] text-[13px] font-semibold leading-none text-danger">
              Retired
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
