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
  await page.fill('#input-usuario-auth', 'teste-status-cor');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  console.log('=== LOGO ===');
  const logoCab = await page.locator('.cabecalho-logo').evaluate((img) => img.complete && img.naturalWidth > 0);
  check('logo aparece no cabeçalho', logoCab);
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  check('favicon aponta para a logo', favicon === 'img/logo.png');

  console.log('=== STATUS "PRONTO" ===');
  async function criar(titulo, materia, prazo, cor) {
    await page.click('#btn-novo-trabalho');
    await page.fill('#input-titulo-trabalho', titulo);
    await page.fill('#input-materia-trabalho', materia);
    if (prazo) await page.fill('#input-prazo-trabalho', prazo);
    if (cor) await page.locator('.opcao-cor[data-cor="' + cor + '"]').click();
    await page.click('#form-trabalho button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  }
  await criar('T1', 'Redes', '2030-01-10', 'azul');
  await criar('T2', 'Redes', '2030-01-05', '');
  await criar('T3', 'Banco', '2030-01-20', 'vermelho');
  await criar('T4', 'Banco', '2030-01-01', 'verde');

  const opcoes = await page.locator('.trabalho-card >> nth=0 >> select option').allTextContents();
  check('select de status tem 4 opções na ordem certa',
    JSON.stringify(opcoes) === JSON.stringify(['Não comecei', 'Fazendo', 'Pronto', 'Entregue']));

  const card = (t) => page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: t });
  await card('T1').locator('select').selectOption('entregue');
  await card('T2').locator('select').selectOption('pronto');
  await card('T3').locator('select').selectOption('fazendo');
  // T4 fica "Não comecei"
  check('status "pronto" gravado no card', (await card('T2').getAttribute('data-status')) === 'pronto');
  check('select do card mostra "Pronto"', (await card('T2').locator('select').inputValue()) === 'pronto');
  check('pronto não conta como entregue na barra', (await page.textContent('#progresso-texto')) === '1 de 4 trabalhos entregues');

  console.log('=== ORDENAR POR STATUS ===');
  const titulos = () => page.locator('#lista-trabalhos .trabalho-titulo').allTextContents();
  await page.selectOption('#select-ordenar', 'status');
  let t = await titulos();
  check('ordem: Não comecei, Fazendo, Pronto, Entregue',
    t[0].startsWith('T4') && t[1].startsWith('T3') && t[2].startsWith('T2') && t[3].startsWith('T1'));

  console.log('=== FILTRAR POR STATUS ===');
  await page.selectOption('#select-filtro-status', 'pronto');
  t = await titulos();
  check('filtro "Pronto" mostra só 1 trabalho', t.length === 1 && t[0].startsWith('T2'));
  await page.selectOption('#select-filtro-status', 'entregue');
  t = await titulos();
  check('filtro "Entregue" mostra só 1 trabalho', t.length === 1 && t[0].startsWith('T1'));
  await page.selectOption('#select-filtro-status', 'fazendo');
  await page.selectOption('#select-filtro-materia', 'Redes');
  check('filtros combinados sem resultado mostram aviso',
    (await page.textContent('#lista-vazia')).includes('Nenhum trabalho encontrado') && await page.isVisible('#lista-vazia'));
  await page.selectOption('#select-filtro-materia', '');
  await page.selectOption('#select-filtro-status', '');
  check('limpar filtros volta aos 4 trabalhos', (await titulos()).length === 4);

  console.log('=== COR DO CARD ===');
  check('card T1 azul', (await card('T1').getAttribute('data-cor')) === 'azul');
  check('card T2 sem cor não tem data-cor', (await card('T2').getAttribute('data-cor')) === null);
  const borda = (c) => card(c).evaluate((el) => getComputedStyle(el).borderLeftColor);
  check('cor azul aplicada na faixa', (await borda('T1')) === 'rgb(47, 111, 181)');
  check('card vermelho com faixa diferente do azul', (await borda('T3')) !== (await borda('T1')));
  check('sem cor, faixa segue o status (pronto = azul de status)', (await borda('T2')) === 'rgb(47, 111, 181)');

  // editar: cor vem marcada e pode ser trocada
  await card('T3').locator('button:has-text("Editar")').click();
  check('editar abre com a cor atual marcada', await page.locator('input[name="cor-trabalho"][value="vermelho"]').isChecked());
  await page.locator('.opcao-cor[data-cor="roxo"]').click();
  await page.click('#form-trabalho button[type="submit"]');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  check('cor trocada para roxo', (await card('T3').getAttribute('data-cor')) === 'roxo');

  // remover a cor
  await card('T3').locator('button:has-text("Editar")').click();
  await page.locator('.opcao-cor[data-cor=""]').click();
  await page.click('#form-trabalho button[type="submit"]');
  await page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);
  check('voltar para "Sem cor" remove a cor', (await card('T3').getAttribute('data-cor')) === null);

  // novo trabalho começa sem cor mesmo depois de editar um colorido
  await page.click('#btn-novo-trabalho');
  check('novo trabalho abre com "Sem cor"', await page.locator('input[name="cor-trabalho"][value=""]').isChecked());
  await page.click('[data-fechar-dialog]');

  // teclado: seletor de cor acessível
  await page.click('#btn-novo-trabalho');
  const radios = await page.locator('input[name="cor-trabalho"]').count();
  check('8 opções de cor (sem cor + 7)', radios === 8);
  const nomes = await page.locator('.opcao-cor .rotulo-oculto').allTextContents();
  check('cada cor tem nome para leitor de tela', nomes.length === 8 && nomes.every((n) => n.trim().length > 0));
  await page.click('[data-fechar-dialog]');

  console.log('=== PERSISTÊNCIA E DADOS ANTIGOS ===');
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  check('após recarregar, cor e status continuam', (await card('T1').getAttribute('data-cor')) === 'azul' && (await card('T2').getAttribute('data-status')) === 'pronto');

  // trabalho antigo, sem campo "cor", continua abrindo normalmente
  await page.evaluate(() => {
    const k = 'trabalhos:v1:teste-status-cor';
    const s = JSON.parse(localStorage.getItem(k));
    s.trabalhos.forEach((x) => { delete x.cor; });
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  check('trabalhos antigos sem cor aparecem sem erro', (await page.locator('.trabalho-card').count()) === 4 && (await card('T1').getAttribute('data-cor')) === null);

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
