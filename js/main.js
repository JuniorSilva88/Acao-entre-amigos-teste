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
  const donationDialog = document.getElementById('donation-dialog');
  const pixOptions = document.getElementById('pix-donation-options');
  const pixResult = document.getElementById('pix-donation-result');
  const pixMethodButton = document.getElementById('choose-pix-method');
  const pixAmountInputs = donationDialog?.querySelectorAll('input[name="donation-amount"]') || [];
  const customAmountInput = document.getElementById('custom-donation-amount');
  const generatePixButton = document.getElementById('generate-pix-qr');
  const donationFeedback = document.getElementById('donation-feedback');
  const pixImage = document.getElementById('pix-qr-code');
  const pixPaymentCode = document.getElementById('pix-payment-code');
  let qrLibraryPromise;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    try {
      field.select();
      if (!document.execCommand('copy')) throw new Error('Cópia não disponível');
    } finally {
      field.remove();
    }
  }

  async function copyPix() {
    const value = pixValue?.textContent.trim();
    if (!value) return;

    try {
      await copyText(value);

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

  function selectedDonationAmount() {
    const selected = Array.from(pixAmountInputs).find(input => input.checked);
    if (!selected) return null;
    return selected.value === 'other' ? customAmountInput.valueAsNumber : Number(selected.value);
  }

  function updateDonationAmount() {
    const selected = Array.from(pixAmountInputs).find(input => input.checked);
    const isCustom = selected?.value === 'other';
    if (customAmountInput) customAmountInput.hidden = !isCustom;
    pixAmountInputs.forEach(input => {
      input.closest('.pix-amount-option')?.classList.toggle('is-selected', input.checked);
    });

    const amount = selectedDonationAmount();
    const isValid = Number.isFinite(amount) && amount >= 0.01 && amount <= 999999.99 &&
      Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
    if (generatePixButton) generatePixButton.hidden = !isValid;
    if (pixResult) pixResult.hidden = true;
    if (donationFeedback) donationFeedback.textContent = '';
  }

  function openDonationDialog() {
    if (!donationDialog) return;
    pixOptions.hidden = true;
    pixResult.hidden = true;
    pixMethodButton.setAttribute('aria-expanded', 'false');
    pixAmountInputs.forEach(input => { input.checked = false; });
    if (customAmountInput) customAmountInput.value = '';
    if (donationFeedback) donationFeedback.textContent = '';
    if (generatePixButton) {
      generatePixButton.hidden = true;
      generatePixButton.disabled = false;
      generatePixButton.textContent = 'Gerar QR Code Pix';
    }
    updateDonationAmount();
    donationDialog.showModal();
  }

  function loadQrLibrary() {
    if (typeof window.qrcode === 'function') return Promise.resolve();
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/vendor/qrcode-generator.js';
      script.async = true;
      script.onload = () => {
        if (typeof window.qrcode === 'function') {
          resolve();
        } else {
          qrLibraryPromise = null;
          reject(new Error('Não foi possível iniciar o gerador de QR Code.'));
        }
      };
      script.onerror = () => {
        qrLibraryPromise = null;
        reject(new Error('Não foi possível carregar o gerador de QR Code. Tente novamente.'));
      };
      document.head.append(script);
    });
    return qrLibraryPromise;
  }

  document.querySelectorAll('[data-open-donation]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      openDonationDialog();
    });
  });

  pixMethodButton?.addEventListener('click', () => {
    pixOptions.hidden = false;
    pixMethodButton.setAttribute('aria-expanded', 'true');
  });

  pixAmountInputs.forEach(input => input.addEventListener('change', () => {
    updateDonationAmount();
    if (input.value === 'other') customAmountInput?.focus();
  }));
  customAmountInput?.addEventListener('input', updateDonationAmount);

  document.getElementById('donation-dialog-close')?.addEventListener('click', () => donationDialog.close());
  document.getElementById('toy-donation-link')?.addEventListener('click', () => donationDialog.close());
  donationDialog?.addEventListener('click', event => {
    if (event.target === donationDialog) donationDialog.close();
  });

  generatePixButton?.addEventListener('click', async () => {
    const amount = selectedDonationAmount();
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 999999.99) return;

    generatePixButton.disabled = true;
    generatePixButton.setAttribute('aria-busy', 'true');
    generatePixButton.textContent = 'Gerando QR Code…';
    if (donationFeedback) donationFeedback.textContent = '';

    try {
      const digits = pixValue?.textContent.trim().replace(/\D/g, '') || '';
      const key = digits.startsWith('55') && [12, 13].includes(digits.length)
        ? `+${digits}`
        : [10, 11].includes(digits.length)
          ? `+55${digits}`
          : '';
      const paymentCode = window.PixDonation.buildPayload(
        amount,
        key,
        donationDialog.dataset.pixRecipient,
        donationDialog.dataset.pixCity
      );

      await loadQrLibrary();
      const qr = window.qrcode(0, 'M');
      qr.addData(paymentCode, 'Byte');
      qr.make();
      pixImage.src = qr.createDataURL(6, 4);
      pixImage.alt = `QR Code Pix para doação de ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount)}`;
      pixPaymentCode.value = paymentCode;
      document.getElementById('pix-result-amount').textContent =
        `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}`;
      pixResult.hidden = false;
    } catch (error) {
      if (donationFeedback) donationFeedback.textContent = error.message;
    } finally {
      generatePixButton.disabled = false;
      generatePixButton.removeAttribute('aria-busy');
      generatePixButton.textContent = 'Gerar QR Code Pix';
    }
  });

  document.getElementById('copy-pix-payment-code')?.addEventListener('click', async () => {
    if (!pixPaymentCode?.value) return;
    try {
      await copyText(pixPaymentCode.value);
      showToast('Código Pix copiado. Confira o recebedor antes de confirmar.');
    } catch {
      showToast('Não foi possível copiar. Selecione e copie o código Pix.');
      pixPaymentCode.focus();
      pixPaymentCode.select();
    }
  });

  document.getElementById('change-donation-amount')?.addEventListener('click', () => {
    pixResult.hidden = true;
    pixOptions.hidden = false;
    pixMethodButton.setAttribute('aria-expanded', 'true');
  });

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

    fetch('data/galleries.json', { cache: 'no-store' })
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
