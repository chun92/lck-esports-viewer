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
    <section className="mb-12 flex flex-col items-start gap-8 border-b border-border pb-8 min-[700px]:flex-row">
      {meta.LatestPhotoUrl && <PlayerPhoto url={meta.LatestPhotoUrl} alt={meta.ID} />}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[64px] font-extrabold leading-none tracking-[-0.02em]">
              {fallback(meta.ID)}
            </h1>
            <div className="mt-2 text-[20px] font-medium text-text-muted">
              {fallback(meta.NativeName)} <span>·</span> {fallback(meta.Name)}
            </div>
          </div>
          {isRetired && (
            <span className="inline-flex items-center rounded-full border border-danger/[0.35] bg-danger/[0.12] px-3 py-[6px] text-[13px] font-semibold leading-none text-danger">
              Retired
            </span>
          )}
        </div>

        {(meta.Team || roles.length > 0) && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {meta.Team && (
              <TeamLine
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
                    className="inline-flex items-center rounded-md border border-accent-sky/[0.4] bg-accent-sky/[0.14] px-2.5 py-[5px] text-[13px] font-semibold leading-none text-accent-sky"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-text-muted">
          <span>{fallback(meta.Country)}</span>
          <span className="text-border">·</span>
          <span>Age {fallback(meta.Age)}</span>
          <span className="text-border">·</span>
          <span>{fallback(meta.Birthdate)}</span>
          <span className="text-border">·</span>
          <span>Career {career}</span>
        </div>
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
      className="h-[280px] w-[224px] shrink-0 rounded-lg border border-border bg-bg-base object-cover"
    />
  )
}

interface TeamLineProps {
  name: string
  logoUrl?: string
  link: string | null
}

function TeamLine({ name, logoUrl, link }: TeamLineProps) {
  const [broken, setBroken] = useState(false)
  const showLogo = logoUrl && !broken

  const inner = (
    <>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-10 w-10 shrink-0 rounded-sm object-contain"
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-sm border border-border bg-bg-base" />
      )}
      <span className="text-[22px] font-semibold leading-none">{name}</span>
    </>
  )

  const baseClass = 'inline-flex items-center gap-3 text-text-primary'

  if (link) {
    return (
      <Link
        to={`/team/${encodeURIComponent(link)}`}
        className={`${baseClass} group hover:text-accent-sky`}
      >
        {inner}
      </Link>
    )
  }
  return <span className={baseClass}>{inner}</span>
}
