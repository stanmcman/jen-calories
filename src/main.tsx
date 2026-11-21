import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/nunito/index.css'
import '@fontsource/caveat/600.css'
import './index.css'
import App from './App.tsx'
import { applySavedThemeEarly } from './lib/theme'

applySavedThemeEarly()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
