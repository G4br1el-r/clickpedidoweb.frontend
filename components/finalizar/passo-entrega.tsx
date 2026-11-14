"use client"

import {
  BikeIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  MapPinnedIcon,
  StoreIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { PatternFormat } from "react-number-format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { RadioGroup } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { acharBairro, buscarCep, type DadosCheckout, somenteDigitos } from "@/lib/checkout"
import { emReais } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { cn } from "@/lib/utils"
import { CabecalhoPasso } from "./cabecalho-passo"
import { Campo, ESTILO_CAMPO } from "./campo"
import { CartaoOpcao } from "./cartao-opcao"

const CURVA = [0.23, 1, 0.32, 1] as const

type Busca = "parada" | "buscando" | "achou" | "nao-achou"

const ABRIR = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.35, ease: CURVA },
} as const

function BlocoEndereco() {
  const lojaEscolhida = useLoja()
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<DadosCheckout>()
  const cep = useWatch({ control, name: "cep" })
  const bairro = useWatch({ control, name: "bairro" })
  const [busca, setBusca] = useState<Busca>("parada")
  const [bairroForaDaArea, setBairroForaDaArea] = useState("")
  // Quem já tem endereço preenchido (último pedido) vê os campos direto.
  const [manual, setManual] = useState(() => Boolean(getValues("rua")))
  const ultimoBuscado = useRef(somenteDigitos(getValues("cep")))
  const refNumero = useRef<HTMLInputElement | null>(null)
  const digitos = somenteDigitos(cep)
  const mostrarCampos = manual || busca === "achou" || busca === "nao-achou"
  const taxa = lojaEscolhida.entrega.bairros.find(({ nome }) => nome === bairro)?.taxa

  useEffect(() => {
    if (digitos.length !== 8 || digitos === ultimoBuscado.current) return
    ultimoBuscado.current = digitos
    const controle = new AbortController()
    setBusca("buscando")
    buscarCep(digitos, controle.signal)
      .then((endereco) => {
        if (!endereco) {
          setBusca("nao-achou")
          return
        }
        setValue("rua", endereco.rua, { shouldValidate: false })
        setValue("cidade", endereco.cidade)
        setValue("uf", endereco.uf)
        const atendido = acharBairro(endereco.bairro)
        setValue("bairro", atendido?.nome ?? "")
        setBairroForaDaArea(atendido ? "" : endereco.bairro)
        setBusca("achou")
        // O número é o próximo campo que falta; o foco vai direto para ele.
        setTimeout(() => refNumero.current?.focus({ preventScroll: false }), 380)
      })
      .catch((erro: unknown) => {
        if (erro instanceof DOMException && erro.name === "AbortError") return
        setBusca("nao-achou")
      })
    return () => controle.abort()
  }, [digitos, setValue])

  const { ref: refNumeroForm, ...numero } = register("numero")

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-start">
        <Campo
          id="cep"
          rotulo="CEP"
          erro={errors.cep?.message}
          dica={
            busca === "nao-achou"
              ? "Não achamos esse CEP. Preencha o endereço abaixo."
              : busca === "achou"
                ? undefined
                : "Digite o CEP que a gente completa o endereço."
          }
        >
          <Controller
            control={control}
            name="cep"
            render={({ field: { ref, onChange, ...campo } }) => (
              <InputGroup className="h-12 rounded-xl bg-background">
                <PatternFormat
                  {...campo}
                  getInputRef={ref}
                  onValueChange={({ formattedValue }) => onChange(formattedValue)}
                  format="#####-###"
                  customInput={InputGroupInput}
                  id="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  aria-invalid={Boolean(errors.cep)}
                  aria-describedby={errors.cep ? "cep-erro" : undefined}
                  className="h-full pl-3.5 text-base md:text-base"
                />
                <InputGroupAddon align="inline-end" className="pr-3.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {busca === "buscando" ? (
                      <motion.span
                        key="buscando"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                      >
                        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                        <span className="sr-only">Buscando endereço</span>
                      </motion.span>
                    ) : busca === "achou" ? (
                      <motion.span
                        key="achou"
                        initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ type: "spring", duration: 0.45, bounce: 0.45 }}
                      >
                        <CheckCircle2Icon className="size-5 text-sucesso" />
                        <span className="sr-only">Endereço encontrado</span>
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </InputGroupAddon>
              </InputGroup>
            )}
          />
        </Campo>
        {!mostrarCampos && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-fit rounded-full px-3 text-sm font-semibold text-marca-texto underline underline-offset-4 hover:bg-accent sm:mt-7"
            onClick={() => setManual(true)}
          >
            Não sei meu CEP
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {mostrarCampos && (
          <motion.div key="campos" {...ABRIR} className="-mx-1 overflow-hidden px-1">
            <div className="grid grid-cols-6 gap-4 pt-1 pb-1">
              <Campo id="rua" rotulo="Rua" erro={errors.rua?.message} className="col-span-6">
                <Input
                  id="rua"
                  autoComplete="address-line1"
                  maxLength={120}
                  aria-invalid={Boolean(errors.rua)}
                  aria-describedby={errors.rua ? "rua-erro" : undefined}
                  className={ESTILO_CAMPO}
                  {...register("rua")}
                />
              </Campo>
              <Campo
                id="numero"
                rotulo="Número"
                erro={errors.numero?.message}
                className="col-span-2"
              >
                <Input
                  id="numero"
                  inputMode="numeric"
                  maxLength={20}
                  aria-invalid={Boolean(errors.numero)}
                  aria-describedby={errors.numero ? "numero-erro" : undefined}
                  className={ESTILO_CAMPO}
                  ref={(elemento) => {
                    refNumeroForm(elemento)
                    refNumero.current = elemento
                  }}
                  {...numero}
                />
              </Campo>
              <Campo id="complemento" rotulo="Complemento" opcional className="col-span-4">
                <Input
                  id="complemento"
                  autoComplete="address-line2"
                  maxLength={60}
                  placeholder="Apto, bloco, casa 2"
                  className={ESTILO_CAMPO}
                  {...register("complemento")}
                />
              </Campo>
              <Campo
                id="bairro"
                rotulo="Bairro"
                erro={errors.bairro?.message}
                dica={
                  bairroForaDaArea
                    ? `${bairroForaDaArea} não está na área de entrega. Escolha o bairro mais próximo ou retire no balcão.`
                    : undefined
                }
                className="col-span-6 sm:col-span-3"
              >
                <Controller
                  control={control}
                  name="bairro"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(valor) => {
                        field.onChange(valor)
                        setBairroForaDaArea("")
                      }}
                    >
                      <SelectTrigger
                        id="bairro"
                        ref={field.ref}
                        aria-invalid={Boolean(errors.bairro)}
                        aria-describedby={errors.bairro ? "bairro-erro" : undefined}
                        className="h-12! w-full rounded-xl bg-background px-3.5 text-base"
                      >
                        <SelectValue placeholder="Escolha o bairro" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="rounded-xl">
                        <SelectGroup>
                          {lojaEscolhida.entrega.bairros.map(({ nome }) => (
                            <SelectItem key={nome} value={nome} className="h-11 text-base">
                              {nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
              <Campo id="cidade" rotulo="Cidade" className="col-span-4 sm:col-span-2">
                <Input
                  id="cidade"
                  autoComplete="address-level2"
                  maxLength={80}
                  className={ESTILO_CAMPO}
                  {...register("cidade")}
                />
              </Campo>
              <Campo id="uf" rotulo="UF" className="col-span-2 sm:col-span-1">
                <Input
                  id="uf"
                  autoComplete="address-level1"
                  maxLength={2}
                  className={cn(ESTILO_CAMPO, "uppercase")}
                  {...register("uf")}
                />
              </Campo>
              <Campo id="referencia" rotulo="Ponto de referência" opcional className="col-span-6">
                <Input
                  id="referencia"
                  maxLength={120}
                  placeholder="Ex.: portão azul, perto da padaria"
                  className={ESTILO_CAMPO}
                  {...register("referencia")}
                />
              </Campo>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {taxa !== undefined && (
          <motion.p
            key={bairro}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: CURVA }}
            className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground"
            aria-live="polite"
          >
            <MapPinnedIcon className="size-4 shrink-0" aria-hidden="true" />
            Entrega para {bairro}: <strong className="tabular-nums">{emReais(taxa)}</strong>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function BlocoRetirada() {
  const loja = useLoja()
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loja.endereco)}`

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-marca-texto"
      >
        <MapPinIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Balcão da {loja.nome}</p>
        <p className="text-sm text-muted-foreground">{loja.endereco}</p>
        <p className="text-sm text-muted-foreground">Fica pronto em {loja.retirada.tempo}</p>
        <a
          href={mapa}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-1 inline-flex min-h-11 items-center text-sm font-semibold text-marca-texto underline underline-offset-4"
        >
          Abrir no mapa
        </a>
      </div>
    </div>
  )
}

export function PassoEntrega() {
  const { control } = useFormContext<DadosCheckout>()
  const loja = useLoja()

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPasso titulo="Como você quer receber?" />
      <Controller
        control={control}
        name="tipo"
        render={({ field }) => (
          <>
            <RadioGroup
              aria-label="Forma de receber"
              value={field.value}
              onValueChange={field.onChange}
              className="grid gap-3 sm:grid-cols-2"
            >
              <CartaoOpcao
                valor="entrega"
                testId="opcao-entrega"
                selecionado={field.value === "entrega"}
                icone={<BikeIcon />}
                titulo="Entrega"
                detalhe={loja.entrega.tempo}
              />
              <CartaoOpcao
                valor="retirada"
                testId="opcao-retirada"
                selecionado={field.value === "retirada"}
                icone={<StoreIcon />}
                titulo="Retirar no balcão"
                detalhe={loja.retirada.tempo}
                lateral={<span className="text-sucesso">Grátis</span>}
              />
            </RadioGroup>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={field.value}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: CURVA }}
              >
                {field.value === "entrega" ? <BlocoEndereco /> : <BlocoRetirada />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      />
    </div>
  )
}
