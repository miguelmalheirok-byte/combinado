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
  await page.fill('#input-usuario-auth', 'teste-backfill');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  // simula exatamente o cenario do usuario: um trabalho em grupo com tarefas que ja tem
  // responsavel (texto livre, como era na versao antiga), mas SEM integrantes cadastrados
  // explicitamente no array "integrantes". Isso e injetado direto no localStorage pra
  // simular dados criados antes dessa funcionalidade existir.
  await page.evaluate(() => {
    var usuarios = JSON.parse(localStorage.getItem('combinado:usuarios:v1'));
    var usuario = Object.keys(usuarios)[0];
    var chave = 'trabalhos:v1:' + usuario;
    var estado = {
      trabalhos: [
        {
          id: 'x1',
          titulo: 'teste2',
          materia: 'a2',
          prazo: '2026-11-11',
          tipo: 'grupo',
          status: 'fazendo',
          tarefas: [
            { id: 't1', texto: 'Fazer parte 1', responsavel: 'Samuel', feito: false },
            { id: 't2', texto: 'Fazer parte 2', responsavel: 'Miguel', feito: false }
          ],
          integrantes: []
        }
      ]
    };
    localStorage.setItem(chave, JSON.stringify(estado));
  });
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');

  const card = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'teste2' });
  const metaTexto = await card.locator('.trabalho-meta').textContent();
  check('card com tarefas antigas (sem integrantes explicitos) agora mostra os nomes no card', metaTexto.includes('integrantes: Samuel, Miguel'));
  check('contador de tarefas continua certo (0/2)', await card.locator('button:has-text("Tarefas (0/2)")').isVisible());

  // abre o dialogo de tarefas - os chips de integrantes devem ter sido preenchidos tambem
  await card.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  const chips = page.locator('#lista-integrantes li.integrante-chip');
  check('chips de integrantes tambem foram preenchidos (Samuel e Miguel)', (await chips.count()) === 2);
  check('select de responsavel tem as 2 opcoes + sem responsavel', (await page.locator('#input-tarefa-responsavel option').count()) === 3);

  // confirma que ficou salvo de verdade (nao so em memoria) apos reload
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  const cardDepois = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'teste2' });
  const metaDepois = await cardDepois.locator('.trabalho-meta').textContent();
  check('apos reload, o backfill persistiu de verdade no localStorage', metaDepois.includes('integrantes: Samuel, Miguel'));

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
