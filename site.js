(() => {
  const storeKey = 'smart-edge-catalogue-draft-v1';
  const whatsapp = 'https://wa.me/254705104557';
  const pageSize = 9;
  const categories = {
    laptops: { label: 'Laptop', icon: 'laptop' },
    desktops: { label: 'Desktop', icon: 'monitor' },
    accessories: { label: 'Accessory', icon: 'accessory' },
  };
  const formatter = new Intl.NumberFormat('en-KE');
  const byId = (id) => document.getElementById(id);
  const productGrid = byId('product-grid');
  const search = byId('product-search');
  const sort = byId('product-sort');
  const filterGroup = byId('category-filters');
  const moreButton = byId('show-more');
  const editLauncher = byId('open-editor');
  const editor = byId('editor');
  const form = byId('product-form');
  const formTitle = byId('form-title');
  const nameInput = byId('edit-name');
  const categoryInput = byId('edit-category');
  const specsInput = byId('edit-specs');
  const priceInput = byId('edit-price');
  const saveButton = byId('save-product');
  const cancelButton = byId('cancel-edit');
  const downloadButton = byId('download-catalogue');
  const discardButton = byId('discard-draft');
  const editorSearch = byId('editor-search');
  const editorList = byId('editor-list');
  const editorStatus = byId('editor-status');

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const use = document.createElementNS(namespace, 'use');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function normaliseCatalogue(items) {
    if (!Array.isArray(items)) throw new Error('Invalid catalogue');
    const ids = new Set();
    return items.map((item) => {
      if (!item) throw new Error('Invalid item');
      const { id, category, name, specs, price } = item;
      if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id) || ids.has(id)
        || !Object.hasOwn(categories, category) || typeof name !== 'string' || !name.trim() || name.length > 100
        || typeof specs !== 'string' || !specs.trim() || specs.length > 240
        || !Number.isSafeInteger(price) || price < 1 || price > 999999999) throw new Error('Invalid item');
      ids.add(id);
      return { id, category, name, specs, price };
    });
  }

  function fingerprint(serialised) {
    let hash = 2166136261;
    for (const character of serialised) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    return String(hash >>> 0);
  }

  function normaliseSearch(value) {
    return value.toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/(\d)\s*[×x]\s*(?=\d)/g, '$1 ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function matches(product, query) {
    if (!query) return true;
    const content = normaliseSearch(`${product.name} ${product.specs} ${product.category} ${categories[product.category].label}`);
    return query.split(' ').every((word) => content.includes(word));
  }

  const priceText = (price) => `KSh ${formatter.format(price)}`;
  let published;
  try {
    published = normaliseCatalogue(publishedCatalogue);
  } catch {
    byId('empty-message').textContent = 'The catalogue could not load. Please reload the page or enquire on WhatsApp.';
    byId('clear-filters').hidden = true;
    byId('empty-state').hidden = false;
    return;
  }

  const publishedJSON = JSON.stringify(published);
  const publishedVersion = fingerprint(publishedJSON);
  let draft = null;
  let draftWarning = '';
  let activeCategory = 'all';
  let limit = pageSize;
  let editing = null;

  try {
    const saved = localStorage.getItem(storeKey);
    if (saved !== null) {
      const { products, source } = JSON.parse(saved);
      const items = normaliseCatalogue(products);
      if (JSON.stringify(items) === publishedJSON) {
        localStorage.removeItem(storeKey);
      } else {
        draft = { products: items, source };
      }
    }
  } catch {
    draftWarning = 'Local edits could not be loaded. The published catalogue is shown.';
  }

  const getProducts = () => draft?.products ?? published;

  function createProductCard(product) {
    const category = categories[product.category];
    const card = element('article', 'product-card');
    const top = element('div', 'product-top');
    const marker = element('span', 'product-icon');
    marker.append(icon(category.icon));
    top.append(marker, element('span', 'product-category', category.label));

    const copy = element('div');
    const heading = element('h3', '', product.name);
    heading.tabIndex = -1;
    copy.append(heading, element('p', 'product-specs', product.specs));

    const footer = element('div', 'product-card-footer');
    const link = element('a', 'product-enquiry');
    const message = `Hello Smart Edge Viva Hub, is ${product.name} (${product.specs}) currently available?`;
    link.href = `${whatsapp}?text=${encodeURIComponent(message)}`;
    link.setAttribute('aria-label', `Enquire about ${product.name} (${product.specs}) on WhatsApp`);
    link.append(icon('whatsapp'), 'Enquire', icon('diagonal'));
    footer.append(element('span', 'price', priceText(product.price)), link);
    card.append(top, copy, footer);
    return card;
  }

  function renderCatalogue() {
    const products = getProducts();
    const query = normaliseSearch(search.value);
    const filtered = products.filter((product) => (activeCategory === 'all' || activeCategory === product.category) && matches(product, query));
    if (sort.value === 'price-low') filtered.sort((first, second) => first.price - second.price);
    if (sort.value === 'price-high') filtered.sort((first, second) => second.price - first.price);

    const displayed = Math.min(filtered.length, limit);
    const noun = filtered.length === 1 ? 'product' : 'products';
    const count = displayed < filtered.length ? `Showing ${displayed} of ${filtered.length} ${noun}` : `${displayed} ${noun}`;
    byId('product-count').textContent = draft ? `${count} · Local preview` : count;
    productGrid.replaceChildren(...filtered.slice(0, limit).map(createProductCard));
    byId('empty-state').hidden = filtered.length > 0;
    byId('empty-message').textContent = products.length ? 'No products match your search and filters.' : 'There are no products in this catalogue.';
    byId('clear-filters').hidden = products.length === 0 || (!search.value && activeCategory === 'all');
    moreButton.hidden = displayed === filtered.length;
  }

  function setCategory(category) {
    activeCategory = category;
    for (const button of filterGroup.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }

  function resetPagination() {
    limit = pageSize;
    renderCatalogue();
  }

  search.addEventListener('input', resetPagination);
  sort.addEventListener('change', resetPagination);
  filterGroup.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    setCategory(button.dataset.category);
    resetPagination();
  });
  byId('clear-filters').addEventListener('click', () => {
    search.value = '';
    sort.value = 'listed';
    setCategory('all');
    resetPagination();
    search.focus();
  });
  moreButton.addEventListener('click', () => {
    const firstNewIndex = limit;
    limit += pageSize;
    renderCatalogue();
    productGrid.children[firstNewIndex]?.querySelector('h3').focus();
  });

  function resetForm() {
    editing = null;
    form.reset();
    formTitle.textContent = 'Add a product';
    saveButton.textContent = 'Add product';
    cancelButton.hidden = true;
  }

  function showEditorStatus(message) {
    editorStatus.textContent = message;
  }

  function saveDraft(products, message) {
    const nextDraft = { products, source: draft?.source ?? publishedVersion };
    try {
      localStorage.setItem(storeKey, JSON.stringify(nextDraft));
    } catch {
      showEditorStatus('Could not save in this browser. Check that browser storage is available and try again.');
      editorStatus.scrollIntoView({ block: 'nearest' });
      return false;
    }
    draft = nextDraft;
    draftWarning = '';
    renderCatalogue();
    renderEditorList();
    showEditorStatus(message);
    return true;
  }

  function selectProduct(product) {
    editing = product.id;
    formTitle.textContent = `Edit ${product.name}`;
    saveButton.textContent = 'Save changes';
    cancelButton.hidden = false;
    nameInput.value = product.name;
    categoryInput.value = product.category;
    priceInput.value = product.price;
    specsInput.value = product.specs;
    formTitle.scrollIntoView({ block: 'center' });
    nameInput.focus({ preventScroll: true });
  }

  function removeProduct(product, index) {
    if (!window.confirm(`Remove ${product.name} (${product.specs}) from the local catalogue?`)) return;
    if (!saveDraft(getProducts().filter((item) => item.id !== product.id), 'Product removed from the local catalogue.')) return;
    if (editing === product.id) resetForm();
    const next = editorList.children[Math.min(index, editorList.children.length - 1)];
    (next?.querySelector('button') ?? editorSearch).focus();
  }

  function renderEditorList() {
    const products = getProducts();
    const query = normaliseSearch(editorSearch.value);
    const visible = products.filter((item) => matches(item, query));
    discardButton.hidden = !draft;
    byId('editor-count').textContent = visible.length === products.length ? String(products.length) : `${visible.length} of ${products.length}`;

    editorList.replaceChildren(...visible.map((item, index) => {
      const row = element('li', 'editor-item');
      const copy = element('div', 'editor-item-copy');
      copy.append(element('strong', '', item.name), element('small', '', `${priceText(item.price)} · ${item.specs}`));
      const actions = element('div', 'editor-item-actions');
      const edit = element('button', 'text-button', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', `Edit ${item.name}, ${priceText(item.price)}`);
      edit.addEventListener('click', () => selectProduct(item));
      const remove = element('button', 'text-button remove-button', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${item.name}, ${priceText(item.price)}`);
      remove.addEventListener('click', () => removeProduct(item, index));
      actions.append(edit, remove);
      row.append(copy, actions);
      return row;
    }));
    if (!visible.length) editorList.append(element('li', 'empty-state', products.length ? 'No items match this search.' : 'Add a product to start this catalogue.'));
  }

  function showDraftStatus() {
    const oldDraft = draft && draft.source !== publishedVersion;
    showEditorStatus(oldDraft ? 'This draft started from an older catalogue. Review it before publishing, or discard local edits to see the latest published prices.' : draftWarning);
  }

  editLauncher.addEventListener('click', () => {
    showDraftStatus();
    renderEditorList();
    editor.showModal();
    editor.scrollTop = 0;
  });
  editorSearch.addEventListener('input', renderEditorList);
  cancelButton.addEventListener('click', () => {
    resetForm();
    nameInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const specs = specsInput.value.trim();
    const price = Number(priceInput.value);
    const category = categoryInput.value;
    if (!name || !specs) {
      showEditorStatus('Enter a product name and specifications.');
      (name ? specsInput : nameInput).focus();
      return;
    }

    const item = { id: editing ?? crypto.randomUUID(), category, name, specs, price };
    const products = editing ? getProducts().map((product) => product.id === editing ? item : product) : [...getProducts(), item];
    if (saveDraft(products, editing ? 'Changes saved in this browser.' : 'Product added to the local catalogue.')) {
      resetForm();
      nameInput.focus();
    }
  });

  discardButton.addEventListener('click', () => {
    if (!window.confirm('Discard your local edits and restore the published catalogue in this browser?')) return;
    try {
      localStorage.removeItem(storeKey);
    } catch {
      showEditorStatus('Could not discard local edits. Check that browser storage is available and try again.');
      return;
    }
    draft = null;
    draftWarning = '';
    resetForm();
    renderCatalogue();
    renderEditorList();
    showEditorStatus('Published catalogue restored in this browser.');
    downloadButton.focus();
  });

  downloadButton.addEventListener('click', () => {
    const source = `const publishedCatalogue = ${JSON.stringify(getProducts(), null, 2)};\n`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = 'catalogue.js';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  byId('catalogue-controls').hidden = false;
  editLauncher.hidden = false;
  renderCatalogue();
})();
