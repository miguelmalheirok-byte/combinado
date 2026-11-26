/* =========================================================
   Combinado — camada de dados (login, trabalhos, grupos)
   Fala com o Supabase; o resto do app não conhece o Supabase.
   Todas as funções devolvem Promise e rejeitam com Error cujo
   .codigo é um destes: usuario_existe, credenciais, senha_curta,
   usuario_invalido, confirmacao_ligada, email_recusado, codigo_invalido,
   somente_dono, responsavel_invalido, rede, sem_sessao, config, outro
   ========================================================= */
(function () {
  "use strict";

  var cliente = null;
  var canal = null;

  // O "e-mail" de cada conta é usuario@dominio. O domínio é de mentira (ninguém recebe e-mail
  // nele) e pode ser trocado em js/config.js se o servidor recusar este.
  function dominioFalso() {
    var cfg = window.COMBINADO_CONFIG || {};
    var d = String(cfg.DOMINIO_EMAIL || "combinado.app").replace(/^@/, "");
    return "@" + d;
  }
  var REGRA_USUARIO = /^[a-z0-9_.-]{3,30}$/;

  function erro(codigo, original) {
    var e = new Error(codigo);
    e.codigo = codigo;
    e.original = original || null;
    return e;
  }

  function traduzir(e) {
    if (!e) return erro("outro");
    var msg = String(e.message || e.msg || "");
    var cod = String(e.code || e.error_code || "");
    if (/codigo_invalido/.test(msg)) return erro("codigo_invalido", e);
    if (/somente_dono/.test(msg)) return erro("somente_dono", e);
    if (/responsavel_invalido/.test(msg)) return erro("responsavel_invalido", e);
    if (/already registered|already been registered|user_already_exists/i.test(msg + " " + cod)) return erro("usuario_existe", e);
    if (/invalid login credentials|invalid_credentials/i.test(msg + " " + cod)) return erro("credenciais", e);
    if (/at least \d+ characters|weak_password/i.test(msg + " " + cod)) return erro("senha_curta", e);
    if (/email_address_invalid|invalid format|is invalid/i.test(msg + " " + cod)) {
      if (window.console && console.warn) console.warn("Cadastro recusado pelo servidor (confira DOMINIO_EMAIL em js/config.js):", msg);
      return erro("email_recusado", e);
    }
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return erro("rede", e);
    if (/jwt|not authenticated|nao_autenticado|auth session missing/i.test(msg)) return erro("sem_sessao", e);
    return erro("outro", e);
  }

  function esperar(consulta) {
    return Promise.resolve(consulta).then(function (r) {
      if (r && r.error) throw traduzir(r.error);
      return r ? r.data : null;
    }, function (e) {
      throw traduzir(e);
    });
  }

  function iniciar() {
    if (cliente) return true;
    var cfg = window.COMBINADO_CONFIG;
    if (!window.supabase || !window.supabase.createClient || !cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_CHAVE) {
      return false;
    }
    cliente = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_CHAVE);
    return true;
  }

  function exigir() {
    if (!cliente && !iniciar()) throw erro("config");
    return cliente;
  }

  /* ---------------- conta ---------------- */

  function normalizarUsuario(texto) {
    return String(texto || "").trim().toLowerCase();
  }

  function usuarioValido(texto) {
    return REGRA_USUARIO.test(normalizarUsuario(texto));
  }

  function emailDe(usuario) {
    return normalizarUsuario(usuario) + dominioFalso();
  }

  function perfilDoUsuarioLogado() {
    return esperar(exigir().auth.getUser()).then(function (d) {
      var u = d && d.user;
      if (!u) throw erro("sem_sessao");
      return esperar(
        exigir().from("perfis").select("id,usuario,nome,importou_local").eq("id", u.id).single()
      );
    });
  }

  function sessaoAtual() {
    return esperar(exigir().auth.getSession()).then(function (d) {
      if (!d || !d.session) return null;
      return perfilDoUsuarioLogado().catch(function (e) {
        if (e.codigo === "sem_sessao") return null;
        throw e;
      });
    });
  }

  function cadastrar(usuario, senha) {
    var digitado = String(usuario || "").trim();
    if (!usuarioValido(digitado)) return Promise.reject(erro("usuario_invalido"));
    return esperar(exigir().auth.signUp({
      email: emailDe(digitado),
      password: senha,
      options: { data: { usuario: normalizarUsuario(digitado), nome: digitado } }
    })).then(function (d) {
      // Com "Confirm email" ligado o Supabase não devolve sessão: avisa em vez de ficar travado.
      if (!d || !d.session) throw erro("confirmacao_ligada");
      return perfilDoUsuarioLogado();
    });
  }

  function entrar(usuario, senha) {
    if (!normalizarUsuario(usuario)) return Promise.reject(erro("credenciais"));
    return esperar(exigir().auth.signInWithPassword({
      email: emailDe(usuario),
      password: senha
    })).then(function () {
      return perfilDoUsuarioLogado();
    });
  }

  function sair() {
    pararDeOuvir();
    return esperar(exigir().auth.signOut());
  }

  function aoMudarSessao(callback) {
    exigir().auth.onAuthStateChange(function (evento) {
      callback(evento);
    });
  }

  function marcarImportado(meuId) {
    return esperar(exigir().from("perfis").update({ importou_local: true }).eq("id", meuId));
  }

  /* ---------------- leitura ---------------- */

  function carregar() {
    var c = exigir();
    return Promise.all([
      esperar(c.from("trabalhos").select("*")),
      esperar(c.from("membros").select("*")),
      esperar(c.from("perfis").select("id,usuario,nome")),
      esperar(c.from("tarefas").select("*").order("ordem", { ascending: true }))
    ]).then(function (r) {
      var perfis = {};
      (r[2] || []).forEach(function (p) { perfis[p.id] = p; });

      var porTrabalho = {};
      (r[3] || []).forEach(function (t) {
        (porTrabalho[t.trabalho_id] = porTrabalho[t.trabalho_id] || { tarefas: [], membros: [] }).tarefas.push({
          id: t.id,
          texto: t.texto,
          responsavelId: t.responsavel_id || "",
          feito: !!t.feito
        });
      });
      (r[1] || []).forEach(function (m) {
        var p = perfis[m.usuario_id] || { usuario: "?", nome: "?" };
        (porTrabalho[m.trabalho_id] = porTrabalho[m.trabalho_id] || { tarefas: [], membros: [] }).membros.push({
          id: m.usuario_id,
          usuario: p.usuario,
          nome: p.nome || p.usuario,
          papel: m.papel,
          entrouEm: m.entrou_em || ""
        });
      });

      return (r[0] || []).map(function (t) {
        var extra = porTrabalho[t.id] || { tarefas: [], membros: [] };
        extra.membros.sort(function (a, b) {
          if (a.papel !== b.papel) return a.papel === "dono" ? -1 : 1;
          return String(a.entrouEm).localeCompare(String(b.entrouEm));
        });
        return {
          id: t.id,
          titulo: t.titulo,
          materia: t.materia || "",
          prazo: t.prazo || "",
          tipo: t.tipo,
          cor: t.cor || "",
          observacoes: t.observacoes || "",
          status: t.status,
          prontoAutomatico: !!t.pronto_automatico,
          codigo: t.codigo || "",
          donoId: t.dono_id,
          membros: extra.membros,
          tarefas: extra.tarefas
        };
      });
    });
  }

  /* ---------------- escrita ---------------- */

  function camposTrabalho(t) {
    return {
      titulo: t.titulo,
      materia: t.materia || null,
      prazo: t.prazo || null,
      tipo: t.tipo,
      cor: t.cor || null,
      observacoes: t.observacoes || null,
      status: t.status,
      pronto_automatico: !!t.prontoAutomatico
    };
  }

  function criarTrabalho(t, meuId) {
    var linha = camposTrabalho(t);
    linha.dono_id = meuId;
    return esperar(exigir().from("trabalhos").insert(linha).select().single());
  }

  function atualizarTrabalho(id, campos) {
    var linha = {};
    ["titulo", "materia", "prazo", "tipo", "cor", "observacoes", "status"].forEach(function (k) {
      if (k in campos) linha[k] = (k === "titulo" || k === "tipo" || k === "status") ? campos[k] : (campos[k] || null);
    });
    if ("prontoAutomatico" in campos) linha.pronto_automatico = !!campos.prontoAutomatico;
    return esperar(exigir().from("trabalhos").update(linha).eq("id", id));
  }

  function excluirTrabalho(id) {
    return esperar(exigir().from("trabalhos").delete().eq("id", id));
  }

  function sairDoTrabalho(trabalhoId, usuarioId) {
    return esperar(exigir().from("membros").delete().eq("trabalho_id", trabalhoId).eq("usuario_id", usuarioId));
  }

  function criarTarefa(trabalhoId, texto, responsavelId) {
    return esperar(exigir().from("tarefas").insert({
      trabalho_id: trabalhoId,
      texto: texto,
      responsavel_id: responsavelId || null,
      feito: false
    }).select().single());
  }

  function atualizarTarefa(id, campos) {
    var linha = {};
    if ("texto" in campos) linha.texto = campos.texto;
    if ("feito" in campos) linha.feito = !!campos.feito;
    if ("responsavelId" in campos) linha.responsavel_id = campos.responsavelId || null;
    return esperar(exigir().from("tarefas").update(linha).eq("id", id));
  }

  function excluirTarefa(id) {
    return esperar(exigir().from("tarefas").delete().eq("id", id));
  }

  function entrarPorCodigo(codigo) {
    return esperar(exigir().rpc("entrar_por_codigo", { p_codigo: String(codigo || "") }));
  }

  function trocarCodigo(trabalhoId) {
    return esperar(exigir().rpc("trocar_codigo", { p_trabalho: trabalhoId }));
  }

  /* Importa trabalhos antigos (localStorage) para a conta. Devolve quantos entraram. */
  function importar(lista, meuId, meuNome) {
    var feitos = 0;
    return lista.reduce(function (cadeia, t) {
      return cadeia.then(function () {
        return criarTrabalho(t, meuId).then(function (novo) {
          var tarefas = (t.tarefas || []).filter(function (x) { return x && x.texto; }).map(function (x) {
            var meu = x.responsavel && String(x.responsavel).toLowerCase() === String(meuNome).toLowerCase();
            return {
              trabalho_id: novo.id,
              texto: String(x.texto).slice(0, 300),
              responsavel_id: meu ? meuId : null,
              feito: !!x.feito
            };
          });
          feitos += 1;
          if (!tarefas.length) return null;
          return esperar(exigir().from("tarefas").insert(tarefas));
        });
      });
    }, Promise.resolve()).then(function () { return feitos; });
  }

  /* ---------------- tempo real ---------------- */

  function ouvirMudancas(callback) {
    var c = exigir();
    pararDeOuvir();
    canal = c.channel("combinado-mudancas");
    ["trabalhos", "membros", "tarefas"].forEach(function (tabela) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, function () {
        callback(tabela);
      });
    });
    canal.subscribe();
  }

  function pararDeOuvir() {
    if (canal && cliente) {
      try { cliente.removeChannel(canal); } catch (e) { /* ignora */ }
    }
    canal = null;
  }

  window.Dados = {
    iniciar: iniciar,
    normalizarUsuario: normalizarUsuario,
    usuarioValido: usuarioValido,
    sessaoAtual: sessaoAtual,
    cadastrar: cadastrar,
    entrar: entrar,
    sair: sair,
    aoMudarSessao: aoMudarSessao,
    marcarImportado: marcarImportado,
    carregar: carregar,
    criarTrabalho: criarTrabalho,
    atualizarTrabalho: atualizarTrabalho,
    excluirTrabalho: excluirTrabalho,
    sairDoTrabalho: sairDoTrabalho,
    criarTarefa: criarTarefa,
    atualizarTarefa: atualizarTarefa,
    excluirTarefa: excluirTarefa,
    entrarPorCodigo: entrarPorCodigo,
    trocarCodigo: trocarCodigo,
    importar: importar,
    ouvirMudancas: ouvirMudancas,
    pararDeOuvir: pararDeOuvir
  };
})();
