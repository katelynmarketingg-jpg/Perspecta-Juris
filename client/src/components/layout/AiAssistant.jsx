import { useState, useRef, useEffect } from 'react'
import { IconSparkles, IconX, IconSend, IconChevronDown } from '../ui'

const QUICK_ACTIONS = [
  { label: 'Resumir processos ativos',          prompt: 'Resuma meus processos ativos e as próximas ações recomendadas.' },
  { label: 'Verificar prazos próximos',          prompt: 'Quais são os prazos mais urgentes nos próximos 7 dias?' },
  { label: 'Calcular verbas rescisórias',        prompt: 'Quero calcular verbas rescisórias. Quais informações preciso?' },
  { label: 'Simular correção monetária IPCA',    prompt: 'Como calcular correção monetária pelo IPCA sobre um valor?' },
  { label: 'Sugerir próxima ação processual',    prompt: 'Com base nos processos em andamento, qual deve ser a próxima ação prioritária?' },
]

function MessageText({ text }) {
  const parts = text.split('\n')
  return (
    <div className="space-y-1">
      {parts.map((line, i) => {
        if (!line) return <br key={i} />
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        return <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      })}
    </div>
  )
}

export default function AiAssistant() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [typing, setTyping]   = useState(false)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, minimized])

  // O assistente ainda NÃO está conectado a uma IA de verdade. Antes ele
  // devolvia respostas fabricadas (prazos e índices inventados) que pareciam
  // reais — perigoso num sistema jurídico. Agora avisa com honestidade.
  const AVISO = 'Ainda não estou conectado a uma inteligência artificial de verdade — este recurso está **em preparação**.\n\nPara não te induzir a erro, prefiro não responder a nada sobre prazos, processos ou cálculos: qualquer resposta minha agora seria inventada.\n\n👉 Use **Prazos** para os prazos reais, **Processos** para o andamento e a **Calculadora** para os cálculos.'
  const sendMessage = async (text) => {
    if (!text.trim() || typing) return
    const userMsg = { id: Date.now(), role: 'user', text: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)
    await new Promise(r => setTimeout(r, 350))
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: AVISO }])
    setTyping(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const reset = () => setMessages([])

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full bg-brand-500 shadow-orange flex items-center justify-center text-white hover:scale-110 transition-transform"
          title="Assistente IA Jurídica"
        >
          <IconSparkles size={20} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className={`fixed right-4 z-[90] w-[370px] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-modal flex flex-col transition-all duration-200 ${
          minimized ? 'bottom-4 h-14' : 'bottom-4 h-[560px]'
        }`}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0 rounded-t-2xl bg-gradient-to-r from-brand-500/10 to-transparent">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-orange flex-shrink-0">
              <IconSparkles size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none">Assistente IA</p>
              <p className="text-[10px] text-brand-500 mt-0.5">Perspecta Juris · Powered by Claude</p>
            </div>
            <button onClick={() => setMinimized(m => !m)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors">
              <IconChevronDown size={15} className={`transition-transform ${minimized ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors">
              <IconX size={15} />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-4">
                    <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3.5">
                      <p className="text-sm font-medium text-white mb-1">Olá! Sou seu assistente jurídico. 👋</p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Posso resumir processos, verificar prazos, fazer cálculos jurídicos e sugerir próximas ações.
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Ações rápidas</p>
                    <div className="space-y-2">
                      {QUICK_ACTIONS.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(a.prompt)}
                          className="w-full text-left px-3 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white hover:border-brand-500/40 hover:bg-brand-500/5 transition-all flex items-center gap-2"
                        >
                          <span className="text-brand-500 flex-shrink-0">→</span>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                        <IconSparkles size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[82%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-500 text-white rounded-tr-sm'
                        : 'bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
                    }`}>
                      {msg.role === 'assistant' ? <MessageText text={msg.text} /> : msg.text}
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <IconSparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-[var(--bg-app)] border border-[var(--border)] px-3.5 py-3 rounded-xl rounded-tl-sm flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}

                {messages.length > 0 && !typing && (
                  <button onClick={reset} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mx-auto block">
                    Limpar conversa
                  </button>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border)] p-3 flex gap-2 items-end flex-shrink-0">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Assistente em preparação — ainda não responde de verdade"
                  rows={1}
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border)] text-sm text-[var(--text-primary)] resize-none focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)] max-h-20"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || typing}
                  className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  <IconSend size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
