# Combinado

Combinado é um organizador de trabalhos da faculdade, pensado para trabalhos individuais e em grupo, de todas as matérias, num lugar só. É um projeto da disciplina de Usabilidade, Desenvolvimento Web, Mobile e Jogos, da UniSul, feito por Miguel Kirchhof e Samuel Lemos.

Acesse em: https://miguelmalheirok-byte.github.io/combinado/

## O problema

Trabalhos de várias matérias, individuais e em grupo, acontecem ao mesmo tempo, e hoje são controlados de cabeça ou pelo WhatsApp. Isso causa prazo perdido e tarefa sem dono, principalmente quando o trabalho é dividido entre colegas.

## O que já tem

O app já permite criar uma conta e fazer login, com cada usuário vendo só os próprios trabalhos. Dá para cadastrar um trabalho com título, matéria, prazo e tipo (individual ou em grupo), editar depois de criado, escrever observações livres sobre o trabalho, escolher uma cor para o card, acompanhar o status (não comecei, fazendo, pronto, entregue) e excluir com confirmação. Nos trabalhos em grupo também dá para cadastrar os integrantes do grupo e dividir as tarefas entre eles, escolhendo o responsável de cada uma numa lista e acompanhando quantas já foram concluídas. Quando todas as tarefas de um trabalho em grupo são concluídas, ele passa sozinho para o status "Pronto".

A lista de trabalhos fica sempre ordenada pelo prazo mais próximo e pode ser filtrada por status, por abas com a contagem de cada um, e por matéria. Trabalhos perto do prazo (ou já atrasados) ganham um aviso destacado no card, enquanto não forem marcados como entregues. No topo da lista também aparece quantos trabalhos já foram entregues do total, com uma barra de progresso.

## Melhorias a partir do teste com usuários

Em novembro de 2026 o app foi testado com 3 estudantes (notebook, Android e iPhone). Os problemas mais citados viraram mudanças: trabalhos em grupo sem tarefas mostram uma dica de próximo passo e o botão Tarefas fica em destaque; o filtro por matéria ganhou ícone e o rótulo "Filtrar por matéria"; o formulário passou a dizer "Nome do trabalho" e "Matéria (disciplina)", e os botões Cancelar e Salvar ficam sempre visíveis, mesmo em tela de celular baixa.

## Visual

O visual segue a direção "Quadro": fundo lilás, contornos grossos em azul-escuro, sombras sólidas e cards coloridos. Os títulos usam a fonte Bricolage Grotesque e o texto usa Instrument Sans, ambas open source (licença SIL OFL) e hospedadas na pasta `fonts/` do próprio projeto, sem depender de serviço externo. Há também um tema escuro: na primeira visita o app segue a preferência do aparelho, e o botão com lua/sol no cabeçalho alterna entre claro e escuro, lembrando a escolha no navegador.

## O que vem por aí

Está planejado sincronizar os trabalhos entre aparelhos diferentes.

## Tecnologia

O Combinado é feito em HTML, CSS e JavaScript puro, sem framework. Os dados ficam salvos no navegador, via localStorage. Por enquanto o login também é só local, sem sincronizar entre aparelhos.

## Rodando localmente

Não precisa de instalação. Basta abrir o arquivo `index.html` num navegador, ou servir a pasta com qualquer servidor estático, por exemplo:

```
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.
