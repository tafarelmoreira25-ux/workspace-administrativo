import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Quando um novo deploy troca os nomes com hash dos arquivos carregados sob
// demanda, uma aba antiga pode tentar buscar um arquivo que já não existe.
// Não recarregamos automaticamente: uma recarga no meio do preenchimento
// descartava a tela ativa. O usuário decide após o rascunho ser preservado.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const chave = 'platino-aviso-atualizacao-chunk'
  const ultimoAviso = Number(sessionStorage.getItem(chave) || 0)

  if (Date.now() - ultimoAviso > 30_000) {
    sessionStorage.setItem(chave, String(Date.now()))
    window.setTimeout(() => {
      const atualizarAgora = window.confirm(
        'Uma atualização do sistema está disponível. Seu rascunho foi preservado. Deseja atualizar a página agora?',
      )
      if (atualizarAgora) window.location.reload()
    }, 0)
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
