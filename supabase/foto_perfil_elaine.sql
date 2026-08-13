-- Vincula o avatar publico ao cadastro existente da Elaine.
update public.funcionarios
set foto_url = '/assets/equipe/elaine.png',
    updated_at = now()
where lower(trim(email)) = 'elaine@platino.com';

-- Deve retornar uma linha com o novo endereco da foto.
select id, nome, email, foto_url
from public.funcionarios
where lower(trim(email)) = 'elaine@platino.com';
