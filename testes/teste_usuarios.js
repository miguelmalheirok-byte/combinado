// Confere as melhorias feitas a partir do teste com 3 usuários (17 a 23/11/2026):
// 1) dica e destaque para dividir tarefas em trabalho em grupo
// 2) filtro por matéria mais fácil de achar
// 3) rótulos do formulário (nome do trabalho x matéria) e botão de salvar sempre visível no celular
// 4) reteste de 24/11: aviso para cadastrar integrantes antes de escolher o responsável da tarefa
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 560 } });
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
  await page.fill('#input-usuario-auth', 'teste-usuarios');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  console.log('=== FORMULÁRIO: RÓTULOS E BOTÃO SALVAR ===');
  await page.click('#btn-novo-trabalho');
  check('campo do nome do trabalho tem rótulo "Nome do trabalho"',
    (await page.textContent('label[for="input-titulo-trabalho"]')).trim() === 'Nome do trabalho');
  check('campo de matéria deixa claro que é a disciplina',
    (await page.textContent('label[for="input-materia-trabalho"]')).includes('disciplina'));
  const salvar = page.locator('#form-trabalho button[type="submit"]');
  const cabeNaTela = async () => {
    const box = await salvar.boundingBox();
    return box && box.y >= 0 && box.y + box.height <= 560;
  };
  check('em tela de celular baixa (360x560), "Salvar trabalho" já aparece sem rolar', await cabeNaTela());
  await page.locator('.opcao-cor[data-cor="roxo"]').scrollIntoViewIfNeeded();
  check('continua visível depois de rolar o formulário', await cabeNaTela());
  await page.fill('#input-titulo-trabalho', 'Projeto A3');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.locator('.opcao-tipo:has-text("Em grupo")').click();
  await salvar.click();
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);

  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Prova individual');
  await page.fill('#input-materia-trabalho', 'Banco de Dados');
  await salvar.click();
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);

  console.log('=== TRABALHO EM GRUPO: PRÓXIMO PASSO FICA ÓBVIO ===');
  const cardGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  const cardInd = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Prova individual' });
  check('grupo sem tarefas mostra a dica de próximo passo', await cardGrupo.locator('.trabalho-dica').isVisible());
  check('a dica manda tocar em Tarefas', (await cardGrupo.locator('.trabalho-dica').textContent()).includes('Tarefas'));
  check('botão Tarefas fica em destaque', (await cardGrupo.locator('.botao-tarefas-destaque').count()) === 1);
  check('trabalho individual não mostra a dica', (await cardInd.locator('.trabalho-dica').count()) === 0);

  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.fill('#input-tarefa-texto', 'Fazer a introdução');
  await page.click('#form-tarefa button[type="submit"]');
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  check('depois da primeira tarefa a dica some', (await cardGrupo.locator('.trabalho-dica').count()) === 0);
  check('e o botão deixa de ficar em destaque', (await cardGrupo.locator('.botao-tarefas-destaque').count()) === 0);
  check('contador de tarefas continua no botão (0/1)', await cardGrupo.locator('button:has-text("Tarefas (0/1)")').isVisible());

  console.log('=== FILTRO POR MATÉRIA MAIS FÁCIL DE ACHAR ===');
  check('rótulo do filtro diz "Filtrar por matéria"',
    (await page.textContent('label[for="select-filtro-materia"]')).replace(/\s+/g, ' ').trim() === 'Filtrar por matéria');
  check('rótulo do filtro tem ícone de funil', (await page.locator('label[for="select-filtro-materia"] svg').count()) === 1);
  await page.selectOption('#select-filtro-materia', 'Sistemas Distribuídos');
  const titulos = await page.locator('#lista-trabalhos .trabalho-titulo').allTextContents();
  check('filtrar por matéria continua funcionando', titulos.length === 1 && titulos[0] === 'Projeto A3');

  console.log('=== RETESTE: AVISO DE INTEGRANTES ANTES DO RESPONSÁVEL ===');
  await page.selectOption('#select-filtro-materia', '');
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  check('grupo sem integrantes mostra o aviso ao lado do campo Responsável', await page.isVisible('#aviso-responsavel'));
  check('o aviso fala em cadastrar os integrantes', (await page.textContent('#aviso-responsavel')).includes('cadastre antes os integrantes'));
  check('o campo Responsável aponta para o aviso (leitor de tela)', (await page.getAttribute('#input-tarefa-responsavel', 'aria-describedby')) === 'aviso-responsavel');
  check('texto de "nenhum integrante" explica a ordem', (await page.textContent('#integrantes-vazio')).includes('depois escolha o responsável'));
  await page.click('#btn-ir-integrantes');
  check('botão "Cadastrar integrantes" leva o foco ao campo do nome', await page.evaluate(() => document.activeElement && document.activeElement.id === 'input-integrante-nome'));
  await page.fill('#input-integrante-nome', 'Miguel');
  await page.click('#form-integrante button');
  check('depois de cadastrar um integrante o aviso some', await page.isHidden('#aviso-responsavel'));
  check('e o integrante aparece como opção de responsável', (await page.locator('#input-tarefa-responsavel option').allTextContents()).includes('Miguel'));
  await page.locator('#lista-integrantes li.integrante-chip').filter({ hasText: 'Miguel' }).locator('button').click();
  check('removendo o último integrante o aviso volta', await page.isVisible('#aviso-responsavel'));
  await page.click('#dialog-tarefas [data-fechar-tarefas]');

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
