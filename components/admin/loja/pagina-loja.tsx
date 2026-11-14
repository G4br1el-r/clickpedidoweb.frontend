"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CopyIcon, PlugIcon, PrinterIcon, Volume2Icon, XIcon } from "lucide-react"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import type { ConfigLoja, FormaPagamento, SomAlerta } from "@/lib/admin/dados/tipos"
import { esquemaLoja, type FormularioLoja } from "@/lib/admin/regras/esquema-loja"
import { copiarParaTodos, textoDoHorario } from "@/lib/admin/regras/loja"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo, temRecurso } from "@/lib/admin/segmentos-painel"
import { tocarAlerta } from "@/lib/admin/som"
import { cn } from "@/lib/utils"
import { Cupom, pedidoDeTeste, useImpressora } from "../impressao/cupom"

type Controle = Control<FormularioLoja, unknown, ConfigLoja>

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
/** Na tela, a semana começa na segunda. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]
const noDia = (dia: number) => `${dia === 0 || dia === 6 ? "no" : "na"} ${DIAS[dia]}`

const SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
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
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-semibold">
          {titulo}
        </h2>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
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
}) {
  const id = useId()
  return (
    <Field data-invalid={Boolean(erro)}>
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

function Chave({
  controle,
  nome,
  rotulo,
  descricao,
  desabilitada,
}: {
  controle: Controle
  nome:
    | "controleAutomatico"
    | "aceitaEntrega"
    | "aceitaRetirada"
    | "impressaoAutomatica"
    | "cortarPapel"
  rotulo: string
  descricao?: string
  desabilitada?: boolean
}) {
  const id = useId()
  return (
    <Controller
      control={controle}
      name={nome}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor={id} className="text-sm font-medium">
              {rotulo}
            </label>
            {descricao && <span className="text-xs text-muted-foreground">{descricao}</span>}
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
      className="w-[4.5rem] text-center tabular-nums sm:w-20"
      aria-label={rotulo}
      aria-invalid={invalido}
      value={valor}
      onValueChange={({ formattedValue }) => aoMudar(formattedValue)}
      onBlur={aoSair}
    />
  )
}

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
    <ul className="flex flex-col divide-y">
      {ORDEM.map((dia) => {
        const indice = horarios.findIndex((item) => item.dia === dia)
        const horario = horarios[indice]
        const erro = erros?.[indice]
        const madrugada =
          horario.aberto && horario.fecha <= horario.abre && horario.fecha !== horario.abre
        return (
          <li key={dia} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 sm:gap-x-3">
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
            <span className="w-14 shrink-0 text-sm sm:w-20 font-medium first-letter:uppercase">
              {DIAS[dia]}
            </span>
            {horario.aberto ? (
              <>
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
                <span className="text-sm text-muted-foreground">às</span>
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
                {madrugada && (
                  <Badge variant="secondary" className="order-last ml-16 sm:order-none sm:ml-0">
                    passa da meia-noite
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Fechado</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={`Copiar o horário de ${DIAS[dia]} para todos`}
              onClick={() => copiar(dia)}
            >
              <CopyIcon />
            </Button>
            {(erro?.abre || erro?.fecha) && (
              <p role="alert" className="w-full text-sm text-destructive">
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
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {cidade}
                      <button
                        type="button"
                        aria-label={`Tirar ${cidade}`}
                        className="rounded-sm p-0.5 hover:bg-background/60"
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
  const [horarios, textoHorario, som] = useWatch({
    control: controle,
    name: ["horarios", "textoHorario", "som"],
  })
  // Conectar e desconectar salvam na hora: vale o que está no servidor, não o rascunho.
  const conectado = Boolean(loja.pagamentoOnlineConectado)
  const comEntrega = temModulo(segmento, "motoboys")

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
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Secao titulo="Loja">
        <FieldGroup className="grid gap-4 md:grid-cols-2">
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
          <div className="md:col-span-2">
            <CampoTexto
              controle={controle}
              nome="endereco"
              rotulo="Endereço"
              maximo={140}
              erro={erros.endereco}
            />
          </div>
          <div className="md:col-span-2">
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
            />
          </div>
          {temRecurso(segmento, "video") && (
            <div className="md:col-span-2">
              <CampoTexto
                controle={controle}
                nome="videoBanner"
                rotulo="Vídeo do banner"
                maximo={200}
                placeholder="https://www.youtube.com/shorts/…"
                descricao="Link do YouTube, Shorts ou Reels. Envio de arquivo fica para quando houver servidor."
                erro={erros.videoBanner}
              />
            </div>
          )}
        </FieldGroup>
      </Secao>

      {temRecurso(segmento, "vitrines") && (
        <Secao
          titulo="Vitrines"
          descricao="As faixas de produtos em destaque e em oferta do cardápio."
        >
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["destaques", "Destaques"],
                ["ofertas", "Ofertas"],
              ] as const
            ).map(([chave, nome]) => (
              <div key={chave} className="flex flex-col gap-2">
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
                    <div className="flex items-center gap-2">
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
          </FieldGroup>
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
        <Chave
          controle={controle}
          nome="controleAutomatico"
          rotulo="Abrir e fechar sozinha pelo horário"
          descricao="Desligado, a loja abre e fecha só pela chave da Fila."
        />
        <CampoTexto
          controle={controle}
          nome="mensagemFechada"
          rotulo="Mensagem de loja fechada"
          maximo={200}
          multilinha
          erro={erros.mensagemFechada}
        />
      </Secao>

      <Secao titulo="Entrega e retirada">
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          {comEntrega && <Chave controle={controle} nome="aceitaEntrega" rotulo="Aceita entrega" />}
          <div className="flex flex-col gap-1">
            <Chave
              controle={controle}
              nome="aceitaRetirada"
              rotulo={segmento === "salao" ? "Atendimento no salão" : "Aceita retirada"}
            />
            {erros.aceitaRetirada && <FieldError>{erros.aceitaRetirada.message}</FieldError>}
          </div>
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
            rotulo={segmento === "salao" ? "Texto do atendimento" : "Tempo de retirada"}
            maximo={40}
            placeholder="20 min"
            erro={erros.tempoRetirada}
          />
          {segmento === "salao" && (
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
        </FieldGroup>
        {comEntrega && <Cidades controle={controle} />}
      </Secao>

      <Secao titulo="Formas de pagamento">
        <div className="flex flex-col gap-3">
          {PAGAMENTOS.filter(
            ({ forma }) =>
              forma !== "pagar-apos-pesagem" || temRecurso(segmento, "pagarAposPesagem"),
          ).map(({ forma, rotulo, online }) => (
            <Controller
              key={forma}
              control={controle}
              name={`pagamentos.${forma}`}
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium" id={`pagamento-${forma}`}>
                      {rotulo}
                    </span>
                    {online && !conectado && (
                      <span className="text-xs text-muted-foreground">
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
          {erros.pagamentos?.root?.message || erros.pagamentos?.message ? (
            <FieldError>{erros.pagamentos.root?.message ?? erros.pagamentos.message}</FieldError>
          ) : null}
        </div>
      </Secao>

      <Secao
        titulo="Pagamento online"
        descricao="No protótipo, a conexão é de demonstração: nenhuma chave ou token é digitado nem guardado aqui."
      >
        <div className="flex flex-wrap items-center gap-3">
          <PlugIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Mercado Pago</span>
          <Badge variant={conectado ? "default" : "outline"}>
            {conectado ? "Conectada" : "Não conectada"}
          </Badge>
          <Button
            type="button"
            size="sm"
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
      </Secao>

      <Secao
        titulo="Impressão"
        descricao="O cupom sai pela impressora configurada neste computador."
      >
        <Chave
          controle={controle}
          nome="impressaoAutomatica"
          rotulo="Imprimir os pedidos novos sozinho"
          descricao="Na Fila, cada pedido novo sai uma vez só."
        />
        <Chave controle={controle} nome="cortarPapel" rotulo="Cortar o papel no fim do cupom" />
        <Button type="button" variant="outline" className="self-start" onClick={() => imprimir()}>
          <PrinterIcon data-icon="inline-start" />
          Imprimir cupom de teste
        </Button>
        {agora && <Cupom pedido={pedidoDeTeste(agora)} loja={loja.nome} area={area} />}
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

      {formState.isDirty && (
        <section
          aria-label="Alterações não salvas"
          className={cn(
            "sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur",
          )}
        >
          <span className="mr-auto text-sm font-medium">Alterações não salvas</span>
          <Button type="button" variant="ghost" onClick={() => reset(valoresIniciais(loja))}>
            Descartar
          </Button>
          <Button type="submit" disabled={salvar.isPending}>
            Salvar alterações
          </Button>
        </section>
      )}
    </form>
  )
}

/** Configurações da loja: dados, horários, entrega, pagamento, impressão e som. */
export function PaginaLoja() {
  const { data: loja } = useLoja()
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações da loja</h1>
        <p className="text-sm text-muted-foreground">
          Tudo é salvo junto, pelo botão que aparece quando algo muda.
        </p>
      </div>
      {loja ? (
        <Formulario key={loja.nome} loja={loja} />
      ) : (
        <Skeleton
          role="status"
          aria-label="Carregando as configurações"
          className="h-[40rem] rounded-xl"
        />
      )}
    </div>
  )
}
