/* global __APP_VERSION__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const VERSAO_ATUAL = __APP_VERSION__
let verificandoVersao = false

async function verificarNovaVersao() {
  if (verificandoVersao || document.visibilityState === 'hidden') return
  verificandoVersao = true

  try {
    const resposta = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!resposta.ok) return
    const { version } = await resposta.json()
    if (!version || version === VERSAO_ATUAL) return

    const chave = `platino-atualizacao-${version}`
    const ultimoAviso = Number(sessionStorage.getItem(chave) || 0)
    if (Date.now() - ultimoAviso < 5 * 60_000) return
    sessionStorage.setItem(chave, String(Date.now()))

    const atualizarAgora = window.confirm(
      'Uma nova versão do sistema está disponível para todos os usuários. Deseja atualizar agora?',
    )
    if (atualizarAgora) window.location.reload()
  } catch {
    // A verificação não deve interromper o uso quando a rede estiver instável.
  } finally {
    verificandoVersao = false
  }
}

window.addEventListener('focus', verificarNovaVersao)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void verificarNovaVersao()
})
window.setInterval(verificarNovaVersao, 5 * 60_000)

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
