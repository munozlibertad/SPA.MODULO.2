// Lógica del SPA - Administrador de Prompts
// Soporte híbrido: Google Apps Script nativo + Local fallback

// Variable que detecta si está corriendo dentro de Google Apps Script
const isRunningInGAS = (typeof google !== 'undefined' && google.script && google.script.run);

let prompts = [];
let categories = [];
let selectedCategory = 'all';
let searchQuery = '';
let deletingPromptId = null;

// Elementos del DOM
const DOM = {
  themeToggle: document.getElementById('theme-toggle'),
  btnConfig: document.getElementById('btn-config'),
  btnOpenCreate: document.getElementById('btn-open-create'),
  btnEmptyCreate: document.getElementById('btn-empty-create'),
  statTotal: document.getElementById('stat-total'),
  statCategories: document.getElementById('stat-categories'),
  statApiStatus: document.getElementById('stat-api-status'),
  btnOpenConfigDb: document.getElementById('btn-open-config-db'),
  searchInput: document.getElementById('search-input'),
  categoryFilters: document.getElementById('category-filters-container'),
  promptsGrid: document.getElementById('prompts-grid-container'),
  loadingView: document.getElementById('loading-view'),
  loadingSubtext: document.getElementById('loading-subtext'),
  emptyView: document.getElementById('empty-view'),
  modalForm: document.getElementById('modal-form-overlay'),
  formModalTitle: document.getElementById('form-modal-title'),
  promptForm: document.getElementById('prompt-form'),
  formPromptId: document.getElementById('form-prompt-id'),
  formCategoria: document.getElementById('form-categoria'),
  formNombre: document.getElementById('form-nombre'),
  formPrompt: document.getElementById('form-prompt'),
  formEjemplos: document.getElementById('form-ejemplos'),
  categoriesDatalist: document.getElementById('categories-datalist'),
  btnCancelForm: document.getElementById('btn-cancel-form'),
  btnCloseFormModal: document.getElementById('btn-close-form-modal'),
  btnSubmitForm: document.getElementById('btn-submit-form'),
  modalDetail: document.getElementById('modal-detail-overlay'),
  detailCategoria: document.getElementById('detail-categoria'),
  detailNombre: document.getElementById('detail-nombre'),
  detailPrompt: document.getElementById('detail-prompt'),
  detailEjemplos: document.getElementById('detail-ejemplos'),
  detailEjemplosSection: document.getElementById('detail-ejemplos-section'),
  btnCopyPrompt: document.getElementById('btn-copy-prompt'),
  btnClosedetail: document.getElementById('btn-close-detail'),
  btnCloseDetailModal: document.getElementById('btn-close-detail-modal'),
  modalDelete: document.getElementById('modal-delete-overlay'),
  deletePromptName: document.getElementById('delete-prompt-name'),
  btnCancelDelete: document.getElementById('btn-cancel-delete'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),
  btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),
  modalConfig: document.getElementById('modal-config-overlay'),
  configForm: document.getElementById('config-form'),
  configApiUrl: document.getElementById('config-api-url'),
  btnCancelConfig: document.getElementById('btn-cancel-config'),
  btnCloseConfigModal: document.getElementById('btn-close-config-modal'),
  toastContainer: document.getElementById('toast-container')
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAPI();
  setupEventListeners();
});

// MANTENIMIENTO DEL TEMA
function initTheme() {
  const savedTheme = localStorage.getItem('prompt_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.remove('light-theme');
    DOM.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  if (isLight) {
    localStorage.setItem('prompt_theme', 'light');
    DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    showToast('Modo claro activado', 'warning');
  } else {
    localStorage.setItem('prompt_theme', 'dark');
    DOM.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    showToast('Modo nocturno activado', 'success');
  }
}

// CONFIGURACIÓN Y CLIENTE API HÍBRIDO
function initAPI() {
  if (isRunningInGAS) {
    updateApiStatus(true, 'Conectado');
    loadPromptsFromGAS();
  } else {
    const apiUrl = localStorage.getItem('prompt_api_url');
    if (apiUrl) {
      DOM.configApiUrl.value = apiUrl;
      testConnection(apiUrl);
    } else {
      updateApiStatus(false, 'Desconectado');
      DOM.loadingSubtext.innerHTML = '<strong style="color: var(--accent);">Acción requerida:</strong> Haz clic en el botón de engranaje arriba para configurar la URL de tu Google Apps Script.';
      openModal(DOM.modalConfig);
    }
  }
}

function updateApiStatus(connected, message) {
  if (connected) {
    DOM.statApiStatus.textContent = message || "Conectado";
    DOM.statApiStatus.style.color = "var(--success)";
    DOM.loadingSubtext.textContent = "Obteniendo datos de Google Sheets...";
  } else {
    DOM.statApiStatus.textContent = message || "Desconectado";
    DOM.statApiStatus.style.color = "var(--danger)";
  }
}

async function loadPromptsFromGAS() {
  try {
    updateApiStatus(true, 'Cargando...');
    google.script.run
      .withSuccessHandler(data => {
        prompts = data || [];
        updateApiStatus(true, 'Conectado');
        updateState();
        renderPrompts();
        renderCategories();
      })
      .withFailureHandler(err => {
        console.error(err);
        updateApiStatus(false, 'Error');
        showToast('Error cargando datos de Google Sheets', 'danger');
      })
      .readPrompts();
  } catch (error) {
    updateApiStatus(false, 'Error');
  }
}

async function testConnection(url) {
  try {
    updateApiStatus(false, 'Probando...');
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'read' })
    });
    
    const result = await response.json();
    if (result.success) {
      updateApiStatus(true);
      prompts = result.data || [];
      updateState();
      renderPrompts();
      renderCategories();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Error conectando a la API:", error);
    updateApiStatus(false, 'Error');
    showToast('Error de conexión a la API. Verifica la URL.', 'danger');
    DOM.loadingView.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--danger); margin-bottom:1rem;"></i>
      <h3>Error de conexión</h3>
      <p style="color: var(--text-secondary); max-width: 400px; margin: 0.5rem auto 1.5rem;">
        No pudimos comunicarnos con Google Apps Script. Revisa que el script esté implementado correctamente y configurado para acceso público de "Cualquiera".
      </p>
      <button class="btn btn-secondary" onclick="openModal(DOM.modalConfig)">Reconfigurar URL</button>
    `;
  }
}

async function callAPI(action, data = null, id = null) {
  if (isRunningInGAS) {
    return new Promise((resolve, reject) => {
      const successHandler = (result) => resolve(result);
      const failureHandler = (err) => reject(err);
      
      const runner = google.script.run
        .withSuccessHandler(successHandler)
        .withFailureHandler(failureHandler);
        
      if (action === 'create') runner.createPrompt(data);
      else if (action === 'read') runner.readPrompts();
      else if (action === 'update') runner.updatePrompt(id, data);
      else if (action === 'delete') runner.deletePrompt(id);
      else if (action === 'setup') runner.setupSheet();
    });
  } else {
    const url = localStorage.getItem('prompt_api_url');
    if (!url) throw new Error("Configura la URL de la API primero.");
    
    const payload = { action };
    if (data) payload.data = data;
    if (id) payload.id = id;
    
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error en el servidor");
    return result.data;
  }
}

function updateState() {
  const allCategories = prompts.map(p => p.categoria.trim()).filter(Boolean);
  categories = [...new Set(allCategories)].sort();
  
  DOM.statTotal.textContent = prompts.length;
  DOM.statCategories.textContent = categories.length;
  DOM.categoriesDatalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
}

// RENDERIZADO DE COMPONENTES UI
function renderCategories() {
  let html = `<button class="category-chip ${selectedCategory === 'all' ? 'active' : ''}" data-category="all">Todos</button>`;
  categories.forEach(cat => {
    html += `<button class="category-chip ${selectedCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`;
  });
  DOM.categoryFilters.innerHTML = html;
  
  DOM.categoryFilters.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.categoryFilters.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = chip.dataset.category;
      renderPrompts();
    });
  });
}

function renderPrompts() {
  DOM.loadingView.style.display = 'none';
  
  const filteredPrompts = prompts.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.categoria === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      item.nombre.toLowerCase().includes(query) || 
      item.categoria.toLowerCase().includes(query) || 
      item.prompt.toLowerCase().includes(query) ||
      (item.ejemplos && item.ejemplos.toLowerCase().includes(query));
      
    return matchesCategory && matchesSearch;
  });
  
  const existingCards = DOM.promptsGrid.querySelectorAll('.prompt-card');
  existingCards.forEach(card => card.remove());
  
  if (filteredPrompts.length === 0) {
    DOM.emptyView.style.display = 'flex';
    return;
  }
  
  DOM.emptyView.style.display = 'none';
  const fragment = document.createDocumentFragment();
  
  filteredPrompts.forEach(item => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.id = item.id;
    
    const countExamples = item.ejemplos ? item.ejemplos.split('\n').filter(line => line.trim()).length : 0;
    
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <span class="card-category">${escapeHTML(item.categoria)}</span>
          <h4 class="card-title" title="${escapeHTML(item.nombre)}">${escapeHTML(item.nombre)}</h4>
        </div>
        <div class="card-actions">
          <button class="action-btn btn-edit" title="Editar prompt">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn btn-delete" title="Eliminar prompt">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <div class="card-content-preview">${escapeHTML(item.prompt)}</div>
      <div class="card-footer">
        <span class="examples-badge">
          <i class="fa-solid fa-lightbulb"></i> ${countExamples} ejemplo(s)
        </span>
        <span class="examples-badge" style="margin-left: 0.5rem;" title="Fecha de creación">
          <i class="fa-regular fa-calendar"></i> ${item.fecha || 'N/A'}
        </span>
        <button class="btn btn-card-copy" style="margin-left: auto;">
          <i class="fa-regular fa-copy"></i> Copiar
        </button>
      </div>
    `;
    
    card.querySelector('.btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditForm(item.id);
    });
    
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(item.id);
    });
    
    const btnCopy = card.querySelector('.btn-card-copy');
    btnCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPromptText(btnCopy, item.prompt);
    });
    
    card.addEventListener('click', () => openDetailModal(item));
    fragment.appendChild(card);
  });
  
  DOM.promptsGrid.appendChild(fragment);
}

// MODALES
function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
});

// EVENT LISTENERS
function setupEventListeners() {
  DOM.themeToggle.addEventListener('click', toggleTheme);
  
  DOM.btnConfig.addEventListener('click', () => {
    if (isRunningInGAS) {
      showToast('Conectado nativamente a Google Sheets', 'success');
    } else {
      openModal(DOM.modalConfig);
    }
  });
  DOM.btnOpenConfigDb.addEventListener('click', () => {
    if (isRunningInGAS) {
      showToast('Conectado nativamente a Google Sheets', 'success');
    } else {
      openModal(DOM.modalConfig);
    }
  });
  
  DOM.btnOpenCreate.addEventListener('click', openCreateForm);
  DOM.btnEmptyCreate.addEventListener('click', openCreateForm);
  
  DOM.btnCloseFormModal.addEventListener('click', () => closeModal(DOM.modalForm));
  DOM.btnCancelForm.addEventListener('click', () => closeModal(DOM.modalForm));
  DOM.btnCloseDetailModal.addEventListener('click', () => closeModal(DOM.modalDetail));
  DOM.btnClosedetail.addEventListener('click', () => closeModal(DOM.modalDetail));
  DOM.btnCloseDeleteModal.addEventListener('click', () => closeModal(DOM.modalDelete));
  DOM.btnCancelDelete.addEventListener('click', () => closeModal(DOM.modalDelete));
  DOM.btnCloseConfigModal.addEventListener('click', () => closeModal(DOM.modalConfig));
  DOM.btnCancelConfig.addEventListener('click', () => closeModal(DOM.modalConfig));
  
  DOM.configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = DOM.configApiUrl.value.trim();
    if (url) {
      localStorage.setItem('prompt_api_url', url);
      closeModal(DOM.modalConfig);
      showToast('API URL Guardada. Conectando...', 'warning');
      DOM.loadingView.style.display = 'flex';
      const cards = DOM.promptsGrid.querySelectorAll('.prompt-card');
      cards.forEach(c => c.remove());
      DOM.emptyView.style.display = 'none';
      testConnection(url);
    }
  });
  
  DOM.promptForm.addEventListener('submit', handleFormSubmit);
  DOM.btnConfirmDelete.addEventListener('click', handleDeleteConfirm);
  DOM.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderPrompts();
  });
}

// CRUD ACTIONS
function openCreateForm() {
  DOM.formPromptId.value = "";
  DOM.promptForm.reset();
  DOM.formModalTitle.textContent = "Agregar Nuevo Prompt";
  openModal(DOM.modalForm);
  DOM.formCategoria.focus();
}

function openEditForm(id) {
  const promptItem = prompts.find(p => p.id === id);
  if (!promptItem) return;
  
  DOM.formModalTitle.textContent = "Editar Prompt";
  DOM.formPromptId.value = promptItem.id;
  DOM.formCategoria.value = promptItem.categoria;
  DOM.formNombre.value = promptItem.nombre;
  DOM.formPrompt.value = promptItem.prompt;
  DOM.formEjemplos.value = promptItem.ejemplos || "";
  
  openModal(DOM.modalForm);
  DOM.formCategoria.focus();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = DOM.formPromptId.value;
  const isEditing = id !== "";
  
  const promptData = {
    categoria: DOM.formCategoria.value.trim(),
    nombre: DOM.formNombre.value.trim(),
    prompt: DOM.formPrompt.value.trim(),
    ejemplos: DOM.formEjemplos.value.trim()
  };
  
  DOM.btnSubmitForm.disabled = true;
  DOM.btnSubmitForm.textContent = "Guardando...";
  
  try {
    if (isEditing) {
      const updatedItem = await callAPI('update', promptData, id);
      const idx = prompts.findIndex(p => p.id === id);
      if (idx !== -1) prompts[idx] = updatedItem;
      showToast('Prompt actualizado correctamente', 'success');
    } else {
      const newItem = await callAPI('create', promptData);
      prompts.push(newItem);
      showToast('Prompt creado con éxito', 'success');
    }
    
    updateState();
    renderCategories();
    renderPrompts();
    closeModal(DOM.modalForm);
  } catch (error) {
    console.error(error);
    showToast('Error al guardar el prompt', 'danger');
  } finally {
    DOM.btnSubmitForm.disabled = false;
    DOM.btnSubmitForm.textContent = "Guardar Prompt";
  }
}

function confirmDelete(id) {
  const promptItem = prompts.find(p => p.id === id);
  if (!promptItem) return;
  
  deletingPromptId = id;
  DOM.deletePromptName.textContent = promptItem.nombre;
  openModal(DOM.modalDelete);
}

async function handleDeleteConfirm() {
  if (!deletingPromptId) return;
  
  DOM.btnConfirmDelete.disabled = true;
  DOM.btnConfirmDelete.textContent = "Eliminando...";
  
  try {
    await callAPI('delete', null, deletingPromptId);
    prompts = prompts.filter(p => p.id !== deletingPromptId);
    
    updateState();
    renderCategories();
    renderPrompts();
    showToast('Prompt eliminado correctamente', 'success');
    closeModal(DOM.modalDelete);
  } catch (error) {
    console.error(error);
    showToast('No se pudo eliminar el prompt', 'danger');
  } finally {
    DOM.btnConfirmDelete.disabled = false;
    DOM.btnConfirmDelete.textContent = "Sí, Eliminar";
    deletingPromptId = null;
  }
}

// DETALLE Y COPIADO
function openDetailModal(item) {
  DOM.detailCategoria.textContent = item.categoria;
  DOM.detailNombre.textContent = item.nombre;
  DOM.detailPrompt.textContent = item.prompt;
  
  const detailFechaEl = document.getElementById('detail-fecha');
  if (detailFechaEl) {
    detailFechaEl.textContent = item.fecha ? `• ${item.fecha}` : '';
  }
  
  if (item.ejemplos) {
    DOM.detailEjemplos.textContent = item.ejemplos;
    DOM.detailEjemplosSection.style.display = 'block';
  } else {
    DOM.detailEjemplosSection.style.display = 'none';
  }
  
  DOM.btnCopyPrompt.onclick = () => {
    copyPromptText(DOM.btnCopyPrompt, item.prompt);
  };
  
  openModal(DOM.modalDetail);
}

function copyPromptText(button, text) {
  navigator.clipboard.writeText(text).then(() => {
    const originalContent = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
    button.style.background = 'var(--success)';
    button.style.color = 'white';
    button.style.borderColor = 'transparent';
    
    showToast('Prompt copiado al portapapeles', 'success');
    
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.style.background = '';
      button.style.color = '';
      button.style.borderColor = '';
    }, 2000);
  }).catch(err => {
    console.error(err);
    showToast('Error al copiar el texto', 'danger');
  });
}

// UTILERÍA: TOASTS & ESCAPING
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-check-circle';
  if (type === 'danger') iconClass = 'fa-times-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-circle';
  
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fa-solid ${iconClass} toast-icon"></i>
      <span class="toast-message">${escapeHTML(message)}</span>
    </div>
    <button class="toast-close">&times;</button>
  `;
  
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) removeToast(toast);
  }, 4000);
}

function removeToast(toast) {
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove());
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
