import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getRequest, saveSignature } from '../../lib/signatures'
import { hashDocumentos, coletarEvidencias, TERMO_LGPD } from '../../lib/signatureProof'

// ── Canvas de assinatura ────────────────────────────────────────────────────
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111'
  }, [])

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const t = e.touches?.[0]
    return { x: (t ? t.clientX : e.clientX) - rect.left, y: (t ? t.clientY : e.clientY) - rect.top }
  }
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
    if (empty) setEmpty(false)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(empty ? null : canvasRef.current.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setEmpty(true); onChange(null)
  }

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} className="w-full h-40 cursor-crosshair"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-gray-400">{empty ? 'Assine acima com o dedo ou mouse' : 'Assinatura registrada'}</span>
        <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-800">Limpar</button>
      </div>
    </div>
  )
}

export default function SignPage() {
  const { id } = useParams()
  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signer, setSigner] = useState({ nome: '', cpf: '' })
  const [signatureImg, setSignatureImg] = useState(null)
  const [photoImg, setPhotoImg] = useState(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [proof, setProof] = useState(null)

  useEffect(() => {
    getRequest(id).then(r => {
      setReq(r)
      if (r?.status === 'assinado') setDone(true)
    }).finally(() => setLoading(false))
  }, [id])

  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoImg(reader.result)
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!signer.nome.trim() || signer.cpf.replace(/\D/g, '').length < 11) { setError('Preencha nome completo e CPF válido.'); return }
    if (!signatureImg) { setError('Faça o desenho da sua assinatura.'); return }
    if (!photoImg) { setError('Envie uma foto de comprovação.'); return }
    if (!consent) { setError('É necessário aceitar o termo de consentimento para assinar.'); return }
    setError(''); setSaving(true)
    try {
      // Integridade + evidências de autenticação, coletadas neste gesto do usuário
      const [documentHash, evidencias] = await Promise.all([
        hashDocumentos(req.documentos),
        coletarEvidencias(),
      ])
      await saveSignature(id, { signer, signatureImg, photoImg, consent: true, consentText: TERMO_LGPD, documentHash, evidencias })
      setProof({ documentHash })
      setDone(true)
    } catch (e) { setError(e.message || 'Erro ao enviar. Tente novamente.') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-sm text-gray-400">Carregando documento…</p>
    </div>
  )

  // Página não encontrada (ex.: link aberto em outro dispositivo sem backend)
  if (!req) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow p-8">
        <p className="text-4xl mb-3">🔗</p>
        <h1 className="text-lg font-bold text-gray-800">Link de assinatura não encontrado</h1>
        <p className="text-sm text-gray-500 mt-2">Este pedido não está disponível neste dispositivo. Para assinar em outro aparelho (via WhatsApp), é necessário que o escritório esteja com o servidor de sincronização ativo.</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow p-8">
        <p className="text-5xl mb-3">✅</p>
        <h1 className="text-lg font-bold text-gray-800">Assinatura concluída!</h1>
        <p className="text-sm text-gray-500 mt-2">Obrigado. Seus documentos foram assinados e validados. O escritório foi notificado e o comprovante com a trilha de auditoria ficou registrado.</p>
        <p className="text-xs text-gray-400 mt-4">Código de validação: <b>{req.validationCode}</b></p>
        {proof?.documentHash && <p className="text-[10px] text-gray-400 mt-1 break-all">Hash SHA-256: {proof.documentHash}</p>}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-violet-600 rounded-t-2xl p-6 text-white">
          <p className="text-xs opacity-80">Perspecta Juris · Assinatura de documentos</p>
          <h1 className="text-xl font-bold mt-1">Olá, {req.clientName || 'cliente'}!</h1>
          <p className="text-sm opacity-90 mt-1">Confira os documentos e assine ao final para validar.</p>
        </div>

        <div className="bg-white rounded-b-2xl shadow p-6 space-y-6">
          {/* Documentos */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">📄 Documentos a assinar ({req.documentos.length})</h2>
            <div className="space-y-2">
              {req.documentos.map((d, i) => (
                <details key={i} className="rounded-lg border border-gray-200">
                  <summary className="px-3 py-2 text-sm font-medium text-gray-800 cursor-pointer select-none">{d.titulo}</summary>
                  <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 max-h-52 overflow-y-auto">
                    <pre className="text-[11px] text-gray-700 whitespace-pre-wrap" style={{ fontFamily: "'Times New Roman', serif" }}>{d.corpo}</pre>
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Verificação */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">1. Seus dados de verificação</h2>
            <input value={signer.nome} onChange={e => setSigner(s => ({ ...s, nome: e.target.value }))} placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2 focus:border-orange-500 focus:outline-none text-gray-900" />
            <input value={signer.cpf} onChange={e => setSigner(s => ({ ...s, cpf: e.target.value }))} placeholder="CPF" inputMode="numeric"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-orange-500 focus:outline-none text-gray-900" />
          </div>

          {/* Assinatura */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">2. Desenhe sua assinatura</h2>
            <SignaturePad onChange={setSignatureImg} />
          </div>

          {/* Foto */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">3. Foto de comprovação</h2>
            <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-orange-500">
              {photoImg ? '✅ Foto anexada — trocar' : '📷 Tirar / enviar foto'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            </label>
            {photoImg && <img src={photoImg} alt="comprovação" className="mt-2 rounded-lg max-h-40 mx-auto" />}
          </div>

          {/* Consentimento LGPD */}
          <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-orange-500 flex-shrink-0" />
            <span className="text-[11px] text-gray-600 leading-relaxed">{TERMO_LGPD}</span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={submit} disabled={saving} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-sm transition-colors">
            {saving ? 'Coletando evidências e assinando…' : 'Assinar e validar documentos'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Ao assinar são registrados data/hora, IP, dispositivo e localização (se autorizada) e o hash do documento, para comprovar autoria e integridade. Assinatura eletrônica nos termos da Lei 14.063/2020 e MP 2.200-2/2001.</p>
        </div>
      </div>
    </div>
  )
}
