import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/Pagination'
import {
  PlayerFilters,
  type FilterState,
  type SearchField,
} from '@/components/PlayerFilters'
import { fetchPlayers, type PlayerListItem } from '@/lib/api'
import { fallback } from '@/lib/player'

type SortKey =
  | 'ID'
  | 'Position'
  | 'Team'
  | 'NativeName'
  | 'Name'
  | 'Age'
  | 'IsActive'
  | 'DebutYear'
type SortDir = 'asc' | 'desc'

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: PlayerListItem[] }
  | { kind: 'error'; message: string }

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'ID', label: 'ID' },
  { key: 'Position', label: 'Position' },
  { key: 'Team', label: 'Team' },
  { key: 'NativeName', label: 'Native Name' },
  { key: 'Name', label: 'Name' },
  { key: 'Age', label: 'Age', className: 'text-right' },
  { key: 'IsActive', label: 'Active', className: 'text-center' },
]

const DEBOUNCE_MS = 250

export function PlayersListPage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ kind: 'loading' })
    fetchPlayers(controller.signal)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        setStatus({ kind: 'error', message: msg })
      })
    return () => controller.abort()
  }, [])

  const urlFilters: FilterState = {
    q: params.get('q') ?? '',
    field: (params.get('field') as SearchField) || 'ID',
    positions: params.get('positions')?.split(',').filter(Boolean) ?? [],
    team: params.get('team') ?? '',
    debutYear: params.get('year') ?? '',
  }
  const sort: SortKey = (params.get('sort') as SortKey) || 'ID'
  const dir: SortDir = (params.get('dir') as SortDir) || 'asc'
  const page = Number(params.get('page') || '1')
  const pageSize = Number(params.get('size') || '20')

  const [draftQ, setDraftQ] = useState(urlFilters.q)
  useEffect(() => setDraftQ(urlFilters.q), [urlFilters.q])
  useEffect(() => {
    const t = setTimeout(() => {
      if (draftQ !== urlFilters.q) {
        updateParams({ q: draftQ, page: '1' })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ])

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const onFilterChange = (next: FilterState) => {
    setDraftQ(next.q)
    updateParams({
      field: next.field === 'ID' ? null : next.field,
      positions: next.positions.length ? next.positions.join(',') : null,
      team: next.team || null,
      year: next.debutYear || null,
      page: '1',
    })
  }

  const onSort = (key: SortKey) => {
    if (sort === key) {
      updateParams({ dir: dir === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: key, dir: 'asc' })
    }
  }

  const all = status.kind === 'ok' ? status.data : []

  const availableTeams = useMemo(() => {
    const s = new Set<string>()
    for (const p of all) if (p.Team) s.add(p.Team)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [all])

  const availablePositions = useMemo(() => {
    const s = new Set<string>()
    for (const p of all) if (p.PositionCategory) s.add(p.PositionCategory)
    return Array.from(s)
  }, [all])

  const filtered = useMemo(() => {
    return all.filter((p) => applyFilters(p, urlFilters))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, urlFilters.q, urlFilters.field, urlFilters.positions.join(','), urlFilters.team, urlFilters.debutYear])

  const sorted = useMemo(
    () => [...filtered].sort(compareBy(sort, dir)),
    [filtered, sort, dir]
  )

  const total = sorted.length
  const pageStart = (page - 1) * pageSize
  const slice = sorted.slice(pageStart, pageStart + pageSize)

  return (
    <main className="mx-auto max-w-[1200px] px-8 py-12">
      <nav className="mb-4 flex items-center gap-4 text-[14px]">
        <Link to="/players" className="font-semibold text-text-primary">
          Players
        </Link>
        <Link to="/teams" className="text-text-muted hover:text-text-primary">
          Teams
        </Link>
      </nav>
      <h1 className="mb-6 text-[32px] font-bold">Players</h1>

      <PlayerFilters
        value={{ ...urlFilters, q: draftQ }}
        onChange={onFilterChange}
        availableTeams={availableTeams}
        availablePositions={availablePositions}
      />

      {status.kind === 'loading' && <p className="text-text-muted">Loading…</p>}
      {status.kind === 'error' && (
        <div className="rounded-[10px] border border-danger/[0.35] bg-danger/[0.12] p-6 text-danger">
          {status.message}
        </div>
      )}

      {status.kind === 'ok' && (
        <>
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
                        className={`cursor-pointer select-none px-4 py-3 text-left font-semibold hover:text-text-primary ${c.className ?? ''}`}
                        onClick={() => onSort(c.key)}
                      >
                        {c.label}
                        <span
                          className={
                            isActive ? 'text-accent-sky' : 'text-text-muted'
                          }
                        >
                          {arrow}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => (
                  <tr
                    key={p.Player}
                    className="border-b border-border last:border-b-0 hover:bg-bg-base/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/player/${encodeURIComponent(p.Player)}`}
                        className="font-semibold text-accent-sky underline-offset-4 hover:underline"
                      >
                        {p.ID}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{fallback(p.Position)}</td>
                    <td className="px-4 py-3">{fallback(p.Team)}</td>
                    <td className="px-4 py-3">{fallback(p.NativeName)}</td>
                    <td className="px-4 py-3">{fallback(p.Name)}</td>
                    <td className="px-4 py-3 text-right">{fallback(p.Age)}</td>
                    <td className="px-4 py-3 text-center">
                      {p.IsActive ? (
                        <span className="inline-flex items-center rounded-full border border-success/[0.4] bg-success/[0.12] px-2 py-0.5 text-[12px] font-semibold text-success">
                          Active
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {slice.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="px-4 py-10 text-center text-text-muted"
                    >
                      조건에 맞는 선수가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={(p) => updateParams({ page: String(p) })}
            onPageSize={(n) =>
              updateParams({ size: String(n), page: '1' })
            }
          />
        </>
      )}
    </main>
  )
}

function applyFilters(p: PlayerListItem, f: FilterState): boolean {
  const q = f.q.trim().toLowerCase()
  if (q) {
    const fields: string[] =
      f.field === 'ID'
        ? [p.ID]
        : f.field === 'Name'
          ? [p.Name, p.NativeName]
          : [p.ID, p.Name, p.NativeName, p.Team]
    if (!fields.some((v) => v && v.toLowerCase().includes(q))) return false
  }
  if (f.positions.length > 0 && !f.positions.includes(p.PositionCategory)) {
    return false
  }
  if (f.team && p.Team !== f.team) return false
  if (f.debutYear) {
    const n = Number(f.debutYear)
    if (!Number.isNaN(n) && p.DebutYear !== n) return false
  }
  return true
}

function compareBy(key: SortKey, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1
  return (a: PlayerListItem, b: PlayerListItem) => {
    const va = valueFor(a, key)
    const vb = valueFor(b, key)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * sign
    }
    return String(va).localeCompare(String(vb)) * sign
  }
}

function valueFor(p: PlayerListItem, key: SortKey): string | number | null {
  switch (key) {
    case 'Age': {
      const n = Number(p.Age)
      return Number.isNaN(n) || p.Age === '' ? null : n
    }
    case 'DebutYear':
      return p.DebutYear ?? null
    case 'IsActive':
      return p.IsActive ? 1 : 0
    default:
      return p[key] || null
  }
}
