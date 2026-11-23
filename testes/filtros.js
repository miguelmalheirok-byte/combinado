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
  await page.fill('#input-usuario-auth', 'teste-filtros');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');

  check('barra de filtros escondida com lista vazia', await page.isHidden('#filtros-barra'));

  async function criarTrabalho(titulo, materia, prazo) {
    await page.click('#btn-novo-trabalho');
    await page.fill('#input-titulo-trabalho', titulo);
    await page.fill('#input-materia-trabalho', materia);
    if (prazo) await page.fill('#input-prazo-trabalho', prazo);
    await page.click('#dialog-trabalho button[type="submit"]');
  }

  // cria em ordem proposital: sem prazo, prazo distante, prazo proximo, outra materia
  await criarTrabalho('Trabalho C (sem prazo)', 'Matematica', '');
  await criarTrabalho('Trabalho A (prazo distante)', 'Sistemas Distribuidos', '2027-03-01');
  await criarTrabalho('Trabalho B (prazo proximo)', 'Sistemas Distribuidos', '2026-12-01');
  await criarTrabalho('Trabalho D (outra materia)', 'Redes', '2026-11-20');

  check('barra de filtros aparece com trabalhos', await page.isVisible('#filtros-barra'));

  function titulosNaTela() {
    return page.locator('#lista-trabalhos li.trabalho-card .trabalho-titulo').allTextContents();
  }

  // ordenacao padrao: prazo mais proximo primeiro, sem prazo por ultimo
  let titulos = await titulosNaTela();
  check('ordem padrao por prazo (proximo primeiro, sem prazo por ultimo)',
    titulos[0].startsWith('Trabalho D') &&
    titulos[1].startsWith('Trabalho B') &&
    titulos[2].startsWith('Trabalho A') &&
    titulos[3].startsWith('Trabalho C')
  );

  // o seletor "Ordenar por" foi removido: a lista fica sempre por prazo
  check('nao existe mais o seletor "Ordenar por"', (await page.locator('#select-ordenar').count()) === 0);

  // filtro por materia
  const opcoesMateria = await page.locator('#select-filtro-materia option').allTextContents();
  check('select de materia tem as 3 materias + todas', opcoesMateria.length === 4 && opcoesMateria.includes('Todas as matérias'));

  await page.selectOption('#select-filtro-materia', 'Sistemas Distribuidos');
  titulos = await titulosNaTela();
  check('filtro por materia mostra so os 2 da materia escolhida', titulos.length === 2 && titulos.every((t) => t.includes('Trabalho A') || t.includes('Trabalho B')));

  // filtro por materia sem nenhum resultado (ao excluir os trabalhos dessa materia depois) - testamos mensagem generica trocando pra materia que nao existe mais depois
  await page.selectOption('#select-filtro-materia', '');
  titulos = await titulosNaTela();
  check('voltando pra "todas as materias" mostra os 4 de novo', titulos.length === 4);

  // exclui os 2 trabalhos de "Sistemas Distribuidos" e confere que a materia some do filtro
  for (const tituloAlvo of ['Trabalho A', 'Trabalho B']) {
    const card = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: tituloAlvo });
    await card.locator('button:has-text("Excluir")').click();
    await page.waitForSelector('#dialog-confirmar[open]');
    await page.click('#btn-confirmar-exclusao');
  }
  const opcoesMateriaDepois = await page.locator('#select-filtro-materia option').allTextContents();
  check('materia sem nenhum trabalho some da lista de filtro', !opcoesMateriaDepois.includes('Sistemas Distribuidos'));

  // reload: preferencia de ordenacao/filtro nao precisa persistir, mas trabalhos restantes sim
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  titulos = await titulosNaTela();
  check('apos reload, restam os 2 trabalhos nao excluidos', titulos.length === 2);

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));

  await browser.close();
})();
