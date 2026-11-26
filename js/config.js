/* Configuração pública do Supabase.
   A chave "publishable" foi feita para ficar no navegador: quem protege os dados
   são as regras de acesso por linha (RLS) do banco (supabase/schema.sql).
   NUNCA coloque aqui a chave "secret" / "service_role". */
window.COMBINADO_CONFIG = {
  SUPABASE_URL: "https://wujxefcybfnalydkkwrj.supabase.co",
  SUPABASE_CHAVE: "sb_publishable_-pXTkc6G9g406DzXUocsOg_3scT2wqK",
  // Cada conta vira usuario@DOMINIO_EMAIL no Supabase (ninguém recebe e-mail nesse endereço).
  // Se o cadastro for recusado para QUALQUER usuário, troque o domínio aqui.
  // Atenção: contas já criadas continuam presas ao domínio antigo.
  DOMINIO_EMAIL: "combinado.app"
};
