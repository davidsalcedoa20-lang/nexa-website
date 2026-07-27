-- ==========================================================
-- NEXA HUB — 27. RLS de project_timeline_stages
-- ==========================================================

create policy project_timeline_stages_admin_all on public.project_timeline_stages
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_timeline_stages_select_own on public.project_timeline_stages
    for select
    using (public.is_own_project(project_id));
