/* =========================================================
   Meus trabalhos — lógica do app
   Protótipo 01: título, matéria, prazo, tipo, status, excluir
   ========================================================= */
(function () {
  "use strict";

  var CHAVE_USUARIOS = "combinado:usuarios:v1";
  var CHAVE_SESSAO = "combinado:sessao:v1";
  var CHAVE_ARMAZENAMENTO_BASE = "trabalhos:v1";

  var usuarioAtual = null;

  /* ---------------- contas (cadastro/login) ---------------- */

  function carregarUsuarios() {
    try {
      var bruto = localStorage.getItem(CHAVE_USUARIOS);
      if (!bruto) return {};
      var salvo = JSON.parse(bruto);
      return (salvo && typeof salvo === "object") ? salvo : {};
    } catch (erro) {
      return {};
    }
  }

  function salvarUsuarios(usuarios) {
    try {
      localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
    } catch (erro) {
      // localStorage indisponível — segue só em memória
    }
  }

  function salvarSessao(usuario) {
    try {
      localStorage.setItem(CHAVE_SESSAO, usuario);
    } catch (erro) {
      // ignora
    }
  }

  function carregarSessao() {
    try {
      return localStorage.getItem(CHAVE_SESSAO) || "";
    } catch (erro) {
      return "";
    }
  }

  function limparSessao() {
    try {
      localStorage.removeItem(CHAVE_SESSAO);
    } catch (erro) {
      // ignora
    }
  }

  var telaAuth = document.getElementById("tela-auth");
  var appPrincipal = document.getElementById("app-principal");
  var formAuth = document.getElementById("form-auth");
  var inputUsuarioAuth = document.getElementById("input-usuario-auth");
  var inputSenhaAuth = document.getElementById("input-senha-auth");
  var authErro = document.getElementById("auth-erro");
  var authTitulo = document.getElementById("auth-titulo");
  var btnAuthPrincipal = document.getElementById("btn-auth-principal");
  var btnAuthAlternar = document.getElementById("btn-auth-alternar");
  var authAlternarTexto = document.getElementById("auth-alternar-texto");
  var cabecalhoUsuarioNome = document.getElementById("cabecalho-usuario-nome");
  var btnSair = document.getElementById("btn-sair");

  var modoCadastro = false;

  function mostrarErroAuth(mensagem) {
    authErro.textContent = mensagem;
    authErro.hidden = false;
  }

  function limparErroAuth() {
    authErro.hidden = true;
    authErro.textContent = "";
  }

  function alternarModoAuth() {
    modoCadastro = !modoCadastro;
    limparErroAuth();
    if (modoCadastro) {
      authTitulo.textContent = "Criar conta";
      btnAuthPrincipal.textContent = "Criar conta";
      authAlternarTexto.textContent = "Já tem conta?";
      btnAuthAlternar.textContent = "Entrar";
    } else {
      authTitulo.textContent = "Entrar";
      btnAuthPrincipal.textContent = "Entrar";
      authAlternarTexto.textContent = "Não tem conta?";
      btnAuthAlternar.textContent = "Criar conta";
    }
  }

  btnAuthAlternar.addEventListener("click", alternarModoAuth);

  formAuth.addEventListener("submit", function (evento) {
    evento.preventDefault();
    limparErroAuth();

    var usuario = inputUsuarioAuth.value.trim();
    var senha = inputSenhaAuth.value;
    if (!usuario || !senha) return;

    var usuarios = carregarUsuarios();

    if (modoCadastro) {
      if (usuarios[usuario]) {
        mostrarErroAuth("Esse usuário já existe. Tente entrar.");
        return;
      }
      usuarios[usuario] = { senha: senha };
      salvarUsuarios(usuarios);
      entrarComoUsuario(usuario);
    } else {
      var conta = usuarios[usuario];
      if (!conta || conta.senha !== senha) {
        mostrarErroAuth("Usuário ou senha incorretos.");
        return;
      }
      entrarComoUsuario(usuario);
    }
  });

  function entrarComoUsuario(usuario) {
    usuarioAtual = usuario;
    salvarSessao(usuario);
    CHAVE_ARMAZENAMENTO = CHAVE_ARMAZENAMENTO_BASE + ":" + usuario;
    formAuth.reset();
    telaAuth.hidden = true;
    appPrincipal.hidden = false;
    cabecalhoUsuarioNome.textContent = usuario;
    state.trabalhos = [];
    carregarEstado();
    renderTrabalhos();
  }

  btnSair.addEventListener("click", function () {
    limparSessao();
    usuarioAtual = null;
    state.trabalhos = [];
    appPrincipal.hidden = true;
    telaAuth.hidden = false;
    modoCadastro = false;
    authTitulo.textContent = "Entrar";
    btnAuthPrincipal.textContent = "Entrar";
    authAlternarTexto.textContent = "Não tem conta?";
    btnAuthAlternar.textContent = "Criar conta";
    limparErroAuth();
    inputUsuarioAuth.focus();
  });

  var CHAVE_ARMAZENAMENTO = CHAVE_ARMAZENAMENTO_BASE;

  var STATUS_LABEL = {
    "nao-comecei": "Não comecei",
    "fazendo": "Fazendo",
    "entregue": "Entregue"
  };

  var TIPO_LABEL = {
    "individual": "Individual",
    "grupo": "Em grupo"
  };

  var state = {
    trabalhos: []   // { id, titulo, materia, prazo, tipo, status }
  };

  /* ---------------- persistência ---------------- */

  function salvarEstado() {
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(state));
    } catch (erro) {
      // localStorage indisponível — segue só em memória
    }
  }

  function carregarEstado() {
    var bruto;
    try {
      bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    } catch (erro) {
      bruto = null;
    }
    if (!bruto) return;
    try {
      var salvo = JSON.parse(bruto);
      if (salvo && Array.isArray(salvo.trabalhos)) {
        state.trabalhos = salvo.trabalhos;
      }
    } catch (erro) {
      // JSON corrompido — ignora e começa do zero
    }
  }

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- referências de elementos ---------------- */

  var listaTrabalhos = document.getElementById("lista-trabalhos");
  var listaVazia = document.getElementById("lista-vazia");
  var btnNovoTrabalho = document.getElementById("btn-novo-trabalho");
  var progressoTrabalhos = document.getElementById("progresso-trabalhos");
  var progressoTexto = document.getElementById("progresso-texto");
  var progressoBarra = document.getElementById("progresso-barra");
  var progressoBarraPreenchida = document.getElementById("progresso-barra-preenchida");
  var filtrosBarra = document.getElementById("filtros-barra");
  var selectOrdenar = document.getElementById("select-ordenar");
  var selectFiltroMateria = document.getElementById("select-filtro-materia");

  var TEXTO_LISTA_VAZIA = 'Nenhum trabalho cadastrado ainda. Toque em "Novo trabalho" para começar.';
  var TEXTO_LISTA_SEM_RESULTADO = "Nenhum trabalho encontrado com esse filtro.";

  var ordenacaoAtual = "prazo";
  var filtroMateriaAtual = "";

  selectOrdenar.addEventListener("change", function () {
    ordenacaoAtual = selectOrdenar.value;
    renderTrabalhos();
  });

  selectFiltroMateria.addEventListener("change", function () {
    filtroMateriaAtual = selectFiltroMateria.value;
    renderTrabalhos();
  });

  var dialogTrabalho = document.getElementById("dialog-trabalho");
  var dialogTrabalhoTitulo = document.getElementById("dialog-trabalho-titulo");
  var formTrabalho = document.getElementById("form-trabalho");
  var inputTitulo = document.getElementById("input-titulo-trabalho");
  var inputMateria = document.getElementById("input-materia-trabalho");
  var inputPrazo = document.getElementById("input-prazo-trabalho");

  var trabalhoEmEdicao = null;

  var dialogConfirmar = document.getElementById("dialog-confirmar");
  var dialogConfirmarTexto = document.getElementById("dialog-confirmar-texto");
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

  function abrirDialogNovoTrabalho() {
    trabalhoEmEdicao = null;
    dialogTrabalhoTitulo.textContent = "Novo trabalho";
    formTrabalho.reset();
    dialogTrabalho.showModal();
    inputTitulo.focus();
  }

  function abrirDialogEditarTrabalho(trabalho) {
    trabalhoEmEdicao = trabalho;
    dialogTrabalhoTitulo.textContent = "Editar trabalho";
    inputTitulo.value = trabalho.titulo;
    inputMateria.value = trabalho.materia;
    inputPrazo.value = trabalho.prazo || "";
    var radioTipo = formTrabalho.querySelector('input[name="tipo-trabalho"][value="' + trabalho.tipo + '"]');
    if (radioTipo) radioTipo.checked = true;
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
    if (!titulo || !materia) return;

    var tipoSelecionado = formTrabalho.querySelector('input[name="tipo-trabalho"]:checked');

    if (trabalhoEmEdicao) {
      trabalhoEmEdicao.titulo = titulo;
      trabalhoEmEdicao.materia = materia;
      trabalhoEmEdicao.prazo = inputPrazo.value || "";
      trabalhoEmEdicao.tipo = tipoSelecionado ? tipoSelecionado.value : "individual";
      trabalhoEmEdicao = null;
    } else {
      state.trabalhos.push({
        id: gerarId(),
        titulo: titulo,
        materia: materia,
        prazo: inputPrazo.value || "",
        tipo: tipoSelecionado ? tipoSelecionado.value : "individual",
        status: "nao-comecei",
        tarefas: [],
        integrantes: []
      });
    }

    salvarEstado();
    dialogTrabalho.close();
    renderTrabalhos();
  });

  /* ---------------- lista de trabalhos ---------------- */

  function pedirConfirmacaoExclusao(trabalho) {
    dialogConfirmarTexto.textContent =
      'Tem certeza que quer excluir "' + trabalho.titulo + '"? Essa ação não pode ser desfeita.';
    btnConfirmarExclusao.onclick = function () {
      state.trabalhos = state.trabalhos.filter(function (t) { return t.id !== trabalho.id; });
      salvarEstado();
      dialogConfirmar.close();
      renderTrabalhos();
    };
    dialogConfirmar.showModal();
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
      return !filtroMateriaAtual || t.materia === filtroMateriaAtual;
    });

    if (ordenacaoAtual === "titulo") {
      filtrados.sort(function (a, b) { return a.titulo.localeCompare(b.titulo, "pt-BR"); });
    } else if (ordenacaoAtual === "recentes") {
      filtrados.reverse();
    } else {
      filtrados.sort(compararPorPrazo);
    }

    return filtrados;
  }

  function atualizarProgresso() {
    var total = state.trabalhos.length;
    progressoTrabalhos.hidden = total === 0;
    if (total === 0) return;

    var entregues = state.trabalhos.filter(function (t) { return t.status === "entregue"; }).length;
    var percentual = Math.round((entregues / total) * 100);

    progressoTexto.textContent = entregues + " de " + total + " " +
      (total === 1 ? "trabalho entregue" : "trabalhos entregues");
    progressoBarraPreenchida.style.width = percentual + "%";
    progressoBarra.setAttribute("aria-valuenow", String(percentual));
  }

  function renderTrabalhos() {
    atualizarProgresso();
    atualizarSelectFiltroMateria();
    filtrosBarra.hidden = state.trabalhos.length === 0;

    listaTrabalhos.innerHTML = "";

    if (state.trabalhos.length === 0) {
      listaVazia.textContent = TEXTO_LISTA_VAZIA;
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
      var item = document.createElement("li");
      item.className = "trabalho-card";
      item.setAttribute("data-status", trabalho.status);

      var titulo = document.createElement("p");
      titulo.className = "trabalho-titulo";
      titulo.textContent = trabalho.titulo;
      var selo = document.createElement("span");
      selo.className = "selo-tipo";
      selo.textContent = TIPO_LABEL[trabalho.tipo] || "Individual";
      titulo.appendChild(selo);

      var lembrete = obterLembretePrazo(trabalho);
      if (lembrete) {
        var seloPrazo = document.createElement("span");
        seloPrazo.className = "selo-prazo " + lembrete.classe;
        seloPrazo.textContent = lembrete.texto;
        titulo.appendChild(seloPrazo);
      }

      item.appendChild(titulo);

      var meta = document.createElement("p");
      meta.className = "trabalho-meta";
      var textoMeta = trabalho.materia;
      if (trabalho.prazo) {
        textoMeta += " · prazo " + formatarDataCurta(trabalho.prazo);
      }
      if (trabalho.tipo === "grupo" && Array.isArray(trabalho.integrantes) && trabalho.integrantes.length > 0) {
        textoMeta += " · integrantes: " + trabalho.integrantes.join(", ");
      }
      meta.textContent = textoMeta;
      item.appendChild(meta);

      var acoes = document.createElement("div");
      acoes.className = "trabalho-acoes";

      var selectStatus = document.createElement("select");
      selectStatus.setAttribute("aria-label", "Status de " + trabalho.titulo);
      Object.keys(STATUS_LABEL).forEach(function (chave) {
        var opcao = document.createElement("option");
        opcao.value = chave;
        opcao.textContent = STATUS_LABEL[chave];
        if (chave === trabalho.status) opcao.selected = true;
        selectStatus.appendChild(opcao);
      });
      selectStatus.addEventListener("change", function () {
        trabalho.status = selectStatus.value;
        salvarEstado();
        renderTrabalhos();
      });
      acoes.appendChild(selectStatus);

      if (trabalho.tipo === "grupo") {
        var tarefasDoTrabalho = Array.isArray(trabalho.tarefas) ? trabalho.tarefas : [];
        var tarefasFeitas = tarefasDoTrabalho.filter(function (t) { return t.feito; }).length;
        var botaoTarefas = document.createElement("button");
        botaoTarefas.type = "button";
        botaoTarefas.className = "botao botao-texto";
        botaoTarefas.textContent = "Tarefas (" + tarefasFeitas + "/" + tarefasDoTrabalho.length + ")";
        botaoTarefas.addEventListener("click", function () {
          abrirDialogTarefas(trabalho);
        });
        acoes.appendChild(botaoTarefas);
      }

      var botaoEditar = document.createElement("button");
      botaoEditar.type = "button";
      botaoEditar.className = "botao botao-texto";
      botaoEditar.textContent = "Editar";
      botaoEditar.addEventListener("click", function () {
        abrirDialogEditarTrabalho(trabalho);
      });
      acoes.appendChild(botaoEditar);

      var botaoExcluir = document.createElement("button");
      botaoExcluir.type = "button";
      botaoExcluir.className = "botao botao-texto";
      botaoExcluir.textContent = "Excluir";
      botaoExcluir.addEventListener("click", function () {
        pedirConfirmacaoExclusao(trabalho);
      });
      acoes.appendChild(botaoExcluir);

      item.appendChild(acoes);
      listaTrabalhos.appendChild(item);
    });
  }

  /* ---------------- tarefas (divisão em trabalhos de grupo) ---------------- */

  var dialogTarefas = document.getElementById("dialog-tarefas");
  var dialogTarefasTitulo = document.getElementById("dialog-tarefas-titulo");
  var formTarefa = document.getElementById("form-tarefa");
  var inputTarefaTexto = document.getElementById("input-tarefa-texto");
  var inputTarefaResponsavel = document.getElementById("input-tarefa-responsavel");
  var listaTarefas = document.getElementById("lista-tarefas");
  var tarefasVazio = document.getElementById("tarefas-vazio");

  var formIntegrante = document.getElementById("form-integrante");
  var inputIntegranteNome = document.getElementById("input-integrante-nome");
  var listaIntegrantes = document.getElementById("lista-integrantes");
  var integrantesVazio = document.getElementById("integrantes-vazio");

  var trabalhoTarefasAtual = null;

  function abrirDialogTarefas(trabalho) {
    trabalhoTarefasAtual = trabalho;
    if (!Array.isArray(trabalho.tarefas)) trabalho.tarefas = [];
    if (!Array.isArray(trabalho.integrantes)) trabalho.integrantes = [];
    dialogTarefasTitulo.textContent = "Tarefas de " + trabalho.titulo;
    formTarefa.reset();
    formIntegrante.reset();
    renderIntegrantes();
    renderTarefas();
    dialogTarefas.showModal();
    inputIntegranteNome.focus();
  }

  /* ---------------- integrantes do grupo ---------------- */

  function renderSelectResponsavel() {
    var selecionadoAntes = inputTarefaResponsavel.value;
    var integrantes = (trabalhoTarefasAtual && trabalhoTarefasAtual.integrantes) || [];

    inputTarefaResponsavel.innerHTML = "";

    var opcaoVazia = document.createElement("option");
    opcaoVazia.value = "";
    opcaoVazia.textContent = "Sem responsável";
    inputTarefaResponsavel.appendChild(opcaoVazia);

    integrantes.forEach(function (nome) {
      var opcao = document.createElement("option");
      opcao.value = nome;
      opcao.textContent = nome;
      inputTarefaResponsavel.appendChild(opcao);
    });

    if (integrantes.indexOf(selecionadoAntes) !== -1) {
      inputTarefaResponsavel.value = selecionadoAntes;
    }
  }

  function renderIntegrantes() {
    if (!trabalhoTarefasAtual) return;
    var integrantes = trabalhoTarefasAtual.integrantes || [];
    listaIntegrantes.innerHTML = "";
    integrantesVazio.hidden = integrantes.length !== 0;

    integrantes.forEach(function (nome) {
      var chip = document.createElement("li");
      chip.className = "integrante-chip";

      var nomeSpan = document.createElement("span");
      nomeSpan.textContent = nome;
      chip.appendChild(nomeSpan);

      var botaoRemover = document.createElement("button");
      botaoRemover.type = "button";
      botaoRemover.textContent = "×";
      botaoRemover.setAttribute("aria-label", "Remover " + nome + " do grupo");
      botaoRemover.addEventListener("click", function () {
        trabalhoTarefasAtual.integrantes = trabalhoTarefasAtual.integrantes.filter(function (n) {
          return n !== nome;
        });
        salvarEstado();
        renderIntegrantes();
        renderSelectResponsavel();
        renderTrabalhos();
      });
      chip.appendChild(botaoRemover);

      listaIntegrantes.appendChild(chip);
    });

    renderSelectResponsavel();
  }

  formIntegrante.addEventListener("submit", function (evento) {
    evento.preventDefault();
    if (!trabalhoTarefasAtual) return;

    var nome = inputIntegranteNome.value.trim();
    if (!nome) return;

    if (!Array.isArray(trabalhoTarefasAtual.integrantes)) trabalhoTarefasAtual.integrantes = [];
    var jaExiste = trabalhoTarefasAtual.integrantes.some(function (n) {
      return n.toLowerCase() === nome.toLowerCase();
    });
    if (jaExiste) {
      inputIntegranteNome.value = "";
      inputIntegranteNome.focus();
      return;
    }

    trabalhoTarefasAtual.integrantes.push(nome);
    salvarEstado();
    formIntegrante.reset();
    renderIntegrantes();
    renderTrabalhos();
    inputIntegranteNome.focus();
  });

  function renderTarefas() {
    if (!trabalhoTarefasAtual) return;
    var tarefas = trabalhoTarefasAtual.tarefas || [];
    listaTarefas.innerHTML = "";
    tarefasVazio.hidden = tarefas.length !== 0;

    tarefas.forEach(function (tarefa) {
      var item = document.createElement("li");
      item.className = "tarefa-item" + (tarefa.feito ? " tarefa-feita" : "");

      var rotulo = document.createElement("label");
      rotulo.className = "tarefa-checkbox";

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!tarefa.feito;
      checkbox.setAttribute("aria-label", "Marcar '" + tarefa.texto + "' como concluída");
      checkbox.addEventListener("change", function () {
        tarefa.feito = checkbox.checked;
        salvarEstado();
        renderTarefas();
        renderTrabalhos();
      });
      rotulo.appendChild(checkbox);

      var textoSpan = document.createElement("span");
      textoSpan.className = "tarefa-texto";
      textoSpan.textContent = tarefa.texto;
      rotulo.appendChild(textoSpan);

      item.appendChild(rotulo);

      if (tarefa.responsavel) {
        var responsavelSpan = document.createElement("span");
        responsavelSpan.className = "tarefa-responsavel";
        responsavelSpan.textContent = tarefa.responsavel;
        item.appendChild(responsavelSpan);
      }

      var botaoExcluirTarefa = document.createElement("button");
      botaoExcluirTarefa.type = "button";
      botaoExcluirTarefa.className = "botao botao-texto tarefa-excluir";
      botaoExcluirTarefa.textContent = "Excluir";
      botaoExcluirTarefa.addEventListener("click", function () {
        trabalhoTarefasAtual.tarefas = trabalhoTarefasAtual.tarefas.filter(function (t) {
          return t.id !== tarefa.id;
        });
        salvarEstado();
        renderTarefas();
        renderTrabalhos();
      });
      item.appendChild(botaoExcluirTarefa);

      listaTarefas.appendChild(item);
    });
  }

  formTarefa.addEventListener("submit", function (evento) {
    evento.preventDefault();
    if (!trabalhoTarefasAtual) return;

    var texto = inputTarefaTexto.value.trim();
    if (!texto) return;
    var responsavel = inputTarefaResponsavel.value.trim();

    if (!Array.isArray(trabalhoTarefasAtual.tarefas)) trabalhoTarefasAtual.tarefas = [];
    trabalhoTarefasAtual.tarefas.push({
      id: gerarId(),
      texto: texto,
      responsavel: responsavel,
      feito: false
    });

    salvarEstado();
    formTarefa.reset();
    renderTarefas();
    renderTrabalhos();
    inputTarefaTexto.focus();
  });

  document.querySelectorAll("[data-fechar-tarefas]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      dialogTarefas.close();
    });
  });

  dialogTarefas.addEventListener("close", function () {
    trabalhoTarefasAtual = null;
  });

  /* ---------------- inicialização ---------------- */

  var sessaoSalva = carregarSessao();
  if (sessaoSalva && carregarUsuarios()[sessaoSalva]) {
    entrarComoUsuario(sessaoSalva);
  } else {
    telaAuth.hidden = false;
    appPrincipal.hidden = true;
    inputUsuarioAuth.focus();
  }
})();
