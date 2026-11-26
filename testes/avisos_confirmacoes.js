/* Melhorias vindas da avaliação de Nielsen: avisos de erro que não somem, aviso dentro da janela de Tarefas,
   "Mostrar senha", confirmações ao excluir tarefa / remover integrante e tela de abertura (carregando / sem conexão). */
const { abrirNavegador, novoContexto, vigiar, calmo, cadastrar, novoTrabalho, convidar, URL_APP } = require('./_base');

(async () => {
  const browser = await abrirNavegador();
  const erros = [];
  function check(desc, cond) {
    console.log((cond ? 'OK  ' : 'FAIL') + ' - ' + desc);
    if (!cond) process.exitCode = 1;
  }
  async function ate(page, fn, arg, timeout) {
    try { await page.waitForFunction(fn, arg, { timeout: timeout || 5000 }); return true; } catch (e) { return false; }
  }
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const flag = (page, nome, valor) => page.evaluate(([n, v]) => { if (v === null) localStorage.removeItem('fake:' + n); else localStorage.setItem('fake:' + n, v); }, [nome, valor]);

  const ctx = await novoContexto(browser);
  const page = await ctx.newPage(); vigiar(page, erros);

  /* ---------- Mostrar senha (item 4) ---------- */
  await page.goto(URL_APP);
  await page.waitForSelector('#tela-auth:not([hidden])');
  check('senha começa escondida', (await page.getAttribute('#input-senha-auth', 'type')) === 'password');
  await page.fill('#input-senha-auth', 'segredo1');
  await page.click('#btn-mostrar-senha');
  check('"Mostrar" revela a senha e vira "Ocultar"', (await page.getAttribute('#input-senha-auth', 'type')) === 'text' && (await page.textContent('#btn-mostrar-senha')) === 'Ocultar' && (await page.getAttribute('#btn-mostrar-senha', 'aria-pressed')) === 'true');
  check('o que foi digitado é mantido ao mostrar', (await page.inputValue('#input-senha-auth')) === 'segredo1');
  await page.click('#btn-mostrar-senha');
  check('"Ocultar" esconde de novo', (await page.getAttribute('#input-senha-auth', 'type')) === 'password' && (await page.textContent('#btn-mostrar-senha')) === 'Mostrar');
  await page.click('#btn-mostrar-senha');
  await page.click('#btn-auth-alternar');
  check('trocar entre Entrar e Criar conta esconde a senha de novo', (await page.getAttribute('#input-senha-auth', 'type')) === 'password');
  check('criar conta: dica fala em anotar a senha', /anote/.test(await page.textContent('#auth-dica-senha')));
  await page.click('#btn-auth-alternar');
  check('entrar: dica diz que não há recuperação de senha', /recupera/.test(await page.textContent('#auth-dica-senha')) && await page.isVisible('#auth-dica-senha'));
  await page.fill('#input-usuario-auth', 'ninguem');
  await page.fill('#input-senha-auth', 'errada1');
  await page.click('#btn-auth-principal');
  await calmo(page);
  check('login errado sugere tocar em Mostrar para conferir', /Mostrar/.test(await page.textContent('#auth-erro')));

  await cadastrar(page, 'Ana', 'senha123');
  check('depois de entrar, a senha digitada não fica no campo e o campo volta escondido', (await page.getAttribute('#input-senha-auth', 'type')) === 'password' && (await page.inputValue('#input-senha-auth')) === '');

  /* ---------- erro de gravação que não é de rede fica na tela (item 1) ---------- */
  await novoTrabalho(page, 'Relatório de Redes', 'Redes');
  const card = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Relatório de Redes' });
  await flag(page, 'falharescrita', '1');
  await card.locator('select').selectOption('fazendo');
  await calmo(page);
  const faixa = page.locator('#faixa-aviso');
  check('erro de gravação aparece', await faixa.isVisible() && /Não foi possível salvar/.test(await faixa.textContent()));
  await dormir(1500);
  check('o erro continua na tela mesmo depois da recarga (antes sumia em milissegundos)', await faixa.isVisible() && /Não foi possível salvar/.test(await faixa.textContent()));
  check('a alteração que falhou foi desfeita na tela (o servidor manda)', (await card.locator('select').inputValue()) === 'nao-comecei');
  await flag(page, 'falharescrita', null);

  /* ---------- sem conexão: alterações desfeitas são avisadas (item 2) ---------- */
  await flag(page, 'offline', '1');
  await card.locator('select').selectOption('entregue');
  check('offline: o aviso diz que a alteração não foi salva', await ate(page, () => /não foram salvas|não foi salva/.test(document.getElementById('faixa-aviso').textContent)));
  await dormir(1500);
  const textoOffline = await faixa.textContent();
  check('offline: o aviso continua visível e explica que será desfeita', await faixa.isVisible() && /serão desfeitas/.test(textoOffline));
  check('offline: não promete mais "vamos tentar de novo" para a alteração perdida', !/Vamos tentar de novo/.test(textoOffline));
  await flag(page, 'offline', '0');
  check('ao voltar a conexão: avisa que as alterações foram desfeitas', await ate(page, () => /foram desfeitas/.test(document.getElementById('faixa-aviso').textContent), null, 9000));
  await calmo(page);
  check('ao voltar a conexão: o status voltou ao valor salvo', (await card.locator('select').inputValue()) === 'nao-comecei');
  await dormir(1500);
  check('o aviso de alterações desfeitas fica alguns segundos', await faixa.isVisible());
  await flag(page, 'offline', null);

  /* ---------- sem alterações perdidas: aviso de conexão some sozinho ---------- */
  await flag(page, 'offline', '1');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check('só carga offline: aparece "Sem conexão com o servidor"', await ate(page, () => /Sem conexão com o servidor/.test(document.getElementById('faixa-aviso').textContent), null, 6000));
  await flag(page, 'offline', null);
  check('com a rede de volta, o aviso de conexão some sozinho', await ate(page, () => document.getElementById('faixa-aviso').hidden, null, 9000));

  /* ---------- aviso dentro da janela de Tarefas (item 3) ---------- */
  await novoTrabalho(page, 'Projeto A3', 'Sistemas', { grupo: true });
  await calmo(page);
  const cardGrupo = page.locator('#lista-trabalhos li.trabalho-card').filter({ hasText: 'Projeto A3' });
  await cardGrupo.locator('button:has-text("Tarefas")').click();
  await page.waitForSelector('#dialog-tarefas[open]');
  check('faixa dentro da janela de Tarefas começa escondida', await page.isHidden('#faixa-aviso-tarefas'));
  await flag(page, 'falharescrita', '1');
  await page.fill('#input-tarefa-texto', 'Tarefa que falha');
  await page.click('#form-tarefa button[type="submit"]');
  await calmo(page);
  const faixaTarefas = page.locator('#faixa-aviso-tarefas');
  check('o erro aparece dentro da janela de Tarefas', await faixaTarefas.isVisible() && /Não foi possível salvar/.test(await faixaTarefas.textContent()));
  await flag(page, 'falharescrita', null);
  await page.fill('#input-tarefa-texto', 'Tarefa boa');
  await page.click('#form-tarefa button[type="submit"]');
  await calmo(page);
  check('a tarefa boa foi salva', (await page.locator('#lista-tarefas li.tarefa-item').count()) === 1);

  /* ---------- confirmar excluir tarefa (item 5) ---------- */
  const item = page.locator('#lista-tarefas li.tarefa-item').first();
  await item.locator('.tarefa-excluir').click();
  check('excluir tarefa abre confirmação com o nome da tarefa', await page.locator('#dialog-confirmar').evaluate((d) => d.open) && /Tarefa boa/.test(await page.textContent('#dialog-confirmar-texto')) && (await page.textContent('#btn-confirmar-exclusao')) === 'Excluir tarefa');
  check('a tarefa ainda está na lista enquanto a confirmação está aberta', (await page.locator('#lista-tarefas li.tarefa-item').count()) === 1);
  await page.click('#dialog-confirmar [data-fechar-confirmar]');
  await calmo(page);
  check('cancelar mantém a tarefa', (await page.locator('#lista-tarefas li.tarefa-item').count()) === 1 && await page.locator('#dialog-tarefas').evaluate((d) => d.open));
  await item.locator('.tarefa-excluir').click();
  await page.click('#btn-confirmar-exclusao');
  await calmo(page);
  check('confirmar exclui a tarefa', (await page.locator('#lista-tarefas li.tarefa-item').count()) === 0);

  /* ---------- confirmar remover integrante (item 5) ---------- */
  await convidar(page, 'Caio');
  const remover = page.locator('#lista-integrantes button[aria-label="Remover Caio do grupo"]');
  const caixa = await remover.boundingBox();
  check('botão "×" tem área de toque de pelo menos 44 px', caixa.width >= 44 && caixa.height >= 44);
  await remover.click();
  check('remover integrante abre confirmação com o nome', await page.locator('#dialog-confirmar').evaluate((d) => d.open) && /caio/i.test(await page.textContent('#dialog-confirmar-titulo')) && (await page.textContent('#btn-confirmar-exclusao')) === 'Remover');
  check('o integrante continua na lista enquanto a confirmação está aberta', (await page.locator('#lista-integrantes li').count()) === 2);
  await page.click('#dialog-confirmar [data-fechar-confirmar]');
  await calmo(page);
  check('cancelar mantém o integrante', (await page.locator('#lista-integrantes li').count()) === 2);
  await remover.click();
  await page.click('#btn-confirmar-exclusao');
  await calmo(page);
  check('confirmar remove o integrante', (await page.locator('#lista-integrantes li').count()) === 1);
  await page.click('#dialog-tarefas [data-fechar-tarefas]');

  /* ---------- abertura do app: carregando e sem conexão (itens 6 e 7) ---------- */
  await flag(page, 'lento', '900');
  await page.reload();
  check('ao reabrir com sessão: aparece "Carregando…" em vez de tela em branco',
    await ate(page, () => !document.getElementById('tela-carregando').hidden && /Carregando/.test(document.getElementById('carregando-texto').textContent), null, 1500)
    && await page.isHidden('#tela-auth') && await page.isHidden('#app-principal'));
  await page.waitForSelector('#app-principal:not([hidden])', { timeout: 12000 });
  check('a tela de carregando some quando o app abre', await page.isHidden('#tela-carregando'));
  await flag(page, 'lento', null);
  await calmo(page);

  await flag(page, 'offline', '1');
  await page.reload();
  check('abrir sem internet com sessão: explica "Sem conexão" em vez de cair no login',
    await ate(page, () => /Sem conexão/.test(document.getElementById('carregando-texto').textContent), null, 4000)
    && await page.isHidden('#tela-auth') && await page.isVisible('#btn-carregando-tentar'));
  await flag(page, 'offline', null);
  await page.click('#btn-carregando-tentar');
  await page.waitForSelector('#app-principal:not([hidden])', { timeout: 8000 });
  await calmo(page);
  check('com a conexão de volta, "Tentar de novo" abre o app já logado', await page.isHidden('#tela-carregando') && (await page.textContent('#cabecalho-usuario-nome')) === 'Ana');

  await flag(page, 'offline', '1');
  await page.reload();
  await ate(page, () => /Sem conexão/.test(document.getElementById('carregando-texto').textContent), null, 4000);
  await flag(page, 'offline', null);
  check('sem tocar em nada, a abertura tenta sozinha e entra quando a rede volta',
    await ate(page, () => !document.getElementById('app-principal').hidden, null, 9000));

  // sem sessão: vai direto para o login
  await page.click('#btn-sair');
  await page.waitForSelector('#tela-auth:not([hidden])');
  await page.reload();
  await page.waitForSelector('#tela-auth:not([hidden])');
  check('sem sessão, abre direto no login (sem ficar em "Carregando…")', await page.isHidden('#tela-carregando'));

  const reais = erros.filter((e) => !/Failed to load resource|favicon/i.test(e));
  check('nenhum erro inesperado no console', reais.length === 0);
  if (reais.length) console.log(reais.join('\n'));
  await browser.close();
})().catch((e) => { console.log('FAIL - exceção: ' + e.message); process.exit(1); });
