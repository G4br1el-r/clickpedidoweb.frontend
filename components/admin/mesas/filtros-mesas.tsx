"use client"

import { BellIcon, SearchIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AreaSalao, Garcom } from "@/lib/admin/dados/tipos"
import type { FiltroEstadoMesa } from "@/lib/admin/regras/filtro-mesas"
import { LIMPAR_GRADE, ROTULOS_ESTADO, useEstadoGrade } from "./estado-grade"

const TODOS = "todos"

const OPCOES_ESTADO = (Object.keys(ROTULOS_ESTADO) as FiltroEstadoMesa[]).map((valor) => ({
  valor,
  rotulo: ROTULOS_ESTADO[valor],
}))

function Filtro({
  rotulo,
  todos,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  todos?: string
  valor: string
  opcoes: readonly { valor: string; rotulo: string }[]
  aoMudar: (valor: string) => void
}) {
  return (
    <Select value={valor} onValueChange={aoMudar}>
      <SelectTrigger aria-label={rotulo} className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {todos && <SelectItem value={TODOS}>{todos}</SelectItem>}
          {opcoes.map((opcao) => (
            <SelectItem key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/** Busca, filtros e ordem da grade de mesas. O estado mora no endereço da página. */
export function FiltrosMesas({
  areas,
  garcons,
  comAtencao,
}: {
  areas: AreaSalao[]
  garcons: Garcom[]
  /** Mesas com alerta, contadas antes do próprio filtro de atenção. */
  comAtencao: number
}) {
  const [estado, setEstado] = useEstadoGrade()
  const temFiltro =
    estado.busca !== "" ||
    estado.area !== null ||
    estado.estado !== null ||
    estado.garcom !== null ||
    estado.atencao !== null ||
    estado.ordem !== "numero"
  const escolher = (valor: string) => (valor === TODOS ? null : valor)

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <InputGroup className="lg:max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Buscar mesa"
          placeholder="Número, nome ou cliente"
          value={estado.busca}
          onChange={(evento) => setEstado({ busca: evento.target.value || null })}
        />
      </InputGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Filtro
          rotulo="Área"
          todos="Todas as áreas"
          valor={estado.area ?? TODOS}
          opcoes={areas
            .toSorted((a, b) => a.ordem - b.ordem)
            .map((area) => ({ valor: area.id, rotulo: area.nome }))}
          aoMudar={(valor) => setEstado({ area: escolher(valor) })}
        />
        <Filtro
          rotulo="Estado"
          todos="Todos os estados"
          valor={estado.estado ?? TODOS}
          opcoes={OPCOES_ESTADO}
          aoMudar={(valor) => setEstado({ estado: escolher(valor) as FiltroEstadoMesa | null })}
        />
        <Filtro
          rotulo="Garçom"
          todos="Todos os garçons"
          valor={estado.garcom ?? TODOS}
          opcoes={garcons
            .filter((garcom) => garcom.ativo)
            .map((garcom) => ({ valor: garcom.nome, rotulo: garcom.nome }))}
          aoMudar={(valor) => setEstado({ garcom: escolher(valor) })}
        />
        <Button
          type="button"
          variant={estado.atencao ? "default" : "outline"}
          aria-pressed={estado.atencao === "sim"}
          onClick={() => setEstado({ atencao: estado.atencao ? null : "sim" })}
        >
          <BellIcon data-icon="inline-start" />
          Precisam de atenção ({comAtencao})
        </Button>
        <Filtro
          rotulo="Ordem"
          valor={estado.ordem}
          opcoes={[
            { valor: "numero", rotulo: "Por número" },
            { valor: "tempo", rotulo: "Mais tempo aberta" },
          ]}
          aoMudar={(valor) => setEstado({ ordem: valor === "tempo" ? "tempo" : null })}
        />
        {temFiltro && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEstado(LIMPAR_GRADE)}>
            <XIcon data-icon="inline-start" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  )
}
