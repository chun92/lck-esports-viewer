import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/Pagination'
import { TopBar } from '@/components/TopBar'
import { fetchTeams } from '@/lib/api'
import type { TeamSummary } from '@/lib/team'

type SortKey = 'Name' | 'Region' | 'Status' | 'ActiveSince' | 'ActiveUntil'
type SortDir = 'asc' | 'desc'

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: TeamSummary[] }
  | { kind: 'error'; message: string }

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'Name', label: 'Team' },
  { key: 'Region', label: 'Region' },
  { key: 'Status', label: 'Status' },
  { key: 'ActiveSince', label: 'Active Period' },
]

const DEBOUNCE_MS = 250

export function TeamsListPage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ kind: 'loading' })
    fetchTeams(controller.signal)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        setStatus({ kind: 'error', message: msg })
      })
    return () => controller.abort()
  }, [])

  const q = params.get('q') ?? ''
  const showAll = params.get('all') === '1'
  const sort: SortKey = (params.get('sort') as SortKey) || 'Name'
  const dir: SortDir = (params.get('dir') as SortDir) || 'asc'
  const page = Number(params.get('page') || '1')
  const pageSize = Number(params.get('size') || '20')

  const [draftQ, setDraftQ] = useState(q)
  useEffect(() => setDraftQ(q), [q])
  useEffect(() => {
    const t = setTimeout(() => {
      if (draftQ !== q) updateParams({ q: draftQ, page: '1' })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ])

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const onSort = (k: SortKey) => {
    if (sort === k) updateParams({ dir: dir === 'asc' ? 'desc' : 'asc', page: '1' })
    else updateParams({ sort: k, dir: 'asc', page: '1' })
  }

  const filtered = useMemo(() => {
    if (status.kind !== 'ok') return []
    const needle = q.trim().toLowerCase()
    return status.data.filter((t) => {
      if (!showAll && t.HistoryCount === 0) return false
      if (!needle) return true
      const fields = [t.Name, t.Short, ...t.FormerNames, ...t.Aliases]
      return fields.some((f) => f && f.toLowerCase().includes(needle))
    })
  }, [status, q, showAll])

  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1
    const arr = [...filtered]
    arr.sort((a, b) => compareBy(a, b, sort) * sign)
    return arr
  }, [filtered, sort, dir])

  const total = sorted.length
  const pageStart = (page - 1) * pageSize
  const slice = sorted.slice(pageStart, pageStart + pageSize)

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <h1 className="mb-6 text-[32px] font-bold">Teams</h1>

      <div className="mb-4 flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center">
        <input
          type="text"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder="팀 이름 검색 (이전 이름 / alias 포함)"
          className="w-full rounded-[8px] border border-border bg-bg-surface px-4 py-2 text-[14px] outline-none focus:border-accent-sky min-[640px]:max-w-[420px]"
        />
        <label className="flex items-center gap-2 text-[13px] text-text-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => updateParams({ all: e.target.checked ? '1' : null, page: '1' })}
            className="h-4 w-4"
          />
          전체 팀 보기 (한국 선수 거쳐가지 않은 팀 포함)
        </label>
      </div>

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
                        <span className={isActive ? 'text-accent-sky' : 'text-text-muted'}>
                          {arrow}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {slice.map((t) => (
                  <tr
                    key={t.OverviewPage}
                    className="border-b border-border last:border-b-0 hover:bg-bg-base/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo logoUrl={t.LogoUrl} name={t.Name} />
                        <div className="min-w-0">
                          <Link
                            to={`/team/${encodeURIComponent(t.OverviewPage)}`}
                            className="font-semibold text-accent-sky underline-offset-4 hover:underline"
                          >
                            {t.Name}
                          </Link>
                          {t.Short && (
                            <div className="text-[12px] text-text-muted">{t.Short}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{t.Region || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge team={t} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-muted">
                      {formatPeriod(t)}
                    </td>
                  </tr>
                ))}
                {slice.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="px-4 py-10 text-center text-text-muted"
                    >
                      조건에 맞는 팀이 없습니다.
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
            onPageSize={(n) => updateParams({ size: String(n), page: '1' })}
          />
        </>
      )}
      </main>
    </>
  )
}

function TeamLogo({ logoUrl, name }: { logoUrl: string; name: string }) {
  const [broken, setBroken] = useState(false)
  if (!logoUrl || broken) {
    return (
      <div
        aria-hidden
        className="h-8 w-8 shrink-0 rounded-sm border border-border bg-bg-base"
      />
    )
  }
  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className="h-8 w-8 shrink-0 rounded-sm object-contain"
      onError={() => setBroken(true)}
      loading="lazy"
    />
  )
}

function StatusBadge({ team }: { team: TeamSummary }) {
  if (!team.IsDisbanded) {
    return (
      <span className="inline-flex items-center rounded-full border border-success/[0.4] bg-success/[0.12] px-2 py-0.5 text-[12px] font-semibold text-success">
        Active
      </span>
    )
  }
  if (team.RenamedTo) {
    return (
      <span className="inline-flex items-center text-[12px] text-text-muted">
        Renamed → {team.RenamedTo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-bg-base px-2 py-0.5 text-[12px] font-semibold text-text-muted">
      Disbanded
    </span>
  )
}

function formatPeriod(t: TeamSummary): string {
  if (!t.ActiveSince) return '—'
  const since = t.ActiveSince.slice(0, 4)
  if (t.ActiveUntil === null) return `${since} – present`
  const until = t.ActiveUntil.slice(0, 4)
  return since === until ? since : `${since} – ${until}`
}

function compareBy(a: TeamSummary, b: TeamSummary, key: SortKey): number {
  if (key === 'Name') return a.Name.localeCompare(b.Name)
  if (key === 'Region') return (a.Region || '').localeCompare(b.Region || '')
  if (key === 'Status') {
    return statusRank(a) - statusRank(b)
  }
  if (key === 'ActiveSince') return cmpNullable(a.ActiveSince, b.ActiveSince)
  if (key === 'ActiveUntil') {
    const av = a.ActiveUntil === null ? '￿' : a.ActiveUntil ?? ''
    const bv = b.ActiveUntil === null ? '￿' : b.ActiveUntil ?? ''
    return av.localeCompare(bv)
  }
  return 0
}

function statusRank(t: TeamSummary): number {
  if (!t.IsDisbanded) return 0
  if (t.RenamedTo) return 1
  return 2
}

function cmpNullable(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}
