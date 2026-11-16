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
  await page.fill('#input-usuario-auth', 'teste-integrantes-card');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  // trabalho individual: nunca deve mostrar "integrantes" na meta
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Prova Individual');
  await page.fill('#input-materia-trabalho', 'Calculo');
  await page.click('#dialog-trabalho button[type="submit"]');

  // trabalho em grupo, ainda sem integrantes cadastrados
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Projeto A3');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#dialog-trabalho button[type="submit"]');

  const cardIndividual = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Prova Individual' });
  const cardGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });

  check('individual nunca mostra "integrantes" na meta', !(await cardIndividual.locator('.trabalho-meta').textContent()).includes('integrantes'));
  check('grupo sem integrantes nao mostra "integrantes" na meta ainda', !(await cardGrupo.locator('.trabalho-meta').textContent()).includes('integrantes'));

  // adiciona integrantes pelo dialogo de tarefas
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  for (const nome of ['Miguel', 'Samuel']) {
    await page.fill('#input-integrante-nome', nome);
    await page.click('#form-integrante button[type="submit"]');
  }
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);

  const metaGrupo = await cardGrupo.locator('.trabalho-meta').textContent();
  check('card do grupo agora mostra os integrantes direto na tela principal', metaGrupo.includes('integrantes: Miguel, Samuel'));

  // remove um integrante e confere que a meta do card atualiza
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  await page.locator('#lista-integrantes li.integrante-chip').filter({ hasText: 'Samuel' }).locator('button').click();
  await page.click('#dialog-tarefas [data-fechar-tarefas]');
  await page.waitForFunction(() => !document.getElementById('dialog-tarefas').open);
  const metaGrupoDepois = await cardGrupo.locator('.trabalho-meta').textContent();
  check('ao remover integrante, a meta do card atualiza (so Miguel)', metaGrupoDepois.includes('integrantes: Miguel') && !metaGrupoDepois.includes('Samuel'));

  // reload: integrantes no card devem persistir
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  const cardGrupoReload = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  const metaReload = await cardGrupoReload.locator('.trabalho-meta').textContent();
  check('apos reload, integrantes continuam visiveis no card', metaReload.includes('integrantes: Miguel'));

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
