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
  await page.fill('#input-usuario-auth', 'teste-progresso');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  check('progresso escondido com lista vazia', await page.isHidden('#progresso-trabalhos'));

  async function criarTrabalho(titulo) {
    await page.click('#btn-novo-trabalho');
    await page.fill('#input-titulo-trabalho', titulo);
    await page.fill('#input-materia-trabalho', 'Materia Teste');
    await page.click('#dialog-trabalho button[type="submit"]');
  }

  await criarTrabalho('Trabalho 1');
  check('progresso aparece com 1 trabalho', await page.isVisible('#progresso-trabalhos'));
  check('texto inicial "0 de 1 trabalho entregue"', (await page.textContent('#progresso-texto')) === '0 de 1 trabalho entregue');
  check('barra em 0%', (await page.getAttribute('#progresso-barra', 'aria-valuenow')) === '0');

  await criarTrabalho('Trabalho 2');
  await criarTrabalho('Trabalho 3');
  await criarTrabalho('Trabalho 4');
  check('texto com 4 trabalhos, nenhum entregue', (await page.textContent('#progresso-texto')) === '0 de 4 trabalhos entregues');

  // marca 1 como entregue (25%)
  const card1 = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Trabalho 1' });
  await card1.locator('select').selectOption('entregue');
  check('texto atualiza pra "1 de 4 trabalhos entregues"', (await page.textContent('#progresso-texto')) === '1 de 4 trabalhos entregues');
  check('barra em 25%', (await page.getAttribute('#progresso-barra', 'aria-valuenow')) === '25');

  // marca mais 3 (100%)
  for (const titulo of ['Trabalho 2', 'Trabalho 3', 'Trabalho 4']) {
    const card = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: titulo });
    await card.locator('select').selectOption('entregue');
  }
  check('texto em 100%: "4 de 4 trabalhos entregues"', (await page.textContent('#progresso-texto')) === '4 de 4 trabalhos entregues');
  check('barra em 100%', (await page.getAttribute('#progresso-barra', 'aria-valuenow')) === '100');

  // exclui todos - progresso deve sumir de novo
  for (const titulo of ['Trabalho 1', 'Trabalho 2', 'Trabalho 3', 'Trabalho 4']) {
    const card = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: titulo });
    await card.locator('button:has-text("Excluir")').click();
    await page.waitForSelector('#dialog-confirmar[open]');
    await page.click('#btn-confirmar-exclusao');
  }
  check('progresso some de novo com lista vazia', await page.isHidden('#progresso-trabalhos'));

  // reload com 1 trabalho entregue - persistencia
  await criarTrabalho('Trabalho Final');
  const cardFinal = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Trabalho Final' });
  await cardFinal.locator('select').selectOption('entregue');
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  check('apos reload, progresso persiste em 100%', (await page.textContent('#progresso-texto')) === '1 de 1 trabalho entregue');

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
