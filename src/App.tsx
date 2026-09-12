import { Routes, Route } from 'react-router'
import Onboarding from './pages/Onboarding'
import WorldPage from './pages/WorldPage'
import HomePage from './pages/HomePage'
import CanvasPage from './pages/CanvasPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/world" element={<WorldPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/canvas" element={<CanvasPage />} />
    </Routes>
  )
}
