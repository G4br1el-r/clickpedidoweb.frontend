/** Marca ou desmarca um item, sem mexer no conjunto de origem. */
export function alternarMarca<T>(marcados: ReadonlySet<T>, item: T): Set<T> {
  const novo = new Set(marcados)
  if (novo.has(item)) novo.delete(item)
  else novo.add(item)
  return novo
}

/** Marca ou desmarca vários de uma vez (o "selecionar todos"); o resto fica como estava. */
export function marcarVarios<T>(marcados: ReadonlySet<T>, itens: readonly T[], marcar: boolean) {
  const novo = new Set(marcados)
  for (const item of itens) {
    if (marcar) novo.add(item)
    else novo.delete(item)
  }
  return novo
}
