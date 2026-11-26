const { chromium } = require('playwright');
const { paginaComFake, novoContexto, calmo, cadastrar, entrar, novoTrabalho } = require('./_base');
(async () => {
  const browser = await chromium.launch();
  const page = await paginaComFake(browser, { viewport: { width: 390, height: 844 } });
  const erros = [];
  page.on('console', msg => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('pageerror', err => erros.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:8799/index.html');
  await page.waitForTimeout(150);

  console.log('--- carga inicial: tela de login visível, app escondido ---');
  console.log('tela-auth visível:', await page.isVisible('#tela-auth'));
  console.log('app-principal visível:', await page.isVisible('#app-principal'));
  console.log('titulo auth:', await page.locator('#auth-titulo').textContent());

  console.log('--- tenta entrar com usuário que não existe ---');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('erro visível (usuário não existe):', await page.isVisible('#auth-erro'));
  console.log('texto erro:', await page.locator('#auth-erro').textContent());
  console.log('ainda na tela de login:', await page.isVisible('#tela-auth'));

  console.log('--- alterna pra criar conta ---');
  await page.click('#btn-auth-alternar');
  await page.waitForTimeout(100);
  console.log('titulo agora:', await page.locator('#auth-titulo').textContent());

  console.log('--- cria conta ---');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('entrou (tela-auth escondida):', !(await page.isVisible('#tela-auth')));
  console.log('app-principal visível:', await page.isVisible('#app-principal'));
  console.log('nome no cabeçalho:', await page.locator('#cabecalho-usuario-nome').textContent());

  console.log('--- cadastra um trabalho pro usuário miguel ---');
  await page.click('#btn-novo-trabalho');
  await page.waitForTimeout(150);
  await page.fill('#input-titulo-trabalho', 'Trabalho do Miguel');
  await page.fill('#input-materia-trabalho', 'Usabilidade');
  await page.click('#form-trabalho button[type=submit]');
  await page.waitForTimeout(150);
  console.log('total trabalhos miguel:', await page.locator('.trabalho-card').count());

  console.log('--- sai (logout) ---');
  await page.click('#btn-sair');
  await page.waitForTimeout(150);
  console.log('voltou pra tela de login:', await page.isVisible('#tela-auth'));
  console.log('app escondido de novo:', !(await page.isVisible('#app-principal')));

  console.log('--- tenta criar conta com usuário que já existe (miguel) ---');
  await page.click('#btn-auth-alternar'); // vai pra modo cadastro
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'outrasenha');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('erro (usuário já existe):', await page.locator('#auth-erro').textContent());

  console.log('--- cria segunda conta (samuel) e confere que a lista de trabalhos é vazia (isolada) ---');
  await page.fill('#input-usuario-auth', 'samuel');
  await page.fill('#input-senha-auth', 'abcdef');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('nome no cabeçalho (samuel):', await page.locator('#cabecalho-usuario-nome').textContent());
  console.log('lista vazia pro samuel (não vê trabalho do miguel):', await page.isVisible('#lista-vazia'));
  console.log('total trabalhos samuel:', await page.locator('.trabalho-card').count());

  console.log('--- sai e entra com miguel de novo: trabalho dele ainda está lá ---');
  await page.click('#btn-sair');
  await page.waitForTimeout(150);
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('total trabalhos miguel (persistiu):', await page.locator('.trabalho-card').count());

  console.log('--- senha errada pro miguel ---');
  await page.click('#btn-sair');
  await page.waitForTimeout(150);
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', 'senhaerrada');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  console.log('erro senha errada:', await page.locator('#auth-erro').textContent());
  console.log('continua na tela de login:', await page.isVisible('#tela-auth'));

  console.log('--- recarrega a página logado: sessão persiste (auto-login) ---');
  await page.fill('#input-usuario-auth', 'miguel');
  await page.fill('#input-senha-auth', '123456');
  await page.click('#btn-auth-principal');
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForTimeout(200);
  console.log('depois do reload, já entrou direto (app visível):', await page.isVisible('#app-principal'));
  console.log('nome no cabeçalho após reload:', await page.locator('#cabecalho-usuario-nome').textContent());
  console.log('total trabalhos após reload:', await page.locator('.trabalho-card').count());

  console.log('--- erros de console ---');
  console.log(erros);

  await browser.close();
})();
