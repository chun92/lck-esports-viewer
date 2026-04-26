import { HashRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'
import { PlayersListPage } from '@/pages/PlayersListPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'
import { TeamsListPage } from '@/pages/TeamsListPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/players" element={<PlayersListPage />} />
        <Route path="/player/:id" element={<PlayerDetailPage />} />
        <Route path="/teams" element={<TeamsListPage />} />
        <Route path="/team/:id" element={<TeamDetailPage />} />
      </Routes>
    </HashRouter>
  )
}
