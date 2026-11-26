/* Ajuda comum dos roteiros: navegador com o Supabase de mentira no lugar do verdadeiro. */
const { chromium } = require('playwright');
const path = require('path');

const FAKE = path.join(__dirname, 'fake_supabase.js');
const URL_APP = 'http://localhost:8799/index.html';

async function abrirNavegador() {
  return chromium.launch();
}

// Um "usuário de navegador": contexto novo (localStorage próprio) com o fake instalado.
async function novoContexto(browser, opcoes) {
  const contexto = await browser.newContext(opcoes || { viewport: { width: 390, height: 844 } });
  await contexto.route('**/js/vendor/supabase.js', (rota) => rota.fulfill({ path: FAKE, contentType: 'application/javascript' }));
  return contexto;
}

function vigiar(page, erros) {
  page.on('console', (msg) => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('pageerror', (err) => erros.push('PAGEERROR: ' + err.message));
}

async function novaPagina(browser, opcoes) {
  const contexto = await novoContexto(browser, opcoes);
  const page = await contexto.newPage();
  return { page, contexto };
}

// Espera tudo assentar (gravações e recargas terminadas).
async function calmo(page) {
  await page.waitForSelector('html[data-ocupado="0"]', { state: 'attached', timeout: 8000 });
}

async function cadastrar(page, usuario, senha) {
  if ((await page.locator('#btn-auth-principal').textContent()).trim() !== 'Criar conta') {
    await page.click('#btn-auth-alternar');
  }
  await page.fill('#input-usuario-auth', usuario);
  await page.fill('#input-senha-auth', senha || '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
}

async function entrar(page, usuario, senha) {
  if ((await page.locator('#btn-auth-principal').textContent()).trim() !== 'Entrar') {
    await page.click('#btn-auth-alternar');
  }
  await page.fill('#input-usuario-auth', usuario);
  await page.fill('#input-senha-auth', senha || '123456');
  await page.click('#btn-auth-principal');
  await page.waitForSelector('#app-principal:not([hidden])');
  await calmo(page);
}

async function novoTrabalho(page, titulo, materia, opcoes) {
  opcoes = opcoes || {};
  await page.click('#btn-novo-trabalho');
  await page.fill('#input-titulo-trabalho', titulo);
  await page.fill('#input-materia-trabalho', materia || 'Matéria');
  if (opcoes.prazo) await page.fill('#input-prazo-trabalho', opcoes.prazo);
  if (opcoes.grupo) await page.click('input[name="tipo-trabalho"][value="grupo"]');
  await page.click('#dialog-trabalho button[type="submit"]');
  await calmo(page);
}

async function paginaComFake(browser, opcoes) {
  const contexto = await novoContexto(browser, opcoes);
  return contexto.newPage();
}

// Com a janela de tarefas aberta no grupo: cria a conta de outra pessoa e entra pelo código.
async function convidar(page, usuario) {
  const codigo = (await page.locator('#codigo-grupo-valor').textContent()).trim();
  const antes = await page.locator('#lista-integrantes li').count();
  const outra = await page.context().newPage();
  await outra.goto(URL_APP);
  await outra.waitForSelector('#tela-auth:not([hidden])');
  await cadastrar(outra, usuario);
  await outra.click('#btn-entrar-codigo');
  await outra.fill('#input-codigo', codigo);
  await outra.click('#btn-codigo-entrar');
  await calmo(outra);
  await outra.close();
  await page.waitForFunction((n) => document.querySelectorAll('#lista-integrantes li').length === n, antes + 1, { timeout: 6000 });
}

module.exports = { convidar, paginaComFake, abrirNavegador, novoContexto, novaPagina, vigiar, calmo, cadastrar, entrar, novoTrabalho, URL_APP };
