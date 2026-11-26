// Confere as melhorias feitas a partir do teste com 3 usuários (17 a 23/11/2026):
// 1) dica e destaque para dividir tarefas em trabalho em grupo
// 2) filtro por matéria mais fácil de achar
// 3) rótulos do formulário (nome do trabalho x matéria) e botão de salvar sempre visível no celular
// 4) reteste de 24/11: aviso para cadastrar integrantes antes de escolher o responsável da tarefa
const { chromium } = require('playwright');
const { convidar, paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');

(async () => {
  const browser = await chromium.launch();
  const page = await paginaComFake(browser, { viewport: { width: 360, height: 560 } });
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
  await calmo(page);

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

  console.log('=== RETESTE: RESPONSÁVEL SÓ COM QUEM ESTÁ NO GRUPO (agora são contas, convidadas pelo código) ===');
  await page.selectOption('#select-filtro-materia', '');
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await calmo(page);
  check('o campo Responsável só oferece quem está no grupo (no começo, só o dono)', (await page.locator('#input-tarefa-responsavel option').count()) === 2);
  check('não existe mais o aviso para "cadastrar integrantes" (não há mais cadastro à mão)', (await page.locator('#aviso-responsavel').count()) === 0);
  check('o código do grupo aparece com explicação de como passar aos colegas', (await page.textContent('.codigo-grupo-dica')).includes('Entrar com código'));
  await convidar(page, 'Miguel');
  check('depois que um colega entra, ele aparece como opção de responsável', (await page.locator('#input-tarefa-responsavel option').allTextContents()).includes('Miguel'));
  await page.click('#dialog-tarefas [data-fechar-tarefas]');

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
