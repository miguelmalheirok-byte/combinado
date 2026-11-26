# Combinado

Combinado é um organizador de trabalhos da faculdade, pensado para trabalhos individuais e em grupo, de todas as matérias, num lugar só. É um projeto da disciplina de Usabilidade, Desenvolvimento Web, Mobile e Jogos, da UniSul, feito por Miguel Kirchhof e Samuel Lemos.

Acesse em: https://miguelmalheirok-byte.github.io/combinado/

## O problema

Trabalhos de várias matérias, individuais e em grupo, acontecem ao mesmo tempo, e hoje são controlados de cabeça ou pelo WhatsApp. Isso causa prazo perdido e tarefa sem dono, principalmente quando o trabalho é dividido entre colegas.

## O que já tem

O app tem login de verdade: cada pessoa cria uma conta com usuário e senha e entra de qualquer aparelho, vendo só os trabalhos dela. Dá para cadastrar um trabalho com título, matéria, prazo e tipo (individual ou em grupo), editar depois de criado, escrever observações livres sobre o trabalho, escolher uma cor para o card, acompanhar o status (não comecei, fazendo, pronto, entregue) e excluir com confirmação.

Nos trabalhos em grupo, quem cria o trabalho é o dono e recebe um código de 6 caracteres. Os colegas criam a própria conta, tocam em "Entrar com código" e passam a ver e editar o mesmo trabalho. Os integrantes são as contas que entraram, o responsável de cada tarefa é escolhido entre elas (e a tarefa pode ser editada depois, tanto o texto quanto o responsável), e tudo se atualiza ao vivo na tela de todo mundo. O dono pode remover integrantes, trocar o código e excluir o trabalho; os integrantes podem sair do trabalho. Quando todas as tarefas de um trabalho em grupo são concluídas, ele passa sozinho para o status "Pronto".

A lista de trabalhos fica sempre ordenada pelo prazo mais próximo e pode ser filtrada por status, por abas com a contagem de cada um, e por matéria. Trabalhos perto do prazo (ou já atrasados) ganham um aviso destacado no card, enquanto não forem marcados como entregues. No topo da lista também aparece quantos trabalhos já foram entregues do total, com uma barra de progresso.

## Melhorias a partir do teste com usuários

Em novembro de 2026 o app foi testado com 3 estudantes (notebook, Android e iPhone). Os problemas mais citados viraram mudanças: trabalhos em grupo sem tarefas mostram uma dica de próximo passo e o botão Tarefas fica em destaque; o filtro por matéria ganhou ícone e o rótulo "Filtrar por matéria"; o formulário passou a dizer "Nome do trabalho" e "Matéria (disciplina)", e os botões Cancelar e Salvar ficam sempre visíveis, mesmo em tela de celular baixa. Num reteste, outra pessoa tentou escolher o responsável de uma tarefa antes de cadastrar os integrantes. Isso foi resolvido de vez com o login de verdade: não há mais cadastro de integrantes à mão, e o campo Responsável só oferece quem já entrou no grupo pelo código.

## Melhorias a partir da avaliação de Nielsen

Em 26/11/2026 o app foi avaliado contra as 10 heurísticas de usabilidade de Nielsen (um avaliador, código e testes com Supabase de mentira). Os sete problemas mais graves foram corrigidos: o aviso de erro de gravação não some mais sozinho; alterações feitas sem conexão e depois desfeitas pelo servidor agora são avisadas; o aviso também aparece dentro da janela de Tarefas; a tela de login ganhou o botão "Mostrar senha" e a dica de que não há recuperação de senha; excluir tarefa e remover integrante pedem confirmação (e o "×" tem área de toque de 44 px); abrir o app mostra "Carregando…" e, sem internet, explica "Sem conexão" e tenta de novo em vez de cair no login.

Uma segunda leva cuidou dos problemas menores: o botão do cabeçalho virou "Sair da conta" e o do card "Sair do grupo"; uma legenda explica a diferença entre Pronto e Entregue; criar um trabalho tira os filtros que o esconderiam; "Redes" e "redes " contam como a mesma matéria, com sugestão no campo; título e tarefa têm limite de caracteres e campos só com espaços avisam o que falta; o card do grupo mostra o código com botão Copiar; e o que foi digitado num trabalho novo sobrevive ao Esc.

## Visual

O visual segue a direção "Quadro": fundo lilás, contornos grossos em azul-escuro, sombras sólidas e cards coloridos. Os títulos usam a fonte Bricolage Grotesque e o texto usa Instrument Sans, ambas open source (licença SIL OFL) e hospedadas na pasta `fonts/` do próprio projeto, sem depender de serviço externo. Há também um tema escuro: na primeira visita o app segue a preferência do aparelho, e o botão com lua/sol no cabeçalho alterna entre claro e escuro, lembrando a escolha no navegador.

## Tecnologia

O Combinado é feito em HTML, CSS e JavaScript puro, sem framework, e continua publicado no GitHub Pages. Contas, trabalhos e grupos ficam no Supabase (login, banco Postgres e atualização em tempo real), que o navegador acessa direto. A decisão e as alternativas estão no ADR-001 (login real e grupos com convite).

Como o site é só arquivos estáticos, a segurança está no banco: todas as tabelas têm regras de acesso por linha (RLS), então só quem é integrante de um trabalho enxerga o trabalho e as tarefas dele. No navegador fica apenas a chave pública (`publishable`) do Supabase, em `js/config.js`; a chave secreta nunca entra no repositório.

O usuário vira um e-mail de mentira (`usuario@combinado.app`) só para o Supabase aceitar o cadastro, com confirmação de e-mail desligada. Por isso não existe recuperação de senha.

Arquivos principais: `js/dados.js` (única parte que fala com o Supabase), `js/app.js` (telas e regras), `js/vendor/supabase.js` (biblioteca oficial, copiada para o projeto) e `supabase/schema.sql` (tabelas, regras de acesso e funções do banco).

## Montando o banco (uma vez)

1. Crie um projeto em supabase.com e, em Authentication > Sign In / Providers > Email, desligue "Confirm email".
2. Em SQL Editor, cole e rode o conteúdo de `supabase/schema.sql`. Pode rodar de novo sem problema.
3. Em `js/config.js`, coloque a URL do projeto e a chave `publishable`.

As regras de acesso foram testadas num Postgres local com três contas (`supabase/testes/`): quem está de fora não lê nada, só o dono exclui o trabalho ou troca o código, e o código antigo para de funcionar depois da troca.

## Trabalhos antigos

Quem usou a versão anterior (dados só no navegador) vê, ao entrar na conta com o mesmo nome de usuário, uma pergunta para importar os trabalhos salvos naquele navegador. Nomes de integrantes digitados à mão não são importados; no lugar deles vale o código do grupo.

## Rodando localmente

Precisa de internet (o login e os dados ficam no Supabase). Não precisa de instalação: sirva a pasta com qualquer servidor estático, por exemplo:

```
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.
