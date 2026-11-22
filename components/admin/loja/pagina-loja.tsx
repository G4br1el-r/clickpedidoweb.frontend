"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CopyIcon, MoonIcon, PrinterIcon, Undo2Icon, Volume2Icon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react"
import { type ReactNode, useEffect, useId, useState } from "react"
import {
  type Control,
  Controller,
  type FieldError as ErroDoCampo,
  useForm,
  useWatch,
} from "react-hook-form"
import { NumericFormat, PatternFormat } from "react-number-format"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAgora } from "@/hooks/use-agora"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useConectarPagamento, useSalvarLoja } from "@/lib/admin/dados/consultas-entrega"
import type { ConfigLoja, FormaPagamento, SomAlerta, TaxasPagamento } from "@/lib/admin/dados/tipos"
import { esquemaLoja, type FormularioLoja } from "@/lib/admin/regras/esquema-loja"
import { copiarParaTodos, textoDoHorario } from "@/lib/admin/regras/loja"
import { rotuloTaxa } from "@/lib/admin/regras/rotulos"
import { resumoDasAlteracoes, secoesAlteradas } from "@/lib/admin/regras/secoes-loja"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo, temRecurso } from "@/lib/admin/segmentos-painel"
import { tocarAlerta } from "@/lib/admin/som"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { semRelogioDoNavegador } from "../entrega/linha-animada"
import { Cupom, pedidoDeTeste, useImpressora } from "../impressao/cupom"
import { Traco } from "../traco"

type Controle = Control<FormularioLoja, unknown, ConfigLoja>

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
/** Na tela, a semana começa na segunda. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]
const noDia = (dia: number) => `${dia === 0 || dia === 6 ? "no" : "na"} ${DIAS[dia]}`
const CURVA = [0.23, 1, 0.32, 1] as const

const SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
  { valor: "sirene", rotulo: "Sirene" },
]

const dinheiro = {
  customInput: Input,
  inputMode: "decimal" as const,
  prefix: "R$ ",
  decimalSeparator: ",",
  thousandSeparator: ".",
  decimalScale: 2,
  fixedDecimalScale: true,
}

/**
 * Seção plana das configurações: fio no topo; no desktop, o título e a explicação ficam na
 * coluna da esquerda e os campos na da direita, para o olho descer só pela coluna dos campos.
 */
function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="grid min-w-0 gap-4 border-t border-border/70 pt-5 pb-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 lg:pt-6"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
          {titulo}
        </h2>
        {descricao && <p className="text-[13px] text-pretty text-muted-foreground">{descricao}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

/** Grade dos campos: uma coluna no celular, duas do tablet em diante. */
function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
}

/** Linhas de chaves (liga/desliga) separadas por fios. */
function Linhas({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-border/70 border-b border-border/70">
      {children}
    </div>
  )
}

/** Campo de texto registrado no formulário, com o erro embaixo. */
function CampoTexto({
  controle,
  nome,
  rotulo,
  descricao,
  maximo,
  placeholder,
  erro,
  multilinha,
  className,
}: {
  controle: Controle
  nome:
    | "nome"
    | "slogan"
    | "endereco"
    | "textoHorario"
    | "mensagemFechada"
    | "tempoEntrega"
    | "tempoRetirada"
    | "videoBanner"
  rotulo: string
  descricao?: ReactNode
  maximo: number
  placeholder?: string
  erro?: ErroDoCampo
  multilinha?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro)} className={className}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={controle}
        name={nome}
        render={({ field }) =>
          multilinha ? (
            <Textarea
              id={id}
              rows={2}
              maxLength={maximo}
              aria-invalid={Boolean(erro)}
              placeholder={placeholder}
              {...field}
            />
          ) : (
            <Input
              id={id}
              maxLength={maximo}
              aria-invalid={Boolean(erro)}
              placeholder={placeholder}
              {...field}
            />
          )
        }
      />
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
      {erro && <FieldError>{erro.message}</FieldError>}
    </Field>
  )
}

function CampoTelefone({
  controle,
  nome,
  rotulo,
  erro,
}: {
  controle: Controle
  nome: "telefone" | "whatsapp"
  rotulo: string
  erro?: ErroDoCampo
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro)}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={controle}
        name={nome}
        render={({ field }) => (
          <PatternFormat
            id={id}
            customInput={Input}
            format={field.value.length > 10 ? "(##) #####-####" : "(##) ####-#####"}
            inputMode="tel"
            className="tabular-nums"
            aria-invalid={Boolean(erro)}
            value={field.value}
            onValueChange={({ value }) => field.onChange(value)}
            onBlur={field.onBlur}
          />
        )}
      />
      {erro && <FieldError>{erro.message}</FieldError>}
    </Field>
  )
}

function CampoDinheiro({
  controle,
  nome,
  rotulo,
  erro,
}: {
  controle: Controle
  nome: "taxaEntregaPadrao" | "pedidoMinimo"
  rotulo: string
  erro?: ErroDoCampo
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro)}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={controle}
        name={nome}
        render={({ field }) => (
          <NumericFormat
            {...dinheiro}
            id={id}
            className="tabular-nums"
            aria-invalid={Boolean(erro)}
            value={field.value}
            onValueChange={({ floatValue }) => field.onChange(floatValue ?? 0)}
            onBlur={field.onBlur}
          />
        )}
      />
      {erro && <FieldError>{erro.message}</FieldError>}
    </Field>
  )
}

const TAXAS: { forma: keyof TaxasPagamento; rotulo: string }[] = (
  ["pixOnline", "cartaoOnline", "maquininha"] as const
).map((forma) => ({ forma, rotulo: rotuloTaxa(forma) }))

/** Taxa de uma forma de pagamento, em %. Vazio fica sem taxa (conta como 0%). */
function CampoTaxa({
  controle,
  forma,
  rotulo,
  erro,
}: {
  controle: Controle
  forma: keyof TaxasPagamento
  rotulo: string
  erro?: ErroDoCampo
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro)}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={controle}
        name={`taxasPagamento.${forma}`}
        render={({ field }) => (
          <NumericFormat
            customInput={Input}
            inputMode="decimal"
            suffix=" %"
            decimalSeparator=","
            decimalScale={2}
            allowNegative={false}
            id={id}
            className="tabular-nums"
            aria-invalid={Boolean(erro)}
            value={field.value ?? ""}
            onValueChange={({ floatValue }) => field.onChange(floatValue)}
            onBlur={field.onBlur}
          />
        )}
      />
      {erro && <FieldError>{erro.message}</FieldError>}
    </Field>
  )
}

/** Uma linha de liga/desliga: rótulo e explicação à esquerda, a chave à direita. */
function Chave({
  controle,
  nome,
  rotulo,
  descricao,
  desabilitada,
  erro,
}: {
  controle: Controle
  nome:
    | "controleAutomatico"
    | "aceitaEntrega"
    | "aceitaRetirada"
    | "impressaoAutomatica"
    | "cortarPapel"
    | "aceiteManual"
  rotulo: string
  descricao?: string
  desabilitada?: boolean
  erro?: string
}) {
  const id = useId()
  return (
    <Controller
      control={controle}
      name={nome}
      render={({ field }) => (
        <div className="flex min-h-14 items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor={id} className="text-sm font-medium">
              {rotulo}
            </label>
            {descricao && <span className="text-[13px] text-muted-foreground">{descricao}</span>}
            {erro && <FieldError>{erro}</FieldError>}
          </div>
          <Switch
            id={id}
            checked={Boolean(field.value)}
            disabled={desabilitada}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  )
}

/** Hora em 24 h ("18:00"), igual em qualquer navegador: o campo nativo mostra AM e PM. */
function CampoHora({
  rotulo,
  invalido,
  valor,
  aoMudar,
  aoSair,
}: {
  rotulo: string
  invalido: boolean
  valor: string
  aoMudar: (valor: string) => void
  aoSair: () => void
}) {
  return (
    <PatternFormat
      customInput={Input}
      format="##:##"
      mask="_"
      inputMode="numeric"
      placeholder="18:00"
      className="w-[4.25rem] px-2 text-center tabular-nums sm:w-[4.75rem]"
      aria-label={rotulo}
      aria-invalid={invalido}
      value={valor}
      onValueChange={({ formattedValue }) => aoMudar(formattedValue)}
      onBlur={aoSair}
    />
  )
}

/** A semana em linhas com fio: chave, dia, abre e fecha, e o atalho de copiar para todos. */
function Horarios({
  controle,
  copiar,
  erros,
}: {
  controle: Controle
  copiar: (dia: number) => void
  erros: ReturnType<
    typeof useForm<FormularioLoja, unknown, ConfigLoja>
  >["formState"]["errors"]["horarios"]
}) {
  const horarios = useWatch({ control: controle, name: "horarios" })
  return (
    <ul className="flex flex-col divide-y divide-border/70 border-b border-border/70">
      {ORDEM.map((dia) => {
        const indice = horarios.findIndex((item) => item.dia === dia)
        const horario = horarios[indice]
        const erro = erros?.[indice]
        const madrugada =
          horario.aberto && horario.fecha <= horario.abre && horario.fecha !== horario.abre
        return (
          <li
            key={dia}
            className="flex min-h-12 flex-wrap items-center gap-x-2.5 gap-y-1 py-2 sm:gap-x-3"
          >
            <Controller
              control={controle}
              name={`horarios.${indice}.aberto`}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label={`Aberto ${noDia(dia)}`}
                />
              )}
            />
            <span
              className={cn(
                "w-[3.75rem] shrink-0 text-sm font-medium first-letter:uppercase sm:w-20",
                !horario.aberto && "text-muted-foreground",
              )}
            >
              {DIAS[dia]}
            </span>
            {horario.aberto ? (
              <span className="flex items-center gap-1.5 sm:gap-2">
                <Controller
                  control={controle}
                  name={`horarios.${indice}.abre`}
                  render={({ field }) => (
                    <CampoHora
                      rotulo={`Abre ${noDia(dia)}`}
                      invalido={Boolean(erro?.abre)}
                      valor={field.value}
                      aoMudar={field.onChange}
                      aoSair={field.onBlur}
                    />
                  )}
                />
                <span className="text-[13px] text-muted-foreground">às</span>
                <Controller
                  control={controle}
                  name={`horarios.${indice}.fecha`}
                  render={({ field }) => (
                    <CampoHora
                      rotulo={`Fecha ${noDia(dia)}`}
                      invalido={Boolean(erro?.fecha)}
                      valor={field.value}
                      aoMudar={field.onChange}
                      aoSair={field.onBlur}
                    />
                  )}
                />
              </span>
            ) : (
              <span className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground">
                <MoonIcon className="size-3.5" aria-hidden="true" />
                Fechado
              </span>
            )}
            {madrugada && (
              <span className="order-last w-full pl-[6.5rem] text-[13px] text-muted-foreground sm:order-none sm:w-auto sm:pl-0">
                até o dia seguinte
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="relative ml-auto text-muted-foreground after:absolute after:-inset-2 hover:text-foreground sm:after:hidden"
              aria-label={`Copiar o horário de ${DIAS[dia]} para todos`}
              title="Copiar para todos os dias"
              onClick={() => copiar(dia)}
            >
              <CopyIcon />
            </Button>
            {(erro?.abre || erro?.fecha) && (
              <p role="alert" className="w-full text-[13px] text-destructive sm:pl-[7.5rem]">
                {erro?.abre?.message ?? erro?.fecha?.message}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Cidades({ controle }: { controle: Controle }) {
  const [nova, setNova] = useState("")
  const id = useId()
  return (
    <Controller
      control={controle}
      name="cidadesAtendidas"
      render={({ field }) => {
        const adicionar = () => {
          const cidade = nova.trim()
          if (cidade && !field.value.includes(cidade)) field.onChange([...field.value, cidade])
          setNova("")
        }
        return (
          <Field>
            <FieldLabel htmlFor={id}>Cidades atendidas</FieldLabel>
            {field.value.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {field.value.map((cidade) => (
                  <li key={cidade}>
                    <Badge variant="secondary" className="h-7 gap-1 pr-1 text-[13px]">
                      {cidade}
                      <button
                        type="button"
                        aria-label={`Tirar ${cidade}`}
                        className="rounded-sm p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                        onClick={() =>
                          field.onChange(field.value.filter((item) => item !== cidade))
                        }
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id={id}
                aria-label="Nova cidade"
                maxLength={60}
                placeholder="Nome da cidade"
                value={nova}
                onChange={(evento) => setNova(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") {
                    evento.preventDefault()
                    adicionar()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={adicionar}>
                Adicionar
              </Button>
            </div>
            <FieldDescription>Vazio: atende qualquer cidade.</FieldDescription>
          </Field>
        )
      }}
    />
  )
}

const PAGAMENTOS: { forma: FormaPagamento; rotulo: string; online?: boolean }[] = [
  { forma: "pix", rotulo: "Pix", online: true },
  { forma: "cartao-online", rotulo: "Cartão online", online: true },
  { forma: "dinheiro", rotulo: "Dinheiro" },
  { forma: "cartao-na-entrega", rotulo: "Cartão na entrega" },
  { forma: "pagar-apos-pesagem", rotulo: "Pagar após a pesagem" },
]

/** O formulário trabalha com textos, nunca indefinidos: o vídeo vazio é "sem vídeo". */
const valoresIniciais = (loja: ConfigLoja): FormularioLoja => ({
  ...loja,
  videoBanner: loja.videoBanner ?? "",
})

/**
 * Barra de salvar: flutua no pé da tela enquanto houver alteração, diz em que seções e
 * reúne descartar e salvar. Ao sair, some para o leitor de tela na hora.
 */
function BarraSalvar({
  resumo,
  salvando,
  aoDescartar,
}: {
  resumo: string
  salvando: boolean
  aoDescartar: () => void
}) {
  const presente = useIsPresent()
  const semMovimento = useReducedMotion()
  return (
    <motion.section
      aria-label={presente ? "Alterações não salvas" : undefined}
      aria-hidden={presente ? undefined : true}
      inert={!presente}
      // Com `onUpdate`, o Motion anima no próprio relógio em vez do WAAPI: a saída termina
      // no tempo certo mesmo com o relógio da página parado (testes com `page.clock`).
      onUpdate={semRelogioDoNavegador}
      initial={{ opacity: 0, y: semMovimento ? 0 : 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: CURVA } }}
      exit={{ opacity: 0, y: semMovimento ? 0 : 10, transition: { duration: 0.15, ease: CURVA } }}
      className="sticky bottom-4 z-20 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-popover p-2.5 pl-4 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.45)] ring-1 ring-border/80"
    >
      <div className="mr-auto flex min-w-0 items-center gap-3">
        <Traco tom="novo" className="h-8" />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">Alterações não salvas</span>
          <span className="truncate text-[13px] text-muted-foreground">{resumo}</span>
        </div>
      </div>
      <div className="flex flex-1 justify-end gap-2 sm:flex-none">
        <Button type="button" variant="ghost" onClick={aoDescartar}>
          <Undo2Icon data-icon="inline-start" />
          Descartar
        </Button>
        <Button type="submit" disabled={salvando}>
          Salvar alterações
        </Button>
      </div>
    </motion.section>
  )
}

function Formulario({ loja }: { loja: ConfigLoja }) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const agora = useAgora(60_000)
  const salvar = useSalvarLoja()
  const conectar = useConectarPagamento()
  const { area, imprimir } = useImpressora("Cupom de teste")
  const formulario = useForm<FormularioLoja, unknown, ConfigLoja>({
    resolver: zodResolver(esquemaLoja) as never,
    defaultValues: valoresIniciais(loja),
  })
  const {
    control: controle,
    formState,
    handleSubmit,
    reset,
    getValues,
    setValue,
    resetField,
  } = formulario
  const erros = formState.errors
  const [horarios, textoHorario, som, aceiteManual] = useWatch({
    control: controle,
    name: ["horarios", "textoHorario", "som", "aceiteManual"],
  })
  // Conectar e desconectar salvam na hora: vale o que está no servidor, não o rascunho.
  const conectado = Boolean(loja.pagamentoOnlineConectado)
  const comEntrega = temModulo(segmento, "motoboys")
  const salao = segmento === "salao"

  // Fechar a aba com alteração pendente pede confirmação do navegador.
  useEffect(() => {
    if (!formState.isDirty) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener("beforeunload", avisar)
    return () => window.removeEventListener("beforeunload", avisar)
  }, [formState.isDirty])

  const enviar = handleSubmit((dados) =>
    salvar.mutate(dados, {
      onSuccess: (salva) => {
        toast.success("Configurações salvas.")
        reset(valoresIniciais(salva))
      },
      onError: (erro) => toast.error(erro.message),
    }),
  )

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <Secao titulo="Loja" descricao="Como a loja aparece no site e no cupom.">
        <Grade>
          <CampoTexto
            controle={controle}
            nome="nome"
            rotulo="Nome da loja"
            maximo={60}
            erro={erros.nome}
          />
          <CampoTexto
            controle={controle}
            nome="slogan"
            rotulo="Slogan"
            maximo={80}
            erro={erros.slogan}
          />
          <CampoTelefone
            controle={controle}
            nome="telefone"
            rotulo="Telefone"
            erro={erros.telefone}
          />
          <CampoTelefone
            controle={controle}
            nome="whatsapp"
            rotulo="WhatsApp"
            erro={erros.whatsapp}
          />
          <CampoTexto
            controle={controle}
            nome="endereco"
            rotulo="Endereço"
            maximo={140}
            erro={erros.endereco}
            className="sm:col-span-2"
          />
          <CampoTexto
            controle={controle}
            nome="textoHorario"
            rotulo="Texto do horário"
            maximo={140}
            placeholder={textoDoHorario(horarios)}
            descricao={
              !textoHorario?.trim() ? `Vazio, aparece: ${textoDoHorario(horarios)}` : undefined
            }
            erro={erros.textoHorario}
            className="sm:col-span-2"
          />
          {temRecurso(segmento, "video") && (
            <CampoTexto
              controle={controle}
              nome="videoBanner"
              rotulo="Vídeo do banner"
              maximo={200}
              placeholder="https://www.youtube.com/shorts/…"
              descricao="Link do YouTube, Shorts ou Reels. Envio de arquivo fica para quando houver servidor."
              erro={erros.videoBanner}
              className="sm:col-span-2"
            />
          )}
        </Grade>
      </Secao>

      {temRecurso(segmento, "vitrines") && (
        <Secao
          titulo="Vitrines"
          descricao="As faixas de produtos em destaque e em oferta do cardápio."
        >
          <Grade>
            {(
              [
                ["destaques", "Destaques"],
                ["ofertas", "Ofertas"],
              ] as const
            ).map(([chave, nome]) => (
              <div key={chave} className="flex flex-col gap-3">
                <Controller
                  control={controle}
                  name={`vitrines.${chave}.titulo`}
                  render={({ field }) => (
                    <Field data-invalid={Boolean(erros.vitrines?.[chave]?.titulo)}>
                      <FieldLabel htmlFor={`vitrine-${chave}`}>Título de {nome}</FieldLabel>
                      <Input id={`vitrine-${chave}`} maxLength={40} {...field} />
                      {erros.vitrines?.[chave]?.titulo && (
                        <FieldError>{erros.vitrines[chave]?.titulo?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
                <Controller
                  control={controle}
                  name={`vitrines.${chave}.ativo`}
                  render={({ field }) => (
                    <div className="flex items-center gap-2.5">
                      <Switch
                        id={`vitrine-${chave}-ativo`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <label htmlFor={`vitrine-${chave}-ativo`} className="text-sm">
                        Mostrar {nome}
                      </label>
                    </div>
                  )}
                />
              </div>
            ))}
          </Grade>
        </Secao>
      )}

      <Secao
        titulo="Horários"
        descricao="Fechamento antes da abertura passa da meia-noite (18h às 2h)."
      >
        <Horarios
          controle={controle}
          erros={erros.horarios}
          copiar={(dia) =>
            setValue("horarios", copiarParaTodos(getValues("horarios"), dia), { shouldDirty: true })
          }
        />
        <Linhas>
          <Chave
            controle={controle}
            nome="controleAutomatico"
            rotulo="Abrir e fechar sozinha pelo horário"
            descricao="Desligado, a loja abre e fecha só pela chave da Fila."
          />
        </Linhas>
        <CampoTexto
          controle={controle}
          nome="mensagemFechada"
          rotulo="Mensagem de loja fechada"
          maximo={200}
          multilinha
          erro={erros.mensagemFechada}
        />
      </Secao>

      <Secao
        titulo="Entrega e retirada"
        descricao={
          salao ? "Como o salão recebe as clientes." : "Como o pedido chega a quem comprou."
        }
      >
        <Linhas>
          {comEntrega && <Chave controle={controle} nome="aceitaEntrega" rotulo="Aceita entrega" />}
          <Chave
            controle={controle}
            nome="aceitaRetirada"
            rotulo={salao ? "Atendimento no salão" : "Aceita retirada"}
            erro={erros.aceitaRetirada?.message}
          />
        </Linhas>
        <Grade>
          {comEntrega && (
            <CampoDinheiro
              controle={controle}
              nome="taxaEntregaPadrao"
              rotulo="Taxa de entrega padrão"
              erro={erros.taxaEntregaPadrao}
            />
          )}
          <CampoDinheiro
            controle={controle}
            nome="pedidoMinimo"
            rotulo="Pedido mínimo"
            erro={erros.pedidoMinimo}
          />
          {comEntrega && (
            <CampoTexto
              controle={controle}
              nome="tempoEntrega"
              rotulo="Tempo de entrega"
              maximo={40}
              placeholder="40 a 60 min"
              erro={erros.tempoEntrega}
            />
          )}
          <CampoTexto
            controle={controle}
            nome="tempoRetirada"
            rotulo={salao ? "Texto do atendimento" : "Tempo de retirada"}
            maximo={40}
            placeholder="20 min"
            erro={erros.tempoRetirada}
          />
          {salao && (
            <Controller
              control={controle}
              name="capacidadeAtendimentos"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="loja-capacidade">Atendimentos ao mesmo tempo</FieldLabel>
                  <Input
                    id="loja-capacidade"
                    type="number"
                    min={1}
                    max={20}
                    className="tabular-nums"
                    value={field.value ?? 1}
                    onChange={(evento) => field.onChange(Number(evento.target.value) || 1)}
                  />
                  <FieldDescription>
                    A agenda não marca mais que isso no mesmo horário.
                  </FieldDescription>
                </Field>
              )}
            />
          )}
        </Grade>
        {comEntrega && <Cidades controle={controle} />}
      </Secao>

      <Secao
        titulo="Formas de pagamento"
        descricao="O que a loja aceita no site. Pix e cartão online dependem da conta online."
      >
        <Linhas>
          {PAGAMENTOS.filter(
            ({ forma }) =>
              forma !== "pagar-apos-pesagem" || temRecurso(segmento, "pagarAposPesagem"),
          ).map(({ forma, rotulo, online }) => (
            <Controller
              key={forma}
              control={controle}
              name={`pagamentos.${forma}`}
              render={({ field }) => (
                <div className="flex min-h-14 items-center justify-between gap-4 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        online && !conectado && "text-muted-foreground",
                      )}
                      id={`pagamento-${forma}`}
                    >
                      {rotulo}
                    </span>
                    {online && !conectado && (
                      <span className="text-[13px] text-muted-foreground">
                        Precisa da conta online conectada.
                      </span>
                    )}
                    {erros.pagamentos?.[forma] && (
                      <FieldError>{erros.pagamentos[forma]?.message}</FieldError>
                    )}
                  </span>
                  <Switch
                    aria-labelledby={`pagamento-${forma}`}
                    checked={field.value}
                    disabled={online && !conectado}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          ))}
        </Linhas>
        {erros.pagamentos?.root?.message || erros.pagamentos?.message ? (
          <FieldError>{erros.pagamentos.root?.message ?? erros.pagamentos.message}</FieldError>
        ) : null}
      </Secao>

      <Secao
        titulo="Pagamento online"
        descricao="No protótipo, a conexão é de demonstração: nenhuma chave ou token é digitado nem guardado aqui."
      >
        <Linhas>
          <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Mercado Pago</span>
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Traco tom={conectado ? "pronto" : "fim"} />
                {conectado ? "Conectada" : "Não conectada"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              disabled={conectar.isPending}
              onClick={() =>
                conectar.mutate(!conectado, {
                  onSuccess: (atualizada) => {
                    // Já está salvo no servidor: o formulário passa a partir daí, sem contar como alteração.
                    resetField("pagamentoOnlineConectado", {
                      defaultValue: atualizada.pagamentoOnlineConectado,
                    })
                    resetField("pagamentos", { defaultValue: atualizada.pagamentos })
                    toast.success(
                      atualizada.pagamentoOnlineConectado
                        ? "Conta conectada."
                        : "Conta desconectada.",
                    )
                  },
                  onError: (erro) => toast.error(erro.message),
                })
              }
            >
              {conectado ? "Desconectar" : "Conectar"}
            </Button>
          </div>
        </Linhas>
      </Secao>

      <Secao
        titulo="Taxas de pagamento"
        descricao="Quanto cada forma cobra, para o Financeiro estimar o que sobra das vendas. Em branco, conta como 0%. Dinheiro e Pix no balcão não têm taxa."
      >
        <Grade>
          {TAXAS.map(({ forma, rotulo }) => (
            <CampoTaxa
              key={forma}
              controle={controle}
              forma={forma}
              rotulo={rotulo}
              erro={erros.taxasPagamento?.[forma]}
            />
          ))}
        </Grade>
      </Secao>

      <Secao
        titulo="Impressão"
        descricao="O cupom sai pela impressora configurada neste computador."
      >
        <Linhas>
          <Chave
            controle={controle}
            nome="impressaoAutomatica"
            rotulo="Imprimir os pedidos novos sozinho"
            descricao="Na Fila, cada pedido novo sai uma vez só."
          />
          <Chave controle={controle} nome="cortarPapel" rotulo="Cortar o papel no fim do cupom" />
        </Linhas>
        <Button type="button" variant="outline" className="self-start" onClick={() => imprimir()}>
          <PrinterIcon data-icon="inline-start" />
          Imprimir cupom de teste
        </Button>
        {agora && <Cupom pedido={pedidoDeTeste(agora)} loja={loja.nome} area={area} />}
      </Secao>

      <Secao
        titulo="Fila e pedidos"
        descricao="Como o pedido do site entra na Fila. A loja nunca recusa sozinha."
      >
        <Linhas>
          <Chave
            controle={controle}
            nome="aceiteManual"
            rotulo="Aceitar cada pedido do site na Fila"
            descricao="O alarme toca até alguém aceitar ou recusar. Desligado, o pedido entra aceito."
          />
        </Linhas>
        <Controller
          control={controle}
          name="limiteAceiteMin"
          render={({ field }) => (
            <Field data-invalid={Boolean(erros.limiteAceiteMin)} className="max-w-xs">
              <FieldLabel htmlFor="loja-limite-aceite">Minutos até o alerta de atraso</FieldLabel>
              <Input
                id="loja-limite-aceite"
                type="number"
                min={1}
                max={30}
                className="tabular-nums"
                disabled={!aceiteManual}
                value={Number.isNaN(field.value) ? "" : field.value}
                onChange={(evento) => field.onChange(evento.target.valueAsNumber)}
              />
              <FieldDescription>
                Sem aceite depois disso, o cartão fica vermelho na Fila.
              </FieldDescription>
              {erros.limiteAceiteMin && <FieldError>{erros.limiteAceiteMin.message}</FieldError>}
            </Field>
          )}
        />
      </Secao>

      <Secao
        titulo="Alerta sonoro"
        descricao="O som padrão da loja. Cada aparelho (Fila, Cozinha) pode escolher outro."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Controller
            control={controle}
            name="som"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Som da loja" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SONS.map(({ valor, rotulo }) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          <Button type="button" variant="outline" onClick={() => tocarAlerta(som)}>
            <Volume2Icon data-icon="inline-start" />
            Ouvir
          </Button>
        </div>
      </Secao>

      <AnimatePresence>
        {formState.isDirty && (
          <BarraSalvar
            key="salvar"
            resumo={resumoDasAlteracoes(secoesAlteradas(formState.dirtyFields))}
            salvando={salvar.isPending}
            aoDescartar={() => reset(valoresIniciais(loja))}
          />
        )}
      </AnimatePresence>
    </form>
  )
}

/** Esqueleto no formato da página: seções com fio, o título à esquerda e os campos. */
function EsqueletoFormulario() {
  return (
    <div role="status" aria-label="Carregando as configurações" className="flex flex-col gap-3">
      {[4, 7, 3].map((campos) => (
        <div
          key={campos}
          className="grid gap-4 border-t border-border/70 pt-6 pb-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {Array.from({ length: campos }, (_, indice) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: campos fixos do esqueleto.
              <div key={indice} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Configurações da loja: dados, horários, entrega, pagamento, impressão e som. */
export function PaginaLoja() {
  const { data: loja } = useLoja()
  return (
    <div className="flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Configurações da loja"
        resumo="Tudo é salvo junto, pelo botão que aparece quando algo muda."
      />
      {loja ? <Formulario key={loja.nome} loja={loja} /> : <EsqueletoFormulario />}
    </div>
  )
}
