const API_BASE_URL = 'http://linkvaultapi.runasp.net/api';
const tokenKey = 'linkvault_token';
const themeKey = 'linkvault_theme';

const state = {
  loading: false,
  categories: [],
  bookmarks: [],
  notes: [],
  currentBookmark: null,
  currentBookmarkNotes: [],
  categoriesLoaded: false,
  bookmarksLoaded: false,
  notesLoaded: false,
  notesFilterCategory: '',
  filters: {
    categoryId: '',
    search: '',
    favoritesOnly: false,
    archivedOnly: false,
  },
};

const parseJwt = (token) => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getToken = () => localStorage.getItem(tokenKey);

const setToken = (token) => {
  if (token) localStorage.setItem(tokenKey, token);
  else localStorage.removeItem(tokenKey);
};

const showAlert = (message, type = 'danger', timeout = 4000) => {
  const container = document.getElementById('alertContainer');
  if (!container) return;
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  container.appendChild(alertDiv);
  window.setTimeout(() => {
    alertDiv.classList.remove('show');
    alertDiv.classList.add('hide');
    setTimeout(() => alertDiv.remove(), 300);
  }, timeout);
};

const showBusy = (show) => {
  const body = document.body;
  if (!body) return;
  body.classList.toggle('loading', show);
};

const renderLoadingState = (tableBodyId, colspan) => {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-5 text-muted loading-shell">Loading…</td></tr>`;
};

const logout = () => {
  setToken(null);
  window.location.href = 'login.html';
};

const ensureAuthenticated = () => {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
};

const applyTheme = () => {
  const saved = localStorage.getItem(themeKey) || 'light';
  document.body.classList.toggle('dark', saved === 'dark');
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.textContent = saved === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  const isDark = document.body.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  localStorage.setItem(themeKey, next);
  applyTheme();
};

const apiRequest = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      window.location.href = 'login.html';
      throw new Error('Session expired. Please log in again.');
    }
    const message = (data && (data.message || data.error || data.title)) || 'Request failed';
    throw new Error(message);
  }
  return data;
};

const setActiveNav = () => {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.classList.toggle('active', link.dataset.navLink === page);
  });
};

const renderUserEmail = () => {
  const el = document.getElementById('navbarUserEmail');
  if (!el) return;
  const jwt = parseJwt(getToken());
  const email = jwt?.email || jwt?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || jwt?.['email'] || 'user@example.com';
  el.textContent = email;
};

const initSharedUI = () => {
  setActiveNav();
  applyTheme();
  renderUserEmail();
  document.querySelectorAll('.logout-btn').forEach((btn) => {
    btn.addEventListener('click', logout);
  });
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
};

const loadCategories = async () => {
  renderLoadingState('categoriesTableBody', 5);
  try {
    const data = await apiRequest('/categories');
    state.categories = Array.isArray(data) ? data : data?.items || [];
    state.categoriesLoaded = true;
  } catch (error) {
    showAlert(error.message);
  }
};

const loadBookmarks = async () => {
  renderLoadingState('bookmarksTableBody', 6);
  try {
    const params = new URLSearchParams();
    if (state.filters.categoryId) params.set('CategoryId', state.filters.categoryId);
    if (state.filters.search) params.set('Search', state.filters.search);
    if (state.filters.favoritesOnly) params.set('IsFavorite', 'true');
    if (state.filters.archivedOnly) params.set('IsArchived', 'true');
    const query = params.toString();
    const data = await apiRequest(`/bookmarks${query ? `?${query}` : ''}`);
    state.bookmarks = Array.isArray(data) ? data : data?.items || [];
    state.bookmarksLoaded = true;
    renderBookmarks();
  } catch (error) {
    showAlert(error.message);
  }
};

const loadNotes = async () => {
  renderLoadingState('notesTableBody', 5);
  try {
    const params = new URLSearchParams();
    if (state.notesFilterCategory) params.set('Category', state.notesFilterCategory);
    const query = params.toString();
    const data = await apiRequest(`/notes${query ? `?${query}` : ''}`);
    state.notes = Array.isArray(data) ? data : data?.items || [];
    state.notesLoaded = true;
    renderNotes();
  } catch (error) {
    showAlert(error.message);
  }
};

const renderCategories = () => {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;
  if (!state.categories.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No categories yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.categories.map((cat) => `
    <tr>
      <td><strong>${cat.categoryName || cat.name || ''}</strong></td>
      <td>${cat.description || ''}</td>
      <td>${cat.bookmarkCount ?? 0}</td>
      <td>${cat.noteCount ?? 0}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-2" data-edit-category="${cat.id}" type="button">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-delete-category="${cat.id}" type="button">Delete</button>
      </td>
    </tr>
  `).join('');
};

const renderBookmarks = () => {
  const tbody = document.getElementById('bookmarksTableBody');
  if (!tbody) return;
  if (!state.bookmarks.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No bookmarks yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.bookmarks.map((bm) => `
    <tr>
      <td><a href="bookmark.html?id=${bm.id}" class="text-decoration-none">${bm.title}</a></td>
      <td><a href="${bm.url}" target="_blank" rel="noopener noreferrer">${bm.url}</a></td>
      <td>${bm.category?.categoryName || bm.categoryName || ''}</td>
      <td><button class="btn btn-link p-0 ${bm.isFavorite ? 'text-warning' : 'text-muted'}" data-toggle-favorite="${bm.id}" type="button">${bm.isFavorite ? '★' : '☆'}</button></td>
      <td><button class="btn btn-link p-0 ${bm.isArchived ? 'text-info' : 'text-muted'}" data-toggle-archive="${bm.id}" type="button">${bm.isArchived ? 'Archived' : 'Active'}</button></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-2" data-edit-bookmark="${bm.id}" type="button">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-delete-bookmark="${bm.id}" type="button">Delete</button>
      </td>
    </tr>
  `).join('');
};

const renderNotes = () => {
  const tbody = document.getElementById('notesTableBody');
  if (!tbody) return;
  if (!state.notes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No notes yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.notes.map((note) => `
    <tr>
      <td><strong>${note.title}</strong></td>
      <td>${(note.content || '').slice(0, 80)}${(note.content || '').length > 80 ? '…' : ''}</td>
      <td>${note.category?.categoryName || note.categoryName || ''}</td>
      <td><button class="btn btn-link p-0 ${note.isPinned ? 'text-primary' : 'text-muted'}" data-toggle-pin="${note.id}" type="button">📌</button></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-2" data-edit-note="${note.id}" type="button">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-delete-note="${note.id}" type="button">Delete</button>
      </td>
    </tr>
  `).join('');
};

const populateCategorySelects = () => {
  const selects = document.querySelectorAll('[name="categoryId"], #bookmarkCategorySelect, #noteCategorySelect');
  selects.forEach((select) => {
    select.innerHTML = '<option value="">Select a category</option>' + state.categories.map((cat) => `<option value="${cat.id}">${cat.categoryName || cat.name || ''}</option>`).join('');
  });
};

const populateBookmarkFilters = () => {
  const filterSelect = document.getElementById('bookmarkCategoryFilter');
  if (!filterSelect) return;
  filterSelect.innerHTML = '<option value="">All categories</option>' + state.categories.map((cat) => `<option value="${cat.id}">${cat.categoryName || cat.name || ''}</option>`).join('');
};

const populateNoteFilters = () => {
  const filterSelect = document.getElementById('notesCategoryFilter');
  if (!filterSelect) return;
  filterSelect.innerHTML = '<option value="">All categories</option>' + state.categories.map((cat) => `<option value="${cat.id}">${cat.categoryName || cat.name || ''}</option>`).join('');
};

const renderBookmarkDetails = async () => {
  const container = document.getElementById('bookmarkDetailsContainer');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!container || !id) return;
  try {
    const data = await apiRequest(`/bookmarks/${id}`);
    state.currentBookmark = data;
    const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString() : '—';
    container.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="h4 mb-3">${data.title}</h2>
          <p><strong>URL:</strong> <a href="${data.url}" target="_blank" rel="noopener noreferrer">${data.url}</a></p>
          <p><strong>Category:</strong> ${data.category?.categoryName || data.categoryName || '—'}</p>
          <p><strong>Favorite:</strong> ${data.isFavorite ? 'Yes' : 'No'}</p>
          <p><strong>Archived:</strong> ${data.isArchived ? 'Yes' : 'No'}</p>
          <p><strong>Created:</strong> ${createdAt}</p>
        </div>
      </div>
    `;
    await loadBookmarkNotes(id);
  } catch (error) {
    showAlert(error.message);
  }
};

const loadBookmarkNotes = async (bookmarkId) => {
  try {
    const data = await apiRequest(`/bookmarks/${bookmarkId}/notes`);
    state.currentBookmarkNotes = Array.isArray(data) ? data : data?.items || [];
    const tbody = document.getElementById('bookmarkNotesTableBody');
    if (!tbody) return;
    if (!state.currentBookmarkNotes.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">No notes for this bookmark yet.</td></tr>';
      return;
    }
    tbody.innerHTML = state.currentBookmarkNotes.map((note) => `
      <tr>
        <td>${note.content}</td>
        <td>${note.createdAt ? new Date(note.createdAt).toLocaleString() : '—'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-delete-bookmark-note="${note.id}" type="button">Delete</button>
        </tr>
    `).join('');
  } catch (error) {
    showAlert(error.message);
  }
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const alert = form.querySelector('.form-alert');
  const payload = Object.fromEntries(new FormData(form).entries());
  const endpoint = form.id === 'loginForm' ? '/auth/login' : '/auth/register';
  const body = form.id === 'loginForm' ? { email: payload.email, password: payload.password } : { firstName: payload.fullName.split(' ')[0] || payload.fullName, lastName: payload.fullName.split(' ').slice(1).join(' ') || payload.fullName, email: payload.email, password: payload.password };
  try {
    const data = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (response) => {
      const text = await response.text();
      let payloadData = null;
      try { payloadData = text ? JSON.parse(text) : null; } catch { payloadData = text; }
      if (!response.ok) {
        throw new Error((payloadData && (payloadData.message || payloadData.error || payloadData.title)) || 'Authentication failed');
      }
      return payloadData;
    });
    const token = data?.token || data?.accessToken;
    if (!token) throw new Error('No token returned by server');
    setToken(token);
    window.location.href = 'bookmarks.html';
  } catch (error) {
    if (alert) {
      alert.textContent = error.message;
      alert.classList.remove('d-none');
    } else {
      showAlert(error.message);
    }
  }
};

const handleCategorySubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = document.getElementById('categoryId').value;
  const payload = {
    categoryName: document.getElementById('categoryName').value.trim(),
    description: document.getElementById('categoryDescription').value.trim() || null,
  };
  try {
    await apiRequest(id ? `/categories/${id}` : '/categories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showAlert(id ? 'Category updated' : 'Category created', 'success');
    bootstrap.Modal.getInstance(document.getElementById('categoryModal'))?.hide();
    form.reset();
    await loadCategories();
    renderCategories();
    populateCategorySelects();
    populateBookmarkFilters();
    populateNoteFilters();
  } catch (error) {
    showAlert(error.message);
  }
};

const handleBookmarkSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = document.getElementById('bookmarkId').value;
  const payload = {
    title: document.getElementById('bookmarkTitle').value.trim(),
    url: document.getElementById('bookmarkUrl').value.trim(),
    categoryId: Number(document.getElementById('bookmarkCategorySelect').value),
    isFavorite: document.getElementById('bookmarkFavorite').checked,
    isArchived: document.getElementById('bookmarkArchived').checked,
  };
  try {
    await apiRequest(id ? `/bookmarks/${id}` : '/bookmarks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showAlert(id ? 'Bookmark updated' : 'Bookmark created', 'success');
    bootstrap.Modal.getInstance(document.getElementById('bookmarkModal'))?.hide();
    form.reset();
    await loadBookmarks();
    populateCategorySelects();
  } catch (error) {
    showAlert(error.message);
  }
};

const handleNoteSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = document.getElementById('noteId').value;
  const payload = {
    title: document.getElementById('noteTitle').value.trim(),
    content: document.getElementById('noteContent').value.trim(),
    categoryId: Number(document.getElementById('noteCategorySelect').value),
  };
  try {
    await apiRequest(id ? `/notes/${id}` : '/notes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showAlert(id ? 'Note updated' : 'Note created', 'success');
    bootstrap.Modal.getInstance(document.getElementById('noteModal'))?.hide();
    form.reset();
    await loadNotes();
    populateCategorySelects();
  } catch (error) {
    showAlert(error.message);
  }
};

const handleBookmarkNoteSubmit = async (event) => {
  event.preventDefault();
  const params = new URLSearchParams(window.location.search);
  const bookmarkId = params.get('id');
  const payload = { content: document.getElementById('bookmarkNoteContent').value.trim() };
  try {
    await apiRequest(`/bookmarks/${bookmarkId}/notes`, { method: 'POST', body: JSON.stringify(payload) });
    showAlert('Note added', 'success');
    bootstrap.Modal.getInstance(document.getElementById('bookmarkNoteModal'))?.hide();
    document.getElementById('bookmarkNoteForm').reset();
    await loadBookmarkNotes(bookmarkId);
  } catch (error) {
    showAlert(error.message);
  }
};

const bindEvents = () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.addEventListener('submit', handleAuthSubmit);
  if (registerForm) registerForm.addEventListener('submit', handleAuthSubmit);

  const authModeButtons = document.querySelectorAll('[data-auth-mode]');
  authModeButtons.forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-form').forEach((form) => form.classList.add('d-none'));
    document.querySelectorAll('[data-auth-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.authMode;
    if (mode === 'register') document.getElementById('registerForm').classList.remove('d-none');
    else document.getElementById('loginForm').classList.remove('d-none');
  }));

  const createCategoryBtn = document.getElementById('createCategoryBtn');
  if (createCategoryBtn) createCategoryBtn.addEventListener('click', () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
  });
  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) categoryForm.addEventListener('submit', handleCategorySubmit);

  document.addEventListener('click', async (event) => {
    const editCategoryButton = event.target.closest('[data-edit-category]');
    if (editCategoryButton) {
      const id = editCategoryButton.dataset.editCategory;
      const cat = state.categories.find((item) => String(item.id) === String(id));
      if (cat) {
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryName').value = cat.categoryName || cat.name || '';
        document.getElementById('categoryDescription').value = cat.description || '';
        new bootstrap.Modal(document.getElementById('categoryModal')).show();
      }
      return;
    }
    const deleteCategoryButton = event.target.closest('[data-delete-category]');
    if (deleteCategoryButton) {
      const id = deleteCategoryButton.dataset.deleteCategory;
      if (confirm('Delete this category?')) {
        try {
          await apiRequest(`/categories/${id}`, { method: 'DELETE' });
          showAlert('Category deleted', 'success');
          await loadCategories();
          renderCategories();
          populateCategorySelects();
          populateBookmarkFilters();
          populateNoteFilters();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }

    const editBookmarkButton = event.target.closest('[data-edit-bookmark]');
    if (editBookmarkButton) {
      const id = editBookmarkButton.dataset.editBookmark;
      const bm = state.bookmarks.find((item) => String(item.id) === String(id));
      if (bm) {
        document.getElementById('bookmarkId').value = bm.id;
        document.getElementById('bookmarkTitle').value = bm.title || '';
        document.getElementById('bookmarkUrl').value = bm.url || '';
        document.getElementById('bookmarkCategorySelect').value = bm.categoryId || bm.category?.id || '';
        document.getElementById('bookmarkFavorite').checked = !!bm.isFavorite;
        document.getElementById('bookmarkArchived').checked = !!bm.isArchived;
        new bootstrap.Modal(document.getElementById('bookmarkModal')).show();
      }
      return;
    }
    const deleteBookmarkButton = event.target.closest('[data-delete-bookmark]');
    if (deleteBookmarkButton) {
      const id = deleteBookmarkButton.dataset.deleteBookmark;
      if (confirm('Delete this bookmark?')) {
        try {
          await apiRequest(`/bookmarks/${id}`, { method: 'DELETE' });
          showAlert('Bookmark deleted', 'success');
          await loadBookmarks();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }

    const toggleFavoriteButton = event.target.closest('[data-toggle-favorite]');
    if (toggleFavoriteButton) {
      const id = toggleFavoriteButton.dataset.toggleFavorite;
      const bm = state.bookmarks.find((item) => String(item.id) === String(id));
      if (bm) {
        try {
          await apiRequest(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ title: bm.title, url: bm.url, categoryId: bm.categoryId || bm.category?.id, isFavorite: !bm.isFavorite, isArchived: bm.isArchived }) });
          await loadBookmarks();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }

    const toggleArchiveButton = event.target.closest('[data-toggle-archive]');
    if (toggleArchiveButton) {
      const id = toggleArchiveButton.dataset.toggleArchive;
      const bm = state.bookmarks.find((item) => String(item.id) === String(id));
      if (bm) {
        try {
          await apiRequest(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ title: bm.title, url: bm.url, categoryId: bm.categoryId || bm.category?.id, isFavorite: bm.isFavorite, isArchived: !bm.isArchived }) });
          await loadBookmarks();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }

    const editNoteButton = event.target.closest('[data-edit-note]');
    if (editNoteButton) {
      const id = editNoteButton.dataset.editNote;
      const note = state.notes.find((item) => String(item.id) === String(id));
      if (note) {
        document.getElementById('noteId').value = note.id;
        document.getElementById('noteTitle').value = note.title || '';
        document.getElementById('noteContent').value = note.content || '';
        document.getElementById('noteCategorySelect').value = note.categoryId || note.category?.id || '';
        new bootstrap.Modal(document.getElementById('noteModal')).show();
      }
      return;
    }
    const deleteNoteButton = event.target.closest('[data-delete-note]');
    if (deleteNoteButton) {
      const id = deleteNoteButton.dataset.deleteNote;
      if (confirm('Delete this note?')) {
        try {
          await apiRequest(`/notes/${id}`, { method: 'DELETE' });
          showAlert('Note deleted', 'success');
          await loadNotes();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }
    const pinNoteButton = event.target.closest('[data-toggle-pin]');
    if (pinNoteButton) {
      const id = pinNoteButton.dataset.togglePin;
      const note = state.notes.find((item) => String(item.id) === String(id));
      if (note) {
        try {
          await apiRequest(`/notes/${id}/pin`, { method: 'PATCH' });
          await loadNotes();
        } catch (error) {
          showAlert(error.message);
        }
      }
      return;
    }

    const deleteBookmarkNoteButton = event.target.closest('[data-delete-bookmark-note]');
    if (deleteBookmarkNoteButton) {
      const id = deleteBookmarkNoteButton.dataset.deleteBookmarkNote;
      if (confirm('Delete this note?')) {
        const params = new URLSearchParams(window.location.search);
        const bookmarkId = params.get('id');
        try {
          await apiRequest(`/bookmarks/${bookmarkId}/notes/${id}`, { method: 'DELETE' });
          showAlert('Note deleted', 'success');
          await loadBookmarkNotes(bookmarkId);
        } catch (error) {
          showAlert(error.message);
        }
      }
    }
  });

  const createBookmarkBtn = document.getElementById('createBookmarkBtn');
  if (createBookmarkBtn) createBookmarkBtn.addEventListener('click', () => {
    document.getElementById('bookmarkForm').reset();
    document.getElementById('bookmarkId').value = '';
    new bootstrap.Modal(document.getElementById('bookmarkModal')).show();
  });
  const bookmarkForm = document.getElementById('bookmarkForm');
  if (bookmarkForm) bookmarkForm.addEventListener('submit', handleBookmarkSubmit);

  const createNoteBtn = document.getElementById('createNoteBtn');
  if (createNoteBtn) createNoteBtn.addEventListener('click', () => {
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    new bootstrap.Modal(document.getElementById('noteModal')).show();
  });
  const noteForm = document.getElementById('noteForm');
  if (noteForm) noteForm.addEventListener('submit', handleNoteSubmit);

  const createNoteForBookmarkBtn = document.getElementById('createNoteForBookmarkBtn');
  if (createNoteForBookmarkBtn) createNoteForBookmarkBtn.addEventListener('click', () => {
    document.getElementById('bookmarkNoteForm').reset();
    new bootstrap.Modal(document.getElementById('bookmarkNoteModal')).show();
  });
  const bookmarkNoteForm = document.getElementById('bookmarkNoteForm');
  if (bookmarkNoteForm) bookmarkNoteForm.addEventListener('submit', handleBookmarkNoteSubmit);

  const filterForm = document.getElementById('bookmarkFilterForm');
  if (filterForm) filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    state.filters.categoryId = formData.get('categoryId') || '';
    state.filters.search = formData.get('search') || '';
    state.filters.favoritesOnly = Boolean(formData.get('favoritesOnly'));
    state.filters.archivedOnly = Boolean(formData.get('archivedOnly'));
    loadBookmarks();
  });
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => {
    filterForm.reset();
    state.filters = { categoryId: '', search: '', favoritesOnly: false, archivedOnly: false };
    loadBookmarks();
  });

  const notesCategoryFilter = document.getElementById('notesCategoryFilter');
  if (notesCategoryFilter) notesCategoryFilter.addEventListener('change', (event) => {
    state.notesFilterCategory = event.target.value;
    loadNotes();
  });
  const clearNotesFilterBtn = document.getElementById('clearNotesFilterBtn');
  if (clearNotesFilterBtn) clearNotesFilterBtn.addEventListener('click', () => {
    state.notesFilterCategory = '';
    if (notesCategoryFilter) notesCategoryFilter.value = '';
    loadNotes();
  });
};

const initializePage = async () => {
  initSharedUI();
  const page = document.body.dataset.page;
  if (page === 'login') {
    if (getToken()) {
      window.location.href = 'bookmarks.html';
      return;
    }
    bindEvents();
    return;
  }
  if (!ensureAuthenticated()) return;
  bindEvents();
  try {
    await Promise.all([loadCategories(), loadBookmarks(), loadNotes()]);
    populateCategorySelects();
    populateBookmarkFilters();
    populateNoteFilters();
    renderCategories();
    renderBookmarks();
    renderNotes();
    if (page === 'bookmark') {
      await renderBookmarkDetails();
    }
  } catch (error) {
    showAlert(error.message);
  }
};

document.addEventListener('DOMContentLoaded', initializePage);
