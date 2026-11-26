-- =====================================================================
-- Combinado — esquema do banco (Supabase / Postgres)
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Pode rodar de novo sem medo: os comandos recriam o que for preciso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  usuario       text not null unique
                  check (usuario ~ '^[a-z0-9_.-]{3,30}$'),
  nome          text,
  importou_local boolean not null default false,
  criado_em     timestamptz not null default now()
);

create table if not exists public.trabalhos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (char_length(titulo) between 1 and 120),
  materia           text,
  prazo             date,
  tipo              text not null default 'individual'
                      check (tipo in ('individual', 'grupo')),
  cor               text,
  observacoes       text,
  status            text not null default 'nao-comecei'
                      check (status in ('nao-comecei', 'fazendo', 'pronto', 'entregue')),
  pronto_automatico boolean not null default false,
  codigo            text unique,
  dono_id           uuid not null default auth.uid() references public.perfis (id),
  criado_em         timestamptz not null default now()
);

create table if not exists public.membros (
  trabalho_id uuid not null references public.trabalhos (id) on delete cascade,
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  papel       text not null default 'integrante'
                check (papel in ('dono', 'integrante')),
  entrou_em   timestamptz not null default now(),
  primary key (trabalho_id, usuario_id)
);

create table if not exists public.tarefas (
  id             uuid primary key default gen_random_uuid(),
  trabalho_id    uuid not null references public.trabalhos (id) on delete cascade,
  texto          text not null check (char_length(texto) between 1 and 300),
  responsavel_id uuid references public.perfis (id) on delete set null,
  feito          boolean not null default false,
  ordem          bigint generated always as identity,
  criado_em      timestamptz not null default now()
);

create index if not exists membros_usuario_idx on public.membros (usuario_id);
create index if not exists tarefas_trabalho_idx on public.tarefas (trabalho_id);

-- ---------------------------------------------------------------------
-- 2) Funções de apoio (usadas pelas regras de acesso)
--    SECURITY DEFINER = rodam com permissão elevada, por isso fixam o
--    search_path e só devolvem sim/não ou o id do trabalho.
-- ---------------------------------------------------------------------

create or replace function public.eh_membro(p_trabalho uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.trabalho_id = p_trabalho and m.usuario_id = auth.uid()
  );
$$;

create or replace function public.eh_dono(p_trabalho uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trabalhos t
    where t.id = p_trabalho and t.dono_id = auth.uid()
  );
$$;

create or replace function public.divide_trabalho(p_outro uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.membros a
    join public.membros b on b.trabalho_id = a.trabalho_id
    where a.usuario_id = auth.uid() and b.usuario_id = p_outro
  );
$$;

-- Código do grupo: 6 caracteres, sem 0/O/1/I para não confundir.
create or replace function public.gerar_codigo()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  novo text;
begin
  loop
    novo := '';
    for i in 1..6 loop
      novo := novo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.trabalhos where codigo = novo);
  end loop;
  return novo;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Gatilhos (triggers)
-- ---------------------------------------------------------------------

-- Ao criar a conta, cria o perfil. O app manda o usuário em raw_user_meta_data.
create or replace function public.novo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  u text;
begin
  u := lower(coalesce(new.raw_user_meta_data ->> 'usuario', split_part(new.email, '@', 1)));
  insert into public.perfis (id, usuario, nome)
  values (new.id, u, coalesce(new.raw_user_meta_data ->> 'nome', u));
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- Ao criar um trabalho: gera o código e coloca o dono como membro.
create or replace function public.trabalho_antes_de_inserir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.codigo is null then
    new.codigo := public.gerar_codigo();
  end if;
  return new;
end;
$$;

drop trigger if exists trabalho_antes on public.trabalhos;
create trigger trabalho_antes
  before insert on public.trabalhos
  for each row execute function public.trabalho_antes_de_inserir();

create or replace function public.trabalho_depois_de_inserir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.membros (trabalho_id, usuario_id, papel)
  values (new.id, new.dono_id, 'dono')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trabalho_depois on public.trabalhos;
create trigger trabalho_depois
  after insert on public.trabalhos
  for each row execute function public.trabalho_depois_de_inserir();

-- Quando alguém sai do trabalho, as tarefas dela ficam sem responsável.
create or replace function public.membro_saiu()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tarefas
     set responsavel_id = null
   where trabalho_id = old.trabalho_id and responsavel_id = old.usuario_id;
  return old;
end;
$$;

drop trigger if exists ao_sair_do_trabalho on public.membros;
create trigger ao_sair_do_trabalho
  after delete on public.membros
  for each row execute function public.membro_saiu();

-- A tarefa só pode ter como responsável alguém que é membro do trabalho.
create or replace function public.tarefa_valida_responsavel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.responsavel_id is not null and not exists (
    select 1 from public.membros m
    where m.trabalho_id = new.trabalho_id and m.usuario_id = new.responsavel_id
  ) then
    raise exception 'responsavel_invalido';
  end if;
  return new;
end;
$$;

drop trigger if exists tarefa_responsavel on public.tarefas;
create trigger tarefa_responsavel
  before insert or update of responsavel_id, trabalho_id on public.tarefas
  for each row execute function public.tarefa_valida_responsavel();

-- ---------------------------------------------------------------------
-- 4) Funções chamadas pelo app (RPC)
-- ---------------------------------------------------------------------

-- Entrar em um trabalho pelo código. Devolve o id do trabalho.
create or replace function public.entrar_por_codigo(p_codigo text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  select id into t from public.trabalhos
   where codigo = upper(trim(p_codigo));
  if t is null then
    raise exception 'codigo_invalido';
  end if;
  insert into public.membros (trabalho_id, usuario_id, papel)
  values (t, auth.uid(), 'integrante')
  on conflict do nothing;
  return t;
end;
$$;

-- Só o dono troca o código (o código antigo deixa de funcionar).
create or replace function public.trocar_codigo(p_trabalho uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  novo text;
begin
  if not public.eh_dono(p_trabalho) then
    raise exception 'somente_dono';
  end if;
  novo := public.gerar_codigo();
  update public.trabalhos set codigo = novo where id = p_trabalho;
  return novo;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Regras de acesso por linha (RLS)
-- ---------------------------------------------------------------------

alter table public.perfis    enable row level security;
alter table public.trabalhos enable row level security;
alter table public.membros   enable row level security;
alter table public.tarefas   enable row level security;

-- perfis
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or public.divide_trabalho(id));

drop policy if exists perfis_alterar on public.perfis;
create policy perfis_alterar on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- trabalhos
drop policy if exists trabalhos_ler on public.trabalhos;
create policy trabalhos_ler on public.trabalhos for select to authenticated
  using (dono_id = auth.uid() or public.eh_membro(id));

drop policy if exists trabalhos_criar on public.trabalhos;
create policy trabalhos_criar on public.trabalhos for insert to authenticated
  with check (dono_id = auth.uid());

drop policy if exists trabalhos_alterar on public.trabalhos;
create policy trabalhos_alterar on public.trabalhos for update to authenticated
  using (public.eh_membro(id)) with check (public.eh_membro(id));

drop policy if exists trabalhos_excluir on public.trabalhos;
create policy trabalhos_excluir on public.trabalhos for delete to authenticated
  using (dono_id = auth.uid());

-- membros (entrar só pela função entrar_por_codigo ou ao criar o trabalho)
drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated
  using (public.eh_membro(trabalho_id));

drop policy if exists membros_remover on public.membros;
create policy membros_remover on public.membros for delete to authenticated
  using (
    papel <> 'dono'
    and (usuario_id = auth.uid() or public.eh_dono(trabalho_id))
  );

-- tarefas
drop policy if exists tarefas_ler on public.tarefas;
create policy tarefas_ler on public.tarefas for select to authenticated
  using (public.eh_membro(trabalho_id));

drop policy if exists tarefas_criar on public.tarefas;
create policy tarefas_criar on public.tarefas for insert to authenticated
  with check (public.eh_membro(trabalho_id));

drop policy if exists tarefas_alterar on public.tarefas;
create policy tarefas_alterar on public.tarefas for update to authenticated
  using (public.eh_membro(trabalho_id)) with check (public.eh_membro(trabalho_id));

drop policy if exists tarefas_excluir on public.tarefas;
create policy tarefas_excluir on public.tarefas for delete to authenticated
  using (public.eh_membro(trabalho_id));

-- ---------------------------------------------------------------------
-- 6) Permissões das tabelas e funções
--    Visitante (anon) não acessa nada. Logado só faz o que as regras acima deixam.
--    Colunas protegidas (dono_id, codigo) não podem ser alteradas direto.
-- ---------------------------------------------------------------------

revoke all on public.perfis, public.trabalhos, public.membros, public.tarefas from anon;
revoke all on public.perfis, public.trabalhos, public.membros, public.tarefas from authenticated;

grant select on public.perfis to authenticated;
grant update (nome, importou_local) on public.perfis to authenticated;

grant select, delete on public.membros to authenticated;

grant select, delete on public.trabalhos to authenticated;
grant insert (titulo, materia, prazo, tipo, cor, observacoes, status, pronto_automatico, dono_id)
  on public.trabalhos to authenticated;
grant update (titulo, materia, prazo, tipo, cor, observacoes, status, pronto_automatico)
  on public.trabalhos to authenticated;

grant select, delete on public.tarefas to authenticated;
grant insert (trabalho_id, texto, responsavel_id, feito) on public.tarefas to authenticated;
grant update (texto, responsavel_id, feito) on public.tarefas to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.eh_membro(uuid)        to authenticated;
grant execute on function public.eh_dono(uuid)          to authenticated;
grant execute on function public.divide_trabalho(uuid)  to authenticated;
grant execute on function public.entrar_por_codigo(text) to authenticated;
grant execute on function public.trocar_codigo(uuid)    to authenticated;

-- ---------------------------------------------------------------------
-- 7) Tempo real: avisa o app quando algo muda
-- ---------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.trabalhos;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.membros;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.tarefas;
  exception when duplicate_object then null; end;
end $$;
