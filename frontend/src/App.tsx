import { HashRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/player/:id" element={<PlayerDetailPage />} />
      </Routes>
    </HashRouter>
  )
}
