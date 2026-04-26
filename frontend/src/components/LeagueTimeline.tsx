import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveTeamInfo, type TeamLinkMap } from '@/lib/knownTeams'
import type { LeagueTimelineCell } from '@/lib/player'

interface Props {
  timeline: LeagueTimelineCell[]
  totals: Record<string, number>
  knownTeams: TeamLinkMap | null
}

interface RowGroup {
  league: string
  short: string
  isInternational: boolean
  totalGames: number
  cellsByYear: Map<number, LeagueTimelineCell[]>
}

export function LeagueTimeline({ timeline, totals, knownTeams }: Props) {
  const { rows, years } = useMemo(
    () => buildRows(timeline, totals),
    [timeline, totals]
  )

  if (rows.length === 0) return null

  const intlRows = rows.filter((r) => r.isInternational)
  const domesticRows = rows.filter((r) => !r.isInternational)

  return (
    <section className="mb-12">
      <h2 className="mb-5 text-[24px] font-bold tracking-tight">Season Overview</h2>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-bg-surface">
        <div className="min-w-fit">
          <YearHeader years={years} />
          {intlRows.length > 0 && (
            <RowSection
              label="International"
              rows={intlRows}
              years={years}
              knownTeams={knownTeams}
            />
          )}
          {domesticRows.length > 0 && (
            <RowSection
              label="Domestic"
              rows={domesticRows}
              years={years}
              knownTeams={knownTeams}
            />
          )}
        </div>
      </div>
    </section>
  )
}

const LABEL_COL = 'min-w-[180px] max-w-[240px]'
const YEAR_COL = 'min-w-[56px] w-[56px]'

function YearHeader({ years }: { years: number[] }) {
  return (
    <div className="flex border-b border-border bg-bg-base/40 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
      <div className={`${LABEL_COL} shrink-0 px-3 py-2`}>League</div>
      <div className="flex">
        {years.map((y) => (
          <div
            key={y}
            className={`${YEAR_COL} shrink-0 border-l border-border px-1 py-2 text-center tabular-nums`}
          >
            {y}
          </div>
        ))}
      </div>
    </div>
  )
}

function RowSection({
  label,
  rows,
  years,
  knownTeams,
}: {
  label: string
  rows: RowGroup[]
  years: number[]
  knownTeams: TeamLinkMap | null
}) {
  return (
    <>
      <div className="flex border-b border-border bg-bg-base/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-gold">
        {label}
      </div>
      {rows.map((row) => (
        <TimelineRow
          key={row.league}
          row={row}
          years={years}
          knownTeams={knownTeams}
        />
      ))}
    </>
  )
}

function TimelineRow({
  row,
  years,
  knownTeams,
}: {
  row: RowGroup
  years: number[]
  knownTeams: TeamLinkMap | null
}) {
  return (
    <div className="flex border-b border-border last:border-b-0 hover:bg-bg-base/40">
      <div
        className={`${LABEL_COL} flex shrink-0 flex-col justify-center px-3 py-2`}
      >
        <div className="truncate text-[14px] font-semibold text-text-primary">
          {row.league}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
          {row.short && row.short !== row.league && <span>{row.short}</span>}
          {row.totalGames > 0 && (
            <span className="tabular-nums normal-case tracking-normal">
              {row.totalGames.toLocaleString()} games
            </span>
          )}
        </div>
      </div>
      <div className="flex">
        {years.map((y) => {
          const cells = row.cellsByYear.get(y) ?? []
          return (
            <YearCell
              key={y}
              cells={cells}
              isInternational={row.isInternational}
              knownTeams={knownTeams}
            />
          )
        })}
      </div>
    </div>
  )
}

function YearCell({
  cells,
  isInternational,
  knownTeams,
}: {
  cells: LeagueTimelineCell[]
  isInternational: boolean
  knownTeams: TeamLinkMap | null
}) {
  if (cells.length === 0) {
    return <div className={`${YEAR_COL} shrink-0 border-l border-border`} />
  }
  return (
    <div className={`${YEAR_COL} shrink-0 border-l border-border p-1`}>
      <div className="flex h-full flex-col gap-0.5">
        {cells.map((c, i) => (
          <CellChip
            key={`${c.Team}-${i}`}
            cell={c}
            isInternational={isInternational}
            knownTeams={knownTeams}
          />
        ))}
      </div>
    </div>
  )
}

function CellChip({
  cell,
  isInternational,
  knownTeams,
}: {
  cell: LeagueTimelineCell
  isInternational: boolean
  knownTeams: TeamLinkMap | null
}) {
  const [logoBroken, setLogoBroken] = useState(false)
  const info = resolveTeamInfo(knownTeams, cell.Team)
  const splitLine =
    !isInternational && cell.Splits.length > 0 ? `\n${cell.Splits.join(', ')}` : ''
  const tooltip = `${cell.Year} · ${cell.League} · ${cell.Team}${splitLine}`

  const baseClass = isInternational
    ? 'border-accent-gold/[0.4] bg-accent-gold/[0.12]'
    : 'border-accent-sky/[0.35] bg-accent-sky/[0.10]'

  const inner = (
    <div
      title={tooltip}
      className={`flex h-7 items-center gap-1 rounded-[4px] border px-1 text-[11px] ${baseClass}`}
    >
      {info?.LogoUrl && !logoBroken ? (
        <img
          src={info.LogoUrl}
          alt={cell.Team}
          loading="lazy"
          onError={() => setLogoBroken(true)}
          className="h-5 w-5 shrink-0 object-contain"
        />
      ) : (
        <div className="h-5 w-5 shrink-0 rounded-sm border border-border bg-bg-base" />
      )}
      <span className="truncate text-text-primary">{cell.Team}</span>
    </div>
  )

  if (info?.OverviewPage) {
    return (
      <Link
        to={`/team/${encodeURIComponent(info.OverviewPage)}`}
        className="block hover:brightness-125"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

function buildRows(
  timeline: LeagueTimelineCell[],
  totals: Record<string, number>
): {
  rows: RowGroup[]
  years: number[]
} {
  if (timeline.length === 0) return { rows: [], years: [] }

  const yearsSet = new Set<number>()
  const byLeague = new Map<string, RowGroup>()

  for (const cell of timeline) {
    yearsSet.add(cell.Year)
    let row = byLeague.get(cell.League)
    if (!row) {
      row = {
        league: cell.League,
        short: cell.LeagueShort,
        isInternational: cell.IsInternational,
        totalGames: totals[cell.League] ?? 0,
        cellsByYear: new Map(),
      }
      byLeague.set(cell.League, row)
    }
    const list = row.cellsByYear.get(cell.Year) ?? []
    list.push(cell)
    row.cellsByYear.set(cell.Year, list)
  }

  const minYear = Math.min(...yearsSet)
  const maxYear = Math.max(...yearsSet)
  const years: number[] = []
  for (let y = minYear; y <= maxYear; y++) years.push(y)

  const rows = Array.from(byLeague.values()).sort((a, b) => {
    if (a.isInternational !== b.isInternational) {
      return a.isInternational ? -1 : 1
    }
    return a.league.localeCompare(b.league)
  })

  return { rows, years }
}
