const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  page.on('console', msg => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('pageerror', err => erros.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:8799/index.html');
  await page.waitForTimeout(150);

  // cria conta e entra
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);

  console.log('--- cria trabalho ---');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  await page.fill('#input-titulo-trabalho', 'Relatório original');
  await page.fill('#input-materia-trabalho', 'Usabilidade');
  await page.fill('#input-prazo-trabalho', '2026-12-01');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  console.log('titulo criado:', await page.locator('.trabalho-titulo').first().textContent());

  console.log('--- abre editar: campos vêm preenchidos ---');
  await page.locator('.trabalho-card >> nth=0 >> text=Editar').click();
  await page.waitForTimeout(150);
  console.log('dialog titulo:', await page.locator('#dialog-trabalho-titulo').textContent());
  console.log('input titulo preenchido:', await page.inputValue('#input-titulo-trabalho'));
  console.log('input materia preenchido:', await page.inputValue('#input-materia-trabalho'));
  console.log('input prazo preenchido:', await page.inputValue('#input-prazo-trabalho'));
  console.log('tipo individual marcado:', await page.isChecked('input[name="tipo-trabalho"][value="individual"]'));

  console.log('--- muda título, matéria, tipo e salva ---');
  await page.fill('#input-titulo-trabalho', 'Relatório final A3 (editado)');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  console.log('total trabalhos (não duplicou):', await page.locator('.trabalho-card').count());
  console.log('titulo atualizado:', await page.locator('.trabalho-titulo').first().textContent());
  console.log('meta atualizada:', await page.locator('.trabalho-meta').first().textContent());
  console.log('selo tipo atualizado:', await page.locator('.selo-tipo').first().textContent());

  console.log('--- status não foi perdido na edição ---');
  await page.selectOption('.trabalho-card >> nth=0 >> select', 'fazendo');
  await page.waitForTimeout(100);
  await page.locator('.trabalho-card >> nth=0 >> text=Editar').click();
  await page.waitForTimeout(100);
  await page.click('#form-trabalho button[type=submit]'); // salva sem mudar nada
  await page.waitForTimeout(100);
  console.log('status continua fazendo:', await page.locator('.trabalho-card').first().getAttribute('data-status'));

  console.log('--- cancelar edição não aplica mudança ---');
  await page.locator('.trabalho-card >> nth=0 >> text=Editar').click();
  await page.waitForTimeout(100);
  await page.fill('#input-titulo-trabalho', 'Isso não deveria salvar');
  await page.click('[data-fechar-dialog]');
  await page.waitForTimeout(100);
  console.log('titulo não mudou (cancelar funcionou):', await page.locator('.trabalho-titulo').first().textContent());

  console.log('--- depois de cancelar edição, abrir "novo trabalho" não fica em modo edição ---');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  console.log('dialog titulo (deve ser Novo trabalho):', await page.locator('#dialog-trabalho-titulo').textContent());
  console.log('campo titulo vazio:', (await page.inputValue('#input-titulo-trabalho')) === '');
  await page.fill('#input-titulo-trabalho', 'Segundo trabalho');
  await page.fill('#input-materia-trabalho', 'Mobile e Jogos');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(100);
  console.log('total trabalhos agora (deve ser 2, não sobrescreveu o primeiro):', await page.locator('.trabalho-card').count());

  console.log('--- persiste depois de reload ---');
  await page.reload();
  await page.waitForTimeout(200);
  console.log('total apos reload:', await page.locator('.trabalho-card').count());
  console.log('titulo do primeiro apos reload:', await page.locator('.trabalho-titulo').first().textContent());

  console.log('--- erros de console ---');
  console.log(erros);

  await browser.close();
})();
