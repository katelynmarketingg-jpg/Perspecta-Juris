import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { usePortalAuthStore } from '../../stores/portalAuthStore'
import { IconSend } from '../../components/ui'

const INITIAL_MESSAGES = [
  {
    id: '1', from: 'lawyer', sender: 'Dra. Ana Souza',
    text: 'Olá! Segue atualização do seu processo de Apelação Cível. O réu interpôs recurso e aguardamos o prazo para contrarrazões. Tudo está sob controle.',
    at: new Date(Date.now() - 86400000 * 5).toISOString(), read: true,
  },
  {
    id: '2', from: 'client',
    text: 'Obrigado pela atualização! Quanto tempo estima para o julgamento da apelação?',
    at: new Date(Date.now() - 86400000 * 4).toISOString(), read: true,
  },
  {
    id: '3', from: 'lawyer', sender: 'Dra. Ana Souza',
    text: 'Em média de 8 a 18 meses no TJSP para a câmara especializada. Assim que tivermos data de pauta, te aviso imediatamente. Fique tranquilo(a).',
    at: new Date(Date.now() - 86400000 * 4).toISOString(), read: true,
  },
  {
    id: '4', from: 'lawyer', sender: 'Dr. Bruno Lima',
    text: 'Bom dia! Sua audiência trabalhista foi designada para 15/06/2026 às 14h na 2ª Vara do Trabalho. Por favor, confirme se pode comparecer.',
    at: new Date(Date.now() - 86400000 * 2).toISOString(), read: false,
  },
  {
    id: '5', from: 'lawyer', sender: 'Dr. Bruno Lima',
    text: 'Lembrando que você precisará trazer: RG, CPF, CTPS e os holerites dos últimos 3 meses de trabalho.',
    at: new Date(Date.now() - 86400000 * 2 + 60000).toISOString(), read: false,
  },
]

export default function PortalMessages() {
  const client = usePortalAuthStore(s => s.client)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    const newMsg = { id: String(Date.now()), from: 'client', text: text.trim(), at: new Date().toISOString(), read: true }
    setMessages(prev => [...prev, newMsg])
    setText('')
    setSending(true)
    await new Promise(r => setTimeout(r, 1800))
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        from: 'lawyer',
        sender: 'Dra. Ana Souza',
        text: 'Mensagem recebida! Retorno em breve. 🙏',
        at: new Date().toISOString(),
        read: true,
      }
    ])
    setSending(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const groups = messages.reduce((acc, msg) => {
    const day = format(new Date(msg.at), 'dd/MM/yyyy')
    if (!acc[day]) acc[day] = []
    acc[day].push(msg)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Mensagens</h1>

      <div className="card flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: '400px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groups).map(([day, msgs]) => (
            <div key={day}>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[11px] text-[var(--text-muted)] px-2">{day}</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="space-y-3">
                {msgs.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${msg.from === 'client' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {msg.from === 'lawyer' && (
                        <p className="text-[10px] text-brand-500 font-semibold px-1">{msg.sender}</p>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.from === 'client'
                          ? 'bg-brand-500 text-white rounded-tr-sm'
                          : 'bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] px-1">
                        {format(new Date(msg.at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-app)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-3 flex gap-2 items-end">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escreva uma mensagem..."
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] text-sm text-[var(--text-primary)] resize-none focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)] max-h-24"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <IconSend size={15} />
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center">
        Mensagens respondidas em horário comercial (seg–sex, 9h–18h).
      </p>
    </div>
  )
}
