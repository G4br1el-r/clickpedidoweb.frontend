import { LockIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/** O perfil de quem está usando o painel não abre esta página. */
export function SemAcesso({ titulo }: { titulo: string }) {
  return (
    <Empty className="m-4 border md:m-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>Peça a um gerente ou troque de usuário no topo.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
