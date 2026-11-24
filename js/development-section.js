const root = document.querySelector('[data-development]');

if (root) {
  const catalog = {
    apps: {
      title: 'Aplicaciones hechas para tu negocio.',
      description: 'Reservas, pedidos y seguimiento en una experiencia creada a tu medida.',
      contact: 'Quiero una aplicación así',
      modes: [['reservas', 'Reservas'], ['pedidos', 'Pedidos'], ['seguimiento', 'Seguimiento']],
      instructions: {
        reservas: 'Elige un servicio y prueba una reserva.',
        pedidos: 'Añade productos y prepara un pedido de ejemplo.',
        seguimiento: 'Avanza un pedido y consulta cada etapa.'
      }
    },
    web: {
      title: 'Plataformas web para hacer crecer tu negocio.',
      description: 'Tiendas, reservas y portales privados accesibles desde cualquier navegador.',
      contact: 'Quiero una plataforma así',
      modes: [['tienda', 'Tienda online'], ['reservas', 'Reservas'], ['portal', 'Portal privado']],
      instructions: {
        tienda: 'Explora el catálogo y prueba añadir un producto.',
        reservas: 'Elige un espacio y encuentra tu horario.',
        portal: 'Entra a un proyecto de ejemplo y consulta sus documentos.'
      }
    },
    business: {
      title: 'Software que organiza tu empresa.',
      description: 'Clientes, tareas y procesos en un sistema creado para tu operación.',
      contact: 'Quiero un sistema así',
      modes: [['procesos', 'Procesos'], ['clientes', 'Clientes'], ['reportes', 'Reportes']],
      instructions: {
        procesos: 'Mueve una solicitud o pulsa Avanzar para cambiar su etapa.',
        clientes: 'Elige un cliente de ejemplo y asigna un responsable.',
        reportes: 'Consulta el avance de las solicitudes de esta demostración.'
      }
    }
  };
  const products = [
    { name: 'Audífonos', icon: 'headphones' },
    { name: 'Altavoz', icon: 'speaker' }
  ];
  const stageNames = ['Recibidas', 'En proceso', 'Completadas'];
  const state = {
    category: null,
    modes: { apps: 'reservas', web: 'tienda', business: 'procesos' },
    booking: { service: 'Asesoría', time: '11:00', confirmed: false },
    order: { quantities: [0, 0], confirmed: false, stage: 0 },
    cart: [0, 0],
    space: { room: 'Sala creativa', time: '10:00', confirmed: false },
    portalOpen: false,
    board: [
      { id: 'revision', title: 'Revisar solicitud', responsible: 'Atención', stage: 0 },
      { id: 'propuesta', title: 'Preparar propuesta', responsible: 'Comercial', stage: 0 },
      { id: 'entrega', title: 'Entrega confirmada', responsible: 'Operaciones', stage: 2 }
    ],
    boardStage: 0,
    selectedClient: 0,
    clientOwners: ['Comercial', 'Operaciones'],
    report: 'resumen',
    message: '',
    paused: matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  const screenElements = {};
  let scene;
  let initialization;

  const iconPaths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18M8 15h3m3 0h2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/>',
    tools: '<path d="m14 7 3 3 4-4a6 6 0 0 1-8 8l-7 7-3-3 7-7a6 6 0 0 1 8-8Z"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 12h3v9H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 1-2Zm18 0h-3v9h2a2 2 0 0 0 2-2v-5a2 2 0 0 0-1-2Z"/>',
    speaker: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="14" r="4"/><path d="M8 7h8"/>',
    bag: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="3"/><path d="M8 7V3h8v4M2 12h20m-12 0v3h4v-3"/>',
    document: '<path d="M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8m-8 4h6"/>'
  };
  const icon = name => `<svg class="demo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
  const button = (action, value, label, selected = false) => `<button type="button" data-action="${action}" data-value="${value}"${selected ? ' class="is-chosen" aria-pressed="true"' : ''}>${label}</button>`;
  const primary = (action, label) => `<button type="button" class="demo-primary demo-full" data-action="${action}">${label}</button>`;
  const message = text => text ? `<div class="demo-status">✓ ${text}</div>` : '';

  function bookingScreen() {
    const { booking } = state;
    return `<span class="demo-label">${icon('calendar')} Ejemplo interactivo</span>
      <h3>Reserva tu cita</h3>
      <h4>Selecciona un servicio</h4>
      <div class="demo-row demo-services">
        ${button('service', 'Asesoría', icon('user') + 'Asesoría', booking.service === 'Asesoría')}
        ${button('service', 'Visita técnica', icon('tools') + 'Visita técnica', booking.service === 'Visita técnica')}
      </div>
      <h4>Elige un horario</h4>
      <div class="demo-row">${['9:00', '11:00', '15:00'].map(time => button('time', time, time, booking.time === time)).join('')}</div>
      ${primary('book', booking.confirmed ? 'Probar otra reserva' : 'Probar reserva')}
      ${message(booking.confirmed ? `${booking.service} · ${booking.time}<br>Reserva de ejemplo creada.` : '')}`;
  }

  function orderScreen() {
    const count = state.order.quantities.reduce((sum, value) => sum + value, 0);
    return `<span class="demo-label">${icon('bag')} Ejemplo interactivo</span><h3>Tu pedido</h3>
      <p>Elige lo que quieres llevar.</p>
      ${products.map((product, index) => `<div class="demo-order"><div class="demo-order-art">${icon(product.icon)}</div><span class="demo-order-name">${product.name}</span>${button('order-remove', index, '−')}<span>${state.order.quantities[index]}</span>${button('order-add', index, '+')}</div>`).join('')}
      <h4>${count} ${count === 1 ? 'producto' : 'productos'}</h4>
      ${primary('order-confirm', 'Probar pedido')}
      ${message(state.order.confirmed ? 'Pedido de ejemplo preparado.' : state.message)}`;
  }

  function trackingScreen() {
    return `<span class="demo-label">${icon('bag')} Ejemplo interactivo</span><h3>Sigue tu pedido</h3>
      <p>Cada etapa en un solo lugar.</p>
      <div class="demo-track">${['Recibido', 'En preparación', 'Listo para entregar'].map((name, index) => `<div class="${index === state.order.stage ? 'is-current' : ''}">${index < state.order.stage ? '✓ ' : ''}${name}</div>`).join('')}</div>
      ${primary('tracking', state.order.stage === 2 ? 'Volver a empezar' : 'Avanzar pedido')}`;
  }

  function shopScreen() {
    return `<h3>Encuentra tu próximo favorito</h3>
      <div class="demo-products">${products.map((product, index) => `<div class="demo-product"><div class="demo-product-art">${icon(product.icon)}</div><h4>${product.name}</h4>${button('cart-add', index, '+ Añadir')}</div>`).join('')}</div>
      ${message(state.message)}`;
  }

  function spaceScreen() {
    return `<h3>Reserva un espacio</h3><p>Encuentra tu lugar para crear.</p>
      <div class="demo-row demo-space">${['Sala creativa', 'Sala de reuniones'].map(room => button('room', room, room, state.space.room === room)).join('')}</div>
      <h4 class="demo-space">Horarios de ejemplo</h4>
      <div class="demo-row demo-space">${['10:00', '14:00', '16:00'].map(time => button('room-time', time, time, state.space.time === time)).join('')}</div>
      <div class="demo-space">${primary('room-book', state.space.confirmed ? 'Probar otra reserva' : 'Probar reserva')}</div>
      ${message(state.space.confirmed ? `${state.space.room} · ${state.space.time}. Reserva de ejemplo creada.` : '')}`;
  }

  function portalScreen() {
    if (state.portalOpen) {
      return `<h3>Documentos del proyecto</h3><p>Todo lo que necesitas, organizado.</p>
        <div class="demo-document">${icon('document')} Propuesta de ejemplo<p>Diseño, desarrollo y pruebas de una plataforma a medida.</p></div>
        <div class="demo-document">${icon('document')} Próximos pasos<p>Definir funcionalidades y revisar el primer prototipo.</p></div>
        <div class="demo-space">${button('portal', '', '← Volver al proyecto')}</div>`;
    }
    return `<h3>Tu proyecto</h3><p>Consulta entregas y avances desde tu portal.</p>
      <div class="demo-document"><h4>Plataforma a medida</h4><p>Etapa actual · Desarrollo</p><div class="demo-progress"><span></span></div><p>Diseño aprobado · Desarrollo en proceso</p></div>
      <div class="demo-space">${primary('portal', 'Ver documentos')}</div>`;
  }

  function boardScreen() {
    return `<h3>Seguimiento de solicitudes</h3>
      <div class="demo-stage-picker">${stageNames.map((name, index) => button('board-stage', index, name, index === state.boardStage)).join('')}</div>
      <div class="demo-kanban">${stageNames.map((name, index) => `<div class="demo-column${index === state.boardStage ? ' is-current' : ''}" data-drop-stage="${index}"><h4>${name}</h4>
        ${state.board.filter(card => card.stage === index).map(card => `<div class="demo-card${index === 2 ? ' is-completed' : ''}" draggable="true" data-card="${card.id}"><strong>${card.title}</strong><small>Responsable · ${card.responsible}</small>${index < 2 ? button('advance', card.id, 'Avanzar →') : button('restart-card', card.id, 'Volver a recibidas')}</div>`).join('')}
      </div>`).join('')}</div>${message(state.message)}`;
  }

  function clientsScreen() {
    const clients = ['Comercial Norte', 'Estudio Central'];
    return `<h3>Clientes y responsables</h3><p>Contactos de ejemplo para explorar.</p>
      <div class="demo-clients">${clients.map((name, index) => button('client', index, `<span>${name}</span><span>↗</span>`, index === state.selectedClient)).join('')}</div>
      <div class="demo-document"><h4>${clients[state.selectedClient]}</h4><p>Responsable · ${state.clientOwners[state.selectedClient]}</p><p>Estado · Seguimiento activo</p>${button('assign-client', '', 'Cambiar responsable')}</div>${message(state.message)}`;
  }

  function reportsScreen() {
    const counts = stageNames.map((_, index) => state.board.filter(card => card.stage === index).length);
    return `<h3>El avance de tu operación</h3><p>Datos de las solicitudes de este ejemplo.</p>
      <div class="demo-row demo-space">${button('report', 'resumen', 'Resumen', state.report === 'resumen')}${button('report', 'detalle', 'Por etapa', state.report === 'detalle')}</div>
      ${state.report === 'resumen' ? `<div class="demo-report"><div><strong>${state.board.length}</strong>Solicitudes</div><div><strong>${counts[1]}</strong>En proceso</div><div><strong>${counts[2]}</strong>Completadas</div></div>` : `<div class="demo-bars">${stageNames.map((name, index) => `<div><span>${name}</span><i style="width:${20 + counts[index] * 55}px"></i><b>${counts[index]}</b></div>`).join('')}</div>`}
      <div class="demo-document"><p>Al mover una solicitud en Procesos, este reporte se actualiza.</p></div>`;
  }

  const renderers = {
    apps: { reservas: bookingScreen, pedidos: orderScreen, seguimiento: trackingScreen },
    web: { tienda: shopScreen, reservas: spaceScreen, portal: portalScreen },
    business: { procesos: boardScreen, clientes: clientsScreen, reportes: reportsScreen }
  };

  function renderScreen(category) {
    const element = screenElements[category];
    const focused = document.activeElement?.closest('[data-action]');
    const focusedAction = element.contains(focused) ? focused?.dataset.action : null;
    const focusedValue = focused?.dataset.value;
    const mode = state.modes[category];
    const content = renderers[category][mode]();
    if (category === 'apps') {
      element.innerHTML = content;
    } else {
      const name = category === 'business' ? 'Mi empresa' : mode === 'tienda' ? 'Tu tienda' : mode === 'portal' ? 'Tu portal' : 'Tu espacio';
      const cartCount = state.cart.reduce((sum, count) => sum + count, 0);
      const cart = cartCount > 0 ? `<button type="button" class="demo-cart" data-action="cart-clear" aria-label="Vaciar carrito de ejemplo"><span class="demo-counter">${cartCount} en carrito</span><span aria-hidden="true">×</span></button>` : '<span class="demo-counter">0 en carrito</span>';
      const toolbar = `<div class="demo-browser-bar"><span class="demo-browser-dots"></span>${category === 'business' ? 'operacion.ejemplo' : 'plataforma.ejemplo'}</div><div class="demo-toolbar"><span class="demo-brand">${icon(category === 'business' ? 'briefcase' : 'bag')}${name}</span><span class="demo-label">Ejemplo interactivo</span>${category === 'web' && mode === 'tienda' ? cart : ''}</div>`;
      const sidebar = category === 'business' ? `<aside class="demo-sidebar"><span>Resumen</span><span class="${mode === 'clientes' ? 'is-current' : ''}">Clientes</span><span class="${mode === 'procesos' ? 'is-current' : ''}">Procesos</span><span class="${mode === 'reportes' ? 'is-current' : ''}">Reportes</span></aside>` : '';
      element.innerHTML = toolbar + `<div class="${category === 'business' ? 'demo-workspace' : 'demo-web-content'}">${sidebar}<div class="demo-main">${content}</div></div>`;
    }
    if (focusedAction) {
      const replacement = [...element.querySelectorAll('[data-action]')].find(button => button.dataset.action === focusedAction && button.dataset.value === focusedValue);
      replacement?.focus({ preventScroll: true });
    }
  }

  function announce(text) {
    state.message = text;
    root.querySelector('[data-dev-announcement]').textContent = text;
  }

  function moveCard(id, stage) {
    const card = state.board.find(item => item.id === id);
    if (!card || !Number.isInteger(stage) || stage < 0 || stage > 2) return;
    card.stage = stage;
    state.boardStage = stage;
    announce(`${card.title}. Estado actualizado a ${stageNames[stage].toLowerCase()}.`);
  }

  const actions = {
    service(value) { state.booking.service = value; state.booking.confirmed = false; },
    time(value) { state.booking.time = value; state.booking.confirmed = false; },
    book() {
      state.booking.confirmed = !state.booking.confirmed;
      announce(state.booking.confirmed ? 'Reserva de ejemplo creada.' : 'Elige otra reserva.');
    },
    'order-add'(value) { state.order.quantities[Number(value)] = Math.min(9, state.order.quantities[Number(value)] + 1); state.order.confirmed = false; },
    'order-remove'(value) { state.order.quantities[Number(value)] = Math.max(0, state.order.quantities[Number(value)] - 1); state.order.confirmed = false; },
    'order-confirm'() {
      state.order.confirmed = state.order.quantities.some(quantity => quantity > 0);
      announce(state.order.confirmed ? 'Pedido de ejemplo preparado.' : 'Añade al menos un producto para probar el pedido.');
    },
    tracking() { state.order.stage = (state.order.stage + 1) % 3; announce(`Pedido de ejemplo. ${['Recibido', 'En preparación', 'Listo para entregar'][state.order.stage]}.`); },
    'cart-add'(value) { state.cart[Number(value)] = Math.min(99, state.cart[Number(value)] + 1); announce(`${products[Number(value)].name}. Producto añadido.`); },
    'cart-clear'() { state.cart = [0, 0]; announce('Carrito de ejemplo vacío.'); },
    room(value) { state.space.room = value; state.space.confirmed = false; },
    'room-time'(value) { state.space.time = value; state.space.confirmed = false; },
    'room-book'() { state.space.confirmed = !state.space.confirmed; announce(state.space.confirmed ? 'Reserva de espacio de ejemplo creada.' : 'Elige otro espacio.'); },
    portal() { state.portalOpen = !state.portalOpen; },
    'board-stage'(value) { state.boardStage = Number(value); },
    advance(value) { const card = state.board.find(item => item.id === value); if (card) moveCard(value, Math.min(2, card.stage + 1)); },
    'restart-card'(value) { moveCard(value, 0); },
    client(value) { state.selectedClient = Number(value); },
    'assign-client'() { const index = state.selectedClient; state.clientOwners[index] = state.clientOwners[index] === 'Comercial' ? 'Operaciones' : 'Comercial'; announce(`Responsable actualizado a ${state.clientOwners[index]}.`); },
    report(value) { state.report = value; }
  };

  for (const category of Object.keys(catalog)) {
    const element = document.createElement('div');
    element.className = `dev-ui${category === 'apps' ? ' demo-phone' : ''}`;
    element.dataset.demo = category;
    element.setAttribute('aria-label', `Ejemplo interactivo de ${category === 'apps' ? 'aplicación' : category === 'web' ? 'plataforma web' : 'software empresarial'}`);
    element.inert = true;
    element.addEventListener('click', event => {
      const control = event.target.closest('[data-action]');
      if (!control || state.category !== category) return;
      const action = actions[control.dataset.action];
      if (!action) return;
      state.message = '';
      action(control.dataset.value);
      renderScreen(category);
    });
    let draggedId = null;
    element.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-card]');
      if (!card) return;
      draggedId = card.dataset.card;
      event.dataTransfer.setData('text/plain', draggedId);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });
    element.addEventListener('dragover', event => {
      const column = event.target.closest('[data-drop-stage]');
      if (!column || !draggedId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      column.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave', event => {
      const column = event.target.closest('[data-drop-stage]');
      if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-drop-target');
    });
    element.addEventListener('drop', event => {
      const column = event.target.closest('[data-drop-stage]');
      if (!column || !draggedId) return;
      event.preventDefault();
      moveCard(draggedId, Number(column.dataset.dropStage));
      draggedId = null;
      renderScreen(category);
    });
    element.addEventListener('dragend', () => {
      draggedId = null;
      element.querySelectorAll('.is-drop-target, .is-dragging').forEach(item => item.classList.remove('is-drop-target', 'is-dragging'));
    });
    screenElements[category] = element;
    renderScreen(category);
  }

  function selectCategory(category) {
    if (category && !catalog[category]) return;
    state.category = category;
    state.message = '';
    root.querySelector('.dev-modebar').hidden = !category;
    root.querySelector('.dev-options').hidden = !category;
    if (category) {
      root.dataset.category = category;
      const entry = catalog[category];
      root.querySelector('[data-dev-title]').textContent = entry.title;
      root.querySelector('[data-dev-summary]').textContent = entry.description;
      const choices = root.querySelector('[data-dev-choices]');
      choices.innerHTML = entry.modes.map(([value, label]) => `<button type="button" data-dev-mode="${value}" aria-pressed="${state.modes[category] === value}">${label}</button>`).join('');
      root.querySelector('[data-dev-instruction]').textContent = entry.instructions[state.modes[category]];
      root.querySelector('[data-dev-contact]').innerHTML = `${entry.contact} <span aria-hidden="true">↗</span>`;
      root.querySelector('[data-dev-contact]').href = `https://wa.me/573132932194?text=${encodeURIComponent(`Hola, NEXA. Me interesa desarrollar ${category === 'apps' ? 'una aplicación' : category === 'web' ? 'una plataforma web' : 'software empresarial'} para mi negocio.`)}`;
      root.querySelector('[data-dev-hint]').textContent = 'Prueba la pantalla. Puedes cambiar de ejemplo cuando quieras.';
      renderScreen(category);
    } else {
      delete root.dataset.category;
      root.querySelector('[data-dev-title]').innerHTML = 'Tu idea.<br> Todo un<br><span>sistema.</span>';
      root.querySelector('[data-dev-summary]').textContent = 'Aplicaciones, plataformas web y software empresarial creados a tu medida.';
      root.querySelector('[data-dev-contact]').innerHTML = 'Hablemos de tu proyecto <span aria-hidden="true">↗</span>';
      root.querySelector('[data-dev-contact]').href = 'https://wa.me/573132932194?text=Hola%2C%20NEXA.%20Quiero%20hablar%20sobre%20un%20proyecto%20de%20desarrollo.';
      root.querySelector('[data-dev-hint]').textContent = 'Mueve el cursor y elige una solución para explorar.';
    }
    root.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab.dataset.devCategory === category;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    for (const [name, element] of Object.entries(screenElements)) element.inert = name !== category;
    scene?.select(category);
    if (root.classList.contains('is-fallback')) showFallback(category || 'apps');
  }

  root.addEventListener('click', event => {
    const category = event.target.closest('[data-dev-category]');
    if (category) selectCategory(category.dataset.devCategory);
    const mode = event.target.closest('[data-dev-mode]');
    if (mode && state.category) {
      state.modes[state.category] = mode.dataset.devMode;
      selectCategory(state.category);
      const current = [...root.querySelectorAll('[data-dev-mode]')].find(item => item.dataset.devMode === mode.dataset.devMode);
      current?.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-dev-back]')) {
      const previous = state.category;
      selectCategory(null);
      root.querySelector(`[data-dev-pin="${previous}"]`)?.focus({ preventScroll: true });
    }
  });
  root.querySelector('.dev-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const categories = Object.keys(catalog);
    let index = categories.indexOf(state.category);
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = 2;
    else index = (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    selectCategory(categories[index]);
    root.querySelector(`#dev-tab-${categories[index]}`).focus({ preventScroll: true });
  });
  const motionButton = root.querySelector('[data-dev-motion]');
  function updateMotion() {
    motionButton.setAttribute('aria-pressed', String(state.paused));
    motionButton.textContent = state.paused ? 'Reanudar movimiento' : 'Pausar movimiento';
    scene?.setPaused(state.paused);
  }
  motionButton.addEventListener('click', () => { state.paused = !state.paused; updateMotion(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { state.paused = event.matches; updateMotion(); });

  function showFallback(category) {
    const holder = root.querySelector('[data-dev-interface]');
    for (const [name, element] of Object.entries(screenElements)) {
      element.style.display = '';
      element.hidden = name !== category;
      element.inert = name !== category;
      holder.append(element);
    }
  }

  async function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        const { createDevelopmentScene } = await import('./development-scene.js?v=20261124-1');
        scene = createDevelopmentScene(root, screenElements, selectCategory);
        scene.select(state.category);
        updateMotion();
        root.classList.add('is-ready');
        root.dataset.renderer = 'webgl';
      } catch (error) {
        root.classList.add('is-fallback');
        root.dataset.renderer = 'html';
        showFallback(state.category || 'apps');
        console.warn('Nexa: la demostración continúa con sus controles accesibles.', error);
      }
    })();
    return initialization;
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { initialize(); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(root);
  } else initialize();
  updateMotion();
}
