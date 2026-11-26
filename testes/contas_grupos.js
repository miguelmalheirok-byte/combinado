const { abrirNavegador, novoContexto, vigiar, calmo, cadastrar, entrar, novoTrabalho, URL_APP } = require('./_base');

(async () => {
  const browser = await abrirNavegador();
  const erros = [];
  let checks = 0;
  function check(desc, cond) {
    checks++;
    console.log((cond ? 'OK  ' : 'FAIL') + ' - ' + desc);
    if (!cond) process.exitCode = 1;
  }
  async function ate(page, fn, arg, timeout) {
    try { await page.waitForFunction(fn, arg, { timeout: timeout || 4000 }); return true; } catch (e) { return false; }
  }

  const ctx = await novoContexto(browser);
  const A = await ctx.newPage(); vigiar(A, erros);
  const B = await ctx.newPage(); vigiar(B, erros);

  /* ---------- 1. login e cadastro ---------- */
  await A.goto(URL_APP);
  await A.waitForSelector('#tela-auth:not([hidden])');
  check('abre na tela de login', await A.isVisible('#tela-auth') && !(await A.isVisible('#app-principal')));
  check('dicas de cadastro escondidas no login', await A.isHidden('#auth-dica-usuario') && await A.isHidden('#auth-dica-senha'));

  await A.click('#btn-auth-alternar');
  check('dicas de usuário e senha aparecem ao criar conta', await A.isVisible('#auth-dica-usuario') && await A.isVisible('#auth-dica-senha'));

  await A.fill('#input-usuario-auth', 'a b');
  await A.fill('#input-senha-auth', '123456');
  await A.click('#btn-auth-principal');
  await calmo(A);
  check('usuário com espaço é recusado com mensagem clara', /Usuário inválido/.test(await A.locator('#auth-erro').textContent()));

  await A.fill('#input-usuario-auth', 'ana');
  await A.fill('#input-senha-auth', '123');
  await A.click('#btn-auth-principal');
  await calmo(A);
  check('senha curta é recusada com mensagem clara', /pelo menos 6/.test(await A.locator('#auth-erro').textContent()));
  check('botão volta ao normal depois do erro', (await A.locator('#btn-auth-principal').textContent()).trim() === 'Criar conta' && await A.isEnabled('#btn-auth-principal'));

  await cadastrar(A, 'Ana', 'senha123');
  check('conta criada entra no app e mostra o nome digitado', (await A.locator('#cabecalho-usuario-nome').textContent()) === 'Ana');
  check('lista começa vazia', await A.isVisible('#lista-vazia'));

  await A.reload();
  await A.waitForSelector('#app-principal:not([hidden])');
  check('recarregar a página mantém a sessão', (await A.locator('#cabecalho-usuario-nome').textContent()) === 'Ana');

  await A.click('#btn-sair');
  await A.waitForSelector('#tela-auth:not([hidden])');
  check('sair volta para a tela de login', await A.isVisible('#tela-auth') && !(await A.isVisible('#app-principal')));

  await A.click('#btn-auth-alternar');
  await A.fill('#input-usuario-auth', 'ANA');
  await A.fill('#input-senha-auth', 'outra-senha');
  await A.click('#btn-auth-principal');
  await calmo(A);
  check('usuário repetido (mesmo em maiúsculas) é recusado', /já existe/.test(await A.locator('#auth-erro').textContent()));

  await A.click('#btn-auth-alternar');
  await A.fill('#input-usuario-auth', 'ana');
  await A.fill('#input-senha-auth', 'errada1');
  await A.click('#btn-auth-principal');
  await calmo(A);
  check('senha errada mostra "Usuário ou senha incorretos"', /incorretos/.test(await A.locator('#auth-erro').textContent()));

  await entrar(A, 'ana', 'senha123');
  check('entrar com a senha certa funciona', await A.isVisible('#app-principal'));

  /* ---------- 2. grupo: criar e compartilhar o código ---------- */
  await novoTrabalho(A, 'TCC em grupo', 'Projeto Integrador', { grupo: true });
  const cardA = A.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'TCC em grupo' });
  check('trabalho criado aparece na lista', (await cardA.count()) === 1);
  check('dono vê "Excluir" (não "Sair")', (await cardA.locator('button:has-text("Excluir")').count()) === 1 && (await cardA.locator('button:has-text("Sair")').count()) === 0);
  check('card em grupo sem tarefas orienta a passar o código', /código do grupo/.test(await cardA.locator('.trabalho-dica').textContent()));

  await cardA.locator('button:has-text("Tarefas")').click();
  await A.waitForSelector('#dialog-tarefas[open]');
  await calmo(A);
  const codigo = (await A.locator('#codigo-grupo-valor').textContent()).trim();
  check('código do grupo tem 6 caracteres sem letras confusas', /^[A-HJ-NP-Z2-9]{6}$/.test(codigo));
  check('dono aparece como integrante com selo "dono"', (await A.locator('#lista-integrantes li').count()) === 1 && /dono/.test(await A.locator('#lista-integrantes li').first().textContent()));
  check('dono vê "Trocar código" e não vê "Sair deste trabalho"', await A.isVisible('#btn-trocar-codigo') && await A.isHidden('#btn-sair-grupo'));
  check('responsável só oferece quem está no grupo', (await A.locator('#input-tarefa-responsavel option').count()) === 2);
  check('não existe mais o campo de digitar integrante', (await A.locator('#form-integrante').count()) === 0);

  /* ---------- 3. outra pessoa entra pelo código ---------- */
  await B.goto(URL_APP);
  await B.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(B, 'bia', 'bia12345');
  check('Bia começa sem trabalhos (não vê os da Ana)', await B.isVisible('#lista-vazia') && (await B.locator('.trabalho-card').count()) === 0);

  await B.click('#btn-entrar-codigo');
  await B.waitForSelector('#dialog-codigo[open]');
  await B.fill('#input-codigo', 'ZZZZZZ');
  await B.click('#btn-codigo-entrar');
  await calmo(B);
  check('código errado mostra erro e a janela continua aberta', /não encontrado/.test(await B.locator('#codigo-erro').textContent()) && await B.isVisible('#dialog-codigo'));
  await B.fill('#input-codigo', ' ' + codigo.toLowerCase() + ' ');
  await B.click('#btn-codigo-entrar');
  await calmo(B);
  check('código certo (minúsculo, com espaços) fecha a janela', await B.isHidden('#dialog-codigo'));
  const cardB = B.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'TCC em grupo' });
  check('trabalho aparece na lista da Bia', (await cardB.count()) === 1);
  check('integrante vê "Sair" (não "Excluir")', (await cardB.locator('button:has-text("Sair")').count()) === 1 && (await cardB.locator('button:has-text("Excluir")').count()) === 0);
  check('card mostra os dois integrantes', /integrantes: Ana, bia/.test(await cardB.locator('.trabalho-meta').textContent()));

  check('Ana vê a Bia entrar ao vivo (janela de tarefas aberta)', await ate(A, () => document.querySelectorAll('#lista-integrantes li').length === 2));
  check('responsável da Ana ganhou a Bia ao vivo', await ate(A, () => document.querySelectorAll('#input-tarefa-responsavel option').length === 3));

  /* ---------- 4. tarefas ao vivo entre as duas ---------- */
  await cardB.locator('button:has-text("Tarefas")').click();
  await B.waitForSelector('#dialog-tarefas[open]');
  check('integrante vê o mesmo código do grupo', (await B.locator('#codigo-grupo-valor').textContent()).trim() === codigo);
  check('integrante não vê "Trocar código" nem "×" de remover, vê "Sair deste trabalho"',
    await B.isHidden('#btn-trocar-codigo') && (await B.locator('#lista-integrantes button').count()) === 0 && await B.isVisible('#btn-sair-grupo'));

  await B.fill('#input-tarefa-texto', 'Escrever a introdução');
  await B.selectOption('#input-tarefa-responsavel', { label: 'bia' });
  await B.click('#form-tarefa button[type="submit"]');
  await calmo(B);
  check('Bia criou a tarefa com ela de responsável', /Escrever a introdução/.test(await B.locator('#lista-tarefas').textContent()) && /bia/.test(await B.locator('.tarefa-responsavel').textContent()));
  check('Ana recebe a tarefa ao vivo, com a Bia de responsável', await ate(A, () => /Escrever a introdução/.test(document.querySelector('#lista-tarefas').textContent) && /bia/.test((document.querySelector('.tarefa-responsavel') || {}).textContent || '')));

  await A.locator('#lista-tarefas input[type="checkbox"]').first().check();
  await calmo(A);
  check('Ana concluiu: anel mostra 1/1', (await A.locator('#tarefas-anel-numero').textContent()) === '1/1');
  check('Bia vê a tarefa concluída ao vivo', await ate(B, () => document.querySelector('#tarefas-anel-numero').textContent === '1/1'));
  await B.click('#dialog-tarefas [data-fechar-tarefas]');
  check('status do card virou Pronto para a Bia (regra automática, gravada no servidor)', await ate(B, () => {
    const c = [...document.querySelectorAll('.trabalho-card')].find((x) => x.textContent.includes('TCC em grupo'));
    return c && c.getAttribute('data-status') === 'pronto';
  }));

  /* ---------- 5. troca de código e quem está de fora ---------- */
  await A.click('#btn-trocar-codigo');
  await A.waitForSelector('#dialog-confirmar[open]');
  check('trocar código pede confirmação', /Trocar o código/.test(await A.locator('#dialog-confirmar-titulo').textContent()));
  await A.click('#btn-confirmar-exclusao');
  await calmo(A);
  const codigo2 = (await A.locator('#codigo-grupo-valor').textContent()).trim();
  check('código novo é diferente do antigo', /^[A-HJ-NP-Z2-9]{6}$/.test(codigo2) && codigo2 !== codigo);

  const C = await ctx.newPage(); vigiar(C, erros);
  await C.goto(URL_APP);
  await C.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(C, 'caio', 'caio1234');
  await C.click('#btn-entrar-codigo');
  await C.fill('#input-codigo', codigo);
  await C.click('#btn-codigo-entrar');
  await calmo(C);
  check('código antigo não funciona mais', /não encontrado/.test(await C.locator('#codigo-erro').textContent()));
  await C.click('#dialog-codigo [data-fechar-codigo]');
  check('Caio (de fora) não enxerga o trabalho', (await C.locator('.trabalho-card').count()) === 0);

  /* ---------- 6. dono remove integrante; integrante sai ---------- */
  await C.fill('#input-codigo', codigo2).catch(() => {});
  await C.click('#btn-entrar-codigo');
  await C.fill('#input-codigo', codigo2);
  await C.click('#btn-codigo-entrar');
  await calmo(C);
  check('código novo funciona para o Caio', await ate(C, () => document.querySelectorAll('.trabalho-card').length === 1));
  check('Ana vê 3 integrantes ao vivo', await ate(A, () => document.querySelectorAll('#lista-integrantes li').length === 3));

  await A.locator('#lista-integrantes button[aria-label="Remover caio do grupo"]').click();
  await calmo(A);
  check('Ana removeu o Caio', await ate(A, () => document.querySelectorAll('#lista-integrantes li').length === 2));
  check('o Caio perde o trabalho ao vivo', await ate(C, () => document.querySelectorAll('.trabalho-card').length === 0));

  await cardB.locator('button:has-text("Sair")').click();
  await B.waitForSelector('#dialog-confirmar[open]');
  check('Bia: sair pede confirmação clara', /Sair de "TCC em grupo"/.test(await B.locator('#dialog-confirmar-titulo').textContent()));
  await B.click('#btn-confirmar-exclusao');
  await calmo(B);
  check('Bia saiu: o trabalho some da lista dela', (await B.locator('.trabalho-card').count()) === 0);
  check('Ana vê a Bia sair ao vivo e a tarefa fica sem responsável', await ate(A, () => document.querySelectorAll('#lista-integrantes li').length === 1 && document.querySelectorAll('.tarefa-responsavel').length === 0));

  /* ---------- 7. excluir pelo dono ---------- */
  await B.click('#btn-entrar-codigo');
  await B.fill('#input-codigo', codigo2);
  await B.click('#btn-codigo-entrar');
  await calmo(B);
  check('Bia voltou pelo código', await ate(B, () => document.querySelectorAll('.trabalho-card').length === 1));
  await A.click('#dialog-tarefas [data-fechar-tarefas]');
  await cardA.locator('button:has-text("Excluir")').click();
  await A.waitForSelector('#dialog-confirmar[open]');
  check('excluir trabalho compartilhado avisa que some para todos', /para todos os integrantes/.test(await A.locator('#dialog-confirmar-texto').textContent()));
  await A.click('#btn-confirmar-exclusao');
  await calmo(A);
  check('trabalho excluído some para a Ana', (await A.locator('.trabalho-card').count()) === 0);
  check('e some para a Bia ao vivo', await ate(B, () => document.querySelectorAll('.trabalho-card').length === 0));

  /* ---------- 8. sem internet: aviso e volta ao estado do servidor ---------- */
  await novoTrabalho(A, 'Individual 1', 'Redes');
  await A.evaluate(() => localStorage.setItem('fake:offline', '1'));
  await A.selectOption('.trabalho-card select', 'fazendo');
  await ate(A, () => !document.getElementById('faixa-aviso').hidden);
  check('sem internet: avisa que a alteração não foi salva', /não foi salva|Sem conexão/.test(await A.locator('#faixa-aviso').textContent()));
  await A.evaluate(() => localStorage.removeItem('fake:offline'));
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check('ao voltar a conexão, a lista confere com o servidor (status não salvo é desfeito)', await ate(A, () => document.querySelector('.trabalho-card select').value === 'nao-comecei', null, 9000));

  /* ---------- 9. confirmação de e-mail ligada no servidor ---------- */
  const ctx2 = await novoContexto(browser);
  const D = await ctx2.newPage(); vigiar(D, erros);
  await D.goto(URL_APP);
  await D.evaluate(() => localStorage.setItem('fake:confirmar', '1'));
  await D.waitForSelector('#tela-auth:not([hidden])');
  await D.click('#btn-auth-alternar');
  await D.fill('#input-usuario-auth', 'dora');
  await D.fill('#input-senha-auth', '123456');
  await D.click('#btn-auth-principal');
  await calmo(D);
  check('servidor pedindo confirmação de e-mail: mostra aviso em vez de travar', /confirmação por e-mail/.test(await D.locator('#auth-erro').textContent()) && await D.isVisible('#tela-auth'));

  /* ---------- 10. importar trabalhos antigos ---------- */
  const ctx3 = await novoContexto(browser);
  const E = await ctx3.newPage(); vigiar(E, erros);
  await E.addInitScript(() => {
    if (localStorage.getItem('semeado')) return;
    localStorage.setItem('semeado', '1');
    localStorage.setItem('combinado:usuarios:v1', JSON.stringify({ Zeca: { senha: 'segredo' }, outro: { senha: 'x' } }));
    localStorage.setItem('trabalhos:v1:Zeca', JSON.stringify({ trabalhos: [
      { id: 'a', titulo: 'Relatório antigo', materia: 'Redes', prazo: '2026-12-01', tipo: 'individual', cor: 'azul', observacoes: 'obs', status: 'fazendo', tarefas: [], integrantes: [] },
      { id: 'b', titulo: 'Projeto antigo', materia: 'Banco de Dados', prazo: '', tipo: 'grupo', cor: '', observacoes: '', status: 'pronto', prontoAutomatico: true,
        tarefas: [{ id: 't1', texto: 'Modelar tabelas', responsavel: 'Zeca', feito: true }, { id: 't2', texto: 'Escrever relatório', responsavel: 'Fulano', feito: false }], integrantes: ['Zeca', 'Fulano'] }
    ] }));
  });
  await E.goto(URL_APP);
  await E.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(E, 'zeca', 'zeca1234');
  await E.waitForSelector('#dialog-importar[open]');
  check('conta nova com trabalhos antigos no navegador oferece importar', /Encontramos 2 trabalhos/.test(await E.locator('#dialog-importar-texto').textContent()));
  await E.click('#btn-importar-sim');
  await E.waitForSelector('#dialog-importar:not([open])', { state: 'attached' });
  await calmo(E);
  check('os 2 trabalhos antigos foram importados', (await E.locator('.trabalho-card').count()) === 2);
  const cardAntigo = E.locator('.trabalho-card').filter({ hasText: 'Projeto antigo' });
  check('status, tipo e matéria foram preservados', (await cardAntigo.getAttribute('data-status')) === 'pronto' && /Banco de Dados/.test(await cardAntigo.locator('.trabalho-meta').textContent()) && /Em grupo/.test(await cardAntigo.textContent()));
  check('tarefas vieram, concluídas ou não', /1\/2/.test(await cardAntigo.locator('button:has-text("Tarefas")').textContent()));
  check('a senha antiga em texto puro foi apagada deste navegador (só a do Zeca)',
    await E.evaluate(() => { const c = JSON.parse(localStorage.getItem('combinado:usuarios:v1')); return !('Zeca' in c) && 'outro' in c; }));
  await E.click('#btn-sair');
  await E.waitForSelector('#tela-auth:not([hidden])');
  await entrar(E, 'zeca', 'zeca1234');
  check('na próxima entrada não pergunta de novo', await E.isHidden('#dialog-importar') && (await E.locator('.trabalho-card').count()) === 2);

  const ctx4 = await novoContexto(browser);
  const F = await ctx4.newPage(); vigiar(F, erros);
  await F.addInitScript(() => {
    if (localStorage.getItem('semeado')) return;
    localStorage.setItem('semeado', '1');
    localStorage.setItem('trabalhos:v1:Lia', JSON.stringify({ trabalhos: [{ id: 'z', titulo: 'Não quero', materia: 'X', tipo: 'individual', status: 'fazendo', tarefas: [] }] }));
  });
  await F.goto(URL_APP);
  await F.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(F, 'lia', 'lia12345');
  await F.waitForSelector('#dialog-importar[open]');
  await F.click('#btn-importar-nao');
  await F.waitForSelector('#dialog-importar:not([open])', { state: 'attached' });
  await calmo(F);
  check('"Não importar" não traz nada para a conta', (await F.locator('.trabalho-card').count()) === 0);
  await F.reload();
  await F.waitForSelector('#app-principal:not([hidden])');
  await calmo(F);
  check('e não pergunta de novo depois de recarregar', await F.isHidden('#dialog-importar'));

  /* ---------- 11. serviço de contas indisponível ---------- */
  const ctx5 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx5.route('**/js/vendor/supabase.js', (r) => r.fulfill({ body: '/* vazio */', contentType: 'application/javascript' }));
  const G = await ctx5.newPage();
  await G.goto(URL_APP);
  await G.waitForSelector('#tela-auth:not([hidden])');
  check('sem a biblioteca do Supabase: tela de login mostra aviso claro', await G.isVisible('#auth-config-erro'));

  console.log('--- total de checagens: ' + checks + ' | erros de console: ' + erros.length);
  if (erros.length) { console.log(erros.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
