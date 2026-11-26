const { chromium } = require('playwright');
const { paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');

(async () => {
  const browser = await chromium.launch();
  const erros = [];
  let checks = 0;
  function check(desc, cond) {
    checks++;
    console.log((cond ? 'OK  ' : 'FAIL') + ' - ' + desc);
    if (!cond) process.exitCode = 1;
  }
  async function novaPagina(colorScheme) {
    const ctx = await novoContexto(browser, { colorScheme, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') erros.push(msg.text()); });
    page.on('pageerror', (err) => erros.push('pageerror: ' + err.message));
    return page;
  }
  const tema = (page) => page.evaluate(() => document.documentElement.getAttribute('data-tema'));
  const fundo = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  async function entrar(page, usuario) {
    await page.goto('http://localhost:8799/');
    await page.click('#btn-auth-alternar');
    await page.fill('#input-usuario-auth', usuario);
    await page.fill('#input-senha-auth', '123456');
    await page.click('#btn-auth-principal');
    await page.waitForSelector('#app-principal:not([hidden])');
    await calmo(page);
  }

  console.log('=== PADRÃO SEGUE O APARELHO ===');
  let page = await novaPagina('light');
  await page.goto('http://localhost:8799/');
  check('aparelho claro: abre no tema claro', (await tema(page)) === 'claro');
  check('fundo claro (#f2f0ff)', (await fundo(page)) === 'rgb(242, 240, 255)');
  await page.context().close();

  page = await novaPagina('dark');
  await page.goto('http://localhost:8799/');
  check('aparelho escuro: abre no tema escuro, já na tela de login', (await tema(page)) === 'escuro');
  check('fundo escuro (#15132e) na tela de login', (await fundo(page)) === 'rgb(21, 19, 46)');
  await page.context().close();

  console.log('=== ALTERNAR E LEMBRAR ===');
  page = await novaPagina('light');
  await entrar(page, 'teste-tema');
  const botao = page.locator('#btn-tema');
  check('botão tem nome para leitor de tela', (await botao.getAttribute('aria-label')) === 'Ativar tema escuro');
  check('botão começa não pressionado', (await botao.getAttribute('aria-pressed')) === 'false');
  await botao.click();
  check('clique muda para o tema escuro', (await tema(page)) === 'escuro');
  check('fundo muda para escuro', (await fundo(page)) === 'rgb(21, 19, 46)');
  check('nome do botão passa a "Ativar tema claro"', (await botao.getAttribute('aria-label')) === 'Ativar tema claro');
  check('botão fica pressionado', (await botao.getAttribute('aria-pressed')) === 'true');

  console.log('=== CORES DOS CARDS NO TEMA ESCURO ===');
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Card azul');
  await page.fill('#input-materia-trabalho', 'Redes');
  await page.locator('.opcao-cor[data-cor="azul"]').click();
  await page.click('#form-trabalho button[type="submit"]');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Card sem cor');
  await page.fill('#input-materia-trabalho', 'Banco');
  await page.click('#form-trabalho button[type="submit"]');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  const estilo = (t, prop) => page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: t })
    .evaluate((el, p) => getComputedStyle(el)[p], prop);
  check('card azul continua azul (#8db8ff)', (await estilo('Card azul', 'backgroundColor')) === 'rgb(141, 184, 255)');
  check('texto do card azul continua escuro (legível)', (await estilo('Card azul', 'color')) === 'rgb(30, 27, 75)');
  check('card sem cor vira superfície escura', (await estilo('Card sem cor', 'backgroundColor')) === 'rgb(34, 31, 69)');
  check('texto do card sem cor fica claro', (await estilo('Card sem cor', 'color')) === 'rgb(236, 233, 255)');

  // contraste simples: luminância do texto contra o fundo, nos dois tipos de card
  const contraste = await page.evaluate(() => {
    function lum(rgb) {
      const m = rgb.match(/\d+/g).map(Number).slice(0, 3).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    }
    function razao(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    return Array.from(document.querySelectorAll('#lista-trabalhos li.trabalho-card')).map((li) => {
      const t = li.querySelector('.trabalho-titulo');
      return razao(getComputedStyle(t).color, getComputedStyle(li).backgroundColor);
    });
  });
  check('contraste do título nos cards >= 4,5 (WCAG AA)', contraste.length === 2 && contraste.every((c) => c >= 4.5));

  console.log('=== PERSISTÊNCIA ===');
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
  check('após recarregar continua escuro', (await tema(page)) === 'escuro');
  check('escolha fica salva no navegador', (await page.evaluate(() => localStorage.getItem('combinado:tema:v1'))) === 'escuro');
  await page.locator('#btn-tema').click();
  check('segundo clique volta ao claro', (await tema(page)) === 'claro' && (await fundo(page)) === 'rgb(242, 240, 255)');
  await page.context().close();

  console.log('=== ESCOLHA MANDA MAIS QUE O APARELHO ===');
  page = await novaPagina('dark');
  await entrar(page, 'teste-tema2');
  await page.locator('#btn-tema').click();
  check('aparelho escuro, mas a pessoa escolheu claro', (await tema(page)) === 'claro');
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
  check('após recarregar, a escolha (claro) vence o aparelho (escuro)', (await tema(page)) === 'claro');

  console.log('=== PÁGINA 404 ===');
  // no servidor local os caminhos /combinado/... não existem; esses avisos de arquivo não contam como erro do app
  const errosAntes = erros.length;
  await page.evaluate(() => localStorage.setItem('combinado:tema:v1', 'escuro'));
  await page.goto('http://localhost:8799/404.html');
  check('404 também segue o tema salvo', (await tema(page)) === 'escuro');
  erros.length = errosAntes;
  await page.context().close();

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
