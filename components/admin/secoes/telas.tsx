"use client"

import { BanknoteIcon, CreditCardIcon, QrCodeIcon, WalletCardsIcon } from "lucide-react"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { type MetodoPagamento, useConfig } from "@/lib/admin/config"
import { BlocoConfig, CampoEscolha, CampoSegmentado, CampoSwitch, CampoTexto } from "../campos"
import { EsquemaCabecalho, EsquemaCard, EsquemaDisposicao, EsquemaTela } from "../esquemas"
import { Wireframe } from "../wireframe"

/* ------------------------------------------------------------------ */
/* Página inicial                                                      */
/* ------------------------------------------------------------------ */

export function SecaoInicio() {
  return (
    <>
      <BlocoConfig
        titulo="Ordem da página"
        descricao="Arraste para reorganizar. Desligue o que não quer mostrar e escolha como cada seção exibe os produtos."
        restaurar="inicio"
      >
        <Wireframe />
      </BlocoConfig>
      <BlocoConfig titulo="Cabeçalho" descricao="O topo da loja, com banner e informações.">
        <CampoEscolha
          secao="inicio"
          campo="cabecalho"
          titulo="Estilo do cabeçalho"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["padrao", "Banner", "Foto grande com o nome no centro"],
              ["compacto", "Compacto", "Faixa baixa, nome ao lado da logo"],
              ["dividido", "Dividido", "Texto de um lado, foto do outro"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaCabecalho estilo={valor} />,
          }))}
        />
        <CampoSwitch
          secao="inicio"
          campo="painelInfo"
          titulo="Painel de informações"
          descricao="Tempo de entrega, retirada, pedido mínimo e horário."
        />
        <CampoSwitch
          secao="inicio"
          campo="barraCategorias"
          titulo="Barra de categorias"
          descricao="Atalhos para pular direto a uma categoria."
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

const OPCOES_COLUNAS = ([1, 2, 3, 4] as const).map((valor) => ({
  valor,
  rotulo: String(valor),
  nome: valor === 1 ? "1 coluna" : `${valor} colunas`,
}))

export function SecaoCards() {
  const disposicao = useConfig((estado) => estado.config.cards.disposicao)
  return (
    <>
      <BlocoConfig
        titulo="Modelo do card"
        descricao="Como cada produto aparece no cardápio."
        restaurar="cards"
      >
        <CampoEscolha
          secao="cards"
          campo="variante"
          titulo="Modelo"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["classico", "Clássico", "Foto ao lado, preço embaixo"],
              ["vitrine", "Vitrine", "Foto grande em cima"],
              ["compacto", "Compacto", "Lista enxuta, foto pequena"],
              ["imersivo", "Imersivo", "A foto é o card"],
              ["mosaico", "Mosaico", "Foto quadrada, feito para grades"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaCard variante={valor} />,
          }))}
        />
        <CampoSwitch secao="cards" campo="descricao" titulo="Mostrar descrição" />
        <CampoSwitch
          secao="cards"
          campo="seloOferta"
          titulo="Selo de oferta"
          descricao="Marca os produtos com preço promocional."
        />
      </BlocoConfig>
      <BlocoConfig
        titulo="Disposição dos itens"
        descricao="Vale para as categorias em “Padrão”. Cada seção pode ter a sua em Página inicial."
      >
        <CampoEscolha
          secao="cards"
          campo="disposicao"
          titulo="Itens por"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["lista", "Linha", "Um item por linha"],
              ["grade", "Colunas", "Itens lado a lado em grade"],
              ["carrossel", "Carrossel", "Uma fileira que desliza"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaDisposicao disposicao={valor} />,
          }))}
        />
        {disposicao !== "lista" && (
          <>
            <CampoSegmentado
              secao="cards"
              campo="colunasCelular"
              aparelho="celular"
              titulo={disposicao === "carrossel" ? "Itens à vista" : "Colunas"}
              descricao="Com 3 ou 4, o modelo Mosaico é o que fica melhor."
              opcoes={OPCOES_COLUNAS}
            />
            <CampoSegmentado
              secao="cards"
              campo="colunasComputador"
              aparelho="computador"
              titulo={disposicao === "carrossel" ? "Itens à vista" : "Colunas"}
              opcoes={OPCOES_COLUNAS}
            />
          </>
        )}
        <CampoSegmentado
          secao="cards"
          campo="espacamento"
          titulo="Espaço entre os itens"
          opcoes={[
            { valor: "justo", rotulo: "Justo", nome: "Espaço justo" },
            { valor: "padrao", rotulo: "Médio", nome: "Espaço médio" },
            { valor: "amplo", rotulo: "Amplo", nome: "Espaço amplo" },
          ]}
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Produto                                                             */
/* ------------------------------------------------------------------ */

export function SecaoProduto() {
  return (
    <>
      <BlocoConfig
        titulo="Formato"
        descricao="Como o produto abre ao ser tocado."
        restaurar="produto"
      >
        <CampoEscolha
          secao="produto"
          campo="layout"
          titulo="Abrir em"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["painel", "Painel", "Sobe no celular, lateral no computador"],
              ["janela", "Janela", "Centralizado sobre a página"],
              ["tela-cheia", "Tela cheia", "Uma página só do produto"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaTela tipo={valor} />,
          }))}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Montagem">
        <CampoSwitch
          secao="produto"
          campo="previaIlustrada"
          titulo="Prévia ilustrada"
          descricao="Desenha a pizza com os sabores escolhidos, no lugar da foto."
        />
        <CampoSwitch
          secao="produto"
          campo="passosEmAbas"
          titulo="Passos em abas"
          descricao="Um passo de cada vez. Desligado, mostra todas as escolhas em lista."
        />
        <CampoSwitch secao="produto" campo="observacao" titulo="Campo de observação" />
        <CampoSwitch
          secao="produto"
          campo="sugestoes"
          titulo="Peça também"
          descricao="Sugere bebidas e sobremesas dentro do produto."
        />
        <CampoTexto secao="produto" campo="textoBotao" titulo="Texto do botão" limite={24} />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sacola                                                              */
/* ------------------------------------------------------------------ */

export function SecaoSacola() {
  return (
    <>
      <BlocoConfig titulo="Formato" restaurar="sacola">
        <CampoEscolha
          secao="sacola"
          campo="estilo"
          titulo="A sacola abre como"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["ilha", "Ilha", "Cresce a partir do ícone"],
              ["gaveta", "Gaveta", "Entra pela lateral"],
              ["pagina", "Página", "Uma tela só para a sacola"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaTela tipo={valor} />,
          }))}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Conteúdo">
        <CampoSwitch
          secao="sacola"
          campo="barraMinimo"
          titulo="Barra do pedido mínimo"
          descricao="Mostra quanto falta para fechar o pedido."
        />
        <CampoSwitch
          secao="sacola"
          campo="sugestoes"
          titulo="Combina com seu pedido"
          descricao="Sugestões para aumentar o valor do pedido."
        />
        <CampoTexto secao="sacola" campo="textoBotao" titulo="Texto do botão" limite={24} />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Finalizar                                                           */
/* ------------------------------------------------------------------ */

const METODOS: {
  id: MetodoPagamento
  nome: string
  descricao: string
  icone: typeof QrCodeIcon
}[] = [
  { id: "pix", nome: "Pix", descricao: "Pagamento na hora, pelo app do banco.", icone: QrCodeIcon },
  {
    id: "cartao-online",
    nome: "Cartão online",
    descricao: "Crédito ou débito no site.",
    icone: CreditCardIcon,
  },
  { id: "dinheiro", nome: "Dinheiro", descricao: "Com troco na entrega.", icone: BanknoteIcon },
  {
    id: "cartao-entrega",
    nome: "Cartão na entrega",
    descricao: "O entregador leva a maquininha.",
    icone: WalletCardsIcon,
  },
]

function Pagamentos() {
  const pagamentos = useConfig((estado) => estado.config.finalizar.pagamentos)
  const atualizar = useConfig((estado) => estado.atualizar)
  const ligados = Object.values(pagamentos).filter(Boolean).length

  return (
    <>
      {METODOS.map(({ id, nome, descricao, icone: Icone }) => (
        <Field key={id} orientation="horizontal">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-muted-foreground [&_svg]:size-4"
          >
            <Icone />
          </span>
          <FieldContent>
            <FieldLabel htmlFor={`pagamento-${id}`}>{nome}</FieldLabel>
            <FieldDescription>{descricao}</FieldDescription>
          </FieldContent>
          <Switch
            id={`pagamento-${id}`}
            checked={pagamentos[id]}
            // A loja precisa aceitar pelo menos uma forma de pagamento.
            disabled={pagamentos[id] && ligados === 1}
            onCheckedChange={(marcado) =>
              atualizar("finalizar", { pagamentos: { ...pagamentos, [id]: marcado } })
            }
          />
        </Field>
      ))}
      <FieldDescription>Pelo menos uma forma de pagamento fica sempre ligada.</FieldDescription>
    </>
  )
}

export function SecaoFinalizar() {
  return (
    <>
      <BlocoConfig titulo="Etapas" restaurar="finalizar">
        <CampoSegmentado
          secao="finalizar"
          campo="fluxo"
          titulo="Formato"
          descricao="Passo a passo guia o cliente; uma página só é mais rápida."
          opcoes={[
            { valor: "passos", rotulo: "Passo a passo", nome: "Passo a passo" },
            { valor: "pagina-unica", rotulo: "Uma página", nome: "Tudo em uma página" },
          ]}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Formas de pagamento">
        <Pagamentos />
      </BlocoConfig>
      <BlocoConfig titulo="Campos e extras">
        <CampoSwitch secao="finalizar" campo="cpfNaNota" titulo="CPF na nota" />
        <CampoSwitch secao="finalizar" campo="observacao" titulo="Observação para a loja" />
        <CampoSwitch
          secao="finalizar"
          campo="cupom"
          titulo="Cupom de desconto"
          descricao="Campo para o cliente aplicar um cupom."
        />
        <CampoSwitch secao="finalizar" campo="gorjeta" titulo="Gorjeta para o entregador" />
        <CampoTexto
          secao="finalizar"
          campo="textoBotao"
          titulo="Texto do botão final"
          limite={24}
        />
      </BlocoConfig>
      <BlocoConfig
        titulo="Envio do pedido"
        descricao="O que o cliente vê enquanto o pedido é enviado. Toque no botão da prévia para ver."
      >
        <CampoEscolha
          secao="finalizar"
          campo="carregamento"
          titulo="Carregamento"
          opcoes={[
            { valor: "simples", rotulo: "Simples", descricao: "Um indicador discreto" },
            {
              valor: "tematico",
              rotulo: "Temático",
              descricao: "A pizza vai ao forno, com mensagens que mudam",
            },
          ]}
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Acompanhamento e conversa                                           */
/* ------------------------------------------------------------------ */

export function SecaoAcompanhamento() {
  return (
    <>
      <BlocoConfig titulo="Topo" restaurar="acompanhamento">
        <CampoEscolha
          secao="acompanhamento"
          campo="topo"
          titulo="Estilo do topo"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["neutro", "Neutro", "Limpo, nas cores da página"],
              ["marca", "Cor da marca", "Faixa na cor principal"],
              ["foto", "Foto", "O banner da loja ao fundo"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <EsquemaTela tipo={valor} />,
          }))}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Conteúdo">
        <CampoSwitch
          secao="acompanhamento"
          campo="linhaDoTempo"
          titulo="Linha do tempo"
          descricao="Cada etapa do pedido, com horário."
        />
        <CampoSwitch
          secao="acompanhamento"
          campo="mapa"
          titulo="Mapa da entrega"
          descricao="Mostra o caminho do entregador."
        />
        <CampoSwitch
          secao="acompanhamento"
          campo="avaliar"
          titulo="Avaliação do pedido"
          descricao="Pede uma nota de 1 a 5 estrelas."
        />
        <CampoTexto
          secao="acompanhamento"
          campo="agradecimento"
          titulo="Mensagem de agradecimento"
          limite={140}
        />
      </BlocoConfig>
    </>
  )
}

export function SecaoConversa() {
  return (
    <BlocoConfig
      titulo="Conversa no WhatsApp"
      descricao="Mensagens que o cliente recebe depois de pedir."
      restaurar="conversa"
    >
      <CampoSwitch secao="conversa" campo="ativa" titulo="Enviar mensagens pelo WhatsApp" />
      <CampoTexto secao="conversa" campo="saudacao" titulo="Primeira mensagem" limite={160} />
      <CampoSwitch
        secao="conversa"
        campo="resumoNoChat"
        titulo="Resumo do pedido no chat"
        descricao="Envia os itens e o total logo depois da saudação."
      />
    </BlocoConfig>
  )
}

/* ------------------------------------------------------------------ */
/* Recursos                                                            */
/* ------------------------------------------------------------------ */

export function SecaoRecursos() {
  return (
    <>
      <BlocoConfig titulo="Na página" restaurar="recursos">
        <CampoSwitch secao="recursos" campo="busca" titulo="Busca no cardápio" />
        <CampoSwitch secao="recursos" campo="compartilhar" titulo="Botão de compartilhar" />
        <CampoSwitch secao="recursos" campo="alternarTema" titulo="Botão de tema claro e escuro" />
        <CampoSwitch secao="recursos" campo="horario" titulo="Horário de funcionamento" />
        <CampoSwitch secao="recursos" campo="seloAberto" titulo="Selo de aberto agora" />
        <CampoSwitch secao="recursos" campo="pedidoMinimo" titulo="Pedido mínimo" />
        <CampoSwitch
          secao="recursos"
          campo="whatsapp"
          titulo="Botão flutuante do WhatsApp"
          descricao="Atalho para o cliente falar com a loja."
        />
      </BlocoConfig>
      <BlocoConfig titulo="Vendas e fidelidade">
        <CampoSwitch
          secao="recursos"
          campo="fidelidade"
          titulo="Cartão fidelidade"
          descricao="A cada 10 pedidos, o cliente ganha um prêmio."
        />
        <CampoSwitch
          secao="recursos"
          campo="popupPromocao"
          titulo="Promoção ao entrar"
          descricao="Uma janela com cupom para quem visita pela primeira vez."
        />
      </BlocoConfig>
    </>
  )
}
