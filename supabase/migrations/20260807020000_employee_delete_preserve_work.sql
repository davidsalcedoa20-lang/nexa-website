-- ==========================================================
-- Empleados: permitir eliminar cuenta sin borrar proyectos
-- ==========================================================

-- Proyectos quedan huérfanos (Sin Director de Edición)
alter table public.employee_projects
    alter column employee_id drop not null;

alter table public.employee_projects
    drop constraint if exists employee_projects_employee_id_fkey;

alter table public.employee_projects
    add constraint employee_projects_employee_id_fkey
    foreign key (employee_id) references public.employees(id) on delete set null;

-- Calendario: conservar filas vinculadas a la tarea
alter table public.employee_calendar
    alter column employee_id drop not null;

alter table public.employee_calendar
    drop constraint if exists employee_calendar_employee_id_fkey;

alter table public.employee_calendar
    add constraint employee_calendar_employee_id_fkey
    foreign key (employee_id) references public.employees(id) on delete set null;

-- Comentarios: conservar texto aunque se borre el autor
alter table public.employee_comments
    alter column author_id drop not null;

alter table public.employee_comments
    drop constraint if exists employee_comments_author_id_fkey;

alter table public.employee_comments
    add constraint employee_comments_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;
