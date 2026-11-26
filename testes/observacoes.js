const { chromium } = require('playwright');
const { paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');

(async () => {
  const browser = await chromium.launch();
  const page = await paginaComFake(browser);
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
  await page.fill('#input-usuario-auth', 'teste-observacoes');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);

  const card = (t) => page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: t });
  const fechado = () => page.waitForFunction(() => !document.getElementById('dialog-trabalho').open);

  await page.click('#btn-novo-trabalho');
  check('campo de observações existe no formulário', await page.isVisible('#input-observacoes-trabalho'));
  check('campo de observações tem label', (await page.locator('label[for="input-observacoes-trabalho"]').count()) === 1);

  // sem observação: nada aparece no card
  await page.fill('#input-titulo-trabalho', 'Sem nota');
  await page.fill('#input-materia-trabalho', 'Redes');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();
  check('trabalho sem observação não mostra o bloco', (await card('Sem nota').locator('.trabalho-observacoes').count()) === 0);

  // com observação (várias linhas)
  await page.click('#btn-novo-trabalho');
  check('novo trabalho abre com observações vazias', (await page.inputValue('#input-observacoes-trabalho')) === '');
  await page.fill('#input-titulo-trabalho', 'Com nota');
  await page.fill('#input-materia-trabalho', 'Banco');
  await page.fill('#input-observacoes-trabalho', 'Entregar pelo Moodle\nem PDF');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();
  const obs = card('Com nota').locator('.trabalho-observacoes');
  check('observação aparece no card', (await obs.count()) === 1 && (await obs.textContent()).includes('Entregar pelo Moodle'));
  check('quebra de linha é preservada', (await obs.textContent()).includes('\nem PDF'));

  // editar
  await card('Com nota').locator('button:has-text("Editar")').click();
  check('editar abre com a observação preenchida', (await page.inputValue('#input-observacoes-trabalho')).startsWith('Entregar pelo Moodle'));
  await page.fill('#input-observacoes-trabalho', 'Só o link do GitHub');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();
  check('observação atualizada', (await card('Com nota').locator('.trabalho-observacoes').textContent()).includes('Só o link do GitHub'));

  // limpar
  await card('Com nota').locator('button:has-text("Editar")').click();
  await page.fill('#input-observacoes-trabalho', '   ');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();
  check('apagar a observação remove o bloco', (await card('Com nota').locator('.trabalho-observacoes').count()) === 0);

  // cancelar não salva
  await card('Sem nota').locator('button:has-text("Editar")').click();
  await page.fill('#input-observacoes-trabalho', 'não deve salvar');
  await page.click('[data-fechar-dialog]');
  check('cancelar não salva a observação', (await card('Sem nota').locator('.trabalho-observacoes').count()) === 0);

  // texto com HTML é mostrado como texto
  await card('Sem nota').locator('button:has-text("Editar")').click();
  await page.fill('#input-observacoes-trabalho', '<b>negrito</b><img src=x onerror=alert(1)>');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();
  const o2 = card('Sem nota').locator('.trabalho-observacoes');
  check('HTML digitado aparece como texto, sem virar tag', (await o2.textContent()).includes('<b>negrito</b>') && (await o2.locator('b, img').count()) === 0);

  // limite de 500
  await card('Sem nota').locator('button:has-text("Editar")').click();
  await page.fill('#input-observacoes-trabalho', 'x'.repeat(600));
  check('limite de 500 caracteres', (await page.inputValue('#input-observacoes-trabalho')).length === 500);
  await page.fill('#input-observacoes-trabalho', 'Persistir');
  await page.click('#form-trabalho button[type="submit"]');
  await fechado();

  // persiste e dados antigos
  await page.reload();
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
  check('após recarregar, observação continua', (await card('Sem nota').locator('.trabalho-observacoes').textContent()).includes('Persistir'));
  check('trabalho sem observação (campo vazio no banco) abre sem erro', (await page.locator('.trabalho-card').count()) === 2);

  console.log('--- total de checagens: ' + checks + ' ---');
  console.log('--- erros de console: ' + erros.length + ' ---');
  erros.forEach((e) => console.log('   ' + e));
  if (erros.length) process.exitCode = 1;
  await browser.close();
})();
