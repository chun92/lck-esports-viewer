import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveTeamInfo, type TeamLinkMap } from '@/lib/knownTeams'
import type {
  LeagueClassification,
  LeagueStage,
  LeagueTimelineCell,
} from '@/lib/player'

interface Props {
  timeline: LeagueTimelineCell[]
  totals: Record<string, number>
  knownTeams: TeamLinkMap | null
}

interface RowGroup {
  league: string
  short: string
  level: string
  classification: LeagueClassification
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

  const intlRows = rows.filter((r) => r.classification === 'International')
  const domesticRows = rows.filter((r) => r.classification === 'Domestic')
  const eventRows = rows.filter((r) => r.classification === 'Events')

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
          {eventRows.length > 0 && (
            <RowSection
              label="Events"
              rows={eventRows}
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
  { stripe: 'border-l-emerald-500', label: 'Spring / Rounds 1-2' },
  { stripe: 'border-l-amber-500', label: 'Summer / Rounds 3-5' },
  { stripe: 'border-l-sky-400', label: 'Winter / Kickoff / Cup' },
  { stripe: 'border-l-cyan-400', label: 'Split 1 / Opening' },
  { stripe: 'border-l-violet-400', label: 'Split 2 / Closing' },
  { stripe: 'border-l-fuchsia-400', label: 'Split 3' },
  { stripe: 'border-l-accent-gold', label: 'Finals / Intl' },
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
        Playoffs
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-[3px] border border-dashed border-accent-sky/60 bg-accent-sky/10 opacity-60" />
        Unofficial
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

function levelStyle(
  level: string,
  classification: LeagueClassification
): LevelStyle {
  if (classification === 'International') {
    return {
      border: 'border-l-accent-gold',
      badge: 'bg-accent-gold/[0.18] text-accent-gold',
      label: 'INTL',
    }
  }
  if (classification === 'Events') {
    return {
      border: 'border-l-text-muted',
      badge: 'bg-text-muted/[0.18] text-text-muted',
      label: 'EVENT',
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
  const style = levelStyle(row.level, row.classification)
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
              classification={row.classification}
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
  stage: LeagueStage | null
}

function expandCellsToChips(
  cells: LeagueTimelineCell[],
  classification: LeagueClassification
): SplitChip[] {
  // International은 cell 단위로 통합(여러 스테이지가 있어도 한 칩). 그 외는 stage별로 분리.
  if (classification === 'International') {
    return cells.map((c) => ({ team: c.Team, stage: null }))
  }
  const chips: SplitChip[] = []
  for (const c of cells) {
    if (c.Stages.length === 0) {
      chips.push({ team: c.Team, stage: null })
    } else {
      for (const s of c.Stages) {
        chips.push({ team: c.Team, stage: s })
      }
    }
  }
  return chips
}

// Tournaments.Split 정규화 값 → 색상 family. exact match 위주로 단순화.
// LCK 2025+ Rounds 1-2/3-5는 Tournaments.Split에 그대로 저장되므로 직접 매핑.
// LCK의 Split="Cup"은 실제 Cup이 아닌 Kickoff 성격이라 Winter family로 묶음.
function splitStripeClass(split: string): string {
  switch (split) {
    case 'Spring':
    case 'Rounds 1-2':
      return 'border-l-emerald-500'
    case 'Summer':
    case 'Rounds 3-5':
    case 'Rounds 3-4':
      return 'border-l-amber-500'
    case 'Winter':
    case 'Kickoff':
    case 'Cup':
      return 'border-l-sky-400'
    case 'Split 1':
    case 'Opening':
    case 'Lock-In':
      return 'border-l-cyan-400'
    case 'Split 2':
    case 'Closing':
      return 'border-l-violet-400'
    case 'Split 3':
      return 'border-l-fuchsia-400'
    case 'Finals':
      return 'border-l-accent-gold'
    case '':
      return 'border-l-transparent'
    default:
      return 'border-l-text-muted/60'
  }
}

function YearCell({
  cells,
  classification,
  knownTeams,
}: {
  cells: LeagueTimelineCell[]
  classification: LeagueClassification
  knownTeams: TeamLinkMap | null
}) {
  if (cells.length === 0) {
    return <div className={`${YEAR_COL} shrink-0 border-l border-border`} />
  }
  const chips = expandCellsToChips(cells, classification)
  return (
    <div className={`${YEAR_COL} shrink-0 border-l border-border p-1`}>
      <div className="flex h-full flex-col gap-0.5">
        {chips.map((chip, i) => (
          <CellChip
            key={`${chip.team}-${chip.stage?.Page ?? 'cell'}-${i}`}
            chip={chip}
            classification={classification}
            knownTeams={knownTeams}
          />
        ))}
      </div>
    </div>
  )
}

function CellChip({
  chip,
  classification,
  knownTeams,
}: {
  chip: SplitChip
  classification: LeagueClassification
  knownTeams: TeamLinkMap | null
}) {
  const [logoBroken, setLogoBroken] = useState(false)
  const info = resolveTeamInfo(knownTeams, chip.team)
  const stage = chip.stage
  const split = stage?.Split ?? ''
  const isPlayoffs = stage?.IsPlayoffs ?? false
  const isUnofficial = stage ? !stage.IsOfficial : false
  const tooltipParts = [chip.team]
  if (split) tooltipParts.push(split)
  if (isPlayoffs) tooltipParts.push('Playoffs')
  if (isUnofficial) tooltipParts.push('Unofficial')
  const tooltip = tooltipParts.join(' · ')

  const baseClass =
    classification === 'International'
      ? 'border-accent-gold/[0.4] bg-accent-gold/[0.12]'
      : classification === 'Events'
        ? 'border-text-muted/[0.35] bg-text-muted/[0.08]'
        : 'border-accent-sky/[0.35] bg-accent-sky/[0.10]'
  const stripeClass =
    classification === 'International'
      ? 'border-l-4 border-l-accent-gold'
      : `border-l-4 ${splitStripeClass(split)}`
  const unofficialClass = isUnofficial
    ? 'border-dashed opacity-60'
    : ''
  const showPlayoffsMark = classification !== 'International' && isPlayoffs

  const inner = (
    <div
      title={tooltip}
      className={`relative flex h-7 items-center justify-center rounded-[4px] border ${baseClass} ${stripeClass} ${unofficialClass}`}
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

const CLASS_PRIORITY: Record<LeagueClassification, number> = {
  International: 0,
  Domestic: 1,
  Events: 2,
}

function rowClassification(cells: LeagueTimelineCell[]): LeagueClassification {
  // 우선순위: 단일 cell이라도 International이면 row 전체를 International로,
  // 그 다음 Domestic, 둘 다 없으면 Events.
  let best: LeagueClassification = 'Events'
  let bestPri = CLASS_PRIORITY.Events
  for (const c of cells) {
    const p = CLASS_PRIORITY[c.Classification]
    if (p < bestPri) {
      best = c.Classification
      bestPri = p
    }
  }
  return best
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
  const cellsByLeague = new Map<string, LeagueTimelineCell[]>()

  for (const cell of timeline) {
    yearsSet.add(cell.Year)
    const list = cellsByLeague.get(cell.League) ?? []
    list.push(cell)
    cellsByLeague.set(cell.League, list)
  }

  const rows: RowGroup[] = []
  for (const [league, cells] of cellsByLeague) {
    const cls = rowClassification(cells)
    const cellsByYear = new Map<number, LeagueTimelineCell[]>()
    for (const c of cells) {
      const list = cellsByYear.get(c.Year) ?? []
      list.push(c)
      cellsByYear.set(c.Year, list)
    }
    const sample = cells[0]
    rows.push({
      league,
      short: sample.LeagueShort,
      level: sample.Level,
      classification: cls,
      isInternational: cls === 'International',
      totalGames: totals[league] ?? 0,
      cellsByYear,
    })
  }

  const minYear = Math.min(...yearsSet)
  const maxYear = Math.max(...yearsSet)
  const years: number[] = []
  for (let y = minYear; y <= maxYear; y++) years.push(y)

  rows.sort((a, b) => {
    const pa = CLASS_PRIORITY[a.classification]
    const pb = CLASS_PRIORITY[b.classification]
    if (pa !== pb) return pa - pb
    return a.league.localeCompare(b.league)
  })

  return { rows, years }
}
