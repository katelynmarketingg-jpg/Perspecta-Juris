// ─────────────────────────────────────────────────────────────────────────
//  Encolher foto antes de enviar.
//
//  A foto de comprovação ia para o servidor do tamanho que saiu da câmera.
//  Em base64 ela cresce mais ou menos 1,37× — uma foto de 4 MB vira 5,5 MB de
//  texto. O servidor recusava com "Request body is too large" e a assinatura
//  não acontecia. Era isso que ela estava vendo.
//
//  Encolher resolve três coisas de uma vez: cabe no limite, sobe rápido em
//  conexão ruim (a pessoa pode estar assinando do celular, na rua) e não
//  entope o banco — essas fotos ficam guardadas como texto dentro dele.
//
//  1280px no maior lado é bastante para comprovar quem assinou: dá para ver
//  o rosto com folga. O que se perde é detalhe que ninguém vai olhar.
// ─────────────────────────────────────────────────────────────────────────

const MAIOR_LADO = 1280
const QUALIDADE = 0.82

async function carregar(file) {
  // createImageBitmap já corrige a rotação da EXIF — sem isso, foto tirada
  // de lado no celular chega deitada.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) }
    catch { /* navegador antigo: cai no Image abaixo */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((ok, erro) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = () => erro(new Error('Não foi possível ler a imagem.'))
      img.src = url
    })
  } finally { setTimeout(() => URL.revokeObjectURL(url), 10000) }
}

const lerComoDataUrl = (file) => new Promise((ok, erro) => {
  const r = new FileReader()
  r.onload = () => ok(r.result)
  r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'))
  r.readAsDataURL(file)
})

export async function comprimirImagem(file, { maiorLado = MAIOR_LADO, qualidade = QUALIDADE } = {}) {
  if (!file) return null
  try {
    const img = await carregar(file)
    const largura = img.width ?? img.naturalWidth
    const altura  = img.height ?? img.naturalHeight
    if (!largura || !altura) return await lerComoDataUrl(file)

    const escala = Math.min(1, maiorLado / Math.max(largura, altura))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(largura * escala)
    canvas.height = Math.round(altura * escala)
    const ctx = canvas.getContext('2d')
    // Fundo branco: JPEG não tem transparência, e PNG transparente viraria preto.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    img.close?.()

    const saida = canvas.toDataURL('image/jpeg', qualidade)
    // Se por algum motivo a "compressão" piorou, fica com o original.
    const original = await lerComoDataUrl(file)
    return saida.length < original.length ? saida : original
  } catch {
    // Formato que o navegador não desenha (HEIC em alguns casos): manda como
    // veio. Pode esbarrar no limite, mas aí o erro é claro e específico.
    return await lerComoDataUrl(file)
  }
}

// Quantos bytes aquele texto base64 vai ocupar de verdade.
export function tamanhoDoDataUrl(dataUrl) {
  const base64 = String(dataUrl ?? '').split(',')[1] ?? ''
  return Math.floor(base64.length * 3 / 4)
}

export const emMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
