type EstadoDosAjustes = {
  aberta: boolean
  /** O segmento tem entrega (e, portanto, a chave de entrega). */
  temEntrega: boolean
  aceitaEntrega: boolean
  somLigado: boolean
  simular: boolean
}

/** O estado dos ajustes da fila em uma linha, para o botão que os recolhe no celular. */
export function resumoDosAjustes({
  aberta,
  temEntrega,
  aceitaEntrega,
  somLigado,
  simular,
}: EstadoDosAjustes) {
  return [
    aberta ? "Loja aberta" : "Loja fechada",
    temEntrega ? (aceitaEntrega ? "Entrega ligada" : "Entrega desligada") : null,
    somLigado ? "Som ligado" : "Som desligado",
    simular ? "Simulando pedidos" : null,
  ]
    .filter(Boolean)
    .join(" · ")
}
