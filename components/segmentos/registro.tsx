import type { ComponentType } from "react"
import type { Selecoes } from "@/lib/produto"
import type { ItemSacola } from "@/lib/sacola"
import type { SegmentoId } from "@/lib/segmentos"
import type { GrupoOpcao, ItemOpcao, Produto } from "@/lib/tipos"
import {
  ArteEnvioAcougue,
  ArteEnvioAdega,
  ArteEnvioFarmacia,
  ArteEnvioLanchonete,
  ArteEnvioSalao,
} from "./artes-envio"
import {
  CarregadorAcougue,
  CarregadorAdega,
  CarregadorFarmacia,
  CarregadorLanchonete,
  CarregadorPizzaria,
  CarregadorSalao,
} from "./carregadores"
import { MENSAGENS_ENVIO_FARMACIA } from "./farmacia/preview-farmacia"
import { ArteEnvioPizza, MENSAGENS_ENVIO_PIZZA } from "./pizzaria/envio-pizza"
import { MiniaturaPizza, PreviewPizza } from "./pizzaria/preview-pizza"
import { PreviewFoto } from "./preview-foto"

type BlocosDoSegmento = {
  /** Prévia que muda conforme as escolhas do produto; destaca o grupo em escolha. */
  PreviewProduto: ComponentType<{
    produto: Produto
    selecoes: Selecoes
    grupoAtivo?: GrupoOpcao
  }>
  /**
   * Imagem de cada opção na lista. Desenhada pelo próprio sistema, para nunca depender
   * de uma foto cadastrada (que pode não combinar ou nem existir).
   */
  MiniaturaOpcao?: ComponentType<{ grupo: GrupoOpcao; item: ItemOpcao }>
  /** Arte do carregamento ao enviar o pedido, em quatro etapas. Cada nicho tem a sua. */
  ArteEnvio: ComponentType<{ etapa: number; itens: ItemSacola[] }>
  /** Carregador pequeno, em laço, do próprio ofício: aparece em toda espera da loja. */
  Carregador: ComponentType<{ className?: string }>
  /** Uma mensagem por etapa do envio. */
  mensagensEnvio?: string[]
}

/** O layout é único; só estes blocos mudam de um segmento para outro. */
export const registroSegmentos: Record<SegmentoId, BlocosDoSegmento> = {
  pizzaria: {
    PreviewProduto: PreviewPizza,
    MiniaturaOpcao: MiniaturaPizza,
    ArteEnvio: ArteEnvioPizza,
    Carregador: CarregadorPizzaria,
    mensagensEnvio: MENSAGENS_ENVIO_PIZZA,
  },
  farmacia: {
    PreviewProduto: PreviewFoto,
    ArteEnvio: ArteEnvioFarmacia,
    Carregador: CarregadorFarmacia,
    mensagensEnvio: MENSAGENS_ENVIO_FARMACIA,
  },
  adega: {
    PreviewProduto: PreviewFoto,
    ArteEnvio: ArteEnvioAdega,
    Carregador: CarregadorAdega,
    mensagensEnvio: [
      "Recebendo seu pedido",
      "Separando as bebidas",
      "Gelando tudo",
      "Saindo gelado!",
    ],
  },
  acougue: {
    PreviewProduto: PreviewFoto,
    ArteEnvio: ArteEnvioAcougue,
    Carregador: CarregadorAcougue,
    mensagensEnvio: [
      "Recebendo seu pedido",
      "Separando os cortes",
      "Cortando e pesando",
      "Embalado a vácuo!",
    ],
  },
  salao: {
    PreviewProduto: PreviewFoto,
    ArteEnvio: ArteEnvioSalao,
    Carregador: CarregadorSalao,
    mensagensEnvio: [
      "Recebendo seu agendamento",
      "Conferindo a agenda",
      "Reservando seu horário",
      "Horário confirmado!",
    ],
  },
  lanchonete: {
    PreviewProduto: PreviewFoto,
    ArteEnvio: ArteEnvioLanchonete,
    Carregador: CarregadorLanchonete,
    mensagensEnvio: [
      "Recebendo seu pedido",
      "Esquentando a chapa",
      "Montando seu lanche",
      "Saindo quentinho!",
    ],
  },
}
