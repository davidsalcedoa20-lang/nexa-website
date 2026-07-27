/* ==========================================================
   NEXA HUB — Página: Proyectos (admin/proyectos.html)
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import {
    listProjects, createProject, duplicateProject, setProjectStatus, archiveProject
} from '../../services/projectService.js';
import { listProjectTypes } from '../../services/projectTypeService.js';
import { listAdmins, listClientWorkspaces } from '../../services/profileService.js';
import { renderProjectsGrid } from '../components/projectCard.js';
import { openProjectModal, populateProjectModalOptions } from '../components/projectModal.js';

const grid = document.getElementById('projectsGrid');
const loadingState = document.getElementById('projectsLoadingState');
const emptyState = document.getElementById('projectsEmptyState');
const errorState = document.getElementById('projectsErrorState');
const newProjectBtn = document.getElementById('newProjectBtn');
const searchInput = document.getElementById('projectSearchInput');
const statusFilter = document.getElementById('projectStatusFilter');
const typeFilter = document.getElementById('projectTypeFilter');

let allProjects = [];

function setView(view) {
    [loadingState, emptyState, errorState].forEach((el) => { if (el) el.style.display = 'none'; });
    if (grid) grid.style.display = 'none';

    if (view === 'loading' && loadingState) loadingState.style.display = 'flex';
    if (view === 'empty' && emptyState) emptyState.style.display = 'flex';
    if (view === 'error' && errorState) errorState.style.display = 'flex';
    if (view === 'grid' && grid) grid.style.display = 'grid';
}

function applyFilters() {
    const search = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || '';
    const typeId = typeFilter?.value || '';

    const filtered = allProjects.filter((p) => {
        const matchesSearch = !search ||
            p.name.toLowerCase().includes(search) ||
            (p.workspaces?.profiles?.full_name || '').toLowerCase().includes(search) ||
            (p.workspaces?.name || '').toLowerCase().includes(search);
        const matchesStatus = !status || p.status === status;
        const matchesType = !typeId || p.project_type_id === typeId;
        return matchesSearch && matchesStatus && matchesType;
    });

    if (!filtered.length) {
        setView(allProjects.length ? 'grid' : 'empty');
        if (grid) {
            grid.style.display = allProjects.length ? 'grid' : 'none';
            grid.innerHTML = allProjects.length ? '<p style="color:#7a7a7a; grid-column:1/-1; text-align:center; padding:40px 0;">Ningún proyecto coincide con los filtros.</p>' : '';
        }
        return;
    }

    setView('grid');
    renderProjectsGrid(grid, filtered, {
        onView: (id) => { window.location.href = `proyecto-detalle.html?id=${id}`; },
        onDuplicate: handleDuplicate,
        onStatusChange: handleStatusChange,
        onArchive: handleArchive
    });
}

async function loadProjects() {
    setView('loading');
    try {
        allProjects = await listProjects();
        setView(allProjects.length ? 'grid' : 'empty');
        applyFilters();
    } catch (error) {
        console.error('[proyectosPage] Error cargando proyectos:', error.message);
        setView('error');
    }
}

async function handleDuplicate(projectId) {
    const project = allProjects.find((p) => p.id === projectId);
    const newName = window.prompt('Nombre del nuevo proyecto duplicado:', `${project?.name || 'Proyecto'} (copia)`);
    if (!newName) return;

    try {
        const newId = await duplicateProject(projectId, newName);
        await loadProjects();
        window.location.href = `proyecto-detalle.html?id=${newId}`;
    } catch (error) {
        alert(`No se pudo duplicar el proyecto: ${error.message}`);
    }
}

async function handleStatusChange(projectId, status) {
    try {
        await setProjectStatus(projectId, status);
        await loadProjects();
    } catch (error) {
        alert(`No se pudo actualizar el estado: ${error.message}`);
    }
}

async function handleArchive(projectId) {
    if (!window.confirm('¿Archivar este proyecto? Podrás consultarlo luego, pero dejará de aparecer en la lista principal.')) return;
    try {
        await archiveProject(projectId);
        await loadProjects();
    } catch (error) {
        alert(`No se pudo archivar el proyecto: ${error.message}`);
    }
}

async function handleCreate(payload) {
    const { data: authUser } = await supabase.auth.getUser();
    await createProject({ ...payload, created_by: authUser?.user?.id });
    await loadProjects();
}

async function setupModalOptions() {
    try {
        const [clients, types, admins] = await Promise.all([
            listClientWorkspaces(),
            listProjectTypes(),
            listAdmins()
        ]);
        populateProjectModalOptions({ clients, types, admins });

        if (typeFilter) {
            typeFilter.innerHTML = '<option value="">Todos los tipos</option>' +
                types.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
        }
    } catch (error) {
        console.error('[proyectosPage] Error cargando opciones del modal:', error.message);
    }
}

newProjectBtn?.addEventListener('click', () => {
    openProjectModal({ onSubmit: handleCreate });
});

searchInput?.addEventListener('input', applyFilters);
statusFilter?.addEventListener('change', applyFilters);
typeFilter?.addEventListener('change', applyFilters);

setupModalOptions();
loadProjects();
