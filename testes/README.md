# Testes automatizados do Combinado

Esta pasta guarda os testes que usamos para conferir as funcionalidades do Combinado a cada mudança. Eles abrem o app num navegador de verdade (Chromium, via Playwright), clicam e preenchem os campos como uma pessoa faria e conferem se o resultado está certo. Também registram qualquer erro que apareça no console do navegador.

O resultado da última execução completa está em `resultados.txt`, na raiz do repositório: 13 roteiros, 164 checagens aprovadas, nenhuma falha e nenhum erro de console.

## O que cada arquivo testa

| Arquivo | O que confere |
|---|---|
| `login.js` | Cadastro, login, senha errada, usuário duplicado, sair, dados isolados por conta e login automático ao recarregar |
| `editar.js` | Edição de trabalho, cancelar sem alterar nada e persistência depois de recarregar |
| `completo.js` | Fluxo geral: criar, mudar status, editar, excluir com confirmação e acessibilidade básica |
| `tarefas.js` | Divisão de tarefas em trabalhos em grupo, contador, marcar como feita, excluir e uso só por teclado |
| `tarefas_status.js` | Trabalho em grupo vai para "Pronto" quando todas as tarefas são concluídas, volta para "Fazendo" se reabrir/adicionar tarefa, e "Entregue" nunca é alterado |
| `observacoes.js` | Campo de observações do trabalho: criar, editar, apagar, cancelar, quebra de linha, limite de 500 caracteres, HTML tratado como texto e dados antigos |
| `integrantes.js` | Cadastro e remoção de integrantes do grupo e escolha do responsável na lista |
| `integrantes_card.js` | Integrantes aparecendo direto no card da tela principal |
| `backfill_integrantes.js` | Trabalhos antigos que já tinham responsável nas tarefas ganhando a lista de integrantes |
| `filtros.js` | Lista ordenada por prazo e filtro por matéria |
| `status_cor.js` | Logo, status "Pronto", filtrar por status, cor do card (escolher, trocar, remover) e dados antigos sem cor |
| `lembrete.js` | Avisos de prazo: atrasado, vence hoje, amanhã e em 3 dias |
| `progresso.js` | Indicador de trabalhos entregues e barra de progresso |

## Como rodar

Precisa ter o Node.js instalado. Na raiz do repositório:

```
npm install playwright
npx playwright install chromium
python3 -m http.server 8799
```

Com o servidor rodando, em outro terminal:

```
node testes/tarefas.js
```

Troque `tarefas.js` pelo arquivo que quiser rodar. Cada linha `OK` é uma checagem aprovada e `FAIL` indica algo quebrado.
