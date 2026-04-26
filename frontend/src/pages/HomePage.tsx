import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TopBar } from '@/components/TopBar'
import { fetchPlayers, fetchTeams, type PlayerListItem } from '@/lib/api'
import { yearsMonths } from '@/lib/player'
import type { TeamSummary } from '@/lib/team'

interface HomeData {
  teams: TeamSummary[]
  players: PlayerListItem[]
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HomeData }
  | { kind: 'error'; message: string }

const TOP_TENURED_LIMIT = 10

export function HomePage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ kind: 'loading' })
    Promise.all([
      fetchTeams(controller.signal),
      fetchPlayers(controller.signal),
    ])
      .then(([teams, players]) =>
        setStatus({ kind: 'ok', data: { teams, players } })
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        setStatus({ kind: 'error', message: msg })
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <Hero />

        {status.kind === 'loading' && (
          <p className="text-text-muted">Loading…</p>
        )}
        {status.kind === 'error' && (
          <div className="rounded-[10px] border border-danger/[0.35] bg-danger/[0.12] p-6 text-danger">
            {status.message}
          </div>
        )}
        {status.kind === 'ok' && (
          <>
            <ActiveTeamsSection teams={status.data.teams} />
            <TopTenuredSection players={status.data.players} />
          </>
        )}
      </main>
    </>
  )
}

function Hero() {
  return (
    <section className="mb-14 mt-2">
      <h1 className="text-[44px] font-extrabold leading-tight tracking-[-0.02em]">
        LCK Esports Viewer
      </h1>
      <p className="mt-3 max-w-[640px] text-[16px] text-text-muted">
        리그 오브 레전드 한국 리그(LCK)의 선수와 팀 정보를
        Leaguepedia 데이터로 살펴보세요.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <CtaCard
          to="/players"
          title="Players"
          description="현역/은퇴 선수의 커리어 타임라인과 프로필"
        />
        <CtaCard
          to="/teams"
          title="Teams"
          description="현역/해체 팀의 로스터와 선수 이력"
        />
      </div>
    </section>
  )
}

function CtaCard({
  to,
  title,
  description,
}: {
  to: string
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-4 rounded-[10px] border border-border bg-bg-surface px-6 py-5 transition-colors hover:border-accent-sky/[0.6]"
    >
      <div>
        <div className="text-[20px] font-bold text-text-primary group-hover:text-accent-sky">
          {title}
        </div>
        <div className="mt-1 text-[13px] text-text-muted">{description}</div>
      </div>
      <span
        aria-hidden
        className="text-[24px] text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent-sky"
      >
        →
      </span>
    </Link>
  )
}

const SECONDARY_SUFFIXES = [
  'Academy',
  'Challengers',
  'Scholars',
  'Rookies',
  'Youth',
  'Junior',
  'Global Academy',
  'Esports Academy',
]

function isMainKoreanTeam(t: TeamSummary): boolean {
  if (t.IsDisbanded || t.Region !== 'Korea') return false
  return !SECONDARY_SUFFIXES.some((s) => t.Name.endsWith(s))
}

function ActiveTeamsSection({ teams }: { teams: TeamSummary[] }) {
  const active = teams
    .filter(isMainKoreanTeam)
    .sort((a, b) => a.Name.localeCompare(b.Name))

  return (
    <section className="mb-14">
      <SectionHeader
        title="LCK Teams"
        subtitle={`현역 LCK 팀 ${active.length}개`}
        link={{ to: '/teams', label: 'View all →' }}
      />
      {active.length === 0 ? (
        <p className="text-text-muted">표시할 팀이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {active.map((t) => (
            <TeamCard key={t.OverviewPage} team={t} />
          ))}
        </div>
      )}
    </section>
  )
}

function TeamCard({ team }: { team: TeamSummary }) {
  const [broken, setBroken] = useState(false)
  const showLogo = team.LogoUrl && !broken
  return (
    <Link
      to={`/team/${encodeURIComponent(team.OverviewPage)}`}
      className="group flex flex-col items-center gap-3 rounded-[10px] border border-border bg-bg-surface p-4 transition-colors hover:border-accent-sky/[0.6]"
    >
      {showLogo ? (
        <img
          src={team.LogoUrl}
          alt={`${team.Name} logo`}
          className="h-16 w-16 object-contain"
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <div className="h-16 w-16 rounded-sm border border-border bg-bg-base" />
      )}
      <div className="text-center">
        <div className="text-[14px] font-semibold text-text-primary group-hover:text-accent-sky">
          {team.Name}
        </div>
        {team.Short && (
          <div className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">
            {team.Short}
          </div>
        )}
      </div>
    </Link>
  )
}

function TopTenuredSection({ players }: { players: PlayerListItem[] }) {
  const top = [...players]
    .filter((p) => p.CareerDays > 0)
    .sort((a, b) => b.CareerDays - a.CareerDays)
    .slice(0, TOP_TENURED_LIMIT)

  return (
    <section>
      <SectionHeader
        title="Most Tenured Players"
        subtitle={`커리어 누적 기간 Top ${top.length}`}
        link={{ to: '/players', label: 'View all →' }}
      />
      <ol className="overflow-hidden rounded-[10px] border border-border bg-bg-surface">
        {top.map((p, i) => (
          <li
            key={p.Player}
            className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-b-0 hover:bg-bg-base/50"
          >
            <span className="w-6 text-right text-[13px] font-bold tabular-nums text-text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                to={`/player/${encodeURIComponent(p.Player)}`}
                className="font-semibold text-accent-sky underline-offset-4 hover:underline"
              >
                {p.ID}
              </Link>
              <div className="mt-0.5 truncate text-[12px] text-text-muted">
                {[p.Position, p.Team].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span className="shrink-0 tabular-nums text-[13px] text-text-muted">
              {yearsMonths(p.CareerDays)}
            </span>
          </li>
        ))}
        {top.length === 0 && (
          <li className="px-5 py-6 text-center text-text-muted">
            데이터가 없습니다.
          </li>
        )}
      </ol>
    </section>
  )
}

function SectionHeader({
  title,
  subtitle,
  link,
}: {
  title: string
  subtitle?: string
  link?: { to: string; label: string }
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[24px] font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <div className="mt-1 text-[13px] text-text-muted">{subtitle}</div>
        )}
      </div>
      {link && (
        <Link
          to={link.to}
          className="shrink-0 text-[13px] text-text-muted hover:text-accent-sky"
        >
          {link.label}
        </Link>
      )}
    </div>
  )
}
