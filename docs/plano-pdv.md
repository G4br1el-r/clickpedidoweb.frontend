# Plano do PDV completo

Base: o PDV da fase 7 de [plano-painel-admin.md](plano-painel-admin.md) e a prévia aprovada em 19/11/2026 ([canvas "Prévia do PDV"](https://claude.ai/artifact/1RCeZ6kWT3FyeyAjqyZcoX): abertura, venda, pagamento dividido, fechamento e tablet). Tudo continua simulado, sem banco: as regras moram em `lib/` como funções puras, prontas para um backend de verdade.

## Para quem e onde

- **Quem opera:** um operador de caixa dedicado, em turno, com fila de clientes. O dono também consegue usar sozinho.
- **Equipamento:** desktop com teclado, leitor de código de barras (que digita como teclado) e impressora térmica de 80 mm. No tablet o catálogo visual é o padrão; o celular fica para venda rápida.
- **Fora:** modo offline (só um indicador de conexão), cadeado Pro no PDV, PDV na lanchonete.

## Decisões

### Equipe e acesso (vale para o painel todo)

- Perfis **Dono**, **Gerente** e **Caixa**. Garçom e Cozinha ficam para depois, mas o modelo os comporta.
- Cada pessoa tem nome, perfil e PIN de 4 a 6 dígitos, no módulo **Equipe** (grupo "Loja" do menu).
- O painel abre como o Dono. "Trocar usuário" no topo (`Ctrl+U`) pede a pessoa e o PIN.
- Menu por perfil:
  - **Caixa:** só PDV, Pedidos e Fila. Sem configurações de aparência.
  - **Gerente:** tudo, menos Equipe e, na tela da loja, Formas de pagamento, Pagamento online e (fase 6) Fiscal.
  - **Dono:** tudo.
- O gerente autoriza ações sensíveis com o PIN dele numa janela por cima, sem trocar quem está logado. Exigem autorização quando quem opera é Caixa: desconto acima do limite, cancelar item, cancelar venda ou devolver, sangria, reabrir caixa, controlado sem receita e fiado acima do limite.

### Turno de caixa

- Sem caixa aberto não se vende. Abrir pede a pessoa, o PIN e o fundo de troco (com contagem por cédula opcional). Quem abre passa a ser o usuário do painel, e o turno fica no nome dela até o fechamento.
- Sangria (retirada) e suprimento (reforço) durante o turno, com motivo e registro de quem fez e quem autorizou.
- Painel do turno no topo do PDV: operador, hora de abertura, vendas, total, ticket médio, dinheiro estimado na gaveta e o alerta "Sangria recomendada" acima do limite.
- Fechamento: Pix e cartões chegam conciliados; o dinheiro é contado por cédula e moeda. Diferença diferente de zero exige justificativa. O caixa não fecha com venda em espera. Reabrir pede o PIN do gerente.
- Histórico de caixas como sub-tela do PDV: turnos com operador, abertura, fechamento, esperado × contado e diferença, e o detalhe com vendas, sangrias e suprimentos.
- **Um caixa por loja** nesta versão. Vários terminais abertos ao mesmo tempo ficam fora (em aberto).

### Tela de venda

- Layout de caixa de mercado no desktop: campo de código sempre focado, lista grande dos itens, total enorme, último item em destaque. O catálogo visual abre no `F2`.
- Leitor: EAN e SKU no produto; bipar lança 1; `3*` antes do código multiplica; etiqueta de balança (EAN-13 começando com 2) traz peso ou preço; código desconhecido oferece lançar como avulso.
- Item cancelado continua na lista, riscado, com quem autorizou.
- Venda em espera: até 5 por turno. Orçamento: validade de 7 dias, vira venda com preços atualizados e não baixa estoque.
- Desconto e acréscimo por item e na venda. Consulta de preço (`Shift+F2`) mostra preço, estoque, lote e validade sem lançar.

| Tecla      | Ação              | Tecla    | Ação                   |
| ---------- | ----------------- | -------- | ---------------------- |
| `F1`       | Ajuda             | `F8`     | Receber                |
| `F2`       | Catálogo          | `F9`     | Finalizar              |
| `Shift+F2` | Consulta de preço | `F10`    | Reimprimir             |
| `F3`       | Cliente / CPF     | `F11`    | Sangria / suprimento   |
| `F4`       | Desconto          | `F12`    | Fechar caixa           |
| `F5`       | Quantidade        | `Esc`    | Voltar / fechar janela |
| `F6`       | Cancelar item     | `Ctrl+U` | Trocar usuário         |
| `F7`       | Venda em espera   | `Ctrl+O` | Orçamento              |

### Pagamento

- Dividido entre várias formas; troco só do dinheiro.
- Formas: dinheiro, Pix (QR simulado, confirma sozinho em 4 s ou à mão), crédito (até 12x, sem juros até 3x, 2,99% a.m. a partir da 4ª), débito, vale-alimentação, vale-refeição, fiado, crédito do cliente / vale-troca.
- Maquininha integrada simulada (TEF): aprova em 3 s; o cartão de teste final 0002 é sempre negado.
- O PDV respeita as formas ligadas em `ConfigLoja.pagamentos`.
- Cupom e fidelidade da vitrine valem no balcão, com as mesmas regras.

### Clientes

- Módulo **Clientes** no painel: nome, CPF, telefone, e-mail, histórico de compras, extrato do fiado e saldo de crédito.
- No PDV, `F3` identifica por CPF ou telefone, com cadastro rápido. "CPF na nota" funciona sem cadastrar.
- Fiado: limite por cliente (padrão R$ 300); acima pede o PIN do gerente; recebimento do fiado no caixa entra como entrada do turno; aviso de atraso após 30 dias.

### Pós-venda e impressão

- Cancelamento no mesmo turno: total, com estorno na forma original e cancelamento simulado da NFC-e (até 30 min).
- Depois: devolução parcial ou total, com estorno ou vale-troca. O estoque sempre volta.
- Impressão unificada com o `Cupom`/`useImpressora` da Fila e dos Pedidos: reimpressão, segunda via, comprovantes de sangria, suprimento e fechamento, e gaveta de dinheiro simulada.

### Fiscal

- Interface `EmissorFiscal` (emitir, cancelar, contingência, consultar status) com um emissor simulado agora; um emissor real (Focus NFe, PlugNotas…) troca só a implementação.
- Seção Fiscal na tela da loja: CNPJ, IE, regime, série, CSC e ambiente (homologação/produção), mais a chave "Emitir NFC-e".
- NCM, CFOP e CST no cadastro do produto. Com o fiscal ligado, toda venda finalizada emite; sem ele, sai o ticket não fiscal.
- Contingência simulada pelo botão de teste "Sefaz fora do ar".

### Por segmento

| Segmento  | No PDV                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Açougue   | Peso com 3 casas, balança simulada com tara, etiqueta de balança, baixa fracionada em kg                                                       |
| Farmácia  | CPF e receita para controlados (gravada em Receitas como `canal: "balcao"` e no livro de Controlados), escolha de lote, lote vencido bloqueado |
| Adega     | "+18" no produto alcoólico e uma confirmação de maioridade por venda                                                                           |
| Salão     | Profissional por serviço, comissão por profissional com relatório, cobrança dos agendamentos do dia                                            |
| Pizzaria  | Nada exclusivo além das comandas                                                                                                               |
| Com Mesas | O PDV puxa comandas abertas para cobrar                                                                                                        |

### Valores padrão (editáveis na tela da loja, seção "PDV e caixa")

| Configuração                | Padrão                                               |
| --------------------------- | ---------------------------------------------------- |
| Desconto sem autorização    | até 10%                                              |
| Alerta de sangria           | dinheiro na gaveta acima de R$ 500                   |
| Fundo de troco sugerido     | R$ 100                                               |
| Vendas em espera            | 5                                                    |
| Limite de fiado por cliente | R$ 300                                               |
| Fiado em atraso             | 30 dias                                              |
| Validade do orçamento       | 7 dias                                               |
| Parcelas no crédito         | até 12x, sem juros até 3x, 2,99% a.m. a partir da 4ª |
| Pix simulado                | confirma em 4 s                                      |
| TEF simulado                | aprova em 3 s; final 0002 negado                     |
| Cancelamento de NFC-e       | até 30 min                                           |

### Dados de demonstração

Os 90 dias passam a ter equipe, turnos de caixa (com sangrias, suprimentos e algumas diferenças justificadas), clientes com fiado e crédito, vendas com pagamento dividido e devoluções. Cada fase acrescenta a parte dela.

## Fases

Cada fase é um PR saindo deste worktree, feito em TDD, com `pnpm check` e `pnpm test:e2e:rapido` verdes. O próximo PR só abre depois do merge do anterior. Telas novas ou mudadas ganham screenshot do Playwright, revisado antes de atualizar.

1. **Equipe e turno de caixa:** perfis, PIN, Equipe, trocar usuário, menu por perfil, autorização do gerente, abertura, sangria, suprimento, painel do turno, fechamento com conferência, reabrir, histórico de caixas e a seção "PDV e caixa". Plano: [plano-pdv-fase-1.md](plano-pdv-fase-1.md).
2. **Layout de caixa:** tela de venda nova, mapa de teclado e ajuda, leitor e EAN/SKU no produto, consulta de preço, venda em espera (e o caixa não fecha com venda em espera), versão de tablet.
3. **Pagamentos:** dividido, crédito e débito com parcelas, Pix com QR, TEF simulado, vales, respeito à configuração da loja.
4. **Clientes:** módulo Clientes, `F3`, CPF na nota, fiado, crédito do cliente e vale-troca.
5. **Ajustes e pós-venda:** desconto e acréscimo por item, autorizações restantes, cancelamento e devolução, impressão unificada, comprovantes e gaveta.
6. **Fiscal:** `EmissorFiscal`, emissor simulado, seção Fiscal, campos fiscais do produto, contingência.
7. **Segmentos:** peso no açougue, receita e lote na farmácia, maioridade na adega, profissional e comissão no salão.
8. **Extras:** comandas no caixa, orçamento, cupom e fidelidade no balcão.

## Em aberto

- Vários caixas abertos ao mesmo tempo na mesma loja (um turno por terminal).
- Perfis Garçom e Cozinha.
- Integração real: TEF, emissor fiscal, banco para o Pix.
