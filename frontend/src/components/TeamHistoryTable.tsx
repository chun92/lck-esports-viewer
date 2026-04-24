import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fallback, yearsMonths } from '@/lib/player'
import {
  CATEGORY_GROUPS,
  categoryGroup,
  type CategoryGroup,
  type TeamHistoryEntry,
} from '@/lib/team'

interface Props {
  history: TeamHistoryEntry[]
}

type SortKey = 'StartDate' | 'EndDate' | 'ID' | 'Position' | 'Duration'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'StartDate', label: 'Start' },
  { key: 'EndDate', label: 'End' },
  { key: 'ID', label: 'Player' },
  { key: 'Position', label: 'Position' },
  { key: 'Duration', label: 'Duration', className: 'text-right' },
]

export function TeamHistoryTable({ history }: Props) {
  const groups = new Map<CategoryGroup, TeamHistoryEntry[]>()
  for (const h of history) {
    const g = categoryGroup(h.PositionCategory)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(h)
  }

  return (
    <section>
      <h2 className="mb-4 text-[22px] font-bold">Player History</h2>
      {history.length === 0 ? (
        <p className="text-text-muted">기록된 선수 이력이 없습니다.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORY_GROUPS.map(({ key, label }) => {
            const items = groups.get(key)
            if (!items || items.length === 0) return null
            return <HistorySection key={key} label={label} items={items} />
          })}
        </div>
      )}
    </section>
  )
}

function HistorySection({ label, items }: { label: string; items: TeamHistoryEntry[] }) {
  const [sort, setSort] = useState<SortKey>('StartDate')
  const [dir, setDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => compareBy(a, b, sort) * sign)
  }, [items, sort, dir])

  const onSort = (key: SortKey) => {
    if (sort === key) {
      setDir(dir === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(key)
      setDir(key === 'StartDate' || key === 'EndDate' ? 'desc' : 'asc')
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-[15px] font-semibold text-text-muted">{label}</h3>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-bg-surface">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-border text-[12px] uppercase tracking-wider text-text-muted">
              {COLUMNS.map((c) => {
                const isActive = sort === c.key
                const arrow = isActive ? (dir === 'asc' ? ' ▲' : ' ▼') : ''
                return (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    className={`cursor-pointer select-none px-4 py-3 text-left font-semibold hover:text-text-primary ${c.className ?? ''}`}
                  >
                    {c.label}
                    <span className={isActive ? 'text-accent-sky' : 'text-text-muted'}>
                      {arrow}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => {
              const dur = resolveDurationDays(h)
              return (
                <tr
                  key={`${h.Player}-${h.StartDate}-${i}`}
                  className="border-b border-border last:border-b-0 hover:bg-bg-base/50"
                >
                  <td className="px-4 py-3">{fallback(h.StartDate)}</td>
                  <td className="px-4 py-3">{fallback(h.EndDate)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/player/${encodeURIComponent(h.Player)}`}
                      className="font-semibold text-accent-sky underline-offset-4 hover:underline"
                    >
                      {h.ID}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{fallback(h.Position)}</td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    {dur !== null ? yearsMonths(dur) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function compareBy(a: TeamHistoryEntry, b: TeamHistoryEntry, key: SortKey): number {
  if (key === 'Duration') {
    const da = resolveDurationDays(a) ?? -1
    const db = resolveDurationDays(b) ?? -1
    return da - db
  }
  const va = a[key] || ''
  const vb = b[key] || ''
  return String(va).localeCompare(String(vb))
}

function resolveDurationDays(e: TeamHistoryEntry): number | null {
  if (e.Duration) {
    const n = Number(e.Duration)
    if (!Number.isNaN(n)) return n
  }
  if (e.ApproximateDuration !== null && e.ApproximateDuration !== undefined && e.ApproximateDuration !== '') {
    const n = Number(e.ApproximateDuration)
    if (!Number.isNaN(n)) return n
  }
  return null
}
