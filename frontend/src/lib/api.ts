import type { PlayerResponse } from './player'

const API_BASE = `${window.location.protocol}//${window.location.hostname}:4444`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
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
