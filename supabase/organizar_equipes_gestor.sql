-- Organiza os perfis exibidos na aba Equipe do gestor e vincula a foto da Janaina.
-- Script idempotente: pode ser executado novamente sem duplicar registros.

begin;

update public.funcionarios
set nome = case
      when lower(trim(nome)) in ('yasmim', 'yasmin')
        or lower(trim(email)) = 'yasmin@adm.com'
      then 'Yasmim'
      else nome
    end,
    setor = 'Administrativo',
    updated_at = now()
where lower(trim(nome)) in ('tafarel', 'tafarel moreira', 'yasmim', 'yasmin', 'thayla')
   or lower(trim(email)) in ('tafarel@platino.com', 'yasmin@adm.com');

update public.funcionarios
set setor = 'Jurídico',
    updated_at = now()
where lower(trim(nome)) in ('nicolas', 'tabata', 'giullian', 'janaina', 'elaine')
   or lower(trim(email)) in (
     'nicolas@platino.com',
     'tabata@platino.com',
     'giullian@platino.com',
     'janaina@platino.com',
     'elaine@platino.com'
   );

update public.funcionarios
set foto_url = '/assets/equipe/janaina.jpeg',
    updated_at = now()
where lower(trim(email)) = 'janaina@platino.com';

commit;

select id, nome, email, cargo, setor, ativo, foto_url
from public.funcionarios
where lower(trim(nome)) in (
  'tafarel', 'tafarel moreira', 'yasmim', 'yasmin', 'thayla',
  'nicolas', 'tabata', 'giullian', 'janaina', 'elaine'
)
order by setor, nome;
