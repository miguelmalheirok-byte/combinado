const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('console', (msg) => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('pageerror', (err) => erros.push('pageerror: ' + err.message));

  let checks = 0;
  function check(desc, cond) {
    checks++;
    console.log((cond ? 'OK  ' : 'FAIL') + ' - ' + desc);
    if (!cond) process.exitCode = 1;
  }

  await page.goto('http://localhost:8799/');

  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'teste-integrantes');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Projeto A3');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#dialog-trabalho button[type="submit"]');

  const cardGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');

  check('lista de integrantes comeca vazia', await page.isVisible('#integrantes-vazio'));

  const selectResp = page.locator('#input-tarefa-responsavel');
  check('select de responsavel comeca so com "Sem responsavel"', (await selectResp.locator('option').count()) === 1);

  // adiciona integrantes
  for (const nome of ['Miguel', 'Samuel']) {
    await page.fill('#input-integrante-nome', nome);
    await page.click('#form-integrante button[type="submit"]');
  }

  const chips = page.locator('#lista-integrantes li.integrante-chip');
  check('2 integrantes adicionados', (await chips.count()) === 2);
  check('estado vazio de integrantes sumiu', await page.isHidden('#integrantes-vazio'));
  check('select de responsavel ganhou as 2 opcoes + sem responsavel', (await selectResp.locator('option').count()) === 3);
  check('campo de nome limpa apos adicionar', (await page.inputValue('#input-integrante-nome')) === '');

  // duplicado (case-insensitive) nao deve duplicar
  await page.fill('#input-integrante-nome', 'miguel');
  await page.click('#form-integrante button[type="submit"]');
  check('nao duplica integrante com nome repetido (case-insensitive)', (await chips.count()) === 2);

  // cria uma tarefa e atribui a um integrante via select
  await page.fill('#input-tarefa-texto', 'Fazer a introdução');
  await selectResp.selectOption('Samuel');
  await page.click('#form-tarefa button[type="submit"]');

  const itensTarefa = page.locator('#lista-tarefas li.tarefa-item');
  check('tarefa criada com responsavel escolhido no select', (await itensTarefa.nth(0).locator('.tarefa-responsavel').textContent()) === 'Samuel');

  // remove um integrante (Samuel) e confirma que a tarefa ja criada mantem o nome
  await chips.filter({ hasText: 'Samuel' }).locator('button').click();
  check('integrante removido da lista', (await chips.count()) === 1);
  check('select de responsavel perdeu a opcao Samuel', (await selectResp.locator('option', { hasText: 'Samuel' }).count()) === 0);
  check('tarefa ja criada continua mostrando Samuel como responsavel (nao eh referencia viva)', (await itensTarefa.nth(0).locator('.tarefa-responsavel').textContent()) === 'Samuel');

  // fecha e reabre - integrantes devem persistir
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');

  const cardGrupoDepois = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  await cardGrupoDepois.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  const chipsDepois = page.locator('#lista-integrantes li.integrante-chip');
  check('apos reload, integrante (Miguel) persistiu', (await chipsDepois.count()) === 1);
  check('apos reload, tarefa com responsavel persistiu', (await page.locator('#lista-tarefas li.tarefa-item .tarefa-responsavel').textContent()) === 'Samuel');

  // teclado: adicionar integrante sem mouse
  await page.focus('#input-integrante-nome');
  await page.keyboard.type('Ana');
  await page.keyboard.press('Enter');
  check('integrante adicionado via teclado', (await chipsDepois.count()) === 2);

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
