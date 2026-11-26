const { chromium } = require('playwright');
const { convidar, paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');

(async () => {
  const browser = await chromium.launch();
  const page = await paginaComFake(browser);
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

  // cadastro de um novo usuário de teste
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'teste-tarefas');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
  check('login/cadastro ok', await page.isHidden('#tela-auth'));

  // cria um trabalho individual (não deve ter botão Tarefas)
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Prova de SO');
  await page.fill('#input-materia-trabalho', 'Sistemas Operacionais');
  await page.click('#dialog-trabalho button[type="submit"]');
  await page.waitForSelector('#lista-trabalhos li');

  // cria um trabalho em grupo (deve ter botão Tarefas)
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Projeto A3');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#dialog-trabalho button[type="submit"]');

  const cards = page.locator('#lista-trabalhos li.trabalho-card');
  check('2 trabalhos criados', (await cards.count()) === 2);

  const cardIndividual = cards.filter({ hasText: 'Prova de SO' });
  const cardGrupo = cards.filter({ hasText: 'Projeto A3' });

  check('trabalho individual NAO tem botao Tarefas', (await cardIndividual.locator('button:has-text("Tarefas")').count()) === 0);
  check('trabalho em grupo TEM botao Tarefas (0/0)', await cardGrupo.locator('button:has-text("Tarefas (0/0)")').isVisible());

  // abre o diálogo de tarefas do trabalho em grupo
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  check('dialogo de tarefas abriu com titulo certo', (await page.textContent('#dialog-tarefas-titulo')).includes('Projeto A3'));
  check('lista de tarefas comeca vazia', await page.isVisible('#tarefas-vazio'));

  // cadastra os integrantes do grupo primeiro (campo responsavel agora é lista suspensa)
  for (const nome of ['Miguel', 'Samuel']) {
    await convidar(page, nome);
  }

  // adiciona 3 tarefas
  const tarefas = [
    { texto: 'Fazer a introdução', responsavel: 'Miguel' },
    { texto: 'Montar os slides', responsavel: 'Samuel' },
    { texto: 'Revisar o texto final', responsavel: '' }
  ];
  for (const t of tarefas) {
    await page.fill('#input-tarefa-texto', t.texto);
    await page.selectOption('#input-tarefa-responsavel', t.responsavel ? { label: t.responsavel } : '');
    await page.click('#form-tarefa button[type="submit"]');
  }

  const itensTarefa = page.locator('#lista-tarefas li.tarefa-item');
  check('3 tarefas adicionadas', (await itensTarefa.count()) === 3);
  check('estado vazio sumiu', await page.isHidden('#tarefas-vazio'));
  check('campo de texto limpa apos adicionar', (await page.inputValue('#input-tarefa-texto')) === '');
  check('responsavel aparece na tarefa', (await itensTarefa.nth(0).locator('.tarefa-responsavel').textContent()) === 'Miguel');
  check('tarefa sem responsavel nao mostra selo', (await itensTarefa.nth(2).locator('.tarefa-responsavel').count()) === 0);

  // marca uma tarefa como feita
  await itensTarefa.nth(0).locator('input[type="checkbox"]').check();
  check('tarefa marcada ganha classe tarefa-feita', (await itensTarefa.nth(0).getAttribute('class')).includes('tarefa-feita'));

  // fecha o dialogo e confere o contador no card
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);
  check('contador do card atualizou para 1/3', await cardGrupo.locator('button:has-text("Tarefas (1/3)")').isVisible());

  // reabre, exclui uma tarefa
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  await itensTarefa.nth(2).locator('.tarefa-excluir').click();
  await page.click('#btn-confirmar-exclusao');
  check('tarefa excluida, restam 2', (await itensTarefa.count()) === 2);
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);
  check('contador atualizou para 1/2 apos exclusao', await cardGrupo.locator('button:has-text("Tarefas (1/2)")').isVisible());

  // reload: confirma persistencia no localStorage
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
  const cardsDepois = page.locator('#lista-trabalhos li.trabalho-card');
  const cardGrupoDepois = cardsDepois.filter({ hasText: 'Projeto A3' });
  check('apos reload, contador de tarefas persistiu (1/2)', await cardGrupoDepois.locator('button:has-text("Tarefas (1/2)")').isVisible());

  await cardGrupoDepois.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  const itensDepois = page.locator('#lista-tarefas li.tarefa-item');
  check('apos reload, 2 tarefas continuam na lista', (await itensDepois.count()) === 2);
  check('apos reload, a tarefa feita continua marcada', (await itensDepois.nth(0).getAttribute('class')).includes('tarefa-feita'));
  await page.click('#dialog-tarefas [data-fechar-tarefas]');

  // edita o trabalho em grupo para individual - botao tarefas deve sumir, mas dados ficam guardados
  await cardGrupoDepois.locator('button:has-text("Editar")').click();
  await page.waitForSelector('#dialog-trabalho[open]');
  await page.click('input[name="tipo-trabalho"][value="individual"]');
  await page.click('#dialog-trabalho button[type="submit"]');
  const cardVirouIndividual = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  check('ao editar para individual, botao Tarefas some', (await cardVirouIndividual.locator('button:has-text("Tarefas")').count()) === 0);

  // volta pra grupo e confirma que as tarefas antigas nao se perderam
  await cardVirouIndividual.locator('button:has-text("Editar")').click();
  await page.waitForSelector('#dialog-trabalho[open]');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#dialog-trabalho button[type="submit"]');
  const cardVoltouGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  check('ao voltar pra grupo, tarefas antigas continuam (1/2)', await cardVoltouGrupo.locator('button:has-text("Tarefas (1/2)")').isVisible());

  // teclado: testar sem mouse (tab + enter) no formulario de tarefa
  await cardVoltouGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  await page.focus('#input-tarefa-texto');
  await page.keyboard.type('Tarefa via teclado');
  await page.selectOption('#input-tarefa-responsavel', 'Samuel');
  await page.click('#form-tarefa button[type="submit"]');
  const itensTeclado = page.locator('#lista-tarefas li.tarefa-item');
  check('tarefa adicionada via teclado + select (sem mouse no texto)', (await itensTeclado.count()) === 3);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
