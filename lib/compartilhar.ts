import { toast } from "sonner"
import { clienteAtual } from "./cliente"

/** Compartilha a loja pelo menu do aparelho; sem ele, copia o link e avisa. */
export async function compartilharLoja() {
  const dados = { title: clienteAtual.nome, text: clienteAtual.slogan, url: window.location.origin }
  try {
    if (navigator.share) {
      await navigator.share(dados)
      return
    }
    await navigator.clipboard.writeText(dados.url)
    toast.success("Link copiado")
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") return
    toast.error("Não foi possível compartilhar agora")
  }
}
