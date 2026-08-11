import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Quando um novo deploy troca os nomes com hash dos arquivos carregados sob
// demanda, uma aba antiga pode tentar buscar um arquivo que ja nao existe.
// O Vite emite este evento antes de rejeitar o import dinamico. Recarregamos
// uma unica vez para obter o HTML e o manifesto do deploy atual.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const chave = 'platino-reload-chunk'
  const ultimaTentativa = Number(sessionStorage.getItem(chave) || 0)

  if (Date.now() - ultimaTentativa > 30_000) {
    sessionStorage.setItem(chave, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
