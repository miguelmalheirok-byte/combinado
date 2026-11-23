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
  await page.fill('#input-usuario-auth', 'teste-tarefas-status');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  async function criarGrupo(titulo) {
    await page.click('#btn-novo-trabalho');
    await page.fill('#input-titulo-trabalho', titulo);
    await page.fill('#input-materia-trabalho', 'Redes');
    await page.click('input[name="tipo-trabalho"][value="grupo"]');
    await page.click('#dialog-trabalho button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  }
  const card = (t) => page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: t });
  const status = (t) => card(t).getAttribute('data-status');
  async function abrirTarefas(t) {
    await card(t).locator('button:has-text("Tarefas")').click();
    await page.waitForSelector('#dialog-tarefas[open]');
  }
  async function fecharTarefas() {
    await page.click('[data-fechar-tarefas]');
    await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);
  }
  async function addTarefa(texto) {
    await page.fill('#input-tarefa-texto', texto);
    await page.click('#form-tarefa button[type="submit"]');
  }
  const marcar = (i) => page.locator('#lista-tarefas .tarefa-item input[type="checkbox"]').nth(i);

  await criarGrupo('Projeto A');
  await abrirTarefas('Projeto A');
  await addTarefa('Introdução');
  await addTarefa('Conclusão');
  check('sem tarefas concluídas, status continua "Não comecei"', (await status('Projeto A')) === 'nao-comecei');

  await marcar(0).check();
  check('uma de duas concluída: não muda para pronto', (await status('Projeto A')) === 'nao-comecei');
  await marcar(1).check();
  check('todas concluídas: vai para "Pronto"', (await status('Projeto A')) === 'pronto');
  check('select do card mostra "Pronto"', (await card('Projeto A').locator('select').inputValue()) === 'pronto');

  // reabrir uma tarefa desfaz o pronto automático
  await marcar(1).uncheck();
  check('reabrir uma tarefa volta para "Fazendo"', (await status('Projeto A')) === 'fazendo');
  await marcar(1).check();
  check('concluir de novo volta para "Pronto"', (await status('Projeto A')) === 'pronto');

  // nova tarefa também desfaz
  await addTarefa('Revisão');
  check('adicionar tarefa nova volta para "Fazendo"', (await status('Projeto A')) === 'fazendo');
  // excluir a pendente conclui o conjunto
  await page.locator('#lista-tarefas .tarefa-item').nth(2).locator('button:has-text("Excluir")').click();
  check('excluir a única pendente leva para "Pronto"', (await status('Projeto A')) === 'pronto');
  await fecharTarefas();

  // entregue nunca é mexido pelas tarefas
  await card('Projeto A').locator('select').selectOption('entregue');
  await abrirTarefas('Projeto A');
  await marcar(0).uncheck();
  check('trabalho "Entregue" não é alterado pelas tarefas', (await status('Projeto A')) === 'entregue');
  await marcar(0).check();
  await fecharTarefas();

  // "Pronto" marcado à mão não é desfeito
  await criarGrupo('Projeto B');
  await card('Projeto B').locator('select').selectOption('pronto');
  await abrirTarefas('Projeto B');
  await addTarefa('Tarefa única');
  check('"Pronto" marcado à mão não é desfeito ao adicionar tarefa', (await status('Projeto B')) === 'pronto');
  await fecharTarefas();

  // sem tarefas nunca vira pronto sozinho
  await criarGrupo('Projeto C');
  check('grupo sem tarefas continua "Não comecei"', (await status('Projeto C')) === 'nao-comecei');

  // um já em "Fazendo" também vai para pronto
  await card('Projeto C').locator('select').selectOption('fazendo');
  await abrirTarefas('Projeto C');
  await addTarefa('Única');
  await marcar(0).check();
  check('de "Fazendo" também vai para "Pronto"', (await status('Projeto C')) === 'pronto');
  await fecharTarefas();

  // persiste
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  check('após recarregar, status "Pronto" continua', (await status('Projeto C')) === 'pronto');

  // filtro e progresso coerentes
  check('pronto não conta como entregue', (await page.textContent('#progresso-texto')) === '1 de 3 trabalhos entregues');

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
