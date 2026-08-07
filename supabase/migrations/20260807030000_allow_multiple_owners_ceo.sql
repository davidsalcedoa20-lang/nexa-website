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
            raise exception 'Un CEO no puede eliminarse.';
        end if;
        return old;
    end if;

    if old.role = 'owner' then
        if new.role is distinct from 'owner' then
            raise exception 'El rol de un CEO no puede cambiarse.';
        end if;
        if new.is_active = false then
            raise exception 'Un CEO no puede desactivarse.';
        end if;
    end if;

    -- Varios owners permitidos (CEOs con el mismo nivel).
    return new;
end;
$$;
