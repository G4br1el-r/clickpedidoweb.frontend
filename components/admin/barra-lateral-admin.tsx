"use client"

import {
  ChevronDownIcon,
  ChevronRightIcon,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode, useId, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useConfig } from "@/lib/admin/config"
import { GRUPOS, type GrupoSecoes, normalizar, SECOES } from "@/lib/admin/secoes"
import { liberarPro } from "./campos"
import { MarcaLoja } from "./marca-loja"
import { MenuModulos } from "./menu-modulos"

/**
 * Plano Pro, só aqui na lateral: "Liberar todos" desbloqueia tudo de uma vez;
 * depois de liberado, dá para bloquear de novo (demonstração).
 */
function CartaoPro() {
  const pro = useConfig((estado) => estado.pro)
  const hidratada = useConfig((estado) => estado.hidratada)
  const compradas = useConfig((estado) => estado.compradas)
  const definirPro = useConfig((estado) => estado.definirPro)

  if (!hidratada) return null

  if (pro) {
    return (
      <div className="opcao-pro rounded-xl bg-card p-3 group-data-[collapsible=icon]:hidden">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <SparklesIcon className="size-4 text-[#D98E00]" />
          Pro liberado
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Todos os recursos estão disponíveis.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="mt-1.5 -ml-2 h-7 px-2">
              <LockIcon data-icon="inline-start" />
              Bloquear de novo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bloquear os recursos Pro?</AlertDialogTitle>
              <AlertDialogDescription>
                As opções pagas voltam a ter cadeado. As que você estiver usando vão para a sacola
                do painel, para contratar uma a uma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter liberado</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  definirPro(false)
                  toast("Recursos Pro bloqueados", { icon: <LockIcon className="size-4" /> })
                }}
              >
                Bloquear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-muted p-3 group-data-[collapsible=icon]:hidden">
      <p className="text-sm font-semibold">Plano Pro</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {compradas.length > 0
          ? `${compradas.length} ${compradas.length === 1 ? "recurso contratado" : "recursos contratados"}. Libere o resto de uma vez.`
          : "Modelos de card, animações e recursos de venda extras."}
      </p>
      <Button
        type="button"
        size="sm"
        className="botao-brilho mt-2.5 w-full bg-linear-to-r from-[#F5B700] to-[#FF8A4C] text-[#2A1700] hover:opacity-95"
        onClick={liberarPro}
        data-testid="liberar-todos"
      >
        <SparklesIcon data-icon="inline-start" />
        Liberar todos
      </Button>
    </div>
  )
}

/**
 * Conteúdo de um Collapsible do shadcn que abre e fecha animando a altura.
 * O Radix trava `animation-name` no elemento, então a altura fica com o Motion.
 */
function ConteudoAnimado({
  id,
  aberto,
  children,
}: {
  id: string
  aberto: boolean
  children: ReactNode
}) {
  // Fica sempre montado (o gatilho aponta para o id); fechado, sai do teclado e do leitor de tela.
  return (
    <motion.div
      id={id}
      className="overflow-hidden"
      initial={false}
      animate={aberto ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      inert={!aberto}
    >
      {children}
    </motion.div>
  )
}

/** Grupo de seções (Marca, Aparência, Telas, Recursos) que abre e fecha. */
function ItemGrupo({ grupo, caminho }: { grupo: GrupoSecoes; caminho: string }) {
  const secoes = SECOES.filter((secao) => secao.grupo === grupo)
  const Icone = secoes[0].icone
  const ativo = secoes.some((secao) => caminho === `/admin/configuracoes/${secao.id}`)
  const [aberto, setAberto] = useState(ativo || grupo === "Telas")
  const id = useId()

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} asChild className="group/colapsavel">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild aria-controls={id}>
          <SidebarMenuButton tooltip={grupo} isActive={ativo}>
            <Icone />
            <span>{grupo}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-300 ease-saida group-data-[state=open]/colapsavel:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <ConteudoAnimado id={id} aberto={aberto}>
          <SidebarMenuSub>
            {secoes.map((secao) => (
              <SidebarMenuSubItem key={secao.id}>
                <SidebarMenuSubButton
                  asChild
                  isActive={caminho === `/admin/configuracoes/${secao.id}`}
                >
                  <Link href={`/admin/configuracoes/${secao.id}`}>
                    <span>{secao.titulo}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </ConteudoAnimado>
      </SidebarMenuItem>
    </Collapsible>
  )
}

/** Título de um grupo da barra lateral que abre e fecha o grupo. */
function TituloGrupo({ controla, children }: { controla: string; children: string }) {
  return (
    <SidebarGroupLabel asChild>
      <CollapsibleTrigger
        aria-controls={controla}
        className="group/titulo w-full cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {children}
        <ChevronDownIcon className="ml-auto transition-transform duration-300 ease-saida group-data-[state=closed]/titulo:-rotate-90" />
      </CollapsibleTrigger>
    </SidebarGroupLabel>
  )
}

/** Barra lateral do painel (Sidebar do shadcn), com busca entre as configurações. */
export function BarraLateralAdmin() {
  const caminho = usePathname()
  const [busca, setBusca] = useState("")
  // Como os outros grupos: começa fechado e só abre sozinho numa página de configuração.
  const [configAberto, setConfigAberto] = useState(() => caminho.startsWith("/admin/configuracoes"))
  const idConfig = useId()
  const termo = normalizar(busca)
  const encontradas = termo
    ? SECOES.filter((secao) =>
        normalizar(`${secao.titulo} ${secao.descricao} ${secao.termos}`).includes(termo),
      )
    : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <MarcaLoja />
      </SidebarHeader>

      <SidebarContent>
        <MenuModulos />

        <Collapsible open={configAberto} onOpenChange={setConfigAberto} asChild>
          <SidebarGroup>
            <TituloGrupo controla={idConfig}>Personalizar loja</TituloGrupo>
            <ConteudoAnimado id={idConfig} aberto={configAberto}>
              <SidebarGroupContent className="flex flex-col gap-2">
                <div className="relative group-data-[collapsible=icon]:hidden">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <SidebarInput
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar configuração"
                    aria-label="Buscar configuração"
                    className="pl-8"
                  />
                </div>
                <SidebarMenu>
                  {termo ? (
                    encontradas.length > 0 ? (
                      encontradas.map(({ id, titulo, icone: Icone }) => (
                        <SidebarMenuItem key={id}>
                          <SidebarMenuButton
                            asChild
                            isActive={caminho === `/admin/configuracoes/${id}`}
                          >
                            <Link href={`/admin/configuracoes/${id}`} onClick={() => setBusca("")}>
                              <Icone />
                              <span>{titulo}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    ) : (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhuma configuração com “{busca.trim()}”.
                      </p>
                    )
                  ) : (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={caminho === "/admin/configuracoes"}
                          tooltip="Todas as opções"
                        >
                          <Link href="/admin/configuracoes">
                            <SettingsIcon />
                            <span>Todas as opções</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {GRUPOS.map((grupo) => (
                        <ItemGrupo key={grupo} grupo={grupo} caminho={caminho} />
                      ))}
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </ConteudoAnimado>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <CartaoPro />
        <Badge
          variant="outline"
          className="mx-2 mb-1 self-start group-data-[collapsible=icon]:hidden"
        >
          Protótipo · salvo neste navegador
        </Badge>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
