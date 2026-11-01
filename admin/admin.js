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
  const publishButton = document.getElementById('publish-galleries');
  const restoreButton = document.getElementById('restore-galleries');
  const deleteButton = document.getElementById('delete-gallery');
  const databaseName = 'acao-entre-amigos-gallery-admin';
  const storeName = 'gallery-data';
  const recordKey = 'galleries';
  const revisionKey = 'galleries-revision';
  let database;
  let baseline = [];
  let galleries = [];
  let publishedRevision = '';
  let draftRevision = null;
  let revisionConflict = false;
  let isPublishing = false;

  function showStatus(message, state = 'success') {
    if (revisionConflict && state !== 'error') {
      status.textContent = `${message} A publicação está bloqueada porque a versão do site mudou; baixe uma cópia de segurança e carregue a versão publicada antes de continuar.`;
      status.dataset.state = 'error';
      return;
    }
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
        image &&
        typeof image.src === 'string' &&
        typeof image.alt === 'string' &&
        (image.uploadId === undefined || typeof image.uploadId === 'string')));
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
      const store = transaction.objectStore(storeName);
      let savedGalleries;
      let savedRevision;
      const galleriesRequest = store.get(recordKey);
      const revisionRequest = store.get(revisionKey);
      galleriesRequest.onsuccess = () => {
        savedGalleries = galleriesRequest.result;
      };
      revisionRequest.onsuccess = () => {
        savedRevision = revisionRequest.result;
      };
      transaction.oncomplete = () => resolve({
        galleries: savedGalleries,
        revision: savedRevision
      });
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível ler as galerias salvas.'));
      transaction.onabort = () => reject(transaction.error || new Error('A leitura das galerias foi cancelada.'));
      galleriesRequest.onerror = () => reject(
        galleriesRequest.error || new Error('Não foi possível ler as galerias salvas.')
      );
      revisionRequest.onerror = () => reject(
        revisionRequest.error || new Error('Não foi possível ler a revisão das galerias.')
      );
    });
  }

  function saveGalleries() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.put(cloneData(galleries), recordKey);
      store.put(draftRevision, revisionKey);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar as alterações.'));
      transaction.onabort = () => reject(transaction.error || new Error('O salvamento das alterações foi cancelado.'));
    });
  }

  async function loadPublishedGalleries() {
    const response = await fetch('api.php', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readApiResponse(response);
    if (
      !isValidGalleryList(data.galleries) ||
      typeof data.revision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.revision)
    ) {
      throw new Error('A resposta da API de galerias tem um formato inválido.');
    }
    publishedRevision = data.revision;
    return data.galleries;
  }

  async function readApiResponse(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`O servidor respondeu em formato inválido (${response.status}).`);
    }
    if (!response.ok) {
      const error = new Error(data.error || `A solicitação falhou (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function updatePublishButton() {
    publishButton.disabled = revisionConflict || isPublishing;
    publishButton.setAttribute('aria-busy', String(isPublishing));
    publishButton.textContent = isPublishing ? 'Publicando…' : 'Publicar no site';
  }

  function setEditorBusy(busy) {
    [createForm, renameForm, uploadForm].forEach(form => {
      form.querySelectorAll('button, input, select').forEach(control => {
        control.disabled = busy;
      });
    });
    [gallerySelect, deleteButton, exportButton, restoreButton].forEach(control => {
      control.disabled = busy;
    });
    imageList.querySelectorAll('button, input, select').forEach(control => {
      control.disabled = busy;
    });
    isPublishing = busy;
    updatePublishButton();
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

  function webpBlobFromDataUrl(dataUrl) {
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) throw new Error('Uma imagem do rascunho não está no formato WebP esperado.');

    const binary = atob(match[1]);
    if (binary.length > 5 * 1024 * 1024) {
      throw new Error('Uma imagem excede o limite de envio de 5 MB.');
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: 'image/webp' });
  }

  async function stageImageForPublication(image, index, total) {
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('image', webpBlobFromDataUrl(image.src), 'gallery.webp');
    showStatus(`Enviando imagem ${index + 1} de ${total}…`);

    const response = await fetch('api.php', {
      method: 'POST',
      body: formData,
      cache: 'no-store'
    });
    const result = await readApiResponse(response);
    if (typeof result.uploadId !== 'string' || !/^[a-f0-9]{32}$/.test(result.uploadId)) {
      throw new Error('A API retornou um identificador inválido para a imagem.');
    }
    image.uploadId = result.uploadId;
    await saveGalleries();
  }

  async function publishDraft() {
    if (revisionConflict || !draftRevision) return;

    setEditorBusy(true);
    let uploadedCount = 0;
    const pendingImages = galleries.flatMap(gallery =>
      gallery.images.filter(image => image.src.startsWith('data:') && !image.uploadId));

    try {
      for (const gallery of galleries) {
        for (const image of gallery.images) {
          if (image.src.startsWith('data:') && !image.uploadId) {
            await stageImageForPublication(image, uploadedCount, pendingImages.length);
            uploadedCount++;
          }
        }
      }

      showStatus('Publicando galerias…');
      const publishGalleries = galleries.map(gallery => ({
        id: gallery.id,
        title: gallery.title,
        images: gallery.images.map(image => {
          if (image.uploadId) return { uploadId: image.uploadId, alt: image.alt };
          return {
            src: image.src,
            ...(image.fullSrc ? { fullSrc: image.fullSrc } : {}),
            alt: image.alt
          };
        })
      }));
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'publish',
          revision: draftRevision,
          galleries: publishGalleries
        })
      });
      const result = await readApiResponse(response);
      if (
        !isValidGalleryList(result.galleries) ||
        typeof result.revision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(result.revision)
      ) {
        throw new Error('A API concluiu a publicação, mas retornou dados inválidos.');
      }

      galleries = result.galleries;
      baseline = cloneData(galleries);
      publishedRevision = result.revision;
      draftRevision = result.revision;
      revisionConflict = false;
      renderEditor();
      try {
        await saveGalleries();
      } catch (error) {
        showStatus(`Galerias publicadas, mas não foi possível atualizar o rascunho local: ${error.message}`, 'error');
        return;
      }

      const warning = Array.isArray(result.warnings) && result.warnings.length
        ? ` ${result.warnings.join(' ')}`
        : '';
      showStatus(`Galerias e imagens publicadas no site.${warning}`);
    } catch (error) {
      if (error.status === 409) {
        revisionConflict = true;
        updatePublishButton();
      }
      if (error.status === 422 && error.message.includes('expirou')) {
        galleries.forEach(gallery => {
          gallery.images.forEach(image => {
            if (image.src.startsWith('data:')) delete image.uploadId;
          });
        });
        try {
          await saveGalleries();
          showStatus('Uma imagem temporária expirou. Clique em “Publicar no site” novamente para reenviá-la.', 'error');
          return;
        } catch (saveError) {
          showStatus(`A imagem temporária expirou e o rascunho não pôde ser atualizado: ${saveError.message}`, 'error');
          return;
        }
      }
      showStatus(error.message, 'error');
    } finally {
      setEditorBusy(false);
    }
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
    showStatus('Cópia de segurança galleries.json baixada.');
  });

  publishButton.addEventListener('click', publishDraft);

  restoreButton.addEventListener('click', async () => {
    if (!window.confirm('Descartar o rascunho local e carregar a versão atualmente publicada no site?')) return;
    try {
      baseline = await loadPublishedGalleries();
      galleries = cloneData(baseline);
      draftRevision = publishedRevision;
      revisionConflict = false;
      await saveGalleries();
      renderEditor();
      updatePublishButton();
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
    if (saved.galleries === undefined) {
      galleries = cloneData(baseline);
      draftRevision = publishedRevision;
      await saveGalleries();
    } else if (isValidGalleryList(saved.galleries)) {
      galleries = saved.galleries;
      if (typeof saved.revision === 'string' && /^[a-f0-9]{64}$/.test(saved.revision)) {
        draftRevision = saved.revision;
      } else if (JSON.stringify(galleries) === JSON.stringify(baseline)) {
        draftRevision = publishedRevision;
        await saveGalleries();
      } else {
        draftRevision = null;
        revisionConflict = true;
      }
      if (draftRevision && draftRevision !== publishedRevision) revisionConflict = true;
    } else {
      throw new Error('Os dados locais das galerias estão inválidos. Descarte as alterações locais para restaurar.');
    }
    renderEditor();
    updatePublishButton();
    if (revisionConflict) {
      showStatus(
        'O rascunho local não corresponde à versão publicada atual. Baixe uma cópia de segurança e carregue a versão publicada antes de continuar.',
        'error'
      );
    }
  }

  initialize().catch(error => {
    console.error(error);
    showStatus(error.message, 'error');
  });
});
