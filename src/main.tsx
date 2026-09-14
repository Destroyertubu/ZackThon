import { isShowcase } from './features/showcase/runtime'
import ShowcaseDirector from './features/showcase/ShowcaseDirector'
import './features/showcase/showcase.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import './features/galaxy/fonts.css'
import './features/typography/typography.css'
import './features/presentation/contextual-ui.css'

if (isShowcase()) document.documentElement.classList.add('ww-showcase')
document.documentElement.classList.add('ww-diegetic')
document.documentElement.classList.remove('ww-text-free')
document.documentElement.classList.add('ww-contextual-ui')

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
    {isShowcase() && <ShowcaseDirector />}
  </BrowserRouter>,
)
