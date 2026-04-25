import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { resolveTeamInfo, type TeamLinkInfo, type TeamLinkMap } from '@/lib/knownTeams'
import {
  EMPTY,
  fallback,
  formatPeriod,
  resolveDuration,
  sortHistoryAsc,
  type Tenure,
} from '@/lib/player'

interface Props {
  history: Tenure[]
  knownTeams?: TeamLinkMap | null
}

export function CareerTimeline({ history, knownTeams }: Props) {
  const sorted = sortHistoryAsc(history)
  const lastIdx = sorted.length - 1

  return (
    <section>
      <h2 className="mb-6 text-[22px] font-bold">Career Timeline</h2>
      <div className="relative pl-8 before:absolute before:left-[7px] before:top-[6px] before:bottom-[6px] before:w-[2px] before:bg-border before:content-['']">
        {sorted.map((t, i) => {
          const isLast = i === lastIdx
          const isCurrent = t.IsCurrent === '1' || (isLast && !t.EndDate)
          const dur = resolveDuration(t)
          return (
            <TimelineItem
              key={`${t.StartDate}-${t.Team}-${i}`}
              tenure={t}
              isLast={isLast}
              isCurrent={isCurrent}
              duration={dur}
              teamInfo={resolveTeamInfo(knownTeams, t.Team)}
            />
          )
        })}
      </div>
    </section>
  )
}

interface ItemProps {
  tenure: Tenure
  isLast: boolean
  isCurrent: boolean
  duration: number | null
  teamInfo: TeamLinkInfo | null
}

function TimelineItem({ tenure, isLast, isCurrent, duration, teamInfo }: ItemProps) {
  const teamLink = teamInfo?.OverviewPage ?? null
  const outerClass = cn(
    'relative mb-3 grid items-center gap-4 rounded-[10px] border border-border bg-bg-surface px-6 py-4',
    'grid-cols-1 min-[900px]:grid-cols-[200px_1fr_auto]',
    "before:absolute before:left-[-30px] before:top-1/2 before:h-3 before:w-3 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-bg-base before:bg-border before:content-['']",
    isCurrent &&
      'border-accent-sky bg-[linear-gradient(180deg,rgba(79,168,224,0.06),rgba(79,168,224,0.02))]',
    isCurrent &&
      'before:bg-accent-gold before:shadow-[0_0_0_3px_rgba(200,155,60,0.22),0_0_12px_rgba(200,155,60,0.55)]',
    teamLink &&
      'cursor-pointer transition-colors hover:border-accent-sky hover:bg-accent-sky/[0.06]'
  )
  const content = (
    <>
      <div
        className={cn(
          'text-[13px] tabular-nums',
          isCurrent ? 'font-semibold text-accent-sky' : 'text-text-muted'
        )}
      >
        {formatPeriod(tenure, isLast)}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo logoUrl={teamInfo?.LogoUrl} name={tenure.Team} />
        <span
          className={cn(
            'truncate text-[15px] font-bold',
            teamLink ? 'text-text-primary' : 'text-danger'
          )}
        >
          {fallback(tenure.Team)}
        </span>
      </div>
      <div className="flex items-center justify-start gap-3 min-[900px]:justify-end">
        <span className="inline-flex rounded-full border border-accent-sky/[0.25] bg-accent-sky/[0.1] px-[10px] py-[3px] text-[12px] font-semibold leading-[1.4] text-accent-sky">
          {fallback(tenure.Position)}
        </span>
        <span className="min-w-[80px] text-right text-[13px] text-text-muted tabular-nums">
          {duration !== null ? `${duration.toLocaleString()} days` : EMPTY}
        </span>
      </div>
    </>
  )

  if (teamLink) {
    return (
      <Link to={`/team/${encodeURIComponent(teamLink)}`} className={outerClass}>
        {content}
      </Link>
    )
  }
  return <div className={outerClass}>{content}</div>
}

function TeamLogo({ logoUrl, name }: { logoUrl?: string; name?: string }) {
  const [broken, setBroken] = useState(false)
  if (!logoUrl || broken) {
    return (
      <div
        aria-hidden
        className="h-6 w-6 shrink-0 rounded-full border border-border bg-bg-base"
      />
    )
  }
  return (
    <img
      src={logoUrl}
      alt={name ? `${name} logo` : ''}
      className="h-6 w-6 shrink-0 rounded-sm object-contain"
      onError={() => setBroken(true)}
      loading="lazy"
    />
  )
}
