// Regras mínimas de senha para os logins criados pelo sistema.
// Antes, `bcrypt.hash(undefined, 12)` estourava uma exceção e o cliente
// recebia um 500 sem explicação nenhuma.

export const SENHA_MIN = 8

// Devolve null se estiver tudo certo, ou a mensagem do erro.
export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.trim() === '') {
    return 'Informe uma senha para este acesso.'
  }
  if (senha.length < SENHA_MIN) {
    return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`
  }
  return null
}
