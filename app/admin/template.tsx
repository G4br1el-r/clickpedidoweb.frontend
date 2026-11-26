import type { ReactNode } from "react"

/**
 * O template remonta a cada troca de módulo (o layout não): é o que faz a página entrar
 * de novo, em CSS puro (`.pagina-admin-entra`, em admin.css), sem esperar o JavaScript.
 */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <div className="pagina-admin-entra flex flex-1 flex-col">{children}</div>
}
