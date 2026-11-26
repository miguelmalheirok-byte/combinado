# Testes automatizados do Combinado

Esta pasta guarda os testes que usamos para conferir as funcionalidades do Combinado a cada mudança. Eles abrem o app num navegador de verdade (Chromium, via Playwright), clicam e preenchem os campos como uma pessoa faria e conferem se o resultado está certo. Também registram qualquer erro que apareça no console do navegador.

O resultado da última execução completa está em `resultados.txt`, na raiz do repositório.

Os roteiros do app rodam contra um Supabase de mentira (`fake_supabase.js`), que guarda tudo no navegador e imita as regras de acesso do banco. Isso deixa os testes rápidos e independentes de internet, e permite simular duas pessoas ao mesmo tempo (duas abas, duas contas). As regras de acesso de verdade, no Postgres, são testadas à parte em `supabase/testes/`.

## O que cada arquivo testa

| Arquivo | O que confere |
|---|---|
| `melhorias_8_a_15.js` | Segunda leva da avaliação de Nielsen: "Sair da conta" e "Sair do grupo", legenda Pronto/Entregue, filtro limpo ao criar trabalho, matérias sem duplicar (maiúsculas e espaços) com sugestão, limites de 120/300 caracteres, mensagem para campos só com espaços, código do grupo com Copiar no card e rascunho do formulário que sobrevive ao Esc (sem vazar para outra conta) |
| `avisos_confirmacoes.js` | Melhorias da avaliação de Nielsen: aviso de erro de gravação que continua na tela, aviso de alterações feitas sem conexão que foram desfeitas, aviso também dentro da janela de Tarefas, botão "Mostrar senha" e dica de que não há recuperação, confirmação ao excluir tarefa e ao remover integrante, e tela de "Carregando…" / "Sem conexão" ao abrir o app |
| `contas_grupos.js` | Login e cadastro de verdade (mensagens de erro, sessão ao recarregar, confirmação de e-mail ligada), grupo com código, duas pessoas ao mesmo tempo com atualização ao vivo, editar tarefa (cancelar, Esc, texto vazio, rascunho que sobrevive a atualização de outra pessoa), troca de código, remover integrante, sair, excluir, queda de internet e importação dos trabalhos antigos |
| `login.js` | Cadastro, login, senha errada, usuário duplicado, sair, dados isolados por conta e login automático ao recarregar |
| `editar.js` | Edição de trabalho, cancelar sem alterar nada e persistência depois de recarregar |
| `completo.js` | Fluxo geral: criar, mudar status, editar, excluir com confirmação e acessibilidade básica |
| `tarefas.js` | Divisão de tarefas em trabalhos em grupo (com colegas entrando pelo código), contador, marcar como feita, excluir e uso só por teclado |
| `tarefas_status.js` | Trabalho em grupo vai para "Pronto" quando todas as tarefas são concluídas, volta para "Fazendo" se reabrir/adicionar tarefa, e "Entregue" nunca é alterado |
| `observacoes.js` | Campo de observações do trabalho: criar, editar, apagar, cancelar, quebra de linha, limite de 500 caracteres, HTML tratado como texto e trabalho sem observação |
| `filtros.js` | Lista ordenada por prazo e filtro por matéria |
| `status_cor.js` | Logo, fonte própria, status "Pronto", abas de status com contagem, cor do card (escolher, trocar, remover), selo de data, prévia do formulário e trabalho sem cor |
| `tema.js` | Tema escuro: segue o aparelho na primeira visita, botão de alternar, escolha salva ao recarregar, cores e contraste dos cards e página 404 |
| `teste_usuarios.js` | Melhorias feitas a partir do teste com usuários: dica e destaque para dividir tarefas no trabalho em grupo, filtro por matéria mais visível, rótulos do formulário e botão de salvar sempre visível em tela de celular baixa, e o campo Responsável oferecendo só quem está no grupo |
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
