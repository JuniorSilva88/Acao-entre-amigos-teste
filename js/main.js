document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.getElementById('btn-menu');
  const navList = document.getElementById('nav-list');

  if (menuButton && navList) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(expanded));
      menuButton.setAttribute('aria-label', expanded ? 'Fechar menu' : 'Abrir menu');
      navList.classList.toggle('open', expanded);
    });

    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Abrir menu');
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        navList.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Abrir menu');
      }
    });
  }

  const pixValue = document.getElementById('pix-value');
  const copyButton = document.getElementById('btn-copy');
  const copyFeedback = document.getElementById('copy-feedback');
  const toast = document.getElementById('toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  async function copyPix() {
    const value = pixValue?.textContent.trim();
    if (!value) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Cópia não disponível');
      }

      if (copyFeedback) copyFeedback.textContent = 'Chave Pix copiada.';
      if (copyButton) {
        copyButton.textContent = 'Chave copiada ✓';
        window.setTimeout(() => {
          copyButton.textContent = 'Copiar Pix';
        }, 2200);
      }
      showToast('Chave Pix copiada. Confira o destinatário no banco.');
    } catch {
      if (copyFeedback) copyFeedback.textContent = 'Selecione e copie a chave exibida acima.';
      showToast('Não foi possível copiar automaticamente. Selecione a chave Pix.');
    }
  }

  if (copyButton) copyButton.addEventListener('click', copyPix);

  document.querySelectorAll('[data-contact="coleta"]').forEach(button => {
    button.addEventListener('click', () => {
      const message = document.getElementById('mensagem');
      if (message) {
        message.value = 'Olá! Gostaria de consultar a possibilidade de coleta de brinquedos. Por favor, informem as opções disponíveis.';
      }
      const contactForm = document.querySelector('.contact-form-details');
      if (contactForm) contactForm.open = true;
    });
  });

  const form = document.getElementById('form-contato');
  const iframe = document.getElementById('fs-iframe');
  const popup = document.getElementById('popup');
  const closePopup = document.getElementById('close-popup');
  let submitted = false;

  if (form && iframe && popup) {
    form.addEventListener('submit', () => {
      submitted = true;
    });

    iframe.addEventListener('load', () => {
      if (!submitted) return;
      submitted = false;
      form.reset();
      popup.setAttribute('aria-hidden', 'false');
      if (closePopup) closePopup.focus();
    });

    const close = () => {
      popup.setAttribute('aria-hidden', 'true');
    };

    if (closePopup) closePopup.addEventListener('click', close);
    popup.addEventListener('click', event => {
      if (event.target === popup) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
  }

  const galleryTabs = document.getElementById('gallery-tabs');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryViewer = document.getElementById('gallery-viewer');

  if (galleryTabs && galleryGrid && galleryViewer) {
    const viewerImage = document.getElementById('gallery-viewer-image');
    const viewerCaption = document.getElementById('gallery-viewer-caption');
    const viewerCount = document.getElementById('gallery-viewer-count');
    const viewerClose = document.getElementById('gallery-viewer-close');
    const viewerPrevious = document.getElementById('gallery-viewer-prev');
    const viewerNext = document.getElementById('gallery-viewer-next');
    let galleries = [];
    let activeGalleryIndex = 0;
    let activeImageIndex = 0;

    function renderGallery() {
      galleryTabs.replaceChildren();
      galleryGrid.replaceChildren();

      galleries.forEach((gallery, index) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'gallery-tab';
        tab.textContent = gallery.title;
        tab.setAttribute('aria-pressed', String(index === activeGalleryIndex));
        tab.addEventListener('click', () => {
          activeGalleryIndex = index;
          renderGallery();
        });
        galleryTabs.append(tab);
      });

      const activeGallery = galleries[activeGalleryIndex];
      if (!activeGallery || activeGallery.images.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'gallery-empty';
        emptyMessage.textContent = activeGallery
          ? 'Ainda não há fotos nesta galeria.'
          : 'Nenhuma galeria disponível no momento.';
        galleryGrid.append(emptyMessage);
        return;
      }

      activeGallery.images.forEach((image, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gallery-item';
        item.setAttribute('aria-label', `Abrir foto ${index + 1}: ${image.alt}`);

        const thumbnail = document.createElement('img');
        thumbnail.src = image.src;
        thumbnail.alt = image.alt;
        thumbnail.loading = 'lazy';

        const openLabel = document.createElement('span');
        openLabel.textContent = 'Ampliar foto';
        item.append(thumbnail, openLabel);
        item.addEventListener('click', () => openGalleryImage(index));
        galleryGrid.append(item);
      });
    }

    function showGalleryImage() {
      const images = galleries[activeGalleryIndex]?.images;
      const image = images?.[activeImageIndex];
      if (!image || !viewerImage || !viewerCaption || !viewerCount) return;

      viewerImage.src = image.fullSrc || image.src;
      viewerImage.alt = image.alt;
      viewerCaption.textContent = image.alt;
      viewerCount.textContent = `${activeImageIndex + 1} / ${images.length}`;
      const disableNavigation = images.length < 2;
      if (viewerPrevious) viewerPrevious.disabled = disableNavigation;
      if (viewerNext) viewerNext.disabled = disableNavigation;
    }

    function openGalleryImage(index) {
      activeImageIndex = index;
      showGalleryImage();
      galleryViewer.showModal();
      if (viewerClose) viewerClose.focus();
    }

    function moveGalleryImage(direction) {
      const images = galleries[activeGalleryIndex]?.images;
      if (!images?.length) return;
      activeImageIndex = (activeImageIndex + direction + images.length) % images.length;
      showGalleryImage();
    }

    viewerClose?.addEventListener('click', () => galleryViewer.close());
    viewerPrevious?.addEventListener('click', () => moveGalleryImage(-1));
    viewerNext?.addEventListener('click', () => moveGalleryImage(1));
    galleryViewer.addEventListener('click', event => {
      if (event.target === galleryViewer) galleryViewer.close();
    });
    galleryViewer.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') moveGalleryImage(-1);
      if (event.key === 'ArrowRight') moveGalleryImage(1);
    });

    fetch('data/galleries.json')
      .then(response => {
        if (!response.ok) throw new Error(`Não foi possível carregar as galerias (${response.status}).`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.some(gallery =>
          typeof gallery.title !== 'string' || !Array.isArray(gallery.images))) {
          throw new Error('O arquivo de galerias tem um formato inválido.');
        }
        galleries = data;
        renderGallery();
      })
      .catch(error => {
        console.error(error);
        galleryGrid.textContent = 'Não foi possível carregar as fotos. Tente novamente mais tarde.';
      });
  }
});
