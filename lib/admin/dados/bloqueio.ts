/**
 * Uma gravação por vez sobre a mesma base, nesta página: ler, mudar e gravar não se cruzam com
 * outra chamada (de qualquer instância do servidor deste módulo, como as "abas" dos testes).
 *
 * Entre abas, quem garante é a revisão (`servidor.ts`): antes de gravar, a chamada confere se
 * outra aba gravou depois da leitura dela e, se gravou, refaz sobre a base nova. O
 * `navigator.locks` foi tentado e saiu: a vez dele chega uns 20 ms depois do clique, e a mudança
 * feita logo antes de sair da página (ou de recarregá-la) não chegava a ser gravada.
 */
const filas = new Map<string, Promise<unknown>>()

export function exclusivo<T>(nome: string, fazer: () => Promise<T>): Promise<T> {
  const anterior = filas.get(nome) ?? Promise.resolve()
  // A vez de cada um começa quando o anterior acaba, dando certo ou não.
  const vez = anterior.then(fazer, fazer)
  const fim = vez.catch(() => undefined)
  filas.set(nome, fim)
  void fim.then(() => {
    if (filas.get(nome) === fim) filas.delete(nome)
  })
  return vez
}
