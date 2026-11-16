const { chromium } = require('playwright');

function isoComOffset(diasOffset) {
  var d = new Date();
  d.setDate(d.getDate() + diasOffset);
  var ano = d.getFullYear();
  var mes = String(d.getMonth() + 1).padStart(2, '0');
  var dia = String(d.getDate()).padStart(2, '0');
  return ano + '-' + mes + '-' + dia;
}

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
  await page.fill('#input-usuario-auth', 'teste-lembrete');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  async function criarTrabalho(titulo, prazoOffset) {
    await page.click('#btn-novo-trabalho');
    await page.fill('#input-titulo-trabalho', titulo);
    await page.fill('#input-materia-trabalho', 'Materia Teste');
    if (prazoOffset !== null) await page.fill('#input-prazo-trabalho', isoComOffset(prazoOffset));
    await page.click('#dialog-trabalho button[type="submit"]');
  }

  await criarTrabalho('Trabalho Atrasado', -2);
  await criarTrabalho('Trabalho Hoje', 0);
  await criarTrabalho('Trabalho Amanha', 1);
  await criarTrabalho('Trabalho Proximo3', 3);
  await criarTrabalho('Trabalho Distante', 10);
  await criarTrabalho('Trabalho SemPrazo', null);

  function badgeDoCard(titulo) {
    return page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: titulo }).locator('.selo-prazo');
  }

  check('atrasado mostra badge "Atrasado"', (await badgeDoCard('Trabalho Atrasado').textContent()) === 'Atrasado');
  check('badge atrasado tem a classe de perigo', (await badgeDoCard('Trabalho Atrasado').getAttribute('class')).includes('selo-prazo-atrasado'));
  check('hoje mostra badge "Vence hoje"', (await badgeDoCard('Trabalho Hoje').textContent()) === 'Vence hoje');
  check('amanha mostra badge "Vence amanhã"', (await badgeDoCard('Trabalho Amanha').textContent()) === 'Vence amanhã');
  check('3 dias mostra badge "Vence em 3 dias"', (await badgeDoCard('Trabalho Proximo3').textContent()) === 'Vence em 3 dias');
  check('prazo distante (10 dias) nao mostra badge', (await badgeDoCard('Trabalho Distante').count()) === 0);
  check('sem prazo nao mostra badge', (await badgeDoCard('Trabalho SemPrazo').count()) === 0);

  // marca o atrasado como entregue - badge deve sumir
  const cardAtrasado = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Trabalho Atrasado' });
  await cardAtrasado.locator('select').selectOption('entregue');
  check('ao marcar como entregue, badge de atraso some', (await badgeDoCard('Trabalho Atrasado').count()) === 0);

  // volta pra nao comecei - badge deve voltar
  await cardAtrasado.locator('select').selectOption('nao-comecei');
  check('ao voltar status, badge de atraso reaparece', (await badgeDoCard('Trabalho Atrasado').count()) === 1);

  // reload: badges recalculados, nao gravados como string fixa
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  check('apos reload, badge "Atrasado" continua correto', (await badgeDoCard('Trabalho Atrasado').textContent()) === 'Atrasado');
  check('apos reload, badge "Vence hoje" continua correto', (await badgeDoCard('Trabalho Hoje').textContent()) === 'Vence hoje');

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
