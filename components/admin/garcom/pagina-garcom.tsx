"use client"

import NumberFlow from "@number-flow/react"
import { ShoppingBasketIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { usePedido } from "@/lib/admin/dados/consultas"
import { useConfigSalao, useLancarNaMesa, useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { useGarcom, useGarcomCarregado } from "@/lib/admin/garcom"
import { garcomDoAparelho } from "@/lib/admin/regras/abrir-mesa"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { totaisDaVenda } from "@/lib/admin/regras/pdv"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { ComandaMesa } from "../mesas/comanda-mesa"
import { CatalogoBalcao } from "../pdv/catalogo-balcao"
import { Traco } from "../traco"
import { Bandeja, useRodada } from "./montar-rodada"

/** Comanda da mesa escolhida: quem está e quanto já deu. */
function ResumoDaComanda({
  mesa,
  pedidoId,
  aoVer,
}: {
  mesa: Mesa
  pedidoId: number
  aoVer: () => void
}) {
  const { data: comanda } = usePedido(pedidoId)
  if (!comanda) return null
  const itens = comanda.itens.reduce((soma, item) => soma + item.quantidade, 0)
  const estado = estadoDaMesa(mesa, comanda)
  return (
    <div className="flex items-center gap-3 text-sm">
      <Traco tom={estado.tom} />
      <span className="min-w-0 flex-1 truncate">
        {comanda.cliente.nome} · {plural(itens, "item", "itens")} · {emReais(comanda.total)}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={aoVer}>
        Ver comanda
      </Button>
    </div>
  )
}

/**
 * Garçom: pensado para o celular. Escolhe a mesa, monta a rodada com o catálogo do
 * balcão e lança na comanda, com ou sem passar pela cozinha.
 */
export function PaginaGarcom() {
  useGarcomCarregado()
  const telaGrande = useTelaGrande()
  const nome = useGarcom((estado) => estado.nome)
  const definirNome = useGarcom((estado) => estado.definirNome)
  const { data: mesas = [] } = useMesas()
  const { data: salao } = useConfigSalao()
  const garcons = salao?.garcons.filter((garcom) => garcom.ativo) ?? []
  // O nome digitado marca o garçom da lista sem diferenciar acento e maiúscula.
  const marcado = garcomDoAparelho(
    garcons.map((garcom) => garcom.nome),
    nome,
  )
  const lancar = useLancarNaMesa()
  const [mesaId, setMesaId] = useState<string | null>(null)
  const [cliente, setCliente] = useState("")
  const rodada = useRodada()
  const { itens } = rodada
  const [bandejaAberta, setBandejaAberta] = useState(false)
  const [vendoComanda, setVendoComanda] = useState(false)

  const mesa = mesas.find((item) => item.id === mesaId) ?? null
  const aoLancar = (enviarParaCozinha: boolean) => {
    if (!mesa) return
    lancar.mutate(
      {
        mesaId: mesa.id,
        enviarParaCozinha,
        ...(nome.trim() ? { garcom: nome } : {}),
        ...(mesa.status === "livre" && cliente.trim() ? { clienteNome: cliente } : {}),
        itens: rodada.lancados(),
      },
      {
        onSuccess: () => {
          toast.success(
            `Mesa ${mesa.numero}: ${enviarParaCozinha ? "enviado para a cozinha" : "lançado na comanda"}.`,
          )
          rodada.limpar()
          setCliente("")
          setBandejaAberta(false)
        },
        onError: (erro) => toast.error(erro.message),
      },
    )
  }

  const bandeja = (
    <Bandeja
      itens={itens}
      mesa={mesa}
      enviando={lancar.isPending}
      aviso={rodada.aviso}
      mudarQuantidade={rodada.mudarQuantidade}
      remover={rodada.remover}
      aoLancar={aoLancar}
    />
  )
  const { quantidade, total } = totaisDaVenda(itens, { modo: "reais", valor: 0 })

  return (
    // No celular, espaço no fim para a barra da bandeja não cobrir os últimos produtos.
    <div className="flex flex-1 flex-col gap-5 p-4 pb-24 md:p-6 lg:px-8 lg:pb-6">
      <CabecalhoPagina
        titulo="Garçom"
        resumo="Escolha a mesa, monte a rodada e lance na comanda."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-0">
        <div className="flex min-w-0 flex-col gap-5 lg:pr-6">
          <div className="flex flex-col gap-3 border-y border-border/70 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="garcom-nome">Seu nome</FieldLabel>
                <Input
                  id="garcom-nome"
                  autoComplete="name"
                  maxLength={40}
                  value={nome}
                  onChange={(evento) => definirNome(evento.target.value)}
                />
                {/* Atalho: os garçons do salão; o nome continua livre neste aparelho. */}
                {garcons.length > 0 && (
                  <fieldset aria-label="Garçons do salão" className="flex flex-wrap gap-1.5">
                    {garcons.map((garcom) => (
                      <Button
                        key={garcom.id}
                        type="button"
                        size="sm"
                        variant={garcom.nome === marcado ? "secondary" : "ghost"}
                        aria-pressed={garcom.nome === marcado}
                        onClick={() => definirNome(garcom.nome)}
                      >
                        {garcom.nome}
                      </Button>
                    ))}
                  </fieldset>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="garcom-mesa">Mesa</FieldLabel>
                <Select value={mesaId ?? ""} onValueChange={setMesaId}>
                  <SelectTrigger id="garcom-mesa" aria-label="Mesa" className="w-full">
                    <SelectValue placeholder="Escolha a mesa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {mesas
                        .filter((item) => !item.bloqueio)
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <Traco tom={estadoDaMesa(item, undefined).tom} />
                            Mesa {item.numero} ·{" "}
                            {item.status === "livre" ? "livre" : item.clienteNome}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {mesa?.status === "livre" && (
                <Field>
                  <FieldLabel htmlFor="garcom-cliente">Cliente</FieldLabel>
                  <Input
                    id="garcom-cliente"
                    maxLength={60}
                    placeholder="Opcional"
                    value={cliente}
                    onChange={(evento) => setCliente(evento.target.value)}
                  />
                </Field>
              )}
            </div>
            {mesa?.pedidoAtivoId && (
              <ResumoDaComanda
                mesa={mesa}
                pedidoId={mesa.pedidoAtivoId}
                aoVer={() => setVendoComanda(true)}
              />
            )}
          </div>

          <CatalogoBalcao quantidadeNa={rodada.quantidadeNa} aoTocar={rodada.tocarProduto} />
        </div>

        {telaGrande ? (
          // Bandeja plana, separada do catálogo por um fio; acompanha a rolagem.
          <aside className="lg:sticky lg:top-20 lg:border-l lg:border-border/70 lg:pl-6">
            {bandeja}
          </aside>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="fixed inset-x-4 bottom-4 z-20 h-12 justify-between rounded-xl px-4 shadow-lg"
              onClick={() => setBandejaAberta(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBasketIcon data-icon="inline-start" />
                Ver bandeja · {plural(quantidade, "item", "itens")}
              </span>
              <NumberFlow
                value={total}
                locales="pt-BR"
                format={formatoMoeda}
                className="font-semibold tabular-nums"
              />
            </Button>
            <Sheet open={bandejaAberta} onOpenChange={setBandejaAberta}>
              <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{mesa ? `Mesa ${mesa.numero}` : "Bandeja"}</SheetTitle>
                  <SheetDescription>Confira a rodada antes de lançar.</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">{bandeja}</div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {rodada.janela}
      <ComandaMesa mesa={vendoComanda ? mesa : null} aoFechar={() => setVendoComanda(false)} />
    </div>
  )
}
