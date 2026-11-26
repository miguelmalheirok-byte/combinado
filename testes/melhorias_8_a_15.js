/* Melhorias 8 a 15 da avaliação de Nielsen: rótulos de "Sair", legenda Pronto/Entregue, filtro limpo ao criar,
   matérias sem duplicar, limites e campos só com espaços, código do grupo no card e rascunho do formulário. */
const { abrirNavegador, novoContexto, vigiar, calmo, cadastrar, novoTrabalho, convidar, URL_APP } = require('./_base');

(async () => {
  const browser = await abrirNavegador();
  const erros = [];
  function check(desc, cond) {
    console.log((cond ? 'OK  ' : 'FAIL') + ' - ' + desc);
    if (!cond) process.exitCode = 1;
  }

  const ctx = await novoContexto(browser);
  const page = await ctx.newPage(); vigiar(page, erros);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  await page.goto(URL_APP);
  await page.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(page, 'Ana', 'senha123');

  /* ---------- 8. rótulos de "Sair" ---------- */
  check('cabeçalho: "Sair da conta"', (await page.textContent('#btn-sair')).trim() === 'Sair da conta');

  /* ---------- 12. limites de caracteres ---------- */
  await page.click('#btn-novo-trabalho');
  check('nome do trabalho tem limite de 120 caracteres', (await page.getAttribute('#input-titulo-trabalho', 'maxlength')) === '120');
  check('campo de nova tarefa tem limite de 300 caracteres', (await page.getAttribute('#input-tarefa-texto', 'maxlength')) === '300');

  /* ---------- 13. só espaços ---------- */
  await page.fill('#input-titulo-trabalho', '    ');
  await page.fill('#input-materia-trabalho', 'Redes');
  await page.click('#dialog-trabalho button[type="submit"]');
  check('título só com espaços: dialog continua aberto com mensagem', await page.locator('#dialog-trabalho').evaluate((d) => d.open)
    && /nome do trabalho/i.test(await page.locator('#input-titulo-trabalho').evaluate((i) => i.validationMessage)));
  await page.fill('#input-titulo-trabalho', 'Relatório');
  check('ao digitar, a mensagem some', (await page.locator('#input-titulo-trabalho').evaluate((i) => i.validationMessage)) === '');
  await page.fill('#input-materia-trabalho', '   ');
  await page.click('#dialog-trabalho button[type="submit"]');
  check('matéria só com espaços: mensagem própria', /matéria/i.test(await page.locator('#input-materia-trabalho').evaluate((i) => i.validationMessage)));

  /* ---------- 15. rascunho do formulário ---------- */
  await page.fill('#input-materia-trabalho', 'Redes de Computadores');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  await page.click('#btn-novo-trabalho');
  check('Esc no formulário novo mantém o que foi digitado', (await page.inputValue('#input-titulo-trabalho')) === 'Relatório' && (await page.inputValue('#input-materia-trabalho')) === 'Redes de Computadores');

  /* ---------- 11. matéria sem duplicar ---------- */
  await page.fill('#input-materia-trabalho', 'Redes de Computadores ');
  await page.click('#dialog-trabalho button[type="submit"]');
  await calmo(page);
  check('depois de enviar, o formulário abre vazio de novo', await (async () => {
    await page.click('#btn-novo-trabalho');
    const vazio = (await page.inputValue('#input-titulo-trabalho')) === '' && (await page.inputValue('#input-materia-trabalho')) === '';
    return vazio;
  })());
  await page.fill('#input-titulo-trabalho', 'Seminário');
  await page.fill('#input-materia-trabalho', 'REDES DE COMPUTADORES');
  await page.click('#dialog-trabalho button[type="submit"]');
  await calmo(page);
  const opcoes = await page.locator('#select-filtro-materia option').allTextContents();
  check('"Redes de Computadores " e "REDES…" viram uma matéria só no filtro', opcoes.length === 2 && opcoes[1] === 'Redes de Computadores');
  const metas = await page.locator('.trabalho-meta').allTextContents();
  check('os cards usam a grafia que já existia', metas.every((m) => m.trim() === 'Redes de Computadores'));
  const sugestoes = await page.locator('#lista-materias option').evaluateAll((os) => os.map((o) => o.value));
  check('o campo de matéria sugere as matérias já usadas', sugestoes.length === 1 && sugestoes[0] === 'Redes de Computadores' && (await page.getAttribute('#input-materia-trabalho', 'list')) === 'lista-materias');

  /* ---------- 9. legenda Pronto/Entregue ---------- */
  const legenda = await page.textContent('.progresso-legenda');
  check('legenda explica Pronto e Entregue', /Pronto/.test(legenda) && /Entregue/.test(legenda) && await page.isVisible('.progresso-legenda'));

  /* ---------- 10. filtro limpo ao criar ---------- */
  await page.click('.aba-status[data-status="pronto"]');
  check('filtro "Pronto" esconde os trabalhos', (await page.locator('#lista-trabalhos li.trabalho-card').count()) === 0);
  await novoTrabalho(page, 'Trabalho novo', 'Redes de Computadores');
  check('criar trabalho com filtro de status ligado limpa o filtro e mostra o novo', (await page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Trabalho novo' }).count()) === 1
    && (await page.getAttribute('.aba-status[data-status=""]', 'aria-pressed')) === 'true');
  await page.selectOption('#select-filtro-materia', 'Redes de Computadores');
  await novoTrabalho(page, 'Outra matéria', 'Banco de Dados');
  check('criar trabalho de outra matéria com filtro de matéria ligado limpa o filtro', (await page.inputValue('#select-filtro-materia')) === ''
    && (await page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Outra matéria' }).count()) === 1);

  /* ---------- 14. código no card + 8. "Sair do grupo" ---------- */
  await novoTrabalho(page, 'Projeto A3', 'Sistemas', { grupo: true });
  await calmo(page);
  const cardGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  const codigoCard = (await cardGrupo.locator('.trabalho-codigo-valor').textContent()).trim();
  check('card em grupo mostra o código de 6 caracteres', /^[A-Z2-9]{6}$/.test(codigoCard));
  check('card individual não mostra código', (await page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Trabalho novo' }).locator('.trabalho-codigo').count()) === 0);
  await cardGrupo.locator('.botao-copiar-card').click();
  check('Copiar no card dá retorno ("Copiado" ou "Selecionado")', await page.waitForFunction(() => /Copiado|Selecionado/.test(document.querySelector('.botao-copiar-card').textContent), null, { timeout: 3000 }).then(() => true, () => false));
  const copiado = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  check('o código copiado é o do grupo (quando o navegador permite ler a área de transferência)', copiado === null || copiado === codigoCard);

  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  check('janela do grupo mostra o mesmo código do card', (await page.textContent('#codigo-grupo-valor')).trim() === codigoCard);
  await convidar(page, 'Bia');
  await page.click('#dialog-tarefas [data-fechar-tarefas]');

  // a Bia entra pelo código e vê "Sair do grupo" e o código no próprio card
  const outra = await ctx.newPage();
  await outra.goto(URL_APP);
  await outra.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(outra, 'Caio', 'senha123');
  await outra.click('#btn-entrar-codigo');
  await outra.fill('#input-codigo', codigoCard);
  await outra.click('#btn-codigo-entrar');
  await calmo(outra);
  const cardCaio = outra.locator('#lista-trabalhos li.trabalho-card').first();
  check('quem não é dono vê "Sair do grupo" no card (e não "Sair" solto)', (await cardCaio.locator('button:has-text("Sair do grupo")').count()) === 1);
  check('quem não é dono também vê o código no card', (await cardCaio.locator('.trabalho-codigo-valor').textContent()).trim() === codigoCard);
  check('dono vê "Excluir"', (await cardGrupo.locator('button:has-text("Excluir")').count()) === 1);
  await cardCaio.locator('button:has-text("Tarefas")').click();
  await outra.waitForSelector('#dialog-tarefas[open]');
  check('janela do grupo: botão "Sair do grupo"', (await outra.textContent('#btn-sair-grupo')).trim() === 'Sair do grupo');
  check('janela do grupo explica que reabrir volta para Fazendo', /volta para Fazendo/.test(await outra.textContent('.tarefas-progresso-dica')));

  // rascunho não vaza para outra conta
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Rascunho da Ana');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  await page.click('#btn-sair');
  await page.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(page, 'Davi', 'senha123');
  await page.click('#btn-novo-trabalho');
  check('o rascunho de uma conta não aparece na conta seguinte', (await page.inputValue('#input-titulo-trabalho')) === '');

  const reais = erros.filter((e) => !/Failed to load resource|favicon/i.test(e));
  check('nenhum erro inesperado no console', reais.length === 0);
  if (reais.length) console.log(reais.join('\n'));
  await browser.close();
})().catch((e) => { console.log('FAIL - exceção: ' + e.message); process.exit(1); });
