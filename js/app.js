/* ============================================
   TODO App - Application Logic
   ============================================ */

(function () {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_TODOS = 'todo-app-todos';
  const STORAGE_SETTINGS = 'todo-app-settings';

  // --- Default Settings ---
  const DEFAULT_SETTINGS = {
    alertDays: 3,
    alertEnabled: true,
    categories: ['仕事', 'プライベート', '買い物', 'その他'],
  };

  // --- State ---
  let todos = [];
  let settings = { ...DEFAULT_SETTINGS };
  let confirmCallback = null;

  // --- Utility ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadFromStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function priorityWeight(priority) {
    const weights = { high: 0, medium: 1, low: 2 };
    return weights[priority] ?? 1;
  }

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    statsTotal: $('#stats-total'),
    statsCompleted: $('#stats-completed'),
    statsPending: $('#stats-pending'),
    progressFill: $('#progress-fill'),
    alertBanner: $('#alert-banner'),
    alertBannerText: $('#alert-banner-text'),
    alertBannerClose: $('#alert-banner-close'),
    todoList: $('#todo-list'),
    emptyState: $('#empty-state'),
    searchInput: $('#search-input'),
    filterCategory: $('#filter-category'),
    filterPriority: $('#filter-priority'),
    filterStatus: $('#filter-status'),
    sortBy: $('#sort-by'),
    btnAddTodo: $('#btn-add-todo'),
    btnSettings: $('#btn-settings'),
    // Modal: TODO
    modalTodo: $('#modal-todo'),
    modalTodoTitle: $('#modal-todo-title'),
    modalTodoClose: $('#modal-todo-close'),
    formTodo: $('#form-todo'),
    todoId: $('#todo-id'),
    todoTitle: $('#todo-title'),
    todoDescription: $('#todo-description'),
    todoCategory: $('#todo-category'),
    todoPriority: $('#todo-priority'),
    todoDueDate: $('#todo-due-date'),
    btnCancelTodo: $('#btn-cancel-todo'),
    // Modal: Settings
    modalSettings: $('#modal-settings'),
    modalSettingsClose: $('#modal-settings-close'),
    settingAlertDays: $('#setting-alert-days'),
    settingAlertEnabled: $('#setting-alert-enabled'),
    categoryList: $('#category-list'),
    newCategoryInput: $('#new-category-input'),
    btnAddCategory: $('#btn-add-category'),
    btnSaveSettings: $('#btn-save-settings'),
    // Modal: Confirm
    modalConfirm: $('#modal-confirm'),
    confirmMessage: $('#confirm-message'),
    btnConfirmCancel: $('#btn-confirm-cancel'),
    btnConfirmOk: $('#btn-confirm-ok'),
  };

  // --- Init ---
  function init() {
    todos = loadFromStorage(STORAGE_TODOS, []);
    settings = { ...DEFAULT_SETTINGS, ...loadFromStorage(STORAGE_SETTINGS, {}) };

    bindEvents();
    renderAll();
  }

  // --- Event Binding ---
  function bindEvents() {
    // Toolbar
    dom.btnAddTodo.addEventListener('click', openAddTodoModal);
    dom.btnSettings.addEventListener('click', openSettingsModal);
    dom.searchInput.addEventListener('input', renderTodoList);
    dom.filterCategory.addEventListener('change', renderTodoList);
    dom.filterPriority.addEventListener('change', renderTodoList);
    dom.filterStatus.addEventListener('change', renderTodoList);
    dom.sortBy.addEventListener('change', renderTodoList);

    // Alert banner
    dom.alertBannerClose.addEventListener('click', () => {
      dom.alertBanner.style.display = 'none';
    });

    // Modal: TODO
    dom.modalTodoClose.addEventListener('click', closeTodoModal);
    dom.btnCancelTodo.addEventListener('click', closeTodoModal);
    dom.formTodo.addEventListener('submit', handleSaveTodo);
    dom.modalTodo.addEventListener('click', (e) => {
      if (e.target === dom.modalTodo) closeTodoModal();
    });

    // Modal: Settings
    dom.modalSettingsClose.addEventListener('click', closeSettingsModal);
    dom.btnAddCategory.addEventListener('click', handleAddCategory);
    dom.btnSaveSettings.addEventListener('click', handleSaveSettings);
    dom.newCategoryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCategory();
      }
    });
    dom.modalSettings.addEventListener('click', (e) => {
      if (e.target === dom.modalSettings) closeSettingsModal();
    });

    // Modal: Confirm
    dom.btnConfirmCancel.addEventListener('click', closeConfirmModal);
    dom.btnConfirmOk.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
    dom.modalConfirm.addEventListener('click', (e) => {
      if (e.target === dom.modalConfirm) closeConfirmModal();
    });

    // Keyboard: ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTodoModal();
        closeSettingsModal();
        closeConfirmModal();
      }
    });
  }

  // --- Render ---
  function renderAll() {
    renderStats();
    renderCategoryFilter();
    renderTodoList();
    checkAlerts();
  }

  function renderStats() {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const pending = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    dom.statsTotal.textContent = `${total} 件`;
    dom.statsCompleted.textContent = `完了 ${completed}`;
    dom.statsPending.textContent = `未完了 ${pending}`;
    dom.progressFill.style.width = `${pct}%`;
  }

  function renderCategoryFilter() {
    const current = dom.filterCategory.value;
    dom.filterCategory.innerHTML = '<option value="all">すべてのカテゴリ</option>';
    settings.categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      dom.filterCategory.appendChild(opt);
    });
    dom.filterCategory.value = current;
  }

  function renderCategorySelect() {
    dom.todoCategory.innerHTML = '';
    settings.categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      dom.todoCategory.appendChild(opt);
    });
  }

  function getFilteredTodos() {
    const search = dom.searchInput.value.toLowerCase().trim();
    const cat = dom.filterCategory.value;
    const priority = dom.filterPriority.value;
    const status = dom.filterStatus.value;
    const sortKey = dom.sortBy.value;

    let filtered = todos.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search) &&
          !(t.description && t.description.toLowerCase().includes(search))) {
        return false;
      }
      if (cat !== 'all' && t.category !== cat) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (status === 'pending' && t.completed) return false;
      if (status === 'completed' && !t.completed) return false;
      return true;
    });

    filtered.sort((a, b) => {
      // Completed items always go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      switch (sortKey) {
        case 'dueDate': {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        case 'priority':
          return priorityWeight(a.priority) - priorityWeight(b.priority);
        case 'createdAt':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'title':
          return a.title.localeCompare(b.title, 'ja');
        default:
          return 0;
      }
    });

    return filtered;
  }

  function renderTodoList() {
    const filtered = getFilteredTodos();

    if (todos.length === 0) {
      dom.todoList.style.display = 'none';
      dom.emptyState.style.display = 'block';
      return;
    }

    dom.emptyState.style.display = 'none';
    dom.todoList.style.display = 'flex';

    if (filtered.length === 0) {
      dom.todoList.innerHTML =
        '<div class="empty-state"><p class="empty-state__text">条件に一致するTODOはありません</p></div>';
      return;
    }

    dom.todoList.innerHTML = filtered.map((todo) => renderTodoItem(todo)).join('');

    // Bind item events
    dom.todoList.querySelectorAll('.todo-item__checkbox').forEach((cb) => {
      cb.addEventListener('change', () => toggleTodo(cb.dataset.id));
    });
    dom.todoList.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => openEditTodoModal(btn.dataset.id));
    });
    dom.todoList.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => confirmDeleteTodo(btn.dataset.id));
    });
  }

  function renderTodoItem(todo) {
    const days = daysUntil(todo.dueDate);
    let dueCls = 'tag--due';
    let dueLabel = '';
    let itemCls = '';

    if (todo.dueDate) {
      if (days !== null && days < 0) {
        dueCls = 'tag--overdue';
        dueLabel = `${Math.abs(days)}日超過`;
        if (!todo.completed) itemCls = 'todo-item--overdue';
      } else if (days !== null && days === 0) {
        dueCls = 'tag--due-soon';
        dueLabel = '今日';
        if (!todo.completed) itemCls = 'todo-item--alert';
      } else if (days !== null && days <= settings.alertDays) {
        dueCls = 'tag--due-soon';
        dueLabel = `あと${days}日`;
        if (!todo.completed) itemCls = 'todo-item--alert';
      } else {
        dueLabel = formatDate(todo.dueDate);
      }
    }

    const priorityLabels = { high: '高', medium: '中', low: '低' };

    return `
      <div class="todo-item ${todo.completed ? 'todo-item--completed' : ''} ${itemCls}">
        <input type="checkbox" class="todo-item__checkbox"
          data-id="${todo.id}" ${todo.completed ? 'checked' : ''}>
        <div class="todo-item__content">
          <div class="todo-item__title">${escapeHtml(todo.title)}</div>
          ${todo.description ? `<div class="todo-item__description">${escapeHtml(todo.description)}</div>` : ''}
          <div class="todo-item__meta">
            ${todo.category ? `<span class="todo-item__tag tag--category">${escapeHtml(todo.category)}</span>` : ''}
            <span class="todo-item__tag tag--priority-${todo.priority}">
              ${priorityLabels[todo.priority] || '中'}
            </span>
            ${todo.dueDate ? `<span class="todo-item__tag ${dueCls}">${dueLabel}</span>` : ''}
          </div>
        </div>
        <div class="todo-item__actions">
          <button class="btn btn--icon btn-edit" data-id="${todo.id}" title="編集">&#9998;</button>
          <button class="btn btn--icon btn-delete" data-id="${todo.id}" title="削除">&#10005;</button>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Alerts ---
  function checkAlerts() {
    if (!settings.alertEnabled) {
      dom.alertBanner.style.display = 'none';
      return;
    }

    const alertTodos = todos.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      const days = daysUntil(t.dueDate);
      return days !== null && days <= settings.alertDays;
    });

    if (alertTodos.length > 0) {
      const overdue = alertTodos.filter((t) => daysUntil(t.dueDate) < 0);
      const dueSoon = alertTodos.filter((t) => daysUntil(t.dueDate) >= 0);

      const parts = [];
      if (overdue.length > 0) parts.push(`${overdue.length}件が期日超過`);
      if (dueSoon.length > 0) parts.push(`${dueSoon.length}件が期日間近`);

      dom.alertBannerText.textContent = parts.join('、');
      dom.alertBanner.style.display = 'flex';
    } else {
      dom.alertBanner.style.display = 'none';
    }
  }

  // --- CRUD ---
  function addTodo(data) {
    const todo = {
      id: generateId(),
      title: data.title.trim(),
      description: (data.description || '').trim(),
      category: data.category || settings.categories[0] || '',
      priority: data.priority || 'medium',
      dueDate: data.dueDate || '',
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    todos.unshift(todo);
    saveTodos();
    renderAll();
  }

  function updateTodo(id, data) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.title = data.title.trim();
    todo.description = (data.description || '').trim();
    todo.category = data.category || '';
    todo.priority = data.priority || 'medium';
    todo.dueDate = data.dueDate || '';
    todo.updatedAt = Date.now();
    saveTodos();
    renderAll();
  }

  function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    saveTodos();
    renderAll();
  }

  function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    todo.updatedAt = Date.now();
    saveTodos();
    renderAll();
  }

  function saveTodos() {
    saveToStorage(STORAGE_TODOS, todos);
  }

  // --- Modal: TODO ---
  function openAddTodoModal() {
    dom.modalTodoTitle.textContent = '新規TODO';
    dom.todoId.value = '';
    dom.todoTitle.value = '';
    dom.todoDescription.value = '';
    dom.todoPriority.value = 'medium';
    dom.todoDueDate.value = '';
    renderCategorySelect();
    dom.todoCategory.value = settings.categories[0] || '';
    dom.modalTodo.style.display = 'flex';
    dom.todoTitle.focus();
  }

  function openEditTodoModal(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    dom.modalTodoTitle.textContent = 'TODOを編集';
    dom.todoId.value = todo.id;
    dom.todoTitle.value = todo.title;
    dom.todoDescription.value = todo.description;
    dom.todoPriority.value = todo.priority;
    dom.todoDueDate.value = todo.dueDate;
    renderCategorySelect();
    dom.todoCategory.value = todo.category;
    dom.modalTodo.style.display = 'flex';
    dom.todoTitle.focus();
  }

  function closeTodoModal() {
    dom.modalTodo.style.display = 'none';
  }

  function handleSaveTodo(e) {
    e.preventDefault();
    const data = {
      title: dom.todoTitle.value,
      description: dom.todoDescription.value,
      category: dom.todoCategory.value,
      priority: dom.todoPriority.value,
      dueDate: dom.todoDueDate.value,
    };

    const id = dom.todoId.value;
    if (id) {
      updateTodo(id, data);
    } else {
      addTodo(data);
    }
    closeTodoModal();
  }

  // --- Modal: Settings ---
  function openSettingsModal() {
    dom.settingAlertDays.value = settings.alertDays;
    dom.settingAlertEnabled.checked = settings.alertEnabled;
    renderCategoryList();
    dom.modalSettings.style.display = 'flex';
  }

  function closeSettingsModal() {
    dom.modalSettings.style.display = 'none';
  }

  function renderCategoryList() {
    dom.categoryList.innerHTML = settings.categories
      .map(
        (cat) => `
        <div class="category-item">
          <span class="category-item__name">${escapeHtml(cat)}</span>
          <button class="category-item__delete" data-category="${escapeHtml(cat)}" title="削除">&times;</button>
        </div>
      `
      )
      .join('');

    dom.categoryList.querySelectorAll('.category-item__delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        settings.categories = settings.categories.filter((c) => c !== cat);
        renderCategoryList();
      });
    });
  }

  function handleAddCategory() {
    const name = dom.newCategoryInput.value.trim();
    if (!name) return;
    if (settings.categories.includes(name)) {
      dom.newCategoryInput.value = '';
      return;
    }
    settings.categories.push(name);
    dom.newCategoryInput.value = '';
    renderCategoryList();
  }

  function handleSaveSettings() {
    settings.alertDays = parseInt(dom.settingAlertDays.value, 10) || 3;
    settings.alertEnabled = dom.settingAlertEnabled.checked;
    saveToStorage(STORAGE_SETTINGS, settings);
    closeSettingsModal();
    renderAll();
  }

  // --- Modal: Confirm ---
  function confirmDeleteTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    dom.confirmMessage.textContent = `「${todo.title}」を削除しますか？`;
    confirmCallback = () => deleteTodo(id);
    dom.modalConfirm.style.display = 'flex';
  }

  function closeConfirmModal() {
    dom.modalConfirm.style.display = 'none';
    confirmCallback = null;
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
