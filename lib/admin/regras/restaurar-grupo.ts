import { CONFIG_PADRAO, type Config } from "@/lib/admin/config"
import { type GrupoSecoes, type InfoSecao, SECOES } from "@/lib/admin/secoes"

/** Seções de um grupo cujas configurações saíram do padrão, na ordem do índice. */
export function secoesParaRestaurar(grupo: GrupoSecoes, config: Config): InfoSecao[] {
  return SECOES.filter(
    (secao) =>
      secao.grupo === grupo &&
      JSON.stringify(config[secao.id]) !== JSON.stringify(CONFIG_PADRAO[secao.id]),
  )
}

/** Diz o que vai voltar ao padrão: os nomes, ou só a conta quando são muitas. */
export function textoDaRestauracao(secoes: Pick<InfoSecao, "titulo">[]): string {
  if (secoes.length > 2) return `${secoes.length} seções voltam ao padrão`
  if (secoes.length === 1) return `${secoes[0].titulo} volta ao padrão`
  return `${secoes.map((secao) => secao.titulo).join(" e ")} voltam ao padrão`
}
