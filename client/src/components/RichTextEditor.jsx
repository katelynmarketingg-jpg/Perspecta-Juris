import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

// Editor de texto rico (estilo Google Docs) baseado em contentEditable.
// Guarda o conteúdo como HTML. Colar do Word mantém a formatação.
const exec = (c, v = null) => document.execCommand(c, false, v)

const looksHtml = (s) => /<[a-z!/][\s\S]*>/i.test(String(s ?? ''))
// Converte texto simples (modelos antigos) em HTML preservando parágrafos/quebras.
function toHtml(s) {
  if (looksHtml(s)) return s
  const esc = String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!esc.trim()) return ''
  return esc.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
}

const RichTextEditor = forwardRef(function RichTextEditor(
  { value, onChange, lineHeight = 1.9, onLineHeight, minHeight = 340 },
  ref,
) {
  const elRef = useRef(null)

  // Define o conteúdo inicial uma única vez (padrão "uncontrolled" para não perder o cursor).
  useEffect(() => {
    if (elRef.current) {
      elRef.current.innerHTML = toHtml(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => onChange?.(elRef.current?.innerHTML ?? '')

  const run = (c, v) => { elRef.current?.focus(); exec(c, v); emit() }

  // Métodos imperativos: inserir campo/marcador na posição do cursor.
  useImperativeHandle(ref, () => ({
    insertText: (text) => { elRef.current?.focus(); exec('insertText', text); emit() },
    insertHtml: (html) => { elRef.current?.focus(); exec('insertHTML', html); emit() },
    focus: () => elRef.current?.focus(),
  }))

  // Ao colar, deixa o navegador manter a formatação (HTML do Word).
  const onPaste = () => { setTimeout(emit, 0) }

  const Btn = ({ cmd, val, title, children, active }) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()}
      onClick={() => run(cmd, val)}
      className="min-w-[30px] h-8 px-2 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-white flex items-center justify-center">
      {children}
    </button>
  )
  const Sep = () => <span className="w-px h-5 bg-[var(--border)] mx-0.5" />

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hover)]">
        <select title="Tamanho / estilo" onMouseDown={e => e.stopPropagation()}
          onChange={e => { run('formatBlock', e.target.value); e.target.selectedIndex = 0 }}
          className="h-8 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <option value="">Estilo</option>
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <select title="Tamanho da fonte" onMouseDown={e => e.stopPropagation()}
          onChange={e => { run('fontSize', e.target.value); e.target.selectedIndex = 0 }}
          className="h-8 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <option value="">Fonte</option>
          <option value="2">Pequena</option>
          <option value="3">Normal</option>
          <option value="4">Média</option>
          <option value="5">Grande</option>
          <option value="6">Muito grande</option>
        </select>
        <Sep />
        <Btn cmd="bold" title="Negrito"><b>N</b></Btn>
        <Btn cmd="italic" title="Itálico"><i>I</i></Btn>
        <Btn cmd="underline" title="Sublinhado"><u>S</u></Btn>
        <label title="Cor do texto" className="min-w-[30px] h-8 px-1 rounded-md hover:bg-[var(--bg-input)] flex items-center justify-center cursor-pointer relative">
          <span className="text-sm">A</span>
          <input type="color" onChange={e => run('foreColor', e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <Sep />
        <Btn cmd="justifyLeft" title="Alinhar à esquerda">⯇</Btn>
        <Btn cmd="justifyCenter" title="Centralizar">≡</Btn>
        <Btn cmd="justifyRight" title="Alinhar à direita">⯈</Btn>
        <Btn cmd="justifyFull" title="Justificar">☰</Btn>
        <Sep />
        <Btn cmd="insertUnorderedList" title="Lista com marcadores">•</Btn>
        <Btn cmd="insertOrderedList" title="Lista numerada">1.</Btn>
        <Btn cmd="outdent" title="Diminuir recuo">⇤</Btn>
        <Btn cmd="indent" title="Aumentar recuo">⇥</Btn>
        <Sep />
        <select title="Espaçamento entre linhas" value={String(lineHeight)} onMouseDown={e => e.stopPropagation()}
          onChange={e => onLineHeight?.(parseFloat(e.target.value))}
          className="h-8 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <option value="1">Espaço 1,0</option>
          <option value="1.5">Espaço 1,5</option>
          <option value="1.9">Espaço 1,9</option>
          <option value="2">Espaço 2,0</option>
          <option value="2.5">Espaço 2,5</option>
        </select>
        <Btn cmd="removeFormat" title="Limpar formatação">⌫</Btn>
      </div>

      {/* Área editável */}
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        className="overflow-y-auto bg-white text-black px-10 py-8 outline-none pj-rte"
        style={{ minHeight, maxHeight: 520, fontFamily: "'Times New Roman', serif", fontSize: '12pt', lineHeight, textAlign: 'justify' }}
      />
    </div>
  )
})

export default RichTextEditor
