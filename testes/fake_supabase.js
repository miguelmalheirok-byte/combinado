/* Supabase de mentira, só para os testes (substitui js/vendor/supabase.js no navegador).
   Guarda o "banco" no localStorage (compartilhado entre abas do mesmo contexto) e a sessão
   no sessionStorage (cada aba pode ser uma pessoa diferente). Imita as regras de acesso
   de supabase/schema.sql; as regras de verdade são testadas em supabase/testes/. */
(function () {
  var KDB = "fake:db", KEVT = "fake:evt", KSES = "fake:sessao";
  var ouvintes = [];       // { tabela, cb }
  var authCbs = [];

  function agora() { return new Date().toISOString(); }
  function uuid() { return "u" + Math.random().toString(16).slice(2, 10) + Date.now().toString(16); }
  function flag(nome) { try { return localStorage.getItem("fake:" + nome); } catch (e) { return null; } }

  function carregar() {
    var bruto = localStorage.getItem(KDB);
    var db = bruto ? JSON.parse(bruto) : null;
    if (!db) db = { users: [], perfis: [], trabalhos: [], membros: [], tarefas: [], seq: 0 };
    return db;
  }
  function gravar(db) { localStorage.setItem(KDB, JSON.stringify(db)); }

  function sessao() {
    try { return JSON.parse(sessionStorage.getItem(KSES) || "null"); } catch (e) { return null; }
  }

  function notificar(tabela) {
    try { localStorage.setItem(KEVT, JSON.stringify({ t: tabela, n: Math.random() })); } catch (e) {}
    disparar(tabela);
  }
  function disparar(tabela) {
    ouvintes.slice().forEach(function (o) { if (o.tabela === tabela) setTimeout(o.cb, 1); });
  }
  window.addEventListener("storage", function (e) {
    if (e.key !== KEVT || !e.newValue) return;
    try { disparar(JSON.parse(e.newValue).t); } catch (x) {}
  });

  function esperar(fn) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (flag("offline") === "1") return resolve({ data: null, error: { message: "Failed to fetch" } });
        try { resolve(fn()); } catch (e) { resolve({ data: null, error: { message: e.message } }); }
      }, 2);
    });
  }

  function codigoNovo(db) {
    var al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", c;
    do { c = ""; for (var i = 0; i < 6; i++) c += al[Math.floor(Math.random() * al.length)]; }
    while (db.trabalhos.some(function (t) { return t.codigo === c; }));
    return c;
  }

  /* ---- regras de acesso (espelham o schema.sql) ---- */
  function ehMembro(db, uid, tid) { return db.membros.some(function (m) { return m.trabalho_id === tid && m.usuario_id === uid; }); }
  function ehDono(db, uid, tid) { return db.trabalhos.some(function (t) { return t.id === tid && t.dono_id === uid; }); }
  function dividem(db, uid, outro) {
    return db.membros.some(function (a) {
      return a.usuario_id === uid && db.membros.some(function (b) { return b.trabalho_id === a.trabalho_id && b.usuario_id === outro; });
    });
  }
  function pode(db, uid, tabela, linha) {
    if (tabela === "perfis") return linha.id === uid || dividem(db, uid, linha.id);
    if (tabela === "trabalhos") return linha.dono_id === uid || ehMembro(db, uid, linha.id);
    return ehMembro(db, uid, linha.trabalho_id);
  }
  function erroRLS(t) { return { message: 'new row violates row-level security policy for table "' + t + '"' }; }
  function erroPerm(t) { return { message: "permission denied for table " + t }; }

  function Consulta(tabela) {
    this.tabela = tabela; this.op = "select"; this.filtros = []; this.ord = null;
    this.payload = null; this.retorna = false; this.unico = false;
  }
  Consulta.prototype.select = function () { if (this.op !== "select") this.retorna = true; return this; };
  Consulta.prototype.insert = function (p) { this.op = "insert"; this.payload = p; return this; };
  Consulta.prototype.update = function (p) { this.op = "update"; this.payload = p; return this; };
  Consulta.prototype.delete = function () { this.op = "delete"; return this; };
  Consulta.prototype.eq = function (c, v) { this.filtros.push([c, v]); return this; };
  Consulta.prototype.order = function (c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; };
  Consulta.prototype.single = function () { this.unico = true; return this; };
  Consulta.prototype.then = function (ok, falha) {
    var q = this;
    return esperar(function () { return executar(q); }).then(ok, falha);
  };

  function filtrar(q, linhas) {
    return linhas.filter(function (l) { return q.filtros.every(function (f) { return l[f[0]] === f[1]; }); });
  }

  function executar(q) {
    var s = sessao();
    if (!s) return { data: null, error: erroPerm(q.tabela) };
    var uid = s.user.id, db = carregar(), t = q.tabela, tabelaDb = db[t];
    var resultado;

    if (q.op === "select") {
      var linhas = filtrar(q, tabelaDb.filter(function (l) { return pode(db, uid, t, l); }));
      if (q.ord) {
        var c = q.ord[0], asc = q.ord[1];
        linhas.sort(function (a, b) { return (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1); });
      }
      resultado = linhas;
    } else if (q.op === "insert") {
      var lote = Array.isArray(q.payload) ? q.payload : [q.payload];
      var criadas = [];
      for (var i = 0; i < lote.length; i++) {
        var p = lote[i], nova;
        if (t === "trabalhos") {
          if (p.dono_id !== uid) return { data: null, error: erroRLS(t) };
          nova = { id: uuid(), titulo: p.titulo, materia: p.materia || null, prazo: p.prazo || null, tipo: p.tipo || "individual",
            cor: p.cor || null, observacoes: p.observacoes || null, status: p.status || "nao-comecei",
            pronto_automatico: !!p.pronto_automatico, codigo: codigoNovo(db), dono_id: uid, criado_em: agora() };
          db.trabalhos.push(nova);
          db.membros.push({ trabalho_id: nova.id, usuario_id: uid, papel: "dono", entrou_em: agora() });
        } else if (t === "tarefas") {
          if (!ehMembro(db, uid, p.trabalho_id)) return { data: null, error: erroRLS(t) };
          if (p.responsavel_id && !ehMembro(db, p.responsavel_id, p.trabalho_id)) return { data: null, error: { message: "responsavel_invalido" } };
          db.seq += 1;
          nova = { id: uuid(), trabalho_id: p.trabalho_id, texto: p.texto, responsavel_id: p.responsavel_id || null, feito: !!p.feito, ordem: db.seq, criado_em: agora() };
          db.tarefas.push(nova);
        } else {
          return { data: null, error: erroPerm(t) };
        }
        criadas.push(nova);
      }
      resultado = q.retorna ? criadas : null;
    } else if (q.op === "update") {
      var alvos = filtrar(q, tabelaDb.filter(function (l) { return pode(db, uid, t, l); }));
      if (t === "perfis") alvos = alvos.filter(function (l) { return l.id === uid; });
      var permitidas = { trabalhos: ["titulo", "materia", "prazo", "tipo", "cor", "observacoes", "status", "pronto_automatico"],
        tarefas: ["texto", "responsavel_id", "feito"], perfis: ["nome", "importou_local"] }[t];
      if (!permitidas) return { data: null, error: erroPerm(t) };
      for (var k in q.payload) if (permitidas.indexOf(k) === -1) return { data: null, error: erroPerm(t) };
      alvos.forEach(function (l) {
        if (t === "tarefas" && q.payload.responsavel_id && !ehMembro(db, q.payload.responsavel_id, l.trabalho_id)) throw new Error("responsavel_invalido");
        for (var k2 in q.payload) l[k2] = q.payload[k2];
      });
      resultado = q.retorna ? alvos : null;
    } else if (q.op === "delete") {
      var vis = filtrar(q, tabelaDb.filter(function (l) { return pode(db, uid, t, l); }));
      var apagar = vis.filter(function (l) {
        if (t === "trabalhos") return l.dono_id === uid;
        if (t === "membros") return l.papel !== "dono" && (l.usuario_id === uid || ehDono(db, uid, l.trabalho_id));
        if (t === "tarefas") return true;
        return false;
      });
      if (t === "perfis") return { data: null, error: erroPerm(t) };
      db[t] = tabelaDb.filter(function (l) { return apagar.indexOf(l) === -1; });
      if (t === "trabalhos") {
        var ids = apagar.map(function (x) { return x.id; });
        db.membros = db.membros.filter(function (m) { return ids.indexOf(m.trabalho_id) === -1; });
        db.tarefas = db.tarefas.filter(function (x) { return ids.indexOf(x.trabalho_id) === -1; });
      }
      if (t === "membros") {
        apagar.forEach(function (m) {
          db.tarefas.forEach(function (x) { if (x.trabalho_id === m.trabalho_id && x.responsavel_id === m.usuario_id) x.responsavel_id = null; });
        });
      }
      resultado = null;
    }

    if (q.op !== "select") { gravar(db); notificar(t); if (t === "trabalhos" && q.op === "insert") notificar("membros"); if (t === "membros") notificar("tarefas"); if (t === "trabalhos" && q.op === "delete") { notificar("membros"); notificar("tarefas"); } }

    if (q.unico) {
      if (!resultado || resultado.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
      resultado = resultado[0];
    }
    return { data: resultado, error: null };
  }

  function rpc(nome, args) {
    return esperar(function () {
      var s = sessao();
      if (!s) return { data: null, error: erroPerm(nome) };
      var db = carregar(), uid = s.user.id;
      if (nome === "entrar_por_codigo") {
        var cod = String(args.p_codigo || "").trim().toUpperCase();
        var t = db.trabalhos.filter(function (x) { return x.codigo === cod; })[0];
        if (!t) return { data: null, error: { message: "codigo_invalido" } };
        if (!ehMembro(db, uid, t.id)) db.membros.push({ trabalho_id: t.id, usuario_id: uid, papel: "integrante", entrou_em: agora() });
        gravar(db); notificar("membros");
        return { data: t.id, error: null };
      }
      if (nome === "trocar_codigo") {
        if (!ehDono(db, uid, args.p_trabalho)) return { data: null, error: { message: "somente_dono" } };
        var novo = codigoNovo(db);
        db.trabalhos.forEach(function (x) { if (x.id === args.p_trabalho) x.codigo = novo; });
        gravar(db); notificar("trabalhos");
        return { data: novo, error: null };
      }
      return { data: null, error: { message: "função desconhecida" } };
    });
  }

  var auth = {
    getSession: function () { return esperar(function () { var s = sessao(); return { data: { session: s }, error: null }; }); },
    getUser: function () { return esperar(function () { var s = sessao(); return s ? { data: { user: s.user }, error: null } : { data: { user: null }, error: { message: "Auth session missing!" } }; }); },
    signUp: function (a) {
      return esperar(function () {
        var db = carregar();
        if (!a.password || a.password.length < 6) return { data: null, error: { message: "Password should be at least 6 characters." } };
        if (db.users.some(function (u) { return u.email === a.email; })) return { data: null, error: { message: "User already registered" } };
        var meta = (a.options && a.options.data) || {};
        var usuario = String(meta.usuario || a.email.split("@")[0]).toLowerCase();
        if (!/^[a-z0-9_.-]{3,30}$/.test(usuario) || db.perfis.some(function (p) { return p.usuario === usuario; })) return { data: null, error: { message: "Database error saving new user" } };
        var user = { id: uuid(), email: a.email, senha: a.password };
        db.users.push(user);
        db.perfis.push({ id: user.id, usuario: usuario, nome: meta.nome || usuario, importou_local: false, criado_em: agora() });
        gravar(db);
        if (flag("confirmar") === "1") return { data: { user: { id: user.id, email: user.email }, session: null }, error: null };
        var s = { user: { id: user.id, email: user.email } };
        sessionStorage.setItem(KSES, JSON.stringify(s));
        authCbs.forEach(function (cb) { cb("SIGNED_IN", s); });
        return { data: { user: s.user, session: s }, error: null };
      });
    },
    signInWithPassword: function (a) {
      return esperar(function () {
        var db = carregar();
        var u = db.users.filter(function (x) { return x.email === a.email && x.senha === a.password; })[0];
        if (!u) return { data: null, error: { message: "Invalid login credentials" } };
        var s = { user: { id: u.id, email: u.email } };
        sessionStorage.setItem(KSES, JSON.stringify(s));
        authCbs.forEach(function (cb) { cb("SIGNED_IN", s); });
        return { data: { user: s.user, session: s }, error: null };
      });
    },
    signOut: function () {
      return esperar(function () {
        sessionStorage.removeItem(KSES);
        authCbs.forEach(function (cb) { cb("SIGNED_OUT", null); });
        return { data: null, error: null };
      });
    },
    onAuthStateChange: function (cb) { authCbs.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; }
  };

  function Canal() { this.regs = []; }
  Canal.prototype.on = function (tipo, filtro, cb) { this.regs.push({ tabela: filtro.table, cb: cb }); return this; };
  Canal.prototype.subscribe = function () { var self = this; self.regs.forEach(function (r) { ouvintes.push(r); }); return this; };

  window.supabase = {
    createClient: function () {
      return {
        auth: auth,
        from: function (t) { return new Consulta(t); },
        rpc: rpc,
        channel: function () { return new Canal(); },
        removeChannel: function (c) { ouvintes = ouvintes.filter(function (o) { return c.regs.indexOf(o) === -1; }); }
      };
    }
  };
})();
