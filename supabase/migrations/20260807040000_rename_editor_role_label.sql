-- Renombrar etiqueta del cargo editor → Director de Edición
update public.employee_roles
set label = 'Director de Edición'
where key = 'editor';
