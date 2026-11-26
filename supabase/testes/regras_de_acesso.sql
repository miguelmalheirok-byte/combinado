\set ON_ERROR_STOP off
\pset pager off
-- contas
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','ana@combinado.app','{"usuario":"ana","nome":"Ana"}'),
 ('00000000-0000-0000-0000-00000000000b','bia@combinado.app','{"usuario":"bia","nome":"Bia"}'),
 ('00000000-0000-0000-0000-00000000000c','caio@combinado.app','{"usuario":"caio"}');
select usuario, nome from public.perfis order by 1;

-- ana cria trabalho
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into public.trabalhos(titulo, tipo, dono_id) values ('TCC','grupo','00000000-0000-0000-0000-00000000000a') returning id, codigo, status;
\echo '--- ana ve:' 
select titulo, codigo from public.trabalhos;
select u.usuario, m.papel from public.membros m join public.perfis u on u.id=m.usuario_id;
insert into public.tarefas(trabalho_id,texto) select id,'Introdução' from public.trabalhos;
\echo '--- ana tenta forjar dono (deve falhar)'
insert into public.trabalhos(titulo, dono_id) values ('X','00000000-0000-0000-0000-00000000000b');
\echo '--- ana tenta mudar codigo direto (deve falhar)'
update public.trabalhos set codigo='AAAAAA';
reset role;

-- bia (de fora) nao ve nada
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
\echo '--- bia fora do grupo: trabalhos/tarefas/membros/perfis (esperado 0,0,0,1)'
select (select count(*) from public.trabalhos) t, (select count(*) from public.tarefas) ta, (select count(*) from public.membros) m, (select count(*) from public.perfis) p;
\echo '--- bia tenta entrar com codigo errado (deve falhar)'
select public.entrar_por_codigo('ZZZZZZ');
\echo '--- bia tenta inserir em membros direto (deve falhar)'
insert into public.membros(trabalho_id,usuario_id) select id,'00000000-0000-0000-0000-00000000000b' from (select id from public.trabalhos limit 1) q;
reset role;
select codigo as codigo_do_tcc from public.trabalhos limit 1 \gset
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
\echo '--- bia entra pelo codigo (minusculo, com espaco)'
select public.entrar_por_codigo(' ' || lower(:'codigo_do_tcc') || ' ') is not null as entrou;
select titulo from public.trabalhos;
select u.usuario, m.papel from public.membros m join public.perfis u on u.id=m.usuario_id order by 1;
select usuario from public.perfis order by 1;
\echo '--- bia marca tarefa feita e responsavel=ela'
update public.tarefas set feito=true, responsavel_id='00000000-0000-0000-0000-00000000000b';
select feito, responsavel_id is not null as tem_resp from public.tarefas;
\echo '--- bia tenta responsavel=caio (nao membro, deve falhar)'
update public.tarefas set responsavel_id='00000000-0000-0000-0000-00000000000c';
\echo '--- bia tenta excluir trabalho (nao dono; 0 linhas)'
delete from public.trabalhos;
select count(*) as ainda_existe from public.trabalhos;
\echo '--- bia tenta remover ana (dono; 0 linhas)'
delete from public.membros where usuario_id='00000000-0000-0000-0000-00000000000a';
\echo '--- bia tenta trocar codigo (deve falhar)'
select public.trocar_codigo((select id from public.trabalhos limit 1));
\echo '--- bia edita titulo e status (ok)'
update public.trabalhos set titulo='TCC final', status='fazendo';
select titulo,status from public.trabalhos;
reset role;

-- caio (de fora) ve nada de ana/bia exceto ele
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
\echo '--- caio fora: (0,0,0,1)'
select (select count(*) from public.trabalhos) t, (select count(*) from public.tarefas) ta, (select count(*) from public.membros) m, (select count(*) from public.perfis) p;
\echo '--- caio tenta alterar trabalho alheio (0 linhas) e tarefa alheia'
update public.trabalhos set titulo='hack';
update public.tarefas set feito=false;
delete from public.tarefas;
\echo '--- caio tenta alterar perfil da ana (0 linhas)'
update public.perfis set nome='hack' where usuario='ana';
reset role;
select titulo from public.trabalhos;

-- ana troca codigo e remove bia
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
\echo '--- ana troca codigo'
select public.trocar_codigo((select id from public.trabalhos limit 1)) <> :'codigo_do_tcc' as mudou;
\echo '--- ana remove bia; tarefa perde responsavel'
delete from public.membros where usuario_id='00000000-0000-0000-0000-00000000000b';
select (select count(*) from public.membros) membros, (select responsavel_id is null from public.tarefas) sem_resp;
\echo '--- ana tenta sair (dono, 0 linhas)'
delete from public.membros where usuario_id='00000000-0000-0000-0000-00000000000a';
select count(*) as membros from public.membros;
\echo '--- ana exclui trabalho: cascata'
delete from public.trabalhos;
select (select count(*) from public.trabalhos) t,(select count(*) from public.tarefas) ta,(select count(*) from public.membros) m;
reset role;

-- visitante
set role anon;
\echo '--- anon (deve falhar tudo)'
select count(*) from public.trabalhos;
select public.entrar_por_codigo('ABCDEF');
reset role;
