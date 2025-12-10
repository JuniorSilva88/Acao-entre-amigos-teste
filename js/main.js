// Interações: copiar Pix, abrir formulário, atualizar ano
document.addEventListener('DOMContentLoaded', function () {
  const copyBtns = [document.getElementById('btn-copy'), document.getElementById('btn-copy-2')];
  const pixValue = document.getElementById('pix-value')?.textContent.trim();
  copyBtns.forEach(b => {
    if (b) {
      b.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pixValue).then(() => {
            b.textContent = 'Copiado!';
            setTimeout(() => b.textContent = 'Copiar Pix', 1500);
          }).catch(() => { prompt('Copie o Pix:', pixValue); });
        }
      });
    }
  });

  // abrir/realçar o formulário ao clicar em 'Quero doar' ou 'Solicitar coleta'
  const btnOpenForm = document.getElementById('btn-open-form');
  const btnSolicitarColeta = document.getElementById('btn-solicitar-coleta');
  const scrollToForm = () => {
    const form = document.querySelector('form[name="doacao"]');
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const name = document.getElementById('name'); if (name) name.focus();
  };
  if (btnOpenForm) btnOpenForm.addEventListener('click', scrollToForm);
  if (btnSolicitarColeta) btnSolicitarColeta.addEventListener('click', () => {
    const msg = document.getElementById('message');
    if (msg) msg.value = 'Solicito coleta de brinquedos. Por favor informe data e ponto de encontro.';
    scrollToForm();
  });

  // envio de formulário (PHP + SweetAlert2)
  const form = document.querySelector('form[name="doacao"]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // impede recarregar a página

      const data = new FormData(form);

      fetch("sendmail.php", {
        method: "POST",
        body: data
      })
        .then(response => response.json())
        .then(result => {
          if (result.status === "ok") {
            Swal.fire({
              title: 'Email enviado com sucesso!',
              text: 'Obrigado pela sua doação. Entraremos em contato em breve.',
              icon: 'success',
              imageUrl: 'assets/ação-entre-amigo.png',
              imageWidth: 80,
              imageHeight: 80,
              imageAlt: 'Logo da campanha',
              confirmButtonText: 'Fechar'
            });
            form.reset();
          } else {
            Swal.fire({
              title: 'Erro!',
              text: 'Não foi possível enviar: ' + (result.message || ''),
              icon: 'error',
              confirmButtonText: 'Fechar'
            });
          }
        })
        .catch(error => {
          Swal.fire({
            title: 'Erro!',
            text: 'Falha na conexão com o servidor.',
            icon: 'error',
            confirmButtonText: 'Fechar'
          });
          console.error('Erro no envio:', error);
        });
    });
  }

  // small menu toggle for mobile
  const btnMenu = document.getElementById('btn-menu');
  const navList = document.getElementById('nav-list');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      const expanded = btnMenu.getAttribute('aria-expanded') === 'true';
      btnMenu.setAttribute('aria-expanded', String(!expanded));
      const navEl = btnMenu.closest('.main-nav');
      if (navEl) navEl.setAttribute('aria-expanded', String(!expanded));
      if (navList && !expanded) {
        const first = navList.querySelector('a'); if (first) first.focus();
      }
    });
  }
  if (navList) {
    const links = navList.querySelectorAll('a');
    links.forEach(l => l.addEventListener('click', () => {
      if (btnMenu) { btnMenu.setAttribute('aria-expanded', 'false'); }
      const navEl = btnMenu && btnMenu.closest && btnMenu.closest('.main-nav');
      if (navEl) navEl.setAttribute('aria-expanded', 'false');
    }));
  }

  // fill year
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
});

// QR modal handlers
document.addEventListener('DOMContentLoaded', function () {
  const btnShow = document.getElementById('btn-show-qr');
  const modal = document.getElementById('qr-modal');
  const btnClose = document.getElementById('btn-close-qr');
  const backdrop = modal && modal.querySelector('.qr-backdrop');
  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (btnClose) btnClose.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
  if (btnShow) btnShow.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); }
  });
});

// Inicialização da galeria com Lightbox2
document.addEventListener('DOMContentLoaded', function () {
  if (typeof lightbox !== "undefined") {
    lightbox.option({
      albumLabel: "%1 de %2",
      wrapAround: true,
      fadeDuration: 200,
      imageFadeDuration: 200,
      resizeDuration: 200,
      disableScrolling: true,
      alwaysShowNavOnTouchDevices: true
    });
  }
});
