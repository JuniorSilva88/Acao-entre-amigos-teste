// Interações: copiar Pix, enviar formulário via AJAX, atualizar ano
document.addEventListener('DOMContentLoaded', function(){
  const copyBtns = [document.getElementById('btn-copy'), document.getElementById('btn-copy-2')];
  const pixValue = document.getElementById('pix-value').textContent.trim();
  copyBtns.forEach(b=>{if(b) b.addEventListener('click', ()=>{navigator.clipboard && navigator.clipboard.writeText(pixValue).then(()=>{b.textContent='Copiado!'; setTimeout(()=>b.textContent='Copiar Pix',1500)}).catch(()=>{prompt('Copie o Pix:',pixValue)})})});
  // abrir/realçar o formulário ao clicar em 'Quero doar' ou 'Solicitar coleta'
  const btnOpenForm = document.getElementById('btn-open-form');
  const btnSolicitarColeta = document.getElementById('btn-solicitar-coleta');
  const scrollToForm = ()=>{
    const form = document.getElementById('donation-form');
    if(!form) return;
    form.scrollIntoView({behavior:'smooth',block:'center'});
    const name = document.getElementById('name'); if(name) name.focus();
  };
  if(btnOpenForm) btnOpenForm.addEventListener('click', scrollToForm);
  if(btnSolicitarColeta) btnSolicitarColeta.addEventListener('click', ()=>{
    const msg = document.getElementById('message');
    if(msg) msg.value = 'Solicito coleta de brinquedos. Por favor informe data e ponto de encontro.';
    scrollToForm();
  });

  const form = document.getElementById('donation-form');
  const status = document.getElementById('form-status');
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      status.textContent='Enviando...';
      const data = new FormData(form);
      fetch(form.action, {method:'POST',body:data}).then(r=>r.json()).then(res=>{
        if(res.success){
          status.textContent='Obrigado! Recebemos sua mensagem.';
          form.reset();
        } else {
          status.textContent='Erro ao enviar. Tente novamente.';
        }
      }).catch(err=>{status.textContent='Erro de rede. Tente novamente.'})
    })
  }

  // small menu toggle for mobile
  const btnMenu = document.getElementById('btn-menu');
  const navList = document.getElementById('nav-list');
  if(btnMenu){
    btnMenu.addEventListener('click', ()=>{
      const expanded = btnMenu.getAttribute('aria-expanded') === 'true';
      btnMenu.setAttribute('aria-expanded', String(!expanded));
      // Quando o atributo aria-expanded muda, o CSS controla exibição do menu
      if(navList && !expanded){
        // foco no primeiro link para acessibilidade
        const first = navList.querySelector('a'); if(first) first.focus();
      }
    })
  }

  // fill year
  const year = document.getElementById('year'); if(year) year.textContent = new Date().getFullYear();
});

// QR modal handlers
document.addEventListener('DOMContentLoaded', function(){
  const btnShow = document.getElementById('btn-show-qr');
  const modal = document.getElementById('qr-modal');
  const btnClose = document.getElementById('btn-close-qr');
  const backdrop = modal && modal.querySelector('.qr-backdrop');
  function openModal(){
    if(!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden','false');
    // focus close button
    if(btnClose) btnClose.focus();
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden','true');
  }
  if(btnShow) btnShow.addEventListener('click', openModal);
  if(btnClose) btnClose.addEventListener('click', closeModal);
  if(backdrop) backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeModal(); } });
});
