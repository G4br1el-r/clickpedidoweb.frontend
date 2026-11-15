"use client"

import { RabbitIcon, TurtleIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Dica } from "@/components/dica"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { ehPro, useConfig, useOpcaoPro } from "@/lib/admin/config"
import { FONTES_TEXTO, FONTES_TITULO } from "@/lib/admin/fontes"
import type { TelaPrevia } from "@/lib/admin/secoes"
import { clienteAtual } from "@/lib/cliente"
import { cn } from "@/lib/utils"
import {
  avisarSacola,
  BlocoConfig,
  CampoEscolha,
  CampoSegmentado,
  CampoSlider,
  CampoSwitch,
  CampoTexto,
  CLASSE_OPCAO,
  SeloPro,
} from "../campos"
import { CampoCor, CampoImagem } from "../campos-midia"
import { AmostraAnimacao, AmostraBotao, AmostraTitulo } from "../esquemas"
import { type Demonstracao, previaVisivel, usePrevia } from "../previa/estado"

/* ------------------------------------------------------------------ */
/* Identidade                                                          */
/* ------------------------------------------------------------------ */

export function SecaoIdentidade() {
  return (
    <>
      <BlocoConfig
        titulo="Nome e subtítulo"
        descricao="Aparecem no topo da loja, na aba do navegador e ao compartilhar."
        restaurar="identidade"
      >
        <CampoTexto secao="identidade" campo="nome" titulo="Nome da loja" limite={40} />
        <CampoTexto
          secao="identidade"
          campo="slogan"
          titulo="Subtítulo"
          limite={80}
          descricao="Uma frase curta sobre o que a loja tem de melhor."
        />
      </BlocoConfig>
      <BlocoConfig titulo="Logo" descricao="Imagem quadrada, de preferência com fundo.">
        <CampoImagem
          campo="logo"
          titulo="Logo"
          descricao="Mínimo de 200 × 200 px."
          atual={clienteAtual.logo.src}
          ladoMaximo={400}
          formato="quadrado"
        />
        <CampoSwitch
          secao="identidade"
          campo="mostrarLogo"
          titulo="Mostrar a logo no topo"
          descricao="Desligue se o nome já basta ou se o banner tem a marca."
        />
      </BlocoConfig>
      <BlocoConfig titulo="Banner" descricao="A foto de capa, atrás do nome da loja.">
        <CampoImagem
          campo="banner"
          titulo="Foto do banner"
          descricao="Horizontal, a partir de 1600 px de largura."
          atual={clienteAtual.banner.src}
          ladoMaximo={1800}
          formato="largo"
        />
        <CampoSlider
          secao="identidade"
          campo="escurecerBanner"
          titulo="Escurecer a foto"
          descricao="Deixa o nome legível sobre fotos claras."
          min={0}
          max={80}
          formatar={(valor) => `${valor}%`}
        />
        <CampoSegmentado
          secao="identidade"
          campo="alturaBanner"
          titulo="Altura"
          opcoes={[
            { valor: "baixo", rotulo: "Baixa", nome: "Banner baixo" },
            { valor: "padrao", rotulo: "Média", nome: "Banner médio" },
            { valor: "alto", rotulo: "Alta", nome: "Banner alto" },
          ]}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Imagem de fundo" descricao="Uma textura suave atrás de todo o cardápio.">
        <CampoImagem
          campo="fundo"
          titulo="Fundo da página"
          descricao="Padrões, texturas ou fotos bem discretas funcionam melhor."
          ladoMaximo={1400}
          formato="largo"
        />
        <CampoSlider
          secao="identidade"
          campo="opacidadeFundo"
          titulo="Intensidade do fundo"
          min={4}
          max={40}
          formatar={(valor) => `${valor}%`}
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Cores                                                               */
/* ------------------------------------------------------------------ */

const PALETAS = [
  { id: "marca", nome: "Da marca", cores: clienteAtual.tema },
  {
    id: "brasa",
    nome: "Brasa",
    cores: { primaria: "#B3261E", acento: "#F2A900", fundo: "#FBF7F3", tinta: "#2A1714" },
  },
  {
    id: "manjericao",
    nome: "Manjericão",
    cores: { primaria: "#2F6B3A", acento: "#D9480F", fundo: "#F5F7F2", tinta: "#16241A" },
  },
  {
    id: "mar",
    nome: "Mar",
    cores: { primaria: "#0F6E7A", acento: "#E8743B", fundo: "#F3F7F8", tinta: "#11262B" },
  },
  {
    id: "noite",
    nome: "Noite",
    cores: { primaria: "#1D1D24", acento: "#E2B33C", fundo: "#F4F3EF", tinta: "#16161B" },
  },
  {
    id: "oliva",
    nome: "Oliva",
    cores: { primaria: "#5B6236", acento: "#C2562E", fundo: "#F6F4EC", tinta: "#22241A" },
  },
] as const

function Paleta({ paleta }: { paleta: (typeof PALETAS)[number] }) {
  const { ehPro, bloqueada, naSacola, liberada } = useOpcaoPro(`cores.paleta:${paleta.id}`)
  const id = `paleta-${paleta.id}`
  return (
    <FieldLabel
      htmlFor={id}
      data-pro-liberada={liberada || undefined}
      className={cn(CLASSE_OPCAO, liberada && "opcao-pro")}
    >
      <Field orientation="horizontal" className="items-center gap-3 p-3!">
        <span
          aria-hidden="true"
          className={cn("flex -space-x-1.5", bloqueada && !naSacola && "opacity-60")}
        >
          {[paleta.cores.primaria, paleta.cores.acento, paleta.cores.fundo].map((cor) => (
            <span
              key={cor}
              className="size-6 rounded-full ring-2 ring-card"
              style={{ background: cor }}
            />
          ))}
        </span>
        <FieldContent>
          <FieldTitle className="flex w-full items-center gap-2">
            {paleta.nome}
            {ehPro && <SeloPro liberada={liberada} naSacola={naSacola} className="ml-auto" />}
          </FieldTitle>
        </FieldContent>
        <RadioGroupItem value={paleta.id} id={id} aria-label={paleta.nome} />
      </Field>
    </FieldLabel>
  )
}

export function SecaoCores() {
  const paleta = useConfig((estado) => estado.config.cores.paleta)
  const pro = useConfig((estado) => estado.pro)
  const compradas = useConfig((estado) => estado.compradas)
  const atualizar = useConfig((estado) => estado.atualizar)

  return (
    <>
      <BlocoConfig
        titulo="Paleta"
        descricao="Comece por uma combinação pronta e ajuste cada cor se quiser."
        restaurar="cores"
      >
        <RadioGroup
          value={paleta}
          aria-label="Paleta"
          onValueChange={(valor) => {
            const escolhida = PALETAS.find((item) => item.id === valor)
            if (!escolhida) return
            atualizar("cores", { paleta: valor, ...escolhida.cores })
            const chave = `cores.paleta:${valor}`
            if (ehPro(chave) && !pro && !compradas.includes(chave)) {
              avisarSacola(`Paleta ${escolhida.nome}`)
            }
          }}
          className="grid gap-2.5 @md/conteudo:grid-cols-2 @2xl/conteudo:grid-cols-3"
        >
          {PALETAS.map((item) => (
            <Paleta key={item.id} paleta={item} />
          ))}
        </RadioGroup>
        {paleta === "personalizada" && (
          <FieldDescription>Você está usando cores personalizadas.</FieldDescription>
        )}
      </BlocoConfig>
      <BlocoConfig titulo="Cores" descricao="O painel avisa quando alguma cor atrapalha a leitura.">
        <CampoCor
          campo="primaria"
          titulo="Principal"
          descricao="Botões de ação e destaques."
          contrasteCom="texto-do-botao"
        />
        <CampoCor
          campo="acento"
          titulo="Destaque"
          descricao="Ofertas, selos e detalhes."
          contrasteCom="fundo"
        />
        <CampoCor campo="fundo" titulo="Fundo" descricao="Cor de fundo da página." />
        <CampoCor campo="tinta" titulo="Texto" descricao="Cor dos textos." contrasteCom="fundo" />
      </BlocoConfig>
      <BlocoConfig titulo="Botões de ação" descricao="Adicionar, continuar e enviar pedido.">
        <CampoEscolha
          secao="cores"
          campo="botao"
          titulo="Estilo"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["solido", "Sólido"],
              ["suave", "Suave"],
              ["contorno", "Contorno"],
              ["degrade", "Degradê"],
              ["brilho", "Brilho"],
            ] as const
          ).map(([valor, rotulo]) => ({ valor, rotulo, visual: <AmostraBotao estilo={valor} /> }))}
        />
        <CampoSlider
          secao="cores"
          campo="cantos"
          titulo="Cantos"
          descricao="De retos a bem arredondados."
          min={0}
          max={24}
          formatar={(valor) => (valor === 0 ? "Retos" : `${valor} px`)}
          amostra={(valor) => (
            // O canto de cima à esquerda de um botão, em tamanho real.
            <span
              aria-hidden="true"
              data-testid="amostra-cantos"
              className="size-6 border-t-2 border-l-2 border-foreground/70 transition-[border-radius] duration-150 ease-saida"
              style={{ borderTopLeftRadius: `${valor}px` }}
            />
          )}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Tema" descricao="Como a loja abre para quem visita.">
        <CampoSegmentado
          secao="cores"
          campo="temaPadrao"
          titulo="Tema ao abrir"
          descricao="Em Automático, segue o celular de cada cliente."
          opcoes={[
            { valor: "sistema", rotulo: "Automático", nome: "Tema automático" },
            { valor: "claro", rotulo: "Claro", nome: "Tema claro" },
            { valor: "escuro", rotulo: "Escuro", nome: "Tema escuro" },
          ]}
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tipografia                                                          */
/* ------------------------------------------------------------------ */

export function SecaoTipografia() {
  return (
    <>
      <BlocoConfig titulo="Fontes" restaurar="tipografia">
        <CampoEscolha
          secao="tipografia"
          campo="titulo"
          titulo="Títulos"
          descricao="Nome da loja, seções e produtos em destaque."
          colunas={3}
          formato="vertical"
          opcoes={(Object.keys(FONTES_TITULO) as (keyof typeof FONTES_TITULO)[]).map((valor) => ({
            valor,
            rotulo: FONTES_TITULO[valor].nome,
            visual: (
              <span
                className="flex h-16 items-center justify-center rounded-lg bg-foreground/[0.04] text-3xl font-bold"
                style={{ fontFamily: FONTES_TITULO[valor].css }}
              >
                Aa
              </span>
            ),
          }))}
        />
        <CampoEscolha
          secao="tipografia"
          campo="texto"
          titulo="Texto"
          descricao="Descrições, preços e botões."
          colunas={3}
          opcoes={(Object.keys(FONTES_TEXTO) as (keyof typeof FONTES_TEXTO)[]).map((valor) => ({
            valor,
            rotulo: FONTES_TEXTO[valor].nome,
            visual: (
              <span className="text-lg" style={{ fontFamily: FONTES_TEXTO[valor].css }}>
                Ag
              </span>
            ),
          }))}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Tamanho e estilo">
        <CampoSlider
          secao="tipografia"
          campo="escala"
          titulo="Tamanho do texto"
          descricao="Aumente se seus clientes preferem letras maiores."
          min={90}
          max={115}
          formatar={(valor) => `${valor}%`}
        />
        <CampoEscolha
          secao="tipografia"
          campo="tituloSecao"
          titulo="Títulos das seções"
          formato="vertical"
          colunas={2}
          opcoes={(
            [
              ["barra", "Com barra"],
              ["sublinhado", "Sublinhado"],
              ["simples", "Simples"],
              ["pilula", "Pílula"],
            ] as const
          ).map(([valor, rotulo]) => ({ valor, rotulo, visual: <AmostraTitulo estilo={valor} /> }))}
        />
      </BlocoConfig>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Animações                                                           */
/* ------------------------------------------------------------------ */

export function SecaoAnimacoes() {
  useMostrarAnimacoes()
  return (
    <>
      <BlocoConfig
        titulo="Entrada da página"
        descricao="Como as seções aparecem quando o cliente abre a loja."
        restaurar="animacoes"
      >
        <CampoEscolha
          secao="animacoes"
          campo="entrada"
          titulo="Animação de entrada"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["nenhuma", "Nenhuma"],
              ["suave", "Suave"],
              ["subir", "Subir"],
              ["zoom", "Zoom"],
              ["desfoque", "Desfoque"],
              ["cascata", "Cascata"],
            ] as const
          ).map(([valor, rotulo]) => ({
            valor,
            rotulo,
            visual: <AmostraAnimacao tipo="entrada" valor={valor} />,
          }))}
        />
        <CampoVelocidade />
      </BlocoConfig>
      <BlocoConfig titulo="Abrir e fechar" descricao="Transição ao abrir um produto.">
        <CampoEscolha
          secao="animacoes"
          campo="abrirProduto"
          titulo="Ao abrir o produto"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["deslizar", "Deslizar", "Sobe de baixo, ou entra pela lateral"],
              ["escalar", "Crescer", "Aparece crescendo no lugar"],
              ["morph", "Transformar", "O card vira a tela do produto"],
            ] as const
          ).map(([valor, rotulo, descricao]) => ({
            valor,
            rotulo,
            descricao,
            visual: <AmostraAnimacao tipo="abrir" valor={valor} />,
          }))}
        />
      </BlocoConfig>
      <BlocoConfig titulo="Toques e destaques">
        <CampoEscolha
          secao="animacoes"
          campo="aoAdicionar"
          titulo="Ao adicionar na sacola"
          formato="vertical"
          colunas={3}
          opcoes={(
            [
              ["voo", "Voo"],
              ["pulso", "Pulso"],
              ["confete", "Confete"],
            ] as const
          ).map(([valor, rotulo]) => ({
            valor,
            rotulo,
            visual: <AmostraAnimacao tipo="adicionar" valor={valor} />,
          }))}
        />
        <CampoEscolha
          secao="animacoes"
          campo="hover"
          titulo="Ao passar o mouse no card"
          formato="vertical"
          colunas={2}
          opcoes={(
            [
              ["nenhum", "Nenhum"],
              ["levantar", "Levantar"],
              ["zoom", "Zoom na foto"],
              ["brilho", "Contorno"],
            ] as const
          ).map(([valor, rotulo]) => ({
            valor,
            rotulo,
            visual: <AmostraAnimacao tipo="hover" valor={valor} />,
          }))}
        />
      </BlocoConfig>
    </>
  )
}

/**
 * Ao mudar uma animação, a prévia vai para a tela certa e toca o movimento:
 * entrada no cardápio, abertura no produto, efeito de adicionar e destaque dos cards.
 */
function useMostrarAnimacoes() {
  const animacoes = useConfig((estado) => estado.config.animacoes)
  const anterior = useRef(animacoes)

  useEffect(() => {
    const antes = anterior.current
    anterior.current = animacoes
    if (antes === animacoes) return

    let tela: TelaPrevia = "inicio"
    let demo: Demonstracao | null = null
    if (antes.abrirProduto !== animacoes.abrirProduto) tela = "produto"
    else if (antes.aoAdicionar !== animacoes.aoAdicionar) {
      tela = "produto"
      demo = "adicionar"
    } else if (antes.hover !== animacoes.hover) demo = "hover"

    const tocar = () => {
      const previa = usePrevia.getState()
      previa.definirTela(tela)
      previa.repetir()
      if (!demo) return []
      const qual = demo
      return [
        setTimeout(() => usePrevia.getState().demonstrar(qual), qual === "adicionar" ? 900 : 650),
        setTimeout(() => usePrevia.setState({ demo: null }), 3200),
      ]
    }

    // Espera o controle parar (o slider de velocidade muda várias vezes por segundo).
    let timers: ReturnType<typeof setTimeout>[] = []
    const inicio = setTimeout(() => {
      timers = tocar()
      if (!previaVisivel()) {
        toast("Veja a animação na prévia", {
          id: "ver-previa",
          action: {
            label: "Ver na prévia",
            onClick: () => {
              usePrevia.getState().abrirFolha(true)
              setTimeout(tocar, 450)
            },
          },
        })
      }
    }, 220)

    return () => {
      clearTimeout(inicio)
      for (const timer of timers) clearTimeout(timer)
    }
  }, [animacoes])
}

/* ------------------------------------------------------------------ */
/* Velocidade: da tartaruga ao coelho                                  */
/* ------------------------------------------------------------------ */

/** Duração das animações: 1,6× é o mais calmo, 0,5× o mais rápido. */
const MAIS_CALMA = 1.6
const MAIS_RAPIDA = 0.5
const PASSO_VELOCIDADE = 0.1

/**
 * Velocidade das animações num slide com a tartaruga à esquerda (calma) e o coelho
 * à direita (rápida). O bicho do lado escolhido cresce, ganha cor e se mexe:
 * a tartaruga anda devagar, o coelho dá pulinhos.
 */
function CampoVelocidade() {
  const velocidade = useConfig((estado) => estado.config.animacoes.velocidade)
  const atualizar = useConfig((estado) => estado.atualizar)
  // O slide vai da tartaruga (esquerda) ao coelho (direita): o contrário da duração.
  const rapidez = MAIS_CALMA + MAIS_RAPIDA - velocidade
  const fracao = (rapidez - MAIS_RAPIDA) / (MAIS_CALMA - MAIS_RAPIDA)
  const calma = fracao < 0.35
  const rapida = fracao > 0.65
  const rotulo = rapida ? "Rápida" : calma ? "Calma" : "Normal"

  function definir(novaRapidez: number) {
    const limitada = Math.min(MAIS_CALMA, Math.max(MAIS_RAPIDA, novaRapidez))
    const duracao = Math.round((MAIS_CALMA + MAIS_RAPIDA - limitada) * 10) / 10
    atualizar("animacoes", { velocidade: duracao })
  }

  const bicho = (ativo: boolean) =>
    cn(
      "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300",
      ativo ? "bg-accent text-marca-texto" : "text-muted-foreground hover:bg-muted",
    )

  return (
    <Field>
      <div className="flex items-baseline justify-between gap-3">
        <FieldTitle id="campo-animacoes-velocidade">Velocidade</FieldTitle>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={rotulo}
            className="text-sm font-semibold text-muted-foreground"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {rotulo}
          </motion.span>
        </AnimatePresence>
      </div>
      <FieldDescription>Vale para todas as animações da loja.</FieldDescription>
      <div className="flex items-center gap-3">
        <Dica texto="Mais calma">
          <button
            type="button"
            aria-label="Mais calma"
            onClick={() => definir(rapidez - PASSO_VELOCIDADE)}
            className={bicho(calma)}
          >
            <motion.span
              className="block"
              animate={
                calma
                  ? { x: [0, 2.5, 0, -1, 0], rotate: [0, -5, 0, 3, 0], scale: 1.2 }
                  : { x: 0, rotate: 0, scale: 1 - fracao * 0.15 }
              }
              transition={
                calma
                  ? { duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                  : { duration: 0.3 }
              }
            >
              <TurtleIcon className="size-6" />
            </motion.span>
          </button>
        </Dica>
        <Slider
          aria-labelledby="campo-animacoes-velocidade"
          aria-valuetext={rotulo}
          value={[rapidez]}
          min={MAIS_RAPIDA}
          max={MAIS_CALMA}
          step={PASSO_VELOCIDADE}
          onValueChange={([valor]) => definir(valor)}
          className="flex-1 py-1.5"
        />
        <Dica texto="Mais rápida">
          <button
            type="button"
            aria-label="Mais rápida"
            onClick={() => definir(rapidez + PASSO_VELOCIDADE)}
            className={bicho(rapida)}
          >
            <motion.span
              className="block"
              animate={
                rapida
                  ? { y: [0, -7, 0, -3, 0], rotate: [0, -8, 0, -4, 0], scale: 1.2 }
                  : { y: 0, rotate: 0, scale: 0.85 + fracao * 0.15 }
              }
              transition={
                rapida
                  ? {
                      duration: 0.55,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 0.35,
                      ease: "easeOut",
                    }
                  : { duration: 0.3 }
              }
            >
              <RabbitIcon className="size-6" />
            </motion.span>
          </button>
        </Dica>
      </div>
    </Field>
  )
}
