import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchField = 'ID' | 'Name' | 'All'

export interface FilterState {
  q: string
  field: SearchField
  positions: string[]
  team: string
  debutYear: string
}

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  availableTeams: string[]
  availablePositions: string[]
}

const INGAME = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
const NON_INGAME_CATS = ['Coach', 'Analyst', 'Staff', 'Media']

export function PlayerFilters({
  value,
  onChange,
  availableTeams,
  availablePositions,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(
    value.positions.length > 0 || value.team !== '' || value.debutYear !== ''
  )
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const teamDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!teamDropdownOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!teamDropdownRef.current?.contains(e.target as Node)) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [teamDropdownOpen])

  const positionCats = useMemo(() => {
    const present = new Set(availablePositions)
    return [...INGAME, ...NON_INGAME_CATS].filter((c) => present.has(c))
  }, [availablePositions])

  const filteredTeams = useMemo(() => {
    const q = teamFilter.trim().toLowerCase()
    if (!q) return availableTeams.slice(0, 200)
    return availableTeams.filter((t) => t.toLowerCase().includes(q)).slice(0, 200)
  }, [availableTeams, teamFilter])

  const togglePosition = (cat: string) => {
    const has = value.positions.includes(cat)
    onChange({
      ...value,
      positions: has
        ? value.positions.filter((p) => p !== cat)
        : [...value.positions, cat],
    })
  }

  const resetAdvanced = () => {
    onChange({ ...value, positions: [], team: '', debutYear: '' })
  }

  return (
    <section className="mb-6 rounded-[10px] border border-border bg-bg-surface p-5">
      <div className="flex flex-col gap-3 min-[640px]:flex-row">
        <select
          value={value.field}
          onChange={(e) =>
            onChange({ ...value, field: e.target.value as SearchField })
          }
          className="rounded-[6px] border border-border bg-bg-base px-3 py-2 text-[14px] text-text-primary focus:border-accent-sky focus:outline-none"
        >
          <option value="ID">ID</option>
          <option value="Name">Name</option>
          <option value="All">All</option>
        </select>
        <input
          type="text"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={
            value.field === 'ID'
              ? 'ID 검색 (예: Faker)'
              : value.field === 'Name'
                ? 'Name / 한글 이름 검색'
                : 'ID / Name / 한글 이름 / 팀 검색'
          }
          className="flex-1 rounded-[6px] border border-border bg-bg-base px-3 py-2 text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent-sky focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="rounded-[6px] border border-border bg-bg-base px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-primary"
        >
          고급 검색 {advancedOpen ? '▲' : '▼'}
        </button>
      </div>

      {advancedOpen && (
        <div className="mt-5 grid gap-5 border-t border-border pt-5 min-[900px]:grid-cols-[1fr_1fr_auto]">
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
              Position
            </div>
            <div className="flex flex-wrap gap-2">
              {positionCats.map((cat) => {
                const active = value.positions.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => togglePosition(cat)}
                    className={
                      active
                        ? 'inline-flex items-center rounded-full border border-accent-sky bg-accent-sky/[0.2] px-3 py-1 text-[13px] font-semibold text-accent-sky'
                        : 'inline-flex items-center rounded-full border border-border bg-bg-base px-3 py-1 text-[13px] text-text-muted hover:text-text-primary'
                    }
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <div ref={teamDropdownRef} className="relative">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
              Team
            </div>
            <button
              type="button"
              onClick={() => setTeamDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-[6px] border border-border bg-bg-base px-3 py-2 text-left text-[14px] text-text-primary"
            >
              <span className={value.team ? '' : 'text-text-muted'}>
                {value.team || '전체 팀'}
              </span>
              <span className="text-text-muted">▼</span>
            </button>
            {teamDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[320px] overflow-hidden rounded-[6px] border border-border bg-bg-surface shadow-lg">
                <input
                  autoFocus
                  type="text"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  placeholder="팀 검색"
                  className="w-full border-b border-border bg-bg-base px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <ul className="max-h-[260px] overflow-y-auto">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ ...value, team: '' })
                        setTeamDropdownOpen(false)
                        setTeamFilter('')
                      }}
                      className="block w-full px-3 py-2 text-left text-[13px] text-text-muted hover:bg-bg-base"
                    >
                      (전체)
                    </button>
                  </li>
                  {filteredTeams.map((t) => (
                    <li key={t}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ ...value, team: t })
                          setTeamDropdownOpen(false)
                          setTeamFilter('')
                        }}
                        className="block w-full px-3 py-2 text-left text-[13px] text-text-primary hover:bg-bg-base"
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                  {filteredTeams.length === 0 && (
                    <li className="px-3 py-2 text-[13px] text-text-muted">
                      결과 없음
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
              Debut Year
            </div>
            <input
              type="number"
              value={value.debutYear}
              onChange={(e) =>
                onChange({ ...value, debutYear: e.target.value })
              }
              placeholder="예: 2013"
              className="w-[140px] rounded-[6px] border border-border bg-bg-base px-3 py-2 text-[14px] text-text-primary placeholder:text-text-muted focus:border-accent-sky focus:outline-none"
            />
          </div>

          <div className="min-[900px]:col-span-3">
            <button
              type="button"
              onClick={resetAdvanced}
              className="text-[12px] text-text-muted underline underline-offset-4 hover:text-text-primary"
            >
              고급 필터 초기화
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
