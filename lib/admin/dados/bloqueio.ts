/**
 * Uma coisa por vez sobre a mesma base: ler, mudar e gravar não se cruzam com outra gravação.
 * Entre abas, o `navigator.locks` do navegador; sem ele, uma fila por nome nesta página (que
 * serve às instâncias do servidor deste módulo, como nos testes).
 */
const filas = new Map<string, Promise<unknown>>()

type Locks = { request<T>(nome: string, fazer: () => Promise<T>): Promise<T> }

function locksDoNavegador(): Locks | undefined {
  try {
    const locks = (globalThis.navigator as { locks?: Locks } | undefined)?.locks
    return typeof locks?.request === "function" ? locks : undefined
  } catch {
    return undefined
  }
}

export function exclusivo<T>(nome: string, fazer: () => Promise<T>): Promise<T> {
  const locks = locksDoNavegador()
  if (locks) return locks.request(nome, fazer)
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
