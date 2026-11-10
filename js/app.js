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
        status: "nao-comecei"
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

  function renderTrabalhos() {
    listaTrabalhos.innerHTML = "";

    if (state.trabalhos.length === 0) {
      listaVazia.hidden = false;
      return;
    }
    listaVazia.hidden = true;

    state.trabalhos.forEach(function (trabalho) {
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
      item.appendChild(titulo);

      var meta = document.createElement("p");
      meta.className = "trabalho-meta";
      var textoMeta = trabalho.materia;
      if (trabalho.prazo) {
        textoMeta += " · prazo " + formatarDataCurta(trabalho.prazo);
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
