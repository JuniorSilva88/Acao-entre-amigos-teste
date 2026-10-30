document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('admin-status');
  const editor = document.getElementById('gallery-editor');
  const gallerySelect = document.getElementById('gallery-select');
  const galleryTitle = document.getElementById('edit-gallery-title');
  const imageList = document.getElementById('image-list');
  const imageFiles = document.getElementById('image-files');
  const createForm = document.getElementById('gallery-create-form');
  const renameForm = document.getElementById('gallery-rename-form');
  const uploadForm = document.getElementById('image-upload-form');
  const exportButton = document.getElementById('export-galleries');
  const restoreButton = document.getElementById('restore-galleries');
  const deleteButton = document.getElementById('delete-gallery');
  const databaseName = 'acao-entre-amigos-gallery-admin';
  const storeName = 'gallery-data';
  const recordKey = 'galleries';
  let database;
  let baseline = [];
  let galleries = [];

  function showStatus(message, state = 'success') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isValidGalleryList(value) {
    return Array.isArray(value) && value.every(gallery =>
      gallery &&
      typeof gallery.id === 'string' &&
      typeof gallery.title === 'string' &&
      Array.isArray(gallery.images) &&
      gallery.images.every(image =>
        image && typeof image.src === 'string' && typeof image.alt === 'string'));
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local.'));
      request.onblocked = () => reject(new Error('Feche outras abas do painel e tente novamente.'));
    });
  }

  function readSavedGalleries() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(recordKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler as galerias salvas.'));
    });
  }

  function saveGalleries() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(cloneData(galleries), recordKey);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar as alterações.'));
      transaction.onabort = () => reject(transaction.error || new Error('O salvamento das alterações foi cancelado.'));
    });
  }

  async function loadPublishedGalleries() {
    const response = await fetch('../data/galleries.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Não foi possível carregar as galerias publicadas (${response.status}).`);
    const data = await response.json();
    if (!isValidGalleryList(data)) throw new Error('O arquivo data/galleries.json tem um formato inválido.');
    return data;
  }

  function selectedGallery() {
    return galleries.find(gallery => gallery.id === gallerySelect.value);
  }

  function renderImages(gallery) {
    imageList.replaceChildren();

    if (!gallery || gallery.images.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'admin-empty';
      emptyMessage.textContent = gallery
        ? 'Esta galeria ainda não tem fotos. Adicione imagens acima.'
        : 'Crie uma galeria para começar a adicionar fotos.';
      imageList.append(emptyMessage);
      return;
    }

    gallery.images.forEach((image, index) => {
      const card = document.createElement('article');
      card.className = 'admin-image-card';

      const preview = document.createElement('img');
      preview.src = image.src.startsWith('data:') ? image.src : `../${image.src}`;
      preview.alt = '';
      preview.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'admin-image-card-body';

      const label = document.createElement('label');
      label.textContent = 'Texto alternativo';
      const altInput = document.createElement('input');
      altInput.type = 'text';
      altInput.value = image.alt;
      altInput.maxLength = 180;
      altInput.dataset.imageAlt = String(index);
      label.append(altInput);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'button button-danger';
      removeButton.dataset.removeImage = String(index);
      removeButton.textContent = 'Remover foto';

      body.append(label, removeButton);
      card.append(preview, body);
      imageList.append(card);
    });
  }

  function renderEditor() {
    gallerySelect.replaceChildren();
    galleries.forEach(gallery => {
      const option = document.createElement('option');
      option.value = gallery.id;
      option.textContent = gallery.title;
      gallerySelect.append(option);
    });

    const gallery = selectedGallery();
    editor.hidden = !gallery;
    if (!gallery) {
      imageList.replaceChildren();
      return;
    }

    galleryTitle.value = gallery.title;
    renderImages(gallery);
  }

  function galleryId() {
    return globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Não foi possível preparar uma imagem para exportação.'));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => reject(reader.error || new Error('Não foi possível ler uma imagem.'));
      reader.readAsDataURL(blob);
    });
  }

  async function optimizeImage(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error(`O arquivo "${file.name}" não é uma imagem.`);
    }

    const bitmap = await createImageBitmap(file);
    try {
      const maxDimension = 1440;
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem no navegador.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const webp = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error(`Não foi possível converter "${file.name}" para WebP.`));
            return;
          }
          resolve(blob);
        }, 'image/webp', 0.82);
      });

      if (webp.type !== 'image/webp') {
        throw new Error('Este navegador não oferece suporte à conversão de imagens para WebP.');
      }

      const src = await readAsDataUrl(webp);
      return {
        src,
        fullSrc: src,
        alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
      };
    } finally {
      bitmap.close();
    }
  }

  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = document.getElementById('new-gallery-title').value.trim();
    if (!title) return;

    galleries.push({ id: galleryId(), title, images: [] });
    gallerySelect.value = galleries[galleries.length - 1].id;
    try {
      await saveGalleries();
      renderEditor();
      createForm.reset();
      showStatus(`A galeria "${title}" foi criada e está salva neste navegador.`);
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  gallerySelect.addEventListener('change', renderEditor);

  renameForm.addEventListener('submit', async event => {
    event.preventDefault();
    const gallery = selectedGallery();
    const title = galleryTitle.value.trim();
    if (!gallery || !title) return;

    gallery.title = title;
    try {
      await saveGalleries();
      renderEditor();
      showStatus('Nome da galeria atualizado.');
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  deleteButton.addEventListener('click', async () => {
    const gallery = selectedGallery();
    if (!gallery || !window.confirm(`Excluir a galeria "${gallery.title}" e todas as suas fotos?`)) return;

    galleries = galleries.filter(item => item.id !== gallery.id);
    try {
      await saveGalleries();
      renderEditor();
      showStatus('Galeria excluída.');
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const gallery = selectedGallery();
    const files = Array.from(imageFiles.files || []);
    if (!gallery || files.length === 0) return;

    showStatus(`Preparando ${files.length} ${files.length === 1 ? 'imagem' : 'imagens'}…`);
    try {
      const images = await Promise.all(files.map(optimizeImage));
      gallery.images.push(...images);
      await saveGalleries();
      renderEditor();
      uploadForm.reset();
      showStatus(`${images.length} ${images.length === 1 ? 'imagem adicionada' : 'imagens adicionadas'} à galeria.`);
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  imageList.addEventListener('change', async event => {
    const input = event.target.closest('[data-image-alt]');
    if (!input) return;

    const gallery = selectedGallery();
    const image = gallery?.images[Number(input.dataset.imageAlt)];
    if (!image) return;

    image.alt = input.value.trim();
    try {
      await saveGalleries();
      showStatus('Texto alternativo salvo.');
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  imageList.addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;

    const gallery = selectedGallery();
    const index = Number(button.dataset.removeImage);
    if (!gallery?.images[index] || !window.confirm('Remover esta foto da galeria?')) return;

    gallery.images.splice(index, 1);
    try {
      await saveGalleries();
      renderEditor();
      showStatus('Foto removida da galeria.');
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  exportButton.addEventListener('click', () => {
    const file = new Blob([`${JSON.stringify(galleries, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'galleries.json';
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus('Arquivo galleries.json baixado. Envie-o para a pasta data/ do site por FTP.');
  });

  restoreButton.addEventListener('click', async () => {
    if (!window.confirm('Descartar as alterações salvas neste navegador e carregar as galerias publicadas?')) return;
    galleries = cloneData(baseline);
    try {
      await saveGalleries();
      renderEditor();
      showStatus('Galerias locais restauradas a partir do arquivo publicado.');
    } catch (error) {
      console.error(error);
      showStatus(error.message, 'error');
    }
  });

  async function initialize() {
    if (!('indexedDB' in window)) {
      throw new Error('Este navegador não oferece armazenamento local para o painel.');
    }

    database = await openDatabase();
    baseline = await loadPublishedGalleries();
    const saved = await readSavedGalleries();
    if (saved === undefined) {
      galleries = cloneData(baseline);
      await saveGalleries();
    } else if (isValidGalleryList(saved)) {
      galleries = saved;
    } else {
      throw new Error('Os dados locais das galerias estão inválidos. Descarte as alterações locais para restaurar.');
    }
    renderEditor();
  }

  initialize().catch(error => {
    console.error(error);
    showStatus(error.message, 'error');
  });
});
