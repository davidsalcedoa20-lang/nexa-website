-- Solo agrega el valor 'owner' al enum. Debe ir en migración
-- separada porque PostgreSQL no permite usar un enum value
-- recién añadido dentro de la misma transacción.
do $$
begin
    alter type public.user_role add value 'owner';
exception
    when duplicate_object then null;
end $$;
