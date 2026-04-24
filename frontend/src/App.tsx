import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'
import { PlayersListPage } from '@/pages/PlayersListPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/players" replace />} />
        <Route path="/players" element={<PlayersListPage />} />
        <Route path="/player/:id" element={<PlayerDetailPage />} />
        <Route path="/team/:id" element={<TeamDetailPage />} />
      </Routes>
    </HashRouter>
  )
}
