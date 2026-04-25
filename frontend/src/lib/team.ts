export interface TeamSummary {
  OverviewPage: string
  Name: string
  Short: string
  Region: string
  LogoUrl: string
  IsDisbanded: boolean
  RenamedTo: string | null
  FormerNames: string[]
  Aliases: string[]
  ActiveSince: string | null
  ActiveUntil: string | null
  HistoryCount: number
}

export interface RosterEntry {
  Player: string
  ID: string
  Position: string
  PositionCategory: string
  JoinDate: string
}

export interface TeamHistoryEntry {
  Player: string
  ID: string
  Position: string
  PositionCategory: string
  TeamAtTime?: string
  StartDate: string
  EndDate: string
  Duration: string
  ApproximateDuration: number | string | null
  IsCurrent: boolean
}

export type CategoryGroup = 'InGame' | 'Coach' | 'Other'

export const INGAME_ROLES = new Set(['Top', 'Jungle', 'Mid', 'Bot', 'Support'])

export function categoryGroup(cat: string): CategoryGroup {
  if (INGAME_ROLES.has(cat)) return 'InGame'
  if (cat === 'Coach') return 'Coach'
  return 'Other'
}

export const CATEGORY_GROUPS: { key: CategoryGroup; label: string }[] = [
  { key: 'InGame', label: 'Players' },
  { key: 'Coach', label: 'Coaching Staff' },
  { key: 'Other', label: 'Others' },
]

export interface TeamResponse {
  OverviewPage: string
  Name: string
  Short: string
  Region: string
  Image: string
  LogoUrl: string
  IsDisbanded: boolean
  RenamedTo: string | null
  Predecessors: string[]
  FormerNames: string[]
  CurrentRoster: RosterEntry[]
  PlayerHistory: TeamHistoryEntry[]
}
