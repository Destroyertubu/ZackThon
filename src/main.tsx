import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import './features/galaxy/fonts.css'
import './features/typography/typography.css'

document.documentElement.classList.add('ww-diegetic')

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
