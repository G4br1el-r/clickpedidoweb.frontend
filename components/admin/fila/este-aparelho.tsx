"use client"

import { BellOffIcon, BellRingIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ConfigLoja, SomAlerta } from "@/lib/admin/dados/tipos"
import {
  type ChaveDoAparelho,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { tocarAlerta } from "@/lib/admin/som"
import { pedirLicenca } from "./avisos-do-aparelho"

const SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
  { valor: "sirene", rotulo: "Sirene" },
]

function Linha({
  id,
  rotulo,
  detalhe,
  marcada,
  aoMudar,
  recusa,
}: {
  id: string
  rotulo: string
  detalhe: string
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  /** Por que o navegador não deixou ligar. */
  recusa?: string | undefined
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {rotulo}
        </Label>
        <span id={`${id}-detalhe`} className="text-xs text-muted-foreground">
          {detalhe}
        </span>
        {recusa && (
          <span role="status" className="text-xs text-destructive">
            {recusa}
          </span>
        )}
      </div>
      <Switch
        id={id}
        checked={marcada}
        onCheckedChange={aoMudar}
        aria-describedby={`${id}-detalhe`}
      />
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className="flex flex-col border-t border-border/70 px-4 py-2 first:border-t-0"
    >
      <h3 className="pt-1 text-xs font-medium text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * O que vale só para este aparelho (caixa, cozinha, celular do dono): som, avisos, tela
 * acesa e a demonstração. Fica guardado neste navegador.
 */
export function EsteAparelho({ loja }: { loja: ConfigLoja | undefined }) {
  const preferencias = usePreferenciasFila()
  const som = useSomDoAparelho()
  const [recusas, setRecusas] = useState<Partial<Record<ChaveDoAparelho, string>>>({})
  // Avisos que dependem do navegador pedem licença ao ligar; sem licença, ficam desligados.
  const ligar = async (chave: ChaveDoAparelho, ligada: boolean) => {
    const recusa = ligada ? await pedirLicenca(chave) : null
    setRecusas((atuais) => ({ ...atuais, [chave]: recusa ?? undefined }))
    if (!recusa) preferencias.ligar(chave, ligada)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {preferencias.somLigado ? (
            <BellRingIcon data-icon="inline-start" />
          ) : (
            <BellOffIcon data-icon="inline-start" />
          )}
          Este aparelho
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Este aparelho" align="end" className="w-80 gap-0 p-0">
        <p className="px-4 pt-3 pb-1 text-sm font-semibold">Este aparelho</p>
        <Grupo titulo="Som">
          <Linha
            id="alerta-sonoro"
            rotulo="Alerta sonoro"
            detalhe="Toca quando chega pedido e repete enquanto um espera aceite."
            marcada={preferencias.somLigado}
            aoMudar={(ligado) => {
              preferencias.ligarSom(ligado)
              // O toque na chave libera o som no navegador.
              if (ligado) tocarAlerta(som)
            }}
          />
          <div className="flex items-center gap-2 pb-2">
            <Select
              value={preferencias.tipoSom ?? "padrao"}
              onValueChange={(tipo) =>
                preferencias.escolherSom(tipo === "padrao" ? null : (tipo as SomAlerta))
              }
            >
              <SelectTrigger size="sm" aria-label="Tipo do alerta" className="min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {/* Sem escolha neste aparelho, vale o som das configurações da loja. */}
                  <SelectItem value="padrao">
                    Padrão da loja (
                    {SONS.find((item) => item.valor === loja?.som)?.rotulo ?? "Alto"})
                  </SelectItem>
                  {SONS.map(({ valor, rotulo }) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => tocarAlerta(som)}>
              Testar
            </Button>
          </div>
        </Grupo>
        <Grupo titulo="Avisos">
          <Linha
            id="notificar"
            rotulo="Notificação do sistema"
            detalhe="Avisa do pedido novo mesmo com a aba escondida."
            marcada={preferencias.notificar}
            aoMudar={(ligada) => ligar("notificar", ligada)}
            recusa={recusas.notificar}
          />
          <Linha
            id="piscar-aba"
            rotulo="Título da aba piscando"
            detalhe="O nome da aba mostra quantos pedidos esperam."
            marcada={preferencias.piscarAba}
            aoMudar={(ligada) => ligar("piscarAba", ligada)}
            recusa={recusas.piscarAba}
          />
          <Linha
            id="vibrar"
            rotulo="Vibrar"
            detalhe="No celular, vibra quando chega pedido."
            marcada={preferencias.vibrar}
            aoMudar={(ligada) => ligar("vibrar", ligada)}
            recusa={recusas.vibrar}
          />
        </Grupo>
        <Grupo titulo="Alertas">
          <Linha
            id="alerta-parado"
            rotulo="Pronto parado"
            detalhe={`Quando um pronto passa de ${preferencias.paradoMin} min sem sair.`}
            marcada={preferencias.alertas.parado}
            aoMudar={(ligado) => preferencias.ligarAlerta("parado", ligado)}
          />
          <Select
            value={String(preferencias.paradoMin)}
            onValueChange={(minutos) => preferencias.definirParadoMin(Number(minutos))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Minutos do pronto parado"
              className="mb-1 w-32"
              disabled={!preferencias.alertas.parado}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[5, 10, 15, 20].map((minutos) => (
                  <SelectItem key={minutos} value={String(minutos)}>
                    {minutos} min
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Linha
            id="alerta-atraso"
            rotulo="Prestes a atrasar"
            detalhe="5 minutos antes do prazo prometido."
            marcada={preferencias.alertas.atraso}
            aoMudar={(ligado) => preferencias.ligarAlerta("atraso", ligado)}
          />
          <Linha
            id="alerta-pago"
            rotulo="Pagamento online confirmado"
            detalhe="Quando o Pix ou o cartão online cai."
            marcada={preferencias.alertas.pago}
            aoMudar={(ligado) => preferencias.ligarAlerta("pago", ligado)}
          />
          <Linha
            id="alerta-cozinha"
            rotulo="Pronto na Cozinha"
            detalhe="Quando a Cozinha marca um pedido pronto."
            marcada={preferencias.alertas.cozinha}
            aoMudar={(ligado) => preferencias.ligarAlerta("cozinha", ligado)}
          />
          <Linha
            id="alerta-cancelou"
            rotulo="Cliente cancelou"
            detalhe="Quando o cliente cancela pelo site."
            marcada={preferencias.alertas.cancelou}
            aoMudar={(ligado) => preferencias.ligarAlerta("cancelou", ligado)}
          />
        </Grupo>
        <Grupo titulo="Tela">
          <Linha
            id="tela-acesa"
            rotulo="Tela sempre acesa"
            detalhe="A tela não apaga enquanto a fila está aberta."
            marcada={preferencias.telaAcesa}
            aoMudar={(ligada) => ligar("telaAcesa", ligada)}
            recusa={recusas.telaAcesa}
          />
          <Linha
            id="compacto"
            rotulo="Modo compacto"
            detalhe="Cada pedido numa linha, que abre ao tocar."
            marcada={preferencias.compacto}
            aoMudar={(ligada) => ligar("compacto", ligada)}
          />
        </Grupo>
        <Grupo titulo="Demonstração">
          <Linha
            id="simular-pedidos"
            rotulo="Simular pedidos chegando"
            detalhe="Um pedido novo chega a cada minuto, mais ou menos."
            marcada={preferencias.simular}
            aoMudar={preferencias.ligarSimulacao}
          />
        </Grupo>
      </PopoverContent>
    </Popover>
  )
}
