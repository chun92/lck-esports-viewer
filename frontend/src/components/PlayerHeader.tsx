import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { TeamLinkInfo } from '@/lib/knownTeams'
import { fallback, splitRoles, type PlayerMeta } from '@/lib/player'

interface Props {
  meta: PlayerMeta
  career: string
  teamInfo?: TeamLinkInfo | null
}

export function PlayerHeader({ meta, career, teamInfo }: Props) {
  const roles = splitRoles(meta.RoleLast || meta.Role)
  const isRetired = meta.IsRetired === '1'
  const teamLink = teamInfo?.OverviewPage ?? null

  return (
    <section className="mb-12 flex flex-col items-start justify-between gap-8 border-b border-border pb-8 min-[900px]:flex-row">
      <div className="flex min-w-0 items-start gap-6">
        {meta.LatestPhotoUrl && <PlayerPhoto url={meta.LatestPhotoUrl} alt={meta.ID} />}
        <div className="min-w-0">
        <h1 className="m-0 text-[64px] font-extrabold leading-none tracking-[-0.02em]">
          {fallback(meta.ID)}
        </h1>
        <div className="mt-2 text-[20px] font-medium text-text-muted">
          {fallback(meta.NativeName)} <span>·</span> {fallback(meta.Name)}
        </div>

        {(meta.Team || roles.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {meta.Team && (
              <TeamBadge
                name={meta.Team}
                logoUrl={teamInfo?.LogoUrl}
                link={teamLink}
              />
            )}
            {roles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-md border border-accent-sky/[0.4] bg-accent-sky/[0.14] px-3 py-[6px] text-[15px] font-bold leading-none text-accent-sky"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 min-[900px]:items-end">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-text-muted min-[900px]:justify-end">
          <span>{fallback(meta.Country)}</span>
          <span className="text-border">·</span>
          <span>Age {fallback(meta.Age)}</span>
          <span className="text-border">·</span>
          <span>{fallback(meta.Birthdate)}</span>
          <span className="text-border">·</span>
          <span>Career {career}</span>
        </div>
        {isRetired && (
          <span className="inline-flex items-center rounded-full border border-danger/[0.35] bg-danger/[0.12] px-3 py-[6px] text-[13px] font-semibold leading-none text-danger">
            Retired
          </span>
        )}
      </div>
    </section>
  )
}

function PlayerPhoto({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={url}
      alt={alt}
      onError={() => setBroken(true)}
      loading="lazy"
      className="h-[120px] w-[120px] shrink-0 rounded-md border border-border bg-bg-base object-cover"
    />
  )
}

interface TeamBadgeProps {
  name: string
  logoUrl?: string
  link: string | null
}

function TeamBadge({ name, logoUrl, link }: TeamBadgeProps) {
  const [broken, setBroken] = useState(false)
  const showLogo = logoUrl && !broken

  const inner = (
    <>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-7 w-7 shrink-0 rounded-sm object-contain"
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <div className="h-7 w-7 shrink-0 rounded-sm border border-accent-gold/[0.35] bg-accent-gold/[0.08]" />
      )}
      <span>{name}</span>
    </>
  )

  const baseClass =
    'inline-flex items-center gap-2 rounded-md border border-accent-gold/[0.4] bg-accent-gold/[0.14] px-3 py-[6px] text-[16px] font-bold leading-none text-accent-gold'

  if (link) {
    return (
      <Link
        to={`/team/${encodeURIComponent(link)}`}
        className={`${baseClass} hover:border-accent-gold hover:bg-accent-gold/[0.22]`}
      >
        {inner}
      </Link>
    )
  }
  return <span className={baseClass}>{inner}</span>
}
