-- ==========================================================
-- Permitir múltiples CEO / owners con el mismo nivel de acceso
-- ==========================================================

create or replace function public.protect_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        if old.role = 'owner' then
            raise exception 'Un CEO / Administrador Principal no puede eliminarse.';
        end if;
        return old;
    end if;

    if old.role = 'owner' then
        if new.role is distinct from 'owner' then
            raise exception 'El rol de un CEO / Administrador Principal no puede cambiarse.';
        end if;
        if new.is_active = false then
            raise exception 'Un CEO / Administrador Principal no puede desactivarse.';
        end if;
    end if;

    -- Varios owners permitidos (CEOs con el mismo nivel).
    return new;
end;
$$;
