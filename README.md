# Combinado

Combinado é um organizador de trabalhos da faculdade, pensado para trabalhos individuais e em grupo, de todas as matérias, num lugar só. É um projeto da disciplina de Usabilidade, Desenvolvimento Web, Mobile e Jogos, da UniSul, feito por Miguel Kirchhof e Samuel Lemos.

Acesse em: https://miguelmalheirok-byte.github.io/combinado/

## O problema

Trabalhos de várias matérias, individuais e em grupo, acontecem ao mesmo tempo, e hoje são controlados de cabeça ou pelo WhatsApp. Isso causa prazo perdido e tarefa sem dono, principalmente quando o trabalho é dividido entre colegas.

## O que já tem

O app já permite criar uma conta e fazer login, com cada usuário vendo só os próprios trabalhos. Dá para cadastrar um trabalho com título, matéria, prazo e tipo (individual ou em grupo), editar depois de criado, acompanhar o status (não comecei, fazendo, entregue) e excluir com confirmação. Nos trabalhos em grupo também dá para cadastrar os integrantes do grupo e dividir as tarefas entre eles, escolhendo o responsável de cada uma numa lista e acompanhando quantas já foram concluídas.

A lista de trabalhos também pode ser ordenada por prazo mais próximo, título ou mais recentes, e filtrada por matéria. Trabalhos perto do prazo (ou já atrasados) ganham um aviso destacado no card, enquanto não forem marcados como entregues.

## O que vem por aí

Está planejado sincronizar os trabalhos entre aparelhos diferentes.

Também está no radar, como ideia futura, um campo de observações livres em cada trabalho.

## Tecnologia

O Combinado é feito em HTML, CSS e JavaScript puro, sem framework. Os dados ficam salvos no navegador, via localStorage. Por enquanto o login também é só local, sem sincronizar entre aparelhos.

## Rodando localmente

Não precisa de instalação. Basta abrir o arquivo `index.html` num navegador, ou servir a pasta com qualquer servidor estático, por exemplo:

```
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.
