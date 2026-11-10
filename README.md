# Combinado

Organizador de trabalhos da faculdade — individuais e em grupo, de todas as matérias, num lugar só.

Projeto da disciplina de Usabilidade, Desenvolvimento Web, Mobile e Jogos (UniSul), feito por Miguel Kirchhof e Samuel Lemos.

**Acesse:** https://miguelmalheirok-byte.github.io/combinado/

## O problema

Trabalhos de várias matérias, individuais e em grupo, acontecem ao mesmo tempo — hoje controlados de cabeça ou no WhatsApp, com prazo perdido e tarefa sem dono.

## O que já tem

- Login e cadastro de usuário (cada conta vê só os próprios trabalhos)
- Cadastrar trabalho: título, matéria, prazo e tipo (individual ou em grupo)
- Editar trabalho já cadastrado
- Acompanhar status (não comecei, fazendo, entregue)
- Excluir trabalho, com confirmação

## O que falta

- Divisão de tarefas para trabalhos em grupo

## Tecnologia

HTML, CSS e JavaScript puro, sem framework. Os dados ficam salvos no navegador (localStorage) — por enquanto o login é só local, sem sincronizar entre aparelhos.

## Rodando localmente

Não precisa de instalação. Basta abrir o `index.html` num navegador, ou servir a pasta com qualquer servidor estático:

```
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.
