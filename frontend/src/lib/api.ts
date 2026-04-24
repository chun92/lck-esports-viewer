import type { PlayerResponse } from './player'
import type { TeamResponse, TeamSummary } from './team'

const API_BASE = `${window.location.protocol}//${window.location.hostname}:4444`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface PlayerListItem {
  Player: string
  ID: string
  Name: string
  NativeName: string
  Country: string
  DebutYear: number | null
  Team: string
  Role: string
  Position: string
  PositionCategory: string
  IsActive: boolean
  Age: string
}

export async function fetchPlayer(
  id: string,
  signal?: AbortSignal
): Promise<PlayerResponse> {
  const res = await fetch(`${API_BASE}/players/${encodeURIComponent(id)}`, {
    signal,
  })
  if (!res.ok) {
    throw new ApiError(
      res.status === 404 ? 'Player not found' : `Request failed (${res.status})`,
      res.status
    )
  }
  return (await res.json()) as PlayerResponse
}

export async function fetchPlayers(
  signal?: AbortSignal
): Promise<PlayerListItem[]> {
  const res = await fetch(`${API_BASE}/players`, { signal })
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return (await res.json()) as PlayerListItem[]
}

export async function fetchTeam(
  id: string,
  signal?: AbortSignal
): Promise<TeamResponse> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, { signal })
  if (!res.ok) {
    throw new ApiError(
      res.status === 404 ? 'Team not found' : `Request failed (${res.status})`,
      res.status
    )
  }
  return (await res.json()) as TeamResponse
}

export async function fetchTeams(
  signal?: AbortSignal
): Promise<TeamSummary[]> {
  const res = await fetch(`${API_BASE}/teams`, { signal })
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return (await res.json()) as TeamSummary[]
}
