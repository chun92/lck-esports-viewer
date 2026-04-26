export const EMPTY = '—'
export const MISSING_DATE = '???'

export interface PlayerMeta {
  ID: string
  Player: string
  Name: string
  NativeName: string
  Country: string
  Age: string
  Birthdate: string
  Team: string
  Team2: string
  CurrentTeams: string
  Role: string
  TeamLast: string
  RoleLast: string
  IsRetired: string
  Birthdate__precision: string
  LatestPhotoUrl?: string
}

export interface Tenure {
  StartDate: string
  EndDate: string
  Team: string
  Position: string
  Duration: string
  ApproximateDuration: number | string | null
  IsCurrent: string
}

export interface LeagueTimelineCell {
  Year: number
  League: string
  LeagueShort: string
  Region: string
  Level: string
  IsInternational: boolean
  Team: string
  Splits: string[]
}

export interface PlayerResponse {
  Player: PlayerMeta
  History: Tenure[]
  LeagueTimeline: LeagueTimelineCell[]
  LeagueTotals: Record<string, number>
}

export function fallback(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return EMPTY
  return v
}

export function splitRoles(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[;/]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function dayDiff(start: string, end: string): number | null {
  if (!start || !end) return null
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

export function resolveDuration(t: Tenure): number | null {
  if (t.Duration) {
    const n = Number(t.Duration)
    if (!Number.isNaN(n)) return n
  }
  const diff = dayDiff(t.StartDate, t.EndDate)
  if (diff !== null) return diff
  if (t.ApproximateDuration !== null && t.ApproximateDuration !== undefined && t.ApproximateDuration !== '') {
    const n = Number(t.ApproximateDuration)
    if (!Number.isNaN(n)) return n
  }
  return null
}

export function formatPeriod(t: Tenure, isLast: boolean): string {
  const start = t.StartDate || MISSING_DATE
  const end = t.EndDate || (isLast ? 'present' : MISSING_DATE)
  return `${start} ~ ${end}`
}

export function yearsMonths(days: number): string {
  if (days <= 0) return '0개월'
  const years = Math.floor(days / 365.25)
  const months = Math.floor((days - years * 365.25) / 30.44)
  if (years === 0) return `${months}개월`
  if (months === 0) return `${years}년`
  return `${years}년 ${months}개월`
}

export function sortHistoryAsc(history: Tenure[]): Tenure[] {
  return [...history].sort((a, b) => {
    const ka = a.StartDate || ''
    const kb = b.StartDate || ''
    return ka.localeCompare(kb)
  })
}

