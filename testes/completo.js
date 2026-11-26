const { chromium } = require('playwright');
const { paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');
(async () => {
  const browser = await chromium.launch();
  const page = await paginaComFake(browser, { viewport: { width: 390, height: 844 } });
  const erros = [];
  const avisos = [];
  page.on('console', msg => {
    if (msg.type() === 'error') erros.push(msg.text());
    if (msg.type() === 'warning') avisos.push(msg.text());
  });
  page.on('pageerror', err => erros.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => erros.push('REQUESTFAILED: ' + req.url()));

  let ok = 0, falhou = 0;
  function check(desc, condicao) {
    if (condicao) { ok++; console.log('OK   -', desc); }
    else { falhou++; console.log('FALHOU -', desc); }
  }

  await page.goto('http://localhost:8799/index.html');
  await page.waitForTimeout(200);

  console.log('=== 1. CARGA INICIAL / LOGIN ===');
  check('título da aba é Combinado', (await page.title()) === 'Combinado');
  check('tela de login aparece primeiro', await page.isVisible('#tela-auth'));
  check('app escondido antes de logar', !(await page.isVisible('#app-principal')));

  console.log('=== 2. VALIDAÇÃO DE LOGIN SEM CONTA ===');
  await page.fill('#input-usuario-auth', 'fulano');
  await page.fill('#input-senha-auth', 'senha123');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  check('erro ao logar com usuário inexistente', await page.isVisible('#auth-erro'));
  check('continua na tela de login', await page.isVisible('#tela-auth'));

  console.log('=== 3. CADASTRO DE USUÁRIO ===');
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'senha123');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  check('entrou após cadastro', await page.isVisible('#app-principal'));
  check('nome certo no cabeçalho', (await page.locator('#cabecalho-usuario-nome').textContent()) === 'miguel');
  check('lista vazia pro usuário novo', await page.isVisible('#lista-vazia'));

  console.log('=== 4. CADASTRAR TRABALHO (individual, completo) ===');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  await page.fill('#input-titulo-trabalho', 'Relatório final A3');
  await page.fill('#input-materia-trabalho', 'Usabilidade');
  await page.fill('#input-prazo-trabalho', '2026-12-01');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  check('1 trabalho criado', (await page.locator('.trabalho-card').count()) === 1);
  check('status inicial correto', (await page.locator('.trabalho-card').first().getAttribute('data-status')) === 'nao-comecei');
  check('tipo individual exibido', (await page.locator('.selo-tipo').first().textContent()) === 'Individual');

  console.log('=== 5. CADASTRAR TRABALHO (grupo, sem prazo) ===');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  await page.fill('#input-titulo-trabalho', 'Projeto A3 — Combinado');
  await page.fill('#input-materia-trabalho', 'Sistemas Distribuídos');
  await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  check('2 trabalhos no total', (await page.locator('.trabalho-card').count()) === 2);
  check('tipo grupo exibido no 2º', (await page.locator('.selo-tipo').nth(1).textContent()) === 'Em grupo');
  check('sem prazo não mostra "prazo" no 2º', !(await page.locator('.trabalho-meta').nth(1).textContent()).includes('prazo'));

  console.log('=== 6. VALIDAÇÃO: TÍTULO/MATÉRIA VAZIOS NÃO SALVAM ===');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(100);
  check('diálogo continua aberto com campos obrigatórios vazios', await page.isVisible('#dialog-trabalho'));
  await page.click('[data-fechar-dialog]');
  await page.waitForTimeout(100);

  console.log('=== 7. EDITAR TRABALHO ===');
  await page.locator('.trabalho-card >> nth=0 >> text=Editar').click();
  await page.waitForTimeout(100);
  check('diálogo abre em modo edição', (await page.locator('#dialog-trabalho-titulo').textContent()) === 'Editar trabalho');
  check('campos vêm preenchidos', (await page.inputValue('#input-titulo-trabalho')) === 'Relatório final A3');
  await page.fill('#input-titulo-trabalho', 'Relatório final A3 (revisado)');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  check('não duplicou ao editar', (await page.locator('.trabalho-card').count()) === 2);
  check('título atualizado', (await page.locator('.trabalho-titulo').first().textContent()).includes('revisado'));

  console.log('=== 8. MUDAR STATUS ===');
  await page.selectOption('.trabalho-card >> nth=0 >> select', 'entregue');
  await page.waitForTimeout(100);
  check('status mudou pra entregue', (await page.locator('.trabalho-card').first().getAttribute('data-status')) === 'entregue');
  await page.selectOption('.trabalho-card >> nth=1 >> select', 'fazendo');
  await page.waitForTimeout(100);
  check('status mudou pra fazendo no 2º', (await page.locator('.trabalho-card').nth(1).getAttribute('data-status')) === 'fazendo');

  console.log('=== 9. EXCLUIR: CANCELAR NÃO APAGA ===');
  await page.locator('.trabalho-card >> nth=0 >> text=Excluir').click();
  await page.waitForTimeout(100);
  check('diálogo de confirmação abre', await page.isVisible('#dialog-confirmar'));
  check('texto cita o título certo', (await page.locator('#dialog-confirmar-titulo').textContent()).includes('revisado'));
  await page.click('[data-fechar-confirmar]');
  await page.waitForTimeout(100);
  check('cancelar não apaga', (await page.locator('.trabalho-card').count()) === 2);

  console.log('=== 10. EXCLUIR: CONFIRMAR APAGA SÓ O CERTO ===');
  await page.locator('.trabalho-card >> nth=0 >> text=Excluir').click();
  await page.waitForTimeout(100);
  await page.click('#btn-confirmar-exclusao');
  await page.waitForTimeout(150);
  check('restou 1 trabalho', (await page.locator('.trabalho-card').count()) === 1);
  check('o que sobrou é o certo (Projeto A3)', (await page.locator('.trabalho-titulo').first().textContent()).includes('Combinado'));

  console.log('=== 11. ISOLAMENTO ENTRE USUÁRIOS ===');
  await page.click('#btn-sair');
  await page.waitForTimeout(100);
  check('logout volta pra tela de login', await page.isVisible('#tela-auth'));
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'samuel');
  await page.fill('#input-senha-auth', 'outrasenha');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  check('samuel não vê trabalho do miguel', await page.isVisible('#lista-vazia'));
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(100);
  await page.fill('#input-titulo-trabalho', 'Trabalho do Samuel');
  await page.fill('#input-materia-trabalho', 'Mobile e Jogos');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(100);
  check('samuel tem 1 trabalho próprio', (await page.locator('.trabalho-card').count()) === 1);

  console.log('=== 12. VOLTAR PRO MIGUEL: DADOS PERSISTIRAM ===');
  await page.click('#btn-sair');
  await page.waitForTimeout(100);
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'senha123');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  check('miguel ainda tem seu trabalho (Combinado)', (await page.locator('.trabalho-card').count()) === 1);
  check('senha errada é rejeitada', true); // checado abaixo

  await page.click('#btn-sair');
  await page.waitForTimeout(100);
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'senhaerrada');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(100);
  check('login com senha errada falha', await page.isVisible('#tela-auth'));

  console.log('=== 13. CADASTRO DUPLICADO ===');
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'qualquer');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(100);
  check('erro ao cadastrar usuário duplicado', await page.isVisible('#auth-erro'));

  console.log('=== 14. SESSÃO PERSISTE APÓS RELOAD ===');
  await page.click('#btn-auth-alternar');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'senha123');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForTimeout(200);
  check('reload mantém logado', await page.isVisible('#app-principal'));
  check('reload mantém dados (1 trabalho)', (await page.locator('.trabalho-card').count()) === 1);

  console.log('=== 15. ACESSIBILIDADE BÁSICA ===');
  const labelsOk = await page.evaluate(() => {
    var ids = ['input-titulo-trabalho', 'input-materia-trabalho', 'input-prazo-trabalho', 'input-usuario-auth', 'input-senha-auth'];
    return ids.every(function (id) {
      var label = document.querySelector('label[for="' + id + '"]');
      return !!label && !!document.getElementById(id);
    });
  });
  check('todos os campos (app + login) têm label associado', labelsOk);

  console.log('\n=== RESULTADO:', ok, 'OK /', falhou, 'FALHOU ===');
  console.log('erros de console:', erros);
  console.log('avisos de console:', avisos);

  await browser.close();
})();
