import type { ComponentType } from "react"
import type { ItemSacola } from "@/lib/sacola"
import type { SegmentoId } from "@/lib/segmentos"
import type { GrupoOpcao, ItemOpcao, Produto } from "@/lib/tipos"
import { MENSAGENS_ENVIO_FARMACIA, PreviewFarmacia } from "./farmacia/preview-farmacia"
import { ArteEnvioPizza, MENSAGENS_ENVIO_PIZZA } from "./pizzaria/envio-pizza"
import { MiniaturaPizza, PreviewPizza } from "./pizzaria/preview-pizza"

type BlocosDoSegmento = {
  /** Prévia que muda conforme as escolhas do produto; destaca o grupo em escolha. */
  PreviewProduto: ComponentType<{
    produto: Produto
    selecoes: Record<string, string>
    grupoAtivo?: GrupoOpcao
  }>
  /**
   * Imagem de cada opção na lista. Desenhada pelo próprio sistema, para nunca depender
   * de uma foto cadastrada (que pode não combinar ou nem existir).
   */
  MiniaturaOpcao?: ComponentType<{ grupo: GrupoOpcao; item: ItemOpcao }>
  /** Arte do carregamento ao enviar o pedido, em quatro etapas. */
  ArteEnvio?: ComponentType<{ etapa: number; itens: ItemSacola[] }>
  /** Uma mensagem por etapa do envio. */
  mensagensEnvio?: string[]
}

/** O layout é único; só estes blocos mudam de um segmento para outro. */
export const registroSegmentos: Record<SegmentoId, BlocosDoSegmento> = {
  pizzaria: {
    PreviewProduto: PreviewPizza,
    MiniaturaOpcao: MiniaturaPizza,
    ArteEnvio: ArteEnvioPizza,
    mensagensEnvio: MENSAGENS_ENVIO_PIZZA,
  },
  farmacia: {
    PreviewProduto: PreviewFarmacia,
    mensagensEnvio: MENSAGENS_ENVIO_FARMACIA,
  },
}
