/* ==========================================================
   NEXA HUB — Página: Proyectos (admin/proyectos.html)
   ==========================================================
   Flujo: Nuevo proyecto → Seleccionar cliente →
   Portal: modal actual | Express: modal Express
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import {
    listProjects, createProject, duplicateProject, setProjectStatus, archiveProject
} from '../../services/projectService.js';
import { listProjectTypes } from '../../services/projectTypeService.js';
import { listAdmins, listClientWorkspaces } from '../../services/profileService.js';
import { listEmployees } from '../../services/employeeService.js';
import { listExpressClients, createExpressProject } from '../services/expressClientService.js';
import { renderProjectsGrid } from '../components/projectCard.js';
import { openProjectModal, populateProjectModalOptions } from '../components/projectModal.js';
import { openProjectClientChooser } from '../components/projectClientChooser.js';
import { openExpressProjectModal } from '../components/expressProjectModal.js';

const grid = document.getElementById('projectsGrid');
const loadingState = document.getElementById('projectsLoadingState');
const emptyState = document.getElementById('projectsEmptyState');
const errorState = document.getElementById('projectsErrorState');
const newProjectBtn = document.getElementById('newProjectBtn');
const searchInput = document.getElementById('projectSearchInput');
const statusFilter = document.getElementById('projectStatusFilter');
const typeFilter = document.getElementById('projectTypeFilter');

let allProjects = [];
let portalWorkspaces = [];
let expressClientsCache = [];
let employeesCache = [];

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

async function handleCreatePortal(payload) {
    const { data: authUser } = await supabase.auth.getUser();
    const newProject = await createProject({ ...payload, created_by: authUser?.user?.id });
    window.location.href = `proyecto-detalle.html?id=${newProject.id}`;
}

function buildChooserClients() {
    const portal = (portalWorkspaces || []).map((w) => ({
        kind: 'portal',
        id: w.id,
        label: w.profiles?.full_name || w.name || 'Cliente Portal',
        sublabel: w.name && w.profiles?.full_name && w.name !== w.profiles.full_name ? w.name : (w.profiles?.email || '')
    }));
    const express = (expressClientsCache || []).map((c) => ({
        kind: 'express',
        id: c.id,
        label: c.full_name || c.contact || 'Cliente Express',
        sublabel: c.company || c.phone || ''
    }));
    return portal.concat(express);
}

function mapEmployeesForSelect(employees) {
    return (employees || [])
        .filter((e) => e && e.is_active !== false)
        .map((e) => ({
            id: e.id,
            full_name: e.full_name || e.profiles?.full_name || 'Empleado',
            role_label: e.employee_roles?.label || e.role_key || ''
        }));
}

async function startNewProjectFlow() {
    try {
        const [workspaces, expressList, employees] = await Promise.all([
            listClientWorkspaces(),
            listExpressClients().catch((err) => {
                console.warn('[proyectosPage] Express no disponible:', err.message);
                return [];
            }),
            listEmployees().catch(() => [])
        ]);
        portalWorkspaces = workspaces || [];
        expressClientsCache = expressList || [];
        employeesCache = mapEmployeesForSelect(employees);

        openProjectClientChooser({
            clients: buildChooserClients(),
            onSelect: (client) => {
                if (client.kind === 'express') {
                    openExpressProjectModal({
                        mode: 'create',
                        clientLabel: client.label,
                        employees: employeesCache,
                        onSubmit: async (payload) => {
                            const created = await createExpressProject(client.id, payload);
                            window.location.href = `express-cliente.html?id=${encodeURIComponent(client.id)}&project=${encodeURIComponent(created.id)}`;
                        }
                    });
                    return;
                }
                try {
                    await ensurePortalModalOptions();
                    openProjectModal({
                        workspaceId: client.id,
                        onSubmit: handleCreatePortal
                    });
                } catch (err) {
                    alert(err.message || 'No se pudo abrir el formulario de proyecto.');
                }
            }
        });
    } catch (error) {
        alert(`No se pudo abrir el selector de clientes: ${error.message}`);
    }
}

/**
 * Carga opciones del modal Portal.
 * IMPORTANTE: tipos, clientes y responsables se cargan por separado.
 * Si clientes/admins fallan (permisos, RLS, red), los tipos de proyecto
 * deben seguir apareciendo — antes un Promise.all los dejaba vacíos.
 */
async function setupModalOptions() {
    // Esperar sesión antes de consultar (admins nuevos / primer login).
    try {
        await supabase.auth.getSession();
    } catch (_) { /* ignore */ }

    let clients = [];
    let types = [];
    let admins = [];

    try {
        types = await listProjectTypes();
    } catch (error) {
        console.error('[proyectosPage] No se pudieron cargar tipos de proyecto:', error.message);
        types = [];
    }

    try {
        clients = await listClientWorkspaces();
    } catch (error) {
        console.error('[proyectosPage] No se pudieron cargar clientes Portal:', error.message);
        clients = [];
    }

    try {
        admins = await listAdmins();
    } catch (error) {
        console.error('[proyectosPage] No se pudieron cargar responsables:', error.message);
        admins = [];
    }

    portalWorkspaces = clients || [];
    populateProjectModalOptions({
        clients: clients || [],
        types: types || [],
        admins: admins || []
    });

    if (typeFilter) {
        typeFilter.innerHTML = '<option value="">Todos los tipos</option>' +
            (types || []).map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    return { clients, types, admins };
}

/** Recarga opciones del modal Portal justo antes de abrirlo. */
async function ensurePortalModalOptions() {
    const result = await setupModalOptions();
    if (!(result?.types || []).length) {
        throw new Error(
            'No se pudieron cargar los tipos de proyecto. Recarga la página o verifica tu sesión de administrador.'
        );
    }
}

newProjectBtn?.addEventListener('click', () => {
    startNewProjectFlow();
});

searchInput?.addEventListener('input', applyFilters);
statusFilter?.addEventListener('change', applyFilters);
typeFilter?.addEventListener('change', applyFilters);

setupModalOptions();
loadProjects();
