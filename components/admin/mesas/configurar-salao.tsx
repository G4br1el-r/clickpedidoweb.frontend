"use client"

import { PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useSalvarConfigSalao } from "@/lib/admin/dados/consultas-mesas"
import type { AreaSalao, ConfigSalao, Garcom } from "@/lib/admin/dados/tipos"
import { FUNCOES_PRO_SALAO } from "@/lib/admin/regras/salao"
import { emReais } from "@/lib/formato"
import { BlocoSecao } from "../bloco-secao"
import { SeloPro } from "../campos"

/** O campo guarda o texto digitado; quem confere o valor é o servidor. */
const numero = (texto: string) =>
  texto.trim() === "" ? Number.NaN : Number(texto.replace(",", "."))

const ALERTAS = [
  ["semPedidoMin", "Sem pedido (min)"],
  ["contaPedidaMin", "Conta pedida (min)"],
  ["servirMin", "Para servir (min)"],
  ["abertaMin", "Mesa aberta (min)"],
] as const

function Campos({ salao, aoFechar }: { salao: ConfigSalao; aoFechar: () => void }) {
  const salvar = useSalvarConfigSalao()
  const [areas, setAreas] = useState<AreaSalao[]>(() =>
    salao.areas.toSorted((a, b) => a.ordem - b.ordem),
  )
  const [garcons, setGarcons] = useState<Garcom[]>(salao.garcons)
  const [taxaAtiva, setTaxaAtiva] = useState(salao.taxaServico.ativa)
  const [taxa, setTaxa] = useState(String(salao.taxaServico.percentual))
  const [couvertAtivo, setCouvertAtivo] = useState(salao.couvert.ativo)
  const [couvert, setCouvert] = useState(String(salao.couvert.porPessoa))
  const [limpeza, setLimpeza] = useState(salao.limpeza)
  const [mapa, setMapa] = useState(salao.funcoes.mapa)
  const [reservas, setReservas] = useState(salao.funcoes.reservas)
  const [qr, setQr] = useState(salao.funcoes.qr)
  const [aceite, setAceite] = useState(salao.qr.aceite)
  const [abrirPeloQr, setAbrirPeloQr] = useState(salao.qr.abrirMesaPeloQr)
  const [antecedencia, setAntecedencia] = useState(String(salao.reservas.antecedenciaMin))
  const [tolerancia, setTolerancia] = useState(String(salao.reservas.toleranciaMin))
  const [alertas, setAlertas] = useState(() =>
    Object.fromEntries(ALERTAS.map(([chave]) => [chave, String(salao.alertas[chave])])),
  )

  const mudarArea = (indice: number, nome: string) =>
    setAreas(areas.map((area, i) => (i === indice ? { ...area, nome } : area)))
  const mudarGarcom = (indice: number, mudanca: Partial<Garcom>) =>
    setGarcons(garcons.map((garcom, i) => (i === indice ? { ...garcom, ...mudanca } : garcom)))

  const enviar = () => {
    const config: ConfigSalao = {
      ...salao,
      areas: areas.map((area, indice) => ({ ...area, ordem: indice })),
      garcons,
      // Desligados, taxa e couvert guardam o valor que veio do servidor, não o texto escondido.
      taxaServico: taxaAtiva
        ? { ativa: true, percentual: numero(taxa) }
        : { ...salao.taxaServico, ativa: false },
      couvert: couvertAtivo
        ? { ativo: true, porPessoa: numero(couvert) }
        : { ...salao.couvert, ativo: false },
      limpeza,
      funcoes: { ...salao.funcoes, mapa, reservas, qr },
      qr: { aceite, abrirMesaPeloQr: abrirPeloQr },
      reservas: { antecedenciaMin: numero(antecedencia), toleranciaMin: numero(tolerancia) },
      alertas: {
        semPedidoMin: numero(alertas.semPedidoMin),
        contaPedidaMin: numero(alertas.contaPedidaMin),
        servirMin: numero(alertas.servirMin),
        abertaMin: numero(alertas.abertaMin),
      },
    }
    salvar.mutate(config, {
      onSuccess: () => {
        toast.success("Salão salvo.")
        aoFechar()
      },
      onError: (erro: Error) => toast.error(erro.message),
    })
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(evento) => {
        evento.preventDefault()
        enviar()
      }}
    >
      <SheetHeader>
        <SheetTitle>Configurar salão</SheetTitle>
        <SheetDescription>
          Áreas, garçons, cobranças, funções Pro, reservas e alertas das mesas.
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <BlocoSecao titulo="Áreas" descricao="A ordem da lista é a ordem no salão.">
          <FieldGroup className="gap-2">
            {areas.map((area, indice) => (
              <div key={area.id} className="flex items-center gap-2">
                <Input
                  aria-label="Nome da área"
                  maxLength={30}
                  value={area.nome}
                  onChange={(evento) => mudarArea(indice, evento.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir área ${area.nome}`}
                  onClick={() => setAreas(areas.filter((_, i) => i !== indice))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </FieldGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setAreas([
                ...areas,
                { id: `area-${crypto.randomUUID()}`, nome: "", ordem: areas.length },
              ])
            }
          >
            <PlusIcon data-icon="inline-start" />
            Adicionar área
          </Button>
        </BlocoSecao>

        <BlocoSecao titulo="Garçons" descricao="Só os ativos aparecem no filtro da grade.">
          <FieldGroup className="gap-2">
            {garcons.map((garcom, indice) => (
              <div key={garcom.id} className="flex items-center gap-2">
                <Input
                  aria-label="Nome do garçom"
                  maxLength={40}
                  value={garcom.nome}
                  onChange={(evento) => mudarGarcom(indice, { nome: evento.target.value })}
                />
                <Switch
                  aria-label={`Garçom ${garcom.nome} ativo`}
                  checked={garcom.ativo}
                  onCheckedChange={(ativo) => mudarGarcom(indice, { ativo })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir garçom ${garcom.nome}`}
                  onClick={() => setGarcons(garcons.filter((_, i) => i !== indice))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </FieldGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setGarcons([
                ...garcons,
                { id: `garcom-${crypto.randomUUID()}`, nome: "", ativo: true },
              ])
            }
          >
            <PlusIcon data-icon="inline-start" />
            Adicionar garçom
          </Button>
        </BlocoSecao>

        <BlocoSecao titulo="Cobranças" descricao="Entram na conta da mesa.">
          <FieldGroup className="gap-5">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="salao-taxa-ativa">Cobrar taxa de serviço</FieldLabel>
                <FieldDescription>Percentual sobre o consumo da mesa.</FieldDescription>
              </FieldContent>
              <Switch id="salao-taxa-ativa" checked={taxaAtiva} onCheckedChange={setTaxaAtiva} />
            </Field>
            {taxaAtiva && (
              <Field>
                <FieldLabel htmlFor="salao-taxa">Taxa de serviço (%)</FieldLabel>
                <Input
                  id="salao-taxa"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={taxa}
                  onChange={(evento) => setTaxa(evento.target.value)}
                />
              </Field>
            )}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="salao-couvert-ativo">Cobrar couvert</FieldLabel>
                <FieldDescription>Valor fixo por pessoa na mesa.</FieldDescription>
              </FieldContent>
              <Switch
                id="salao-couvert-ativo"
                checked={couvertAtivo}
                onCheckedChange={setCouvertAtivo}
              />
            </Field>
            {couvertAtivo && (
              <Field>
                <FieldLabel htmlFor="salao-couvert">Couvert por pessoa (R$)</FieldLabel>
                <Input
                  id="salao-couvert"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={couvert}
                  onChange={(evento) => setCouvert(evento.target.value)}
                />
              </Field>
            )}
          </FieldGroup>
        </BlocoSecao>

        <BlocoSecao titulo="Limpeza">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="salao-limpeza">Limpeza depois de fechar a conta</FieldLabel>
              <FieldDescription>
                A mesa fica em limpeza até alguém marcar como limpa.
              </FieldDescription>
            </FieldContent>
            <Switch id="salao-limpeza" checked={limpeza} onCheckedChange={setLimpeza} />
          </Field>
        </BlocoSecao>

        <BlocoSecao titulo="Funções Pro" descricao="Recursos do plano Pro para o salão.">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="salao-mapa" className="flex flex-wrap items-center gap-2">
                {FUNCOES_PRO_SALAO.mapa.nome}
                <SeloPro liberada={mapa} />
              </FieldLabel>
              <FieldDescription>
                As mesas na planta de cada área, para ver e arrastar.{" "}
                {emReais(FUNCOES_PRO_SALAO.mapa.preco)} por mês.
              </FieldDescription>
            </FieldContent>
            <Switch id="salao-mapa" checked={mapa} onCheckedChange={setMapa} />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="salao-reservas" className="flex flex-wrap items-center gap-2">
                {FUNCOES_PRO_SALAO.reservas.nome}
                <SeloPro liberada={reservas} />
              </FieldLabel>
              <FieldDescription>
                Reservas do dia e a fila de espera, com a mesa sugerida e o chamado pelo WhatsApp.{" "}
                {emReais(FUNCOES_PRO_SALAO.reservas.preco)} por mês.
              </FieldDescription>
            </FieldContent>
            <Switch id="salao-reservas" checked={reservas} onCheckedChange={setReservas} />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="salao-qr" className="flex flex-wrap items-center gap-2">
                {FUNCOES_PRO_SALAO.qr.nome}
                <SeloPro liberada={qr} />
              </FieldLabel>
              <FieldDescription>
                O cliente pede, chama o garçom e pede a conta pelo QR da mesa.{" "}
                {emReais(FUNCOES_PRO_SALAO.qr.preco)} por mês.
              </FieldDescription>
            </FieldContent>
            <Switch id="salao-qr" checked={qr} onCheckedChange={setQr} />
          </Field>
        </BlocoSecao>

        <BlocoSecao titulo="QR na mesa" descricao="Como o pedido do cliente chega ao salão.">
          <FieldSet>
            <FieldLegend variant="label">Quem aceita o pedido</FieldLegend>
            <RadioGroup
              value={aceite}
              onValueChange={(valor) => setAceite(valor as ConfigSalao["qr"]["aceite"])}
            >
              <Field orientation="horizontal">
                <RadioGroupItem id="salao-qr-garcom" value="garcom" />
                <FieldLabel htmlFor="salao-qr-garcom">O garçom aceita</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="salao-qr-direto" value="direto" />
                <FieldLabel htmlFor="salao-qr-direto">Vai direto para a cozinha</FieldLabel>
              </Field>
            </RadioGroup>
          </FieldSet>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="salao-qr-abrir">O primeiro pedido abre a mesa livre</FieldLabel>
              <FieldDescription>Desligado, o cliente chama o garçom para abrir.</FieldDescription>
            </FieldContent>
            <Switch id="salao-qr-abrir" checked={abrirPeloQr} onCheckedChange={setAbrirPeloQr} />
          </Field>
        </BlocoSecao>

        <BlocoSecao
          titulo="Reservas"
          descricao="A mesa fica reservada a partir da antecedência; passada a tolerância, a reserva conta como não compareceu."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="salao-antecedencia">Antecedência (min)</FieldLabel>
              <Input
                id="salao-antecedencia"
                type="number"
                inputMode="numeric"
                value={antecedencia}
                onChange={(evento) => setAntecedencia(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="salao-tolerancia">Tolerância (min)</FieldLabel>
              <Input
                id="salao-tolerancia"
                type="number"
                inputMode="numeric"
                value={tolerancia}
                onChange={(evento) => setTolerancia(evento.target.value)}
              />
            </Field>
          </div>
        </BlocoSecao>

        <BlocoSecao titulo="Alertas" descricao="Minutos até a mesa pedir atenção.">
          <div className="grid grid-cols-2 gap-3">
            {ALERTAS.map(([chave, rotulo]) => (
              <Field key={chave}>
                <FieldLabel htmlFor={`salao-${chave}`}>{rotulo}</FieldLabel>
                <Input
                  id={`salao-${chave}`}
                  type="number"
                  inputMode="numeric"
                  value={alertas[chave]}
                  onChange={(evento) => setAlertas({ ...alertas, [chave]: evento.target.value })}
                />
              </Field>
            ))}
          </div>
        </BlocoSecao>
      </div>
      <SheetFooter>
        <Button type="submit" disabled={salvar.isPending}>
          Salvar
        </Button>
      </SheetFooter>
    </form>
  )
}

/** Painel lateral com as áreas, os garçons, as cobranças, a limpeza e os alertas do salão. */
function PainelSalao({
  salao,
  aberto,
  aoMudar,
}: {
  salao: ConfigSalao | undefined
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent className="w-full sm:max-w-md">
        {salao && <Campos salao={salao} aoFechar={() => aoMudar(false)} />}
      </SheetContent>
    </Sheet>
  )
}

/** Botão do cabeçalho que abre o painel Configurar salão. */
export function ConfigurarSalao({
  salao,
  aberto: abertoDeFora,
  aoMudar,
}: {
  salao: ConfigSalao | undefined
  /** Aberto por fora (a explicação do mapa Pro abre o painel). */
  aberto?: boolean
  aoMudar?: (aberto: boolean) => void
}) {
  const [abertoAqui, setAbertoAqui] = useState(false)
  const aberto = abertoDeFora ?? abertoAqui
  const setAberto = aoMudar ?? setAbertoAqui
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!salao}
        onClick={() => setAberto(true)}
      >
        <SettingsIcon data-icon="inline-start" />
        Configurar salão
      </Button>
      <PainelSalao salao={salao} aberto={aberto} aoMudar={setAberto} />
    </>
  )
}
