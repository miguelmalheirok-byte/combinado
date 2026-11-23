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
  const fonteTitulo = await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 20px "Bricolage Grotesque"')));
  check('fonte dos títulos (Bricolage Grotesque) carregada do próprio site', fonteTitulo);
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

  console.log('=== ORDEM DA LISTA ===');
  const titulos = () => page.locator('#lista-trabalhos .trabalho-titulo').allTextContents();
  let t = await titulos();
  check('lista sempre por prazo mais próximo (T4, T2, T1, T3)',
    t[0].startsWith('T4') && t[1].startsWith('T2') && t[2].startsWith('T1') && t[3].startsWith('T3'));

  console.log('=== FILTRAR POR STATUS (abas) ===');
  const aba = (st) => page.locator('#abas-status .aba-status[data-status="' + st + '"]').click();
  const contagens = await page.locator('#abas-status .aba-contagem').allTextContents();
  check('abas mostram contagem por status (4, 1, 1, 1, 1)', JSON.stringify(contagens) === JSON.stringify(['4', '1', '1', '1', '1']));
  check('aba "Todos" começa selecionada', (await page.locator('#abas-status .aba-status[data-status=""]').getAttribute('aria-pressed')) === 'true');
  await aba('pronto');
  t = await titulos();
  check('filtro "Pronto" mostra só 1 trabalho', t.length === 1 && t[0].startsWith('T2'));
  check('aba "Pronto" fica marcada e "Todos" desmarca',
    (await page.locator('#abas-status .aba-status[data-status="pronto"]').getAttribute('aria-pressed')) === 'true' &&
    (await page.locator('#abas-status .aba-status[data-status=""]').getAttribute('aria-pressed')) === 'false');
  await aba('entregue');
  t = await titulos();
  check('filtro "Entregue" mostra só 1 trabalho', t.length === 1 && t[0].startsWith('T1'));
  await aba('fazendo');
  await page.selectOption('#select-filtro-materia', 'Redes');
  check('filtros combinados sem resultado mostram aviso',
    (await page.textContent('#lista-vazia')).includes('Nenhum trabalho encontrado') && await page.isVisible('#lista-vazia'));
  await page.selectOption('#select-filtro-materia', '');
  await aba('');
  check('limpar filtros volta aos 4 trabalhos', (await titulos()).length === 4);

  console.log('=== COR DO CARD ===');
  check('card T1 azul', (await card('T1').getAttribute('data-cor')) === 'azul');
  check('card T2 sem cor não tem data-cor', (await card('T2').getAttribute('data-cor')) === null);
  const fundo = (c) => card(c).evaluate((el) => getComputedStyle(el).backgroundColor);
  check('card azul pintado de azul (#8db8ff)', (await fundo('T1')) === 'rgb(141, 184, 255)');
  check('card vermelho com cor diferente do azul', (await fundo('T3')) !== (await fundo('T1')));
  check('card vermelho pintado de #ff8a80', (await fundo('T3')) === 'rgb(255, 138, 128)');
  check('sem cor, card fica branco', (await fundo('T2')) === 'rgb(255, 255, 255)');

  console.log('=== SELO DE DATA ===');
  check('card com prazo mostra selo de data "Prazo 10/01"', (await card('T1').locator('.selo-data').textContent()) === 'Prazo 10/01');
  check('título do card não carrega mais selos', (await card('T1').locator('.trabalho-titulo').textContent()) === 'T1');

  console.log('=== PRÉVIA NO FORMULÁRIO ===');
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', 'Prévia X');
  await page.locator('.opcao-cor[data-cor="rosa"]').click();
  check('prévia mostra o título digitado', (await page.textContent('#previa-titulo')) === 'Prévia X');
  check('prévia muda para a cor escolhida', (await page.locator('#previa-trabalho').getAttribute('data-cor')) === 'rosa');
  await page.click('[data-fechar-dialog]');

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
