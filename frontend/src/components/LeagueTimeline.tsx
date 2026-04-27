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
  level: string
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
        <div className="w-fit min-w-full">
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
      <SplitLegend />
    </section>
  )
}

const LEGEND_ITEMS: Array<{ stripe: string; label: string }> = [
  { stripe: 'border-l-emerald-500', label: 'Spring' },
  { stripe: 'border-l-amber-500', label: 'Summer' },
  { stripe: 'border-l-sky-400', label: 'Winter / Kickoff' },
  { stripe: 'border-l-cyan-400', label: 'Split 1 / Opening' },
  { stripe: 'border-l-violet-400', label: 'Split 2 / Closing' },
  { stripe: 'border-l-rose-400', label: 'Cup' },
  { stripe: 'border-l-accent-gold', label: 'Championship / Intl' },
]

function SplitLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
      <span className="font-semibold uppercase tracking-wider">Split</span>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-1 rounded-[1px] border-l-4 ${item.stripe}`}
          />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold ring-1 ring-bg-surface" />
        Playoffs / Finals
      </span>
    </div>
  )
}

const LABEL_COL = 'w-[180px] min-w-[180px] max-w-[180px]'
const YEAR_COL = 'w-[56px] min-w-[56px] max-w-[56px]'

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

interface LevelStyle {
  border: string
  badge: string
  label: string
}

function levelStyle(level: string, isInternational: boolean): LevelStyle {
  if (isInternational) {
    return {
      border: 'border-l-accent-gold',
      badge: 'bg-accent-gold/[0.18] text-accent-gold',
      label: 'INTL',
    }
  }
  const norm = level.toLowerCase()
  if (norm === 'primary') {
    return {
      border: 'border-l-accent-sky',
      badge: 'bg-accent-sky/[0.18] text-accent-sky',
      label: 'TIER 1',
    }
  }
  if (norm === 'secondary') {
    return {
      border: 'border-l-success',
      badge: 'bg-success/[0.18] text-success',
      label: 'TIER 2',
    }
  }
  if (norm === 'tertiary' || norm === 'developmental') {
    return {
      border: 'border-l-text-muted',
      badge: 'bg-text-muted/[0.15] text-text-muted',
      label: 'TIER 3',
    }
  }
  return {
    border: 'border-l-border',
    badge: 'bg-border text-text-muted',
    label: '—',
  }
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
  const style = levelStyle(row.level, row.isInternational)
  const primaryLabel = row.short || row.league
  const subLabel = row.short && row.short !== row.league ? row.league : ''
  return (
    <div className="flex border-b border-border last:border-b-0 hover:bg-bg-base/40">
      <div
        className={`${LABEL_COL} flex shrink-0 items-center gap-2 border-l-4 ${style.border} px-3 py-2`}
        title={subLabel || primaryLabel}
      >
        <span
          className={`shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
        >
          {style.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-text-primary">
            {primaryLabel}
          </div>
          {(subLabel || row.totalGames > 0) && (
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
              {subLabel && <span className="truncate">{subLabel}</span>}
              {row.totalGames > 0 && (
                <span className="shrink-0 tabular-nums">
                  {row.totalGames.toLocaleString()}g
                </span>
              )}
            </div>
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

interface SplitChip {
  team: string
  splitLabel: string
}

function expandCellsToChips(
  cells: LeagueTimelineCell[],
  isInternational: boolean
): SplitChip[] {
  if (isInternational) {
    return cells.map((c) => ({ team: c.Team, splitLabel: '' }))
  }
  const chips: SplitChip[] = []
  for (const c of cells) {
    if (c.Splits.length === 0) {
      chips.push({ team: c.Team, splitLabel: '' })
    } else {
      for (const s of c.Splits) {
        chips.push({ team: c.Team, splitLabel: s })
      }
    }
  }
  return chips
}

// 좌측 컬러 스트라이프로 split 시즌 구분. 색상=시즌 family, stage(정규/Playoffs)는 칩 우상단 인디케이터.
// 2025+ LCK 포맷: Rounds 1-2 → Spring, Rounds 3-5 → Summer, Road to MSI → Spring PO, Season Playoffs → Summer PO.
// LCK 내 split "Cup"은 실제 Cup이 아니라 시즌 오프닝 Kickoff 토너먼트.
function splitStripeClass(label: string): string {
  const s = label.toLowerCase().trim()
  if (!s) return 'border-l-transparent'
  if (s.includes('spring') || s.includes('rounds 1-2') || s.includes('road to msi'))
    return 'border-l-emerald-500'
  if (s.includes('summer') || s.includes('rounds 3-5') || s.includes('season playoffs') || s.includes('season play-in'))
    return 'border-l-amber-500'
  if (s.includes('winter') || s.includes('kickoff') || s === 'cup')
    return 'border-l-sky-400'
  if (s.includes('split 1') || s.includes('opening') || s.includes('1st championship'))
    return 'border-l-cyan-400'
  if (s.includes('split 2') || s.includes('closing') || s.includes('2nd championship'))
    return 'border-l-violet-400'
  if (s.includes('kespa') || s.includes('cup')) return 'border-l-rose-400'
  if (s.includes('championship') || s.includes('finals')) return 'border-l-accent-gold'
  if (s.includes('playoffs')) return 'border-l-fuchsia-400'
  return 'border-l-text-muted/60'
}

function isPlayoffsStage(label: string): boolean {
  const s = label.toLowerCase()
  return /playoffs|finals|play-in|road to msi/.test(s)
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
  const chips = expandCellsToChips(cells, isInternational)
  return (
    <div className={`${YEAR_COL} shrink-0 border-l border-border p-1`}>
      <div className="flex h-full flex-col gap-0.5">
        {chips.map((chip, i) => (
          <CellChip
            key={`${chip.team}-${chip.splitLabel}-${i}`}
            chip={chip}
            isInternational={isInternational}
            knownTeams={knownTeams}
          />
        ))}
      </div>
    </div>
  )
}

function CellChip({
  chip,
  isInternational,
  knownTeams,
}: {
  chip: SplitChip
  isInternational: boolean
  knownTeams: TeamLinkMap | null
}) {
  const [logoBroken, setLogoBroken] = useState(false)
  const info = resolveTeamInfo(knownTeams, chip.team)
  const tooltip = chip.splitLabel
    ? `${chip.team} · ${chip.splitLabel}`
    : chip.team

  const baseClass = isInternational
    ? 'border-accent-gold/[0.4] bg-accent-gold/[0.12]'
    : 'border-accent-sky/[0.35] bg-accent-sky/[0.10]'
  const stripeClass = isInternational
    ? 'border-l-4 border-l-accent-gold'
    : `border-l-4 ${splitStripeClass(chip.splitLabel)}`
  const showPlayoffsMark = !isInternational && isPlayoffsStage(chip.splitLabel)

  const inner = (
    <div
      title={tooltip}
      className={`relative flex h-7 items-center justify-center rounded-[4px] border ${baseClass} ${stripeClass}`}
    >
      {showPlayoffsMark && (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent-gold ring-1 ring-bg-surface"
        />
      )}
      {info?.LogoUrl && !logoBroken ? (
        <img
          src={info.LogoUrl}
          alt={chip.team}
          loading="lazy"
          onError={() => setLogoBroken(true)}
          className="h-5 w-5 object-contain"
        />
      ) : (
        <span className="text-[10px] font-semibold text-text-muted">
          {chip.team.slice(0, 3).toUpperCase()}
        </span>
      )}
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
        level: cell.Level,
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
