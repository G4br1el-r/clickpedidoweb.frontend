"use client"

import { PlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useCategorias } from "@/lib/admin/dados/consultas-cardapio"
import { useSalvarPracas } from "@/lib/admin/dados/consultas-entrega"
import { type Categoria, CORES_DE_PRACA, type Praca } from "@/lib/admin/dados/tipos"
import { esquemaPracas } from "@/lib/admin/regras/esquema-loja"
import { plural } from "@/lib/formato"
import { RecursoPro } from "../recurso-pro"
import { NOME_DA_COR, TracoDePraca } from "./traco-de-praca"

const novaPraca = (): Praca => ({
  id: `praca-${crypto.randomUUID().slice(0, 8)}`,
  nome: "",
  cor: "ambar",
  categoriaIds: [],
  imprime: true,
  tocaSom: true,
})

/**
 * Janela de uma praça: nome, cor, categorias e as chaves de via e som. A categoria que já
 * está em outra praça aparece apagada, com o nome dela.
 */
function JanelaPraca({
  praca,
  nova,
  pracas,
  categorias,
  salvando,
  aoSalvar,
  aoExcluir,
  aoFechar,
}: {
  praca: Praca
  nova: boolean
  pracas: Praca[]
  categorias: Categoria[]
  salvando: boolean
  aoSalvar: (praca: Praca) => string | undefined
  aoExcluir: () => void
  aoFechar: () => void
}) {
  const [rascunho, setRascunho] = useState(praca)
  const [erro, setErro] = useState<string>()
  const idNome = useId()
  const mudar = (mudanca: Partial<Praca>) => setRascunho((atual) => ({ ...atual, ...mudanca }))
  const daOutra = (categoriaId: string) =>
    pracas.find((outra) => outra.id !== praca.id && outra.categoriaIds.includes(categoriaId))

  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{nova ? "Nova praça" : "Editar praça"}</DialogTitle>
          <DialogDescription>
            Os itens das categorias marcadas aparecem na tela desta praça.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            setErro(aoSalvar(rascunho))
          }}
        >
          <Field data-invalid={Boolean(erro)}>
            <FieldLabel htmlFor={idNome}>Nome</FieldLabel>
            <Input
              id={idNome}
              maxLength={30}
              value={rascunho.nome}
              aria-invalid={Boolean(erro)}
              placeholder="Forno, Chapa, Bebidas…"
              onChange={(evento) => mudar({ nome: evento.target.value })}
            />
            {erro && <FieldError>{erro}</FieldError>}
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Cor</FieldLegend>
            <RadioGroup
              aria-label="Cor"
              value={rascunho.cor}
              onValueChange={(cor) => mudar({ cor: cor as Praca["cor"] })}
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              {CORES_DE_PRACA.map((cor) => (
                <Label key={cor} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={cor} aria-label={NOME_DA_COR[cor]} />
                  <TracoDePraca cor={cor} />
                  {NOME_DA_COR[cor]}
                </Label>
              ))}
            </RadioGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Categorias</FieldLegend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {categorias.map((categoria) => {
                const outra = daOutra(categoria.id)
                const marcada = rascunho.categoriaIds.includes(categoria.id)
                return (
                  <li key={categoria.id}>
                    <Label className="flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={marcada}
                        disabled={Boolean(outra)}
                        aria-label={categoria.nome}
                        onCheckedChange={(ligada) =>
                          mudar({
                            categoriaIds: ligada
                              ? [...rascunho.categoriaIds, categoria.id]
                              : rascunho.categoriaIds.filter((id) => id !== categoria.id),
                          })
                        }
                      />
                      <span className={outra ? "text-muted-foreground" : undefined}>
                        {categoria.nome}
                      </span>
                      {outra && (
                        <span className="text-xs text-muted-foreground">em {outra.nome}</span>
                      )}
                    </Label>
                  </li>
                )
              })}
            </ul>
          </FieldSet>

          <div className="flex flex-col gap-3">
            {(
              [
                ["imprime", "Imprime a via"],
                ["tocaSom", "Toca o alerta de pedido novo"],
              ] as const
            ).map(([campo, rotulo]) => (
              <Label key={campo} className="flex items-center justify-between gap-4 font-normal">
                {rotulo}
                <Switch
                  checked={rascunho[campo]}
                  aria-label={rotulo}
                  onCheckedChange={(ligada) => mudar({ [campo]: ligada })}
                />
              </Label>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            {!nova ? (
              <Button type="button" variant="ghost" disabled={salvando} onClick={aoExcluir}>
                Excluir praça
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={salvando}>
              Salvar praça
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * As praças da cozinha: a lista, com as categorias de cada uma, e a janela de editar.
 * Salva a lista inteira, conferida pelo mesmo esquema do servidor.
 */
export function PracasDaCozinha() {
  const { data: loja } = useLoja()
  const { data: categorias = [] } = useCategorias()
  const salvar = useSalvarPracas()
  const [aberta, setAberta] = useState<{ praca: Praca; nova: boolean } | null>(null)
  if (!loja) return <Skeleton className="h-24 rounded-lg" />
  const pracas = loja.pracas ?? []

  const gravar = (lista: Praca[]) =>
    salvar.mutate(lista, {
      onSuccess: () => setAberta(null),
      onError: (erro) => toast.error(erro.message),
    })
  /** Confere antes de mandar: o erro desta praça aparece na janela. */
  const aoSalvar = (praca: Praca): string | undefined => {
    const lista = aberta?.nova
      ? [...pracas, praca]
      : pracas.map((outra) => (outra.id === praca.id ? praca : outra))
    const conferida = esquemaPracas.safeParse(lista)
    if (!conferida.success) return conferida.error.issues[0].message
    gravar(conferida.data)
    return undefined
  }

  const botaoNova = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      onClick={() => setAberta({ praca: novaPraca(), nova: true })}
    >
      <PlusIcon data-icon="inline-start" />
      Nova praça
    </Button>
  )

  return (
    <div className="flex flex-col gap-3">
      {pracas.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {pracas.map((praca) => (
            <li
              key={praca.id}
              aria-label={praca.nome}
              className="flex items-center gap-3 py-2.5 text-sm"
            >
              <TracoDePraca cor={praca.cor} />
              <span className="font-medium">{praca.nome}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                {plural(praca.categoriaIds.length, "categoria", "categorias")}
                {praca.imprime ? " · imprime a via" : ""}
                {praca.tocaSom ? "" : " · sem som"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Editar ${praca.nome}`}
                onClick={() => setAberta({ praca, nova: false })}
              >
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {pracas.length > 0 ? (
        <RecursoPro
          chave="cozinha.pracas"
          compacto
          descricao="Divida a cozinha em praças, cada uma com a sua tela, via e som."
        >
          {botaoNova}
        </RecursoPro>
      ) : (
        botaoNova
      )}
      {aberta && (
        <JanelaPraca
          praca={aberta.praca}
          nova={aberta.nova}
          pracas={pracas}
          categorias={categorias}
          salvando={salvar.isPending}
          aoSalvar={aoSalvar}
          aoExcluir={() => gravar(pracas.filter((outra) => outra.id !== aberta.praca.id))}
          aoFechar={() => setAberta(null)}
        />
      )}
    </div>
  )
}
