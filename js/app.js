/* =========================================================
   Combinado — lógica do app
   Contas e dados no Supabase (js/dados.js); tela e regras aqui.
   ========================================================= */
(function () {
  "use strict";

  var usuarioAtual = null;   // { id, usuario, nome, importou_local }

  /* ---------------- tela de login / cadastro ---------------- */

  var telaAuth = document.getElementById("tela-auth");
  var appPrincipal = document.getElementById("app-principal");
  var formAuth = document.getElementById("form-auth");
  var inputUsuarioAuth = document.getElementById("input-usuario-auth");
  var inputSenhaAuth = document.getElementById("input-senha-auth");
  var authErro = document.getElementById("auth-erro");
  var authConfigErro = document.getElementById("auth-config-erro");
  var authDicaUsuario = document.getElementById("auth-dica-usuario");
  var authDicaSenha = document.getElementById("auth-dica-senha");
  var authTitulo = document.getElementById("auth-titulo");
  var btnAuthPrincipal = document.getElementById("btn-auth-principal");
  var btnAuthAlternar = document.getElementById("btn-auth-alternar");
  var authAlternarTexto = document.getElementById("auth-alternar-texto");
  var cabecalhoUsuarioNome = document.getElementById("cabecalho-usuario-nome");
  var btnSair = document.getElementById("btn-sair");

  var modoCadastro = false;
  var ocupadoAuth = false;
  var saindo = false;

  var MENSAGENS_AUTH = {
    usuario_existe: "Esse usuário já existe. Tente entrar.",
    credenciais: "Usuário ou senha incorretos.",
    senha_curta: "A senha precisa ter pelo menos 6 caracteres.",
    usuario_invalido: "Usuário inválido. Use de 3 a 30 letras, números, ponto, hífen ou sublinhado, sem espaços.",
    confirmacao_ligada: "Conta criada, mas o servidor está pedindo confirmação por e-mail. Avise a equipe do Combinado.",
    email_recusado: "O servidor recusou o cadastro. Tente outro usuário; se persistir, avise a equipe.",
    rede: "Sem conexão com o servidor. Confira a internet e tente de novo.",
    config: "Não foi possível carregar o serviço de contas. Recarregue a página."
  };

  function mostrarErroAuth(mensagem) {
    authErro.textContent = mensagem;
    authErro.hidden = false;
  }

  function limparErroAuth() {
    authErro.hidden = true;
    authErro.textContent = "";
  }

  function rotuloBotaoAuth() {
    return modoCadastro ? "Criar conta" : "Entrar";
  }

  function definirModoAuth(cadastro) {
    modoCadastro = cadastro;
    limparErroAuth();
    authTitulo.textContent = rotuloBotaoAuth();
    btnAuthPrincipal.textContent = rotuloBotaoAuth();
    authAlternarTexto.textContent = cadastro ? "Já tem conta?" : "Não tem conta?";
    btnAuthAlternar.textContent = cadastro ? "Entrar" : "Criar conta";
    authDicaUsuario.hidden = !cadastro;
    authDicaSenha.hidden = !cadastro;
    inputSenhaAuth.setAttribute("autocomplete", cadastro ? "new-password" : "current-password");
  }

  btnAuthAlternar.addEventListener("click", function () {
    definirModoAuth(!modoCadastro);
  });

  formAuth.addEventListener("submit", function (evento) {
    evento.preventDefault();
    if (ocupadoAuth) return;
    limparErroAuth();

    var usuario = inputUsuarioAuth.value.trim();
    var senha = inputSenhaAuth.value;
    if (!usuario || !senha) return;

    if (!Dados.iniciar()) {
      authConfigErro.hidden = false;
      return;
    }

    ocupadoAuth = true;
    btnAuthPrincipal.disabled = true;
    btnAuthPrincipal.textContent = modoCadastro ? "Criando…" : "Entrando…";
    atualizarOcupado();

    var promessa = modoCadastro ? Dados.cadastrar(usuario, senha) : Dados.entrar(usuario, senha);
    promessa.then(function (perfil) {
      return entrarComoPerfil(perfil);
    }).catch(function (e) {
      mostrarErroAuth(MENSAGENS_AUTH[e && e.codigo] || "Algo deu errado. Tente de novo.");
    }).then(function () {
      ocupadoAuth = false;
      btnAuthPrincipal.disabled = false;
      btnAuthPrincipal.textContent = rotuloBotaoAuth();
      atualizarOcupado();
    });
  });

  function mostrarTelaAuth() {
    appPrincipal.hidden = true;
    telaAuth.hidden = false;
    inputUsuarioAuth.focus();
  }

  function entrarComoPerfil(perfil) {
    usuarioAtual = perfil;
    formAuth.reset();
    telaAuth.hidden = true;
    appPrincipal.hidden = false;
    cabecalhoUsuarioNome.textContent = perfil.nome || perfil.usuario;
    state.trabalhos = [];
    cargaEstado = "carregando";
    renderTrabalhos();
    return recarregar().then(function () {
      if (usuarioAtual !== perfil) return;
      Dados.ouvirMudancas(function () { agendarRecarga(250); });
      oferecerImportacao();
    });
  }

  function voltarParaLogin(mensagem) {
    usuarioAtual = null;
    clearTimeout(timerRecarga);
    timerRecarga = null;
    pendentes = 0;
    recarregarDepois = false;
    Dados.pararDeOuvir();
    state.trabalhos = [];
    [dialogTrabalho, dialogTarefas, dialogConfirmar, dialogCodigo, dialogImportar].forEach(function (d) {
      if (d.open) d.close();
    });
    faixaAviso.hidden = true;
    definirModoAuth(false);
    mostrarTelaAuth();
    if (mensagem) mostrarErroAuth(mensagem);
    atualizarOcupado();
  }

  btnSair.addEventListener("click", function () {
    saindo = true;
    Dados.sair().catch(function () { /* mesmo com erro de rede, sai desta tela */ }).then(function () {
      saindo = false;
      voltarParaLogin();
    });
  });

  var STATUS_LABEL = {
    "nao-comecei": "Não comecei",
    "fazendo": "Fazendo",
    "pronto": "Pronto",
    "entregue": "Entregue"
  };

  var CORES_VALIDAS = ["vermelho", "laranja", "amarelo", "verde", "azul", "roxo", "rosa"];

  var TIPO_LABEL = {
    "individual": "Individual",
    "grupo": "Em grupo"
  };

  var state = {
    trabalhos: []   // { id, titulo, materia, prazo, tipo, cor, observacoes, status, codigo, donoId, membros[], tarefas[] }
  };


  /* ---------------- estado em memória + sincronização ---------------- */

  var cargaEstado = "carregando";   // carregando | ok | erro
  var pendentes = 0;                // gravações em andamento
  var recarregarDepois = false;
  var recargaEmAndamento = false;
  var timerRecarga = null;
  var timerAviso = null;

  var faixaAviso = document.getElementById("faixa-aviso");

  // Marca o <html> enquanto há algo em andamento (útil para estilo e para os testes).
  function atualizarOcupado() {
    var ocupado = pendentes > 0 || recargaEmAndamento || timerRecarga !== null || ocupadoAuth;
    document.documentElement.setAttribute("data-ocupado", ocupado ? "1" : "0");
  }

  function mostrarAviso(texto, fixo) {
    clearTimeout(timerAviso);
    faixaAviso.textContent = texto;
    faixaAviso.hidden = false;
    if (!fixo) {
      timerAviso = setTimeout(function () { faixaAviso.hidden = true; }, 6000);
    }
  }

  function esconderAviso() {
    clearTimeout(timerAviso);
    faixaAviso.hidden = true;
  }

  var MENSAGENS_ESCRITA = {
    rede: "Sem conexão: a última alteração não foi salva.",
    somente_dono: "Só quem criou o trabalho pode fazer isso.",
    responsavel_invalido: "Esse responsável não faz mais parte do grupo.",
    sem_sessao: "Sua sessão expirou. Entre de novo."
  };

  function agendarRecarga(atraso) {
    clearTimeout(timerRecarga);
    timerRecarga = setTimeout(function () {
      timerRecarga = null;
      recarregar();
    }, atraso);
    atualizarOcupado();
  }

  function recarregar() {
    if (!usuarioAtual) return Promise.resolve();
    if (pendentes > 0 || recargaEmAndamento) {
      recarregarDepois = true;
      return Promise.resolve();
    }
    var daVez = usuarioAtual;
    recargaEmAndamento = true;
    atualizarOcupado();
    return Dados.carregar().then(function (lista) {
      recargaEmAndamento = false;
      if (usuarioAtual !== daVez) return;
      if (pendentes > 0) {
        recarregarDepois = true;
        return;
      }
      state.trabalhos = lista;
      cargaEstado = "ok";
      esconderAviso();
      depoisDeCarregar();
    }).catch(function (e) {
      recargaEmAndamento = false;
      if (usuarioAtual !== daVez) return;
      if (e && e.codigo === "sem_sessao") {
        voltarParaLogin("Sua sessão expirou. Entre de novo.");
        return;
      }
      if (cargaEstado === "carregando") cargaEstado = "erro";
      mostrarAviso("Sem conexão com o servidor. Vamos tentar de novo.", true);
      renderTrabalhos();
      agendarRecarga(4000);
    }).then(function () {
      atualizarOcupado();
      if (recarregarDepois && pendentes === 0 && !recargaEmAndamento && usuarioAtual) {
        recarregarDepois = false;
        agendarRecarga(0);
      }
    });
  }

  // Toda gravação passa por aqui: conta como "pendente", avisa se falhar
  // e, no fim, confere com o servidor (que desfaz o que não foi salvo).
  function escrever(funcaoQueGrava) {
    pendentes += 1;
    atualizarOcupado();
    var inicio;
    try {
      inicio = Promise.resolve(funcaoQueGrava());
    } catch (e) {
      inicio = Promise.reject(e);
    }
    return inicio.catch(function (e) {
      mostrarAviso(MENSAGENS_ESCRITA[e && e.codigo] || "Não foi possível salvar. Tente de novo.", false);
      if (e && e.codigo === "sem_sessao") voltarParaLogin("Sua sessão expirou. Entre de novo.");
    }).then(function () {
      pendentes = Math.max(0, pendentes - 1);
      if (pendentes === 0 && usuarioAtual) agendarRecarga(0);
      atualizarOcupado();
    });
  }

  function achar(id) {
    for (var i = 0; i < state.trabalhos.length; i++) {
      if (state.trabalhos[i].id === id) return state.trabalhos[i];
    }
    return null;
  }

  function ehTemporario(item) {
    return !!item && String(item.id).indexOf("tmp-") === 0;
  }

  function gerarIdTemporario() {
    return "tmp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function souDono(trabalho) {
    return !!usuarioAtual && trabalho.donoId === usuarioAtual.id;
  }

  function nomeDoMembro(trabalho, id) {
    var lista = (trabalho && trabalho.membros) || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i].nome;
    }
    return "";
  }

  // Depois de cada carga: redesenha a lista e atualiza janelas abertas.
  function depoisDeCarregar() {
    renderTrabalhos();

    if (trabalhoTarefasAtual) {
      var atualizado = achar(trabalhoTarefasAtual.id);
      if (!atualizado) {
        trabalhoTarefasAtual = null;
        if (dialogTarefas.open) dialogTarefas.close();
        mostrarAviso("Esse trabalho não está mais disponível para você.", false);
      } else {
        trabalhoTarefasAtual = atualizado;
        renderIntegrantes();
        renderTarefas();
      }
    }

    if (trabalhoEmEdicaoId && !achar(trabalhoEmEdicaoId)) {
      trabalhoEmEdicaoId = null;
      if (dialogTrabalho.open) dialogTrabalho.close();
      mostrarAviso("Esse trabalho não está mais disponível para você.", false);
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && usuarioAtual) agendarRecarga(0);
  });

  /* ---------------- tema claro / escuro ---------------- */

  var CHAVE_TEMA = "combinado:tema:v1";
  var btnTema = document.getElementById("btn-tema");
  var metaTema = document.querySelector('meta[name="theme-color"]');

  function temaAtual() {
    return document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro";
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-tema", tema);
    btnTema.setAttribute("aria-label", tema === "escuro" ? "Ativar tema claro" : "Ativar tema escuro");
    btnTema.setAttribute("aria-pressed", tema === "escuro" ? "true" : "false");
    if (metaTema) metaTema.setAttribute("content", tema === "escuro" ? "#15132e" : "#f2f0ff");
  }

  btnTema.addEventListener("click", function () {
    var novo = temaAtual() === "escuro" ? "claro" : "escuro";
    aplicarTema(novo);
    try { localStorage.setItem(CHAVE_TEMA, novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  });

  aplicarTema(temaAtual());

  /* ---------------- referências de elementos ---------------- */

  var listaTrabalhos = document.getElementById("lista-trabalhos");
  var listaVazia = document.getElementById("lista-vazia");
  var btnNovoTrabalho = document.getElementById("btn-novo-trabalho");
  var progressoTrabalhos = document.getElementById("progresso-trabalhos");
  var progressoTexto = document.getElementById("progresso-texto");
  var progressoBarra = document.getElementById("progresso-barra");
  var progressoBarraPreenchida = document.getElementById("progresso-barra-preenchida");
  var filtrosBarra = document.getElementById("filtros-barra");
  var selectFiltroMateria = document.getElementById("select-filtro-materia");
  var abasStatus = document.getElementById("abas-status");

  var TEXTO_LISTA_VAZIA = 'Nenhum trabalho cadastrado ainda. Toque em "Novo trabalho" para começar.';
  var TEXTO_LISTA_SEM_RESULTADO = "Nenhum trabalho encontrado com esse filtro.";

  var filtroMateriaAtual = "";
  var filtroStatusAtual = "";

  selectFiltroMateria.addEventListener("change", function () {
    filtroMateriaAtual = selectFiltroMateria.value;
    renderTrabalhos();
  });

  abasStatus.addEventListener("click", function (evento) {
    var aba = evento.target.closest ? evento.target.closest(".aba-status") : null;
    if (!aba || !abasStatus.contains(aba)) return;
    filtroStatusAtual = aba.getAttribute("data-status") || "";
    renderTrabalhos();
  });

  function atualizarAbasStatus() {
    var contagens = { "": 0 };
    state.trabalhos.forEach(function (t) {
      if (filtroMateriaAtual && t.materia !== filtroMateriaAtual) return;
      contagens[""] += 1;
      contagens[t.status] = (contagens[t.status] || 0) + 1;
    });
    abasStatus.querySelectorAll(".aba-status").forEach(function (aba) {
      var chave = aba.getAttribute("data-status") || "";
      aba.setAttribute("aria-pressed", chave === filtroStatusAtual ? "true" : "false");
      var numero = aba.querySelector(".aba-contagem");
      if (numero) numero.textContent = String(contagens[chave] || 0);
    });
  }

  var dialogTrabalho = document.getElementById("dialog-trabalho");
  var dialogTrabalhoTitulo = document.getElementById("dialog-trabalho-titulo");
  var formTrabalho = document.getElementById("form-trabalho");
  var inputTitulo = document.getElementById("input-titulo-trabalho");
  var inputMateria = document.getElementById("input-materia-trabalho");
  var inputPrazo = document.getElementById("input-prazo-trabalho");
  var inputObservacoes = document.getElementById("input-observacoes-trabalho");

  var trabalhoEmEdicaoId = null;

  var dialogConfirmar = document.getElementById("dialog-confirmar");
  var dialogConfirmarTexto = document.getElementById("dialog-confirmar-texto");
  var dialogConfirmarTitulo = document.getElementById("dialog-confirmar-titulo");
  var previaTrabalho = document.getElementById("previa-trabalho");
  var previaTitulo = document.getElementById("previa-titulo");
  var previaMeta = document.getElementById("previa-meta");
  var btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao");

  /* ---------------- utilidades ---------------- */

  function formatarDataCurta(isoData) {
    if (!isoData) return "";
    var partes = isoData.split("-");
    if (partes.length !== 3) return isoData;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  /* ---------------- lembrete de prazo ---------------- */

  function calcularDiasRestantes(isoData) {
    var partes = isoData.split("-");
    if (partes.length !== 3) return null;
    var dataPrazo = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    if (isNaN(dataPrazo.getTime())) return null;
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataPrazo.setHours(0, 0, 0, 0);
    var umDiaMs = 24 * 60 * 60 * 1000;
    return Math.round((dataPrazo.getTime() - hoje.getTime()) / umDiaMs);
  }

  function obterLembretePrazo(trabalho) {
    if (!trabalho.prazo || trabalho.status === "entregue") return null;
    var dias = calcularDiasRestantes(trabalho.prazo);
    if (dias === null) return null;
    if (dias < 0) return { texto: "Atrasado", classe: "selo-prazo-atrasado" };
    if (dias === 0) return { texto: "Vence hoje", classe: "selo-prazo-hoje" };
    if (dias === 1) return { texto: "Vence amanhã", classe: "selo-prazo-proximo" };
    if (dias <= 3) return { texto: "Vence em " + dias + " dias", classe: "selo-prazo-proximo" };
    return null;
  }

  /* ---------------- diálogo de novo trabalho ---------------- */

  function corValida(cor) {
    return CORES_VALIDAS.indexOf(cor) !== -1 ? cor : "";
  }

  function marcarCorNoDialog(cor) {
    var radio = formTrabalho.querySelector('input[name="cor-trabalho"][value="' + cor + '"]');
    if (radio) radio.checked = true;
  }

  function atualizarPrevia() {
    var corSel = formTrabalho.querySelector('input[name="cor-trabalho"]:checked');
    var cor = corSel ? corValida(corSel.value) : "";
    if (cor) previaTrabalho.setAttribute("data-cor", cor);
    else previaTrabalho.removeAttribute("data-cor");
    previaTitulo.textContent = inputTitulo.value.trim() || "Título do trabalho";
    var partes = [];
    var materia = inputMateria.value.trim();
    if (materia) partes.push(materia);
    if (inputPrazo.value) partes.push("prazo " + formatarDataCurta(inputPrazo.value));
    previaMeta.textContent = partes.length ? partes.join(" · ") : "Matéria e prazo";
  }

  formTrabalho.addEventListener("input", atualizarPrevia);
  formTrabalho.addEventListener("change", atualizarPrevia);
  formTrabalho.addEventListener("reset", function () {
    setTimeout(atualizarPrevia, 0);
  });

  function abrirDialogNovoTrabalho() {
    trabalhoEmEdicaoId = null;
    dialogTrabalhoTitulo.textContent = "Novo trabalho";
    formTrabalho.reset();
    atualizarPrevia();
    dialogTrabalho.showModal();
    inputTitulo.focus();
  }

  function abrirDialogEditarTrabalho(trabalho) {
    trabalhoEmEdicaoId = trabalho.id;
    dialogTrabalhoTitulo.textContent = "Editar trabalho";
    inputTitulo.value = trabalho.titulo;
    inputMateria.value = trabalho.materia;
    inputPrazo.value = trabalho.prazo || "";
    inputObservacoes.value = trabalho.observacoes || "";
    var radioTipo = formTrabalho.querySelector('input[name="tipo-trabalho"][value="' + trabalho.tipo + '"]');
    if (radioTipo) radioTipo.checked = true;
    marcarCorNoDialog(corValida(trabalho.cor));
    atualizarPrevia();
    dialogTrabalho.showModal();
    inputTitulo.focus();
  }

  btnNovoTrabalho.addEventListener("click", abrirDialogNovoTrabalho);

  document.querySelectorAll("[data-fechar-dialog]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      dialogTrabalho.close();
    });
  });

  document.querySelectorAll("[data-fechar-confirmar]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      dialogConfirmar.close();
    });
  });

  formTrabalho.addEventListener("submit", function (evento) {
    evento.preventDefault();
    var titulo = inputTitulo.value.trim();
    var materia = inputMateria.value.trim();
    if (!titulo || !materia || !usuarioAtual) return;

    var tipoSelecionado = formTrabalho.querySelector('input[name="tipo-trabalho"]:checked');
    var corSelecionada = formTrabalho.querySelector('input[name="cor-trabalho"]:checked');
    var campos = {
      titulo: titulo,
      materia: materia,
      prazo: inputPrazo.value || "",
      tipo: tipoSelecionado ? tipoSelecionado.value : "individual",
      cor: corSelecionada ? corValida(corSelecionada.value) : "",
      observacoes: inputObservacoes.value.trim()
    };

    if (trabalhoEmEdicaoId) {
      var emEdicao = achar(trabalhoEmEdicaoId);
      trabalhoEmEdicaoId = null;
      if (!emEdicao) {
        dialogTrabalho.close();
        mostrarAviso("Esse trabalho não está mais disponível para você.", false);
        renderTrabalhos();
        return;
      }
      Object.keys(campos).forEach(function (k) { emEdicao[k] = campos[k]; });
      escrever(function () { return Dados.atualizarTrabalho(emEdicao.id, campos); });
    } else {
      var novo = {
        id: gerarIdTemporario(),
        status: "nao-comecei",
        prontoAutomatico: false,
        codigo: "",
        donoId: usuarioAtual.id,
        membros: [{ id: usuarioAtual.id, usuario: usuarioAtual.usuario, nome: usuarioAtual.nome || usuarioAtual.usuario, papel: "dono" }],
        tarefas: []
      };
      Object.keys(campos).forEach(function (k) { novo[k] = campos[k]; });
      state.trabalhos.push(novo);
      escrever(function () { return Dados.criarTrabalho(novo, usuarioAtual.id); });
    }

    dialogTrabalho.close();
    renderTrabalhos();
  });

  /* ---------------- lista de trabalhos ---------------- */

  function pedirConfirmacao(opcoes) {
    dialogConfirmarTitulo.textContent = opcoes.titulo;
    dialogConfirmarTexto.textContent = opcoes.texto;
    btnConfirmarExclusao.textContent = opcoes.rotulo;
    btnConfirmarExclusao.onclick = function () {
      dialogConfirmar.close();
      opcoes.aoConfirmar();
    };
    dialogConfirmar.showModal();
  }

  function removerDaListaLocal(trabalho) {
    state.trabalhos = state.trabalhos.filter(function (t) { return t.id !== trabalho.id; });
    renderTrabalhos();
  }

  function pedirConfirmacaoExclusao(trabalho) {
    var compartilhado = trabalho.membros && trabalho.membros.length > 1;
    pedirConfirmacao({
      titulo: 'Excluir "' + trabalho.titulo + '"?',
      texto: compartilhado
        ? "O trabalho some para todos os integrantes e não dá para desfazer."
        : "O trabalho some da lista e não dá para desfazer.",
      rotulo: "Excluir trabalho",
      aoConfirmar: function () {
        removerDaListaLocal(trabalho);
        escrever(function () { return Dados.excluirTrabalho(trabalho.id); });
      }
    });
  }

  function pedirConfirmacaoSaida(trabalho) {
    pedirConfirmacao({
      titulo: 'Sair de "' + trabalho.titulo + '"?',
      texto: "O trabalho some da sua lista. Para voltar, é preciso entrar de novo com o código do grupo.",
      rotulo: "Sair do trabalho",
      aoConfirmar: function () {
        if (dialogTarefas.open) dialogTarefas.close();
        removerDaListaLocal(trabalho);
        escrever(function () { return Dados.sairDoTrabalho(trabalho.id, usuarioAtual.id); });
      }
    });
  }


  function obterMateriasUnicas() {
    var vistas = {};
    var materias = [];
    state.trabalhos.forEach(function (t) {
      if (t.materia && !vistas[t.materia]) {
        vistas[t.materia] = true;
        materias.push(t.materia);
      }
    });
    materias.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    return materias;
  }

  function atualizarSelectFiltroMateria() {
    var valorAtual = selectFiltroMateria.value;
    var materias = obterMateriasUnicas();

    selectFiltroMateria.innerHTML = "";
    var opcaoTodas = document.createElement("option");
    opcaoTodas.value = "";
    opcaoTodas.textContent = "Todas as matérias";
    selectFiltroMateria.appendChild(opcaoTodas);

    materias.forEach(function (materia) {
      var opcao = document.createElement("option");
      opcao.value = materia;
      opcao.textContent = materia;
      selectFiltroMateria.appendChild(opcao);
    });

    if (materias.indexOf(valorAtual) !== -1) {
      selectFiltroMateria.value = valorAtual;
    } else {
      selectFiltroMateria.value = "";
      filtroMateriaAtual = "";
    }
  }

  function compararPorPrazo(a, b) {
    if (!a.prazo && !b.prazo) return 0;
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo < b.prazo ? -1 : (a.prazo > b.prazo ? 1 : 0);
  }

  function ordenarEFiltrar(lista) {
    var filtrados = lista.filter(function (t) {
      return (!filtroMateriaAtual || t.materia === filtroMateriaAtual) &&
             (!filtroStatusAtual || t.status === filtroStatusAtual);
    });

    // sempre pelo prazo mais próximo; trabalhos sem prazo vão para o fim
    filtrados.sort(compararPorPrazo);

    return filtrados;
  }

  function atualizarProgresso() {
    var total = state.trabalhos.length;
    progressoTrabalhos.hidden = total === 0;
    if (total === 0) return;

    var entregues = state.trabalhos.filter(function (t) { return t.status === "entregue"; }).length;
    var percentual = Math.round((entregues / total) * 100);

    progressoTexto.textContent = "";
    var numeroProgresso = document.createElement("span");
    numeroProgresso.className = "progresso-numero";
    numeroProgresso.textContent = String(entregues);
    progressoTexto.appendChild(numeroProgresso);
    progressoTexto.appendChild(document.createTextNode(
      " de " + total + " " + (total === 1 ? "trabalho entregue" : "trabalhos entregues")));
    progressoBarraPreenchida.style.width = percentual + "%";
    progressoBarra.setAttribute("aria-valuenow", String(percentual));
  }

  function renderTrabalhos() {
    atualizarProgresso();
    atualizarSelectFiltroMateria();
    atualizarAbasStatus();
    filtrosBarra.hidden = state.trabalhos.length === 0;

    listaTrabalhos.innerHTML = "";

    if (state.trabalhos.length === 0) {
      listaVazia.textContent = cargaEstado === "carregando" ? "Carregando seus trabalhos…"
        : cargaEstado === "erro" ? "Não foi possível carregar seus trabalhos agora."
        : TEXTO_LISTA_VAZIA;
      listaVazia.hidden = false;
      return;
    }

    var visiveis = ordenarEFiltrar(state.trabalhos.slice());

    if (visiveis.length === 0) {
      listaVazia.textContent = TEXTO_LISTA_SEM_RESULTADO;
      listaVazia.hidden = false;
      return;
    }
    listaVazia.hidden = true;

    visiveis.forEach(function (trabalho) {
      var salvando = ehTemporario(trabalho);
      var item = document.createElement("li");
      item.className = "trabalho-card";
      item.setAttribute("data-status", trabalho.status);
      var cor = corValida(trabalho.cor);
      if (cor) item.setAttribute("data-cor", cor);

      var selos = document.createElement("div");
      selos.className = "trabalho-selos";

      if (trabalho.prazo) {
        var seloData = document.createElement("span");
        seloData.className = "selo-data";
        seloData.textContent = "Prazo " + formatarDataCurta(trabalho.prazo).slice(0, 5);
        selos.appendChild(seloData);
      }

      var lembrete = obterLembretePrazo(trabalho);
      if (lembrete) {
        var seloPrazo = document.createElement("span");
        seloPrazo.className = "selo-prazo " + lembrete.classe;
        seloPrazo.textContent = lembrete.texto;
        selos.appendChild(seloPrazo);
      }

      var selo = document.createElement("span");
      selo.className = "selo-tipo";
      selo.textContent = TIPO_LABEL[trabalho.tipo] || "Individual";
      selos.appendChild(selo);

      item.appendChild(selos);

      var titulo = document.createElement("p");
      titulo.className = "trabalho-titulo";
      titulo.textContent = trabalho.titulo;
      item.appendChild(titulo);

      var meta = document.createElement("p");
      meta.className = "trabalho-meta";
      var textoMeta = trabalho.materia;
      if (trabalho.tipo === "grupo" && Array.isArray(trabalho.membros) && trabalho.membros.length > 1) {
        textoMeta += " · integrantes: " + trabalho.membros.map(function (m) { return m.nome; }).join(", ");
      }
      meta.textContent = textoMeta;
      item.appendChild(meta);

      if (trabalho.observacoes) {
        var obs = document.createElement("p");
        obs.className = "trabalho-observacoes";
        var rotuloObs = document.createElement("span");
        rotuloObs.className = "trabalho-observacoes-rotulo";
        rotuloObs.textContent = "Observações: ";
        obs.appendChild(rotuloObs);
        obs.appendChild(document.createTextNode(trabalho.observacoes));
        item.appendChild(obs);
      }

      var semTarefas = trabalho.tipo === "grupo" &&
        (!Array.isArray(trabalho.tarefas) || trabalho.tarefas.length === 0);
      if (semTarefas) {
        var dica = document.createElement("p");
        dica.className = "trabalho-dica";
        dica.textContent = "Próximo passo: toque em Tarefas, passe o código do grupo aos colegas e divida o trabalho.";
        item.appendChild(dica);
      }

      var acoes = document.createElement("div");
      acoes.className = "trabalho-acoes";

      var selectStatus = document.createElement("select");
      selectStatus.setAttribute("aria-label", "Status de " + trabalho.titulo);
      selectStatus.disabled = salvando;
      Object.keys(STATUS_LABEL).forEach(function (chave) {
        var opcao = document.createElement("option");
        opcao.value = chave;
        opcao.textContent = STATUS_LABEL[chave];
        if (chave === trabalho.status) opcao.selected = true;
        selectStatus.appendChild(opcao);
      });
      selectStatus.addEventListener("change", function () {
        trabalho.status = selectStatus.value;
        trabalho.prontoAutomatico = false;
        var status = trabalho.status;
        renderTrabalhos();
        escrever(function () {
          return Dados.atualizarTrabalho(trabalho.id, { status: status, prontoAutomatico: false });
        });
      });
      acoes.appendChild(selectStatus);

      if (trabalho.tipo === "grupo") {
        var tarefasDoTrabalho = Array.isArray(trabalho.tarefas) ? trabalho.tarefas : [];
        var tarefasFeitas = tarefasDoTrabalho.filter(function (t) { return t.feito; }).length;
        var botaoTarefas = document.createElement("button");
        botaoTarefas.type = "button";
        botaoTarefas.className = "botao botao-tarefas" + (semTarefas ? " botao-tarefas-destaque" : "");
        botaoTarefas.textContent = "Tarefas (" + tarefasFeitas + "/" + tarefasDoTrabalho.length + ")";
        botaoTarefas.disabled = salvando;
        botaoTarefas.addEventListener("click", function () {
          abrirDialogTarefas(trabalho);
        });
        acoes.appendChild(botaoTarefas);
      }

      var botaoEditar = document.createElement("button");
      botaoEditar.type = "button";
      botaoEditar.className = "botao botao-texto";
      botaoEditar.textContent = "Editar";
      botaoEditar.disabled = salvando;
      botaoEditar.addEventListener("click", function () {
        abrirDialogEditarTrabalho(trabalho);
      });
      acoes.appendChild(botaoEditar);

      var botaoExcluir = document.createElement("button");
      botaoExcluir.type = "button";
      botaoExcluir.className = "botao botao-texto";
      var dono = souDono(trabalho);
      botaoExcluir.textContent = dono ? "Excluir" : "Sair";
      botaoExcluir.disabled = salvando;
      botaoExcluir.addEventListener("click", function () {
        if (dono) pedirConfirmacaoExclusao(trabalho);
        else pedirConfirmacaoSaida(trabalho);
      });
      acoes.appendChild(botaoExcluir);

      item.appendChild(acoes);
      listaTrabalhos.appendChild(item);
    });
  }

  /* ---------------- tarefas (divisão em trabalhos de grupo) ---------------- */

  // Quando todas as tarefas do trabalho em grupo estão concluídas, o trabalho vai para "Pronto".
  // Se depois uma tarefa for reaberta ou entrar uma nova, volta para "Fazendo" (só quando foi o
  // próprio app que moveu para Pronto; um "Pronto" marcado à mão não é desfeito). "Entregue"
  // nunca é alterado automaticamente.
  function aplicarStatusPelasTarefas(trabalho) {
    var tarefas = Array.isArray(trabalho.tarefas) ? trabalho.tarefas : [];
    var todasFeitas = tarefas.length > 0 && tarefas.every(function (t) { return t.feito; });

    if (todasFeitas) {
      if (trabalho.status === "nao-comecei" || trabalho.status === "fazendo") {
        trabalho.status = "pronto";
        trabalho.prontoAutomatico = true;
      }
    } else if (trabalho.status === "pronto" && trabalho.prontoAutomatico) {
      trabalho.status = "fazendo";
      trabalho.prontoAutomatico = false;
    }
  }

  // Aplica a regra acima e devolve a gravação do novo status, se ele mudou.
  function statusPelasTarefasComGravacao(trabalho) {
    var antes = trabalho.status + "|" + trabalho.prontoAutomatico;
    aplicarStatusPelasTarefas(trabalho);
    if (antes === trabalho.status + "|" + trabalho.prontoAutomatico) return null;
    var status = trabalho.status;
    var auto = trabalho.prontoAutomatico;
    return function () { return Dados.atualizarTrabalho(trabalho.id, { status: status, prontoAutomatico: auto }); };
  }

  var dialogTarefas = document.getElementById("dialog-tarefas");
  var dialogTarefasTitulo = document.getElementById("dialog-tarefas-titulo");
  var formTarefa = document.getElementById("form-tarefa");
  var inputTarefaTexto = document.getElementById("input-tarefa-texto");
  var inputTarefaResponsavel = document.getElementById("input-tarefa-responsavel");
  var listaTarefas = document.getElementById("lista-tarefas");
  var tarefasVazio = document.getElementById("tarefas-vazio");

  var listaIntegrantes = document.getElementById("lista-integrantes");
  var codigoGrupoValor = document.getElementById("codigo-grupo-valor");
  var btnCopiarCodigo = document.getElementById("btn-copiar-codigo");
  var btnTrocarCodigo = document.getElementById("btn-trocar-codigo");
  var btnSairGrupo = document.getElementById("btn-sair-grupo");

  var trabalhoTarefasAtual = null;

  var tarefasAnelArco = document.getElementById("tarefas-anel-arco");
  var tarefasAnelNumero = document.getElementById("tarefas-anel-numero");
  var tarefasProgressoTitulo = document.getElementById("tarefas-progresso-titulo");
  var CIRCUNFERENCIA_ANEL = 213.63;

  function indiceAvatar(membroId) {
    var lista = (trabalhoTarefasAtual && trabalhoTarefasAtual.membros) || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === membroId) return i % 6;
    }
    return 0;
  }

  function atualizarAnelTarefas() {
    if (!trabalhoTarefasAtual) return;
    var tarefas = trabalhoTarefasAtual.tarefas || [];
    var feitas = tarefas.filter(function (t) { return t.feito; }).length;
    var total = tarefas.length;
    var fracao = total === 0 ? 0 : feitas / total;
    tarefasAnelArco.setAttribute("stroke-dasharray",
      (CIRCUNFERENCIA_ANEL * fracao).toFixed(2) + " " + CIRCUNFERENCIA_ANEL);
    tarefasAnelNumero.textContent = feitas + "/" + total;
    if (total === 0) {
      tarefasProgressoTitulo.textContent = "Nenhuma tarefa ainda";
    } else {
      tarefasProgressoTitulo.textContent = feitas + " de " + total + " " +
        (total === 1 ? "tarefa concluída" : "tarefas concluídas");
    }
  }

  function abrirDialogTarefas(trabalho) {
    trabalhoTarefasAtual = trabalho;
    dialogTarefasTitulo.textContent = trabalho.titulo;
    formTarefa.reset();
    renderIntegrantes();
    renderTarefas();
    dialogTarefas.showModal();
    inputTarefaTexto.focus();
  }

  /* ---------------- integrantes do grupo (contas) e código ---------------- */

  function renderSelectResponsavel() {
    var selecionadoAntes = inputTarefaResponsavel.value;
    var membros = (trabalhoTarefasAtual && trabalhoTarefasAtual.membros) || [];

    inputTarefaResponsavel.innerHTML = "";

    var opcaoVazia = document.createElement("option");
    opcaoVazia.value = "";
    opcaoVazia.textContent = "Sem responsável";
    inputTarefaResponsavel.appendChild(opcaoVazia);

    membros.forEach(function (m) {
      var opcao = document.createElement("option");
      opcao.value = m.id;
      opcao.textContent = m.nome;
      inputTarefaResponsavel.appendChild(opcao);
    });

    var aindaExiste = membros.some(function (m) { return m.id === selecionadoAntes; });
    inputTarefaResponsavel.value = aindaExiste ? selecionadoAntes : "";
  }

  function renderIntegrantes() {
    if (!trabalhoTarefasAtual) return;
    var trabalho = trabalhoTarefasAtual;
    var dono = souDono(trabalho);
    listaIntegrantes.innerHTML = "";

    (trabalho.membros || []).forEach(function (m) {
      var chip = document.createElement("li");
      chip.className = "integrante-chip";

      var avatar = document.createElement("span");
      avatar.className = "avatar av-" + indiceAvatar(m.id);
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = m.nome.charAt(0).toUpperCase();
      chip.appendChild(avatar);

      var nomeSpan = document.createElement("span");
      nomeSpan.textContent = m.nome + (m.id === usuarioAtual.id ? " (você)" : "");
      chip.appendChild(nomeSpan);

      if (m.papel === "dono") {
        var selo = document.createElement("span");
        selo.className = "integrante-papel";
        selo.textContent = "dono";
        chip.appendChild(selo);
      } else if (dono) {
        var botaoRemover = document.createElement("button");
        botaoRemover.type = "button";
        botaoRemover.textContent = "×";
        botaoRemover.setAttribute("aria-label", "Remover " + m.nome + " do grupo");
        botaoRemover.addEventListener("click", function () {
          trabalho.membros = trabalho.membros.filter(function (x) { return x.id !== m.id; });
          trabalho.tarefas.forEach(function (t) {
            if (t.responsavelId === m.id) t.responsavelId = "";
          });
          renderIntegrantes();
          renderTarefas();
          renderTrabalhos();
          escrever(function () { return Dados.sairDoTrabalho(trabalho.id, m.id); });
        });
        chip.appendChild(botaoRemover);
      }

      listaIntegrantes.appendChild(chip);
    });

    codigoGrupoValor.textContent = trabalho.codigo || "…";
    btnTrocarCodigo.hidden = !dono;
    btnSairGrupo.hidden = dono;
    btnCopiarCodigo.disabled = !trabalho.codigo;
    btnTrocarCodigo.disabled = !trabalho.codigo;

    renderSelectResponsavel();
  }

  var timerCopiado = null;
  btnCopiarCodigo.addEventListener("click", function () {
    if (!trabalhoTarefasAtual || !trabalhoTarefasAtual.codigo) return;
    var codigo = trabalhoTarefasAtual.codigo;
    function marcar(texto) {
      btnCopiarCodigo.textContent = texto;
      clearTimeout(timerCopiado);
      timerCopiado = setTimeout(function () { btnCopiarCodigo.textContent = "Copiar"; }, 1800);
    }
    function selecionarNaTela() {
      try {
        var faixa = document.createRange();
        faixa.selectNodeContents(codigoGrupoValor);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(faixa);
      } catch (e) { /* ignora */ }
      marcar("Selecionado");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo).then(function () { marcar("Copiado"); }, selecionarNaTela);
    } else {
      selecionarNaTela();
    }
  });

  btnTrocarCodigo.addEventListener("click", function () {
    var trabalho = trabalhoTarefasAtual;
    if (!trabalho || !souDono(trabalho)) return;
    pedirConfirmacao({
      titulo: "Trocar o código do grupo?",
      texto: "O código atual deixa de funcionar para quem ainda não entrou. Quem já está no grupo continua nele.",
      rotulo: "Trocar código",
      aoConfirmar: function () {
        escrever(function () {
          return Dados.trocarCodigo(trabalho.id).then(function (novo) {
            trabalho.codigo = novo;
            if (trabalhoTarefasAtual === trabalho) renderIntegrantes();
          });
        });
      }
    });
  });

  btnSairGrupo.addEventListener("click", function () {
    if (trabalhoTarefasAtual) pedirConfirmacaoSaida(trabalhoTarefasAtual);
  });

  function renderTarefas() {
    if (!trabalhoTarefasAtual) return;
    var trabalho = trabalhoTarefasAtual;
    var tarefas = trabalho.tarefas || [];
    listaTarefas.innerHTML = "";
    tarefasVazio.hidden = tarefas.length !== 0;
    atualizarAnelTarefas();

    tarefas.forEach(function (tarefa) {
      var item = document.createElement("li");
      item.className = "tarefa-item" + (tarefa.feito ? " tarefa-feita" : "");
      var salvando = ehTemporario(tarefa);

      var rotulo = document.createElement("label");
      rotulo.className = "tarefa-checkbox";

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!tarefa.feito;
      checkbox.disabled = salvando;
      checkbox.setAttribute("aria-label", "Marcar '" + tarefa.texto + "' como concluída");
      checkbox.addEventListener("change", function () {
        tarefa.feito = checkbox.checked;
        var gravaStatus = statusPelasTarefasComGravacao(trabalho);
        var feito = tarefa.feito;
        renderTarefas();
        renderTrabalhos();
        escrever(function () {
          return Dados.atualizarTarefa(tarefa.id, { feito: feito }).then(function () {
            if (gravaStatus) return gravaStatus();
          });
        });
      });
      rotulo.appendChild(checkbox);

      var textoSpan = document.createElement("span");
      textoSpan.className = "tarefa-texto";
      textoSpan.textContent = tarefa.texto;
      rotulo.appendChild(textoSpan);

      item.appendChild(rotulo);

      var nomeResp = tarefa.responsavelId ? nomeDoMembro(trabalho, tarefa.responsavelId) : "";
      if (nomeResp) {
        var responsavelSpan = document.createElement("span");
        responsavelSpan.className = "tarefa-responsavel av-" + indiceAvatar(tarefa.responsavelId);
        responsavelSpan.textContent = nomeResp;
        item.appendChild(responsavelSpan);
      }

      var botaoExcluirTarefa = document.createElement("button");
      botaoExcluirTarefa.type = "button";
      botaoExcluirTarefa.className = "botao botao-texto tarefa-excluir";
      botaoExcluirTarefa.textContent = "Excluir";
      botaoExcluirTarefa.disabled = salvando;
      botaoExcluirTarefa.addEventListener("click", function () {
        trabalho.tarefas = trabalho.tarefas.filter(function (t) { return t.id !== tarefa.id; });
        var gravaStatus = statusPelasTarefasComGravacao(trabalho);
        renderTarefas();
        renderTrabalhos();
        escrever(function () {
          return Dados.excluirTarefa(tarefa.id).then(function () {
            if (gravaStatus) return gravaStatus();
          });
        });
      });
      item.appendChild(botaoExcluirTarefa);

      listaTarefas.appendChild(item);
    });
  }

  formTarefa.addEventListener("submit", function (evento) {
    evento.preventDefault();
    if (!trabalhoTarefasAtual) return;
    var trabalho = trabalhoTarefasAtual;
    if (ehTemporario(trabalho)) return;

    var texto = inputTarefaTexto.value.trim();
    if (!texto) return;
    var responsavelId = inputTarefaResponsavel.value;

    var nova = { id: gerarIdTemporario(), texto: texto, responsavelId: responsavelId, feito: false };
    trabalho.tarefas.push(nova);
    var gravaStatus = statusPelasTarefasComGravacao(trabalho);

    formTarefa.reset();
    renderTarefas();
    renderTrabalhos();
    inputTarefaTexto.focus();

    escrever(function () {
      return Dados.criarTarefa(trabalho.id, texto, responsavelId).then(function () {
        if (gravaStatus) return gravaStatus();
      });
    });
  });

  document.querySelectorAll("[data-fechar-tarefas]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      dialogTarefas.close();
    });
  });

  dialogTarefas.addEventListener("close", function () {
    trabalhoTarefasAtual = null;
  });

  /* ---------------- entrar em um trabalho com código ---------------- */

  var dialogCodigo = document.getElementById("dialog-codigo");
  var formCodigo = document.getElementById("form-codigo");
  var inputCodigo = document.getElementById("input-codigo");
  var codigoErro = document.getElementById("codigo-erro");
  var btnCodigoEntrar = document.getElementById("btn-codigo-entrar");
  var btnEntrarCodigo = document.getElementById("btn-entrar-codigo");

  btnEntrarCodigo.addEventListener("click", function () {
    formCodigo.reset();
    codigoErro.hidden = true;
    dialogCodigo.showModal();
    inputCodigo.focus();
  });

  document.querySelectorAll("[data-fechar-codigo]").forEach(function (botao) {
    botao.addEventListener("click", function () { dialogCodigo.close(); });
  });

  var MENSAGENS_CODIGO = {
    codigo_invalido: "Código não encontrado. Confira com quem criou o trabalho.",
    rede: "Sem conexão com o servidor. Tente de novo.",
    sem_sessao: "Sua sessão expirou. Entre de novo."
  };

  formCodigo.addEventListener("submit", function (evento) {
    evento.preventDefault();
    var codigo = inputCodigo.value.trim();
    if (!codigo || !usuarioAtual) return;
    codigoErro.hidden = true;
    btnCodigoEntrar.disabled = true;

    pendentes += 1;
    atualizarOcupado();
    Dados.entrarPorCodigo(codigo).then(function () {
      dialogCodigo.close();
      mostrarAviso("Você entrou no trabalho.", false);
    }).catch(function (e) {
      codigoErro.textContent = MENSAGENS_CODIGO[e && e.codigo] || "Não foi possível entrar. Tente de novo.";
      codigoErro.hidden = false;
      inputCodigo.focus();
    }).then(function () {
      btnCodigoEntrar.disabled = false;
      pendentes = Math.max(0, pendentes - 1);
      if (pendentes === 0 && usuarioAtual) agendarRecarga(0);
      atualizarOcupado();
    });
  });

  /* ---------------- importar trabalhos antigos (localStorage) ---------------- */

  var dialogImportar = document.getElementById("dialog-importar");
  var dialogImportarTexto = document.getElementById("dialog-importar-texto");
  var btnImportarSim = document.getElementById("btn-importar-sim");
  var btnImportarNao = document.getElementById("btn-importar-nao");

  var PREFIXO_LOCAL = "trabalhos:v1:";
  var CHAVE_USUARIOS_ANTIGA = "combinado:usuarios:v1";

  function limparNome(texto) {
    return Dados.normalizarUsuario(String(texto || "").replace(/\s+/g, ""));
  }

  function lerTrabalhosLocais(perfil) {
    var alvos = [limparNome(perfil.usuario), limparNome(perfil.nome)];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var chave = localStorage.key(i);
        if (!chave || chave.indexOf(PREFIXO_LOCAL) !== 0) continue;
        if (alvos.indexOf(limparNome(chave.slice(PREFIXO_LOCAL.length))) === -1) continue;
        var salvo = JSON.parse(localStorage.getItem(chave));
        if (salvo && Array.isArray(salvo.trabalhos)) {
          return salvo.trabalhos.filter(function (t) { return t && t.titulo; }).map(function (t) {
            return {
              titulo: String(t.titulo).slice(0, 120),
              materia: String(t.materia || ""),
              prazo: /^\d{4}-\d{2}-\d{2}$/.test(t.prazo || "") ? t.prazo : "",
              tipo: t.tipo === "grupo" ? "grupo" : "individual",
              cor: corValida(t.cor),
              observacoes: String(t.observacoes || ""),
              status: STATUS_LABEL[t.status] ? t.status : "nao-comecei",
              prontoAutomatico: !!t.prontoAutomatico,
              tarefas: Array.isArray(t.tarefas) ? t.tarefas : []
            };
          });
        }
      }
    } catch (e) { /* sem armazenamento ou dado corrompido: nada a importar */ }
    return [];
  }

  // A conta antiga guardava a senha em texto puro neste navegador: some junto com a decisão.
  function apagarContaAntiga(perfil) {
    try {
      var bruto = localStorage.getItem(CHAVE_USUARIOS_ANTIGA);
      if (!bruto) return;
      var contas = JSON.parse(bruto);
      if (!contas || typeof contas !== "object") return;
      var alvos = [limparNome(perfil.usuario), limparNome(perfil.nome)];
      Object.keys(contas).forEach(function (nome) {
        if (alvos.indexOf(limparNome(nome)) !== -1) delete contas[nome];
      });
      localStorage.setItem(CHAVE_USUARIOS_ANTIGA, JSON.stringify(contas));
    } catch (e) { /* ignora */ }
  }

  function oferecerImportacao() {
    var perfil = usuarioAtual;
    if (!perfil || perfil.importou_local) return;
    var lista = lerTrabalhosLocais(perfil);
    if (lista.length === 0) return;

    dialogImportarTexto.textContent =
      "Encontramos " + lista.length + (lista.length === 1 ? " trabalho salvo" : " trabalhos salvos") +
      " neste navegador, da época em que o Combinado não tinha login de verdade. " +
      "Quer trazer para a sua conta? Nomes de integrantes digitados à mão não vêm junto: " +
      "para trabalhar em grupo, use o código do grupo.";

    function encerrar() {
      perfil.importou_local = true;
      apagarContaAntiga(perfil);
      btnImportarSim.disabled = false;
      btnImportarNao.disabled = false;
      dialogImportar.close();
    }

    btnImportarNao.onclick = function () {
      btnImportarSim.disabled = true;
      btnImportarNao.disabled = true;
      Dados.marcarImportado(perfil.id).catch(function () { /* tenta de novo na próxima entrada */ }).then(encerrar);
    };

    btnImportarSim.onclick = function () {
      btnImportarSim.disabled = true;
      btnImportarNao.disabled = true;
      pendentes += 1;
      atualizarOcupado();
      Dados.importar(lista, perfil.id, perfil.nome || perfil.usuario).then(function (n) {
        return Dados.marcarImportado(perfil.id).then(function () { return n; });
      }).then(function (n) {
        mostrarAviso(n + (n === 1 ? " trabalho importado." : " trabalhos importados."), false);
        encerrar();
      }).catch(function (e) {
        mostrarAviso(MENSAGENS_ESCRITA[e && e.codigo] || "Não foi possível importar agora. Tente de novo ao entrar.", false);
        btnImportarSim.disabled = false;
        btnImportarNao.disabled = false;
        dialogImportar.close();
      }).then(function () {
        pendentes = Math.max(0, pendentes - 1);
        if (pendentes === 0 && usuarioAtual) agendarRecarga(0);
        atualizarOcupado();
      });
    };

    dialogImportar.showModal();
  }

  /* ---------------- inicialização ---------------- */

  atualizarOcupado();
  telaAuth.hidden = true;
  appPrincipal.hidden = true;

  if (!Dados.iniciar()) {
    mostrarTelaAuth();
    authConfigErro.hidden = false;
  } else {
    Dados.aoMudarSessao(function (evento) {
      if (evento === "SIGNED_OUT" && usuarioAtual && !saindo) {
        voltarParaLogin("Sua sessão terminou. Entre de novo.");
      }
    });
    Dados.sessaoAtual().then(function (perfil) {
      if (perfil) return entrarComoPerfil(perfil);
      mostrarTelaAuth();
    }).catch(function () {
      mostrarTelaAuth();
    });
  }
})();
