-- Organiza os perfis exibidos na aba Equipe do gestor e vincula as fotos oficiais.
-- Script idempotente: pode ser executado novamente sem duplicar registros.

begin;

update public.funcionarios
set nome = case
      when lower(trim(nome)) in ('yasmim', 'yasmin')
        or lower(trim(email)) = 'yasmin@adm.com'
      then 'Yasmin'
      else nome
    end,
    setor = 'Administrativo',
    updated_at = now()
where lower(trim(nome)) in ('tafa', 'tafarel', 'tafarel moreira', 'yasmim', 'yasmin', 'thayla', 'thayla venturini')
   or lower(trim(email)) in ('tafa@adm.com', 'tafarel@platino.com', 'yasmin@adm.com', 'thayla@adm.com');

update public.funcionarios
set foto_url = case lower(trim(email))
      when 'yasmin@adm.com' then '/assets/equipe/yasmin-oficial.png'
      when 'thayla@adm.com' then '/assets/equipe/thayla-oficial.png'
      when 'tafa@adm.com' then '/assets/equipe/tafa-oficial.png'
      when 'tafarel@platino.com' then '/assets/equipe/tafa-oficial.png'
      else foto_url
    end,
    cargo = case lower(trim(email))
      when 'yasmin@adm.com' then 'Auxiliar Administrativo'
      when 'thayla@adm.com' then 'Auxiliar Administrativo'
      when 'tafa@adm.com' then 'Supervisor Administrativo'
      when 'tafarel@platino.com' then 'Supervisor Administrativo'
      else cargo
    end,
    updated_at = now()
where lower(trim(email)) in (
  'yasmin@adm.com',
  'thayla@adm.com',
  'tafa@adm.com',
  'tafarel@platino.com'
);

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
set foto_url = case lower(trim(email))
      when 'nicolas@platino.com' then '/assets/equipe/nicolas-oficial.png'
      when 'tabata@platino.com' then '/assets/equipe/tabata-oficial.png'
      when 'elaine@platino.com' then '/assets/equipe/elaine-oficial.png'
      when 'janaina@platino.com' then '/assets/equipe/janaina-oficial.png'
      when 'giullian@platino.com' then '/assets/equipe/giullian-oficial.png'
      else foto_url
    end,
    cargo = case lower(trim(email))
      when 'nicolas@platino.com' then 'Supervisor'
      when 'tabata@platino.com' then 'Consultora jurídica'
      when 'elaine@platino.com' then 'Consultora jurídica'
      when 'janaina@platino.com' then 'Consultora jurídica'
      when 'giullian@platino.com' then 'Hunter'
      else cargo
    end,
    updated_at = now()
where lower(trim(email)) in (
  'nicolas@platino.com',
  'tabata@platino.com',
  'elaine@platino.com',
  'janaina@platino.com',
  'giullian@platino.com'
);

update public.funcionarios
set foto_url = case
      when lower(trim(nome)) in ('thayla', 'thayla venturini') then '/assets/equipe/thayla-oficial.png'
      when lower(trim(nome)) in ('yasmim', 'yasmin') then '/assets/equipe/yasmin-oficial.png'
      when lower(trim(nome)) in ('tafa', 'tafarel', 'tafarel moreira') then '/assets/equipe/tafa-oficial.png'
      else foto_url
    end,
    updated_at = now()
where lower(trim(nome)) in (
  'thayla', 'thayla venturini', 'yasmim', 'yasmin', 'tafa', 'tafarel', 'tafarel moreira'
);

commit;

select id, nome, email, cargo, setor, ativo, foto_url
from public.funcionarios
where lower(trim(nome)) in (
  'tafarel', 'tafarel moreira', 'yasmim', 'yasmin', 'thayla', 'thayla venturini',
  'nicolas', 'tabata', 'giullian', 'janaina', 'elaine'
)
order by setor, nome;
