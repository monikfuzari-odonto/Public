/* Ajustes para iPhone: funcionar offline, tocar o som do descanso, exportar arquivos e dica de instalação. */
(function () {
  // 1) Offline: registra o service worker (só em https)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  // 2) Som do fim do descanso / prancha: o iPhone só libera áudio depois de um toque.
  //    Desbloqueia no primeiro toque e reaproveita um único AudioContext.
  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    var shared = null;
    var getCtx = function () {
      if (!shared) { try { shared = new AC(); } catch (e) { return null; } }
      if (shared.state !== 'running') { try { shared.resume(); } catch (e) {} }
      return shared;
    };
    var unlock = function () {
      var c = getCtx();
      if (!c) return;
      try {
        var src = c.createBufferSource();
        src.buffer = c.createBuffer(1, 1, 22050);
        src.connect(c.destination);
        src.start(0);
      } catch (e) {}
    };
    document.addEventListener('touchend', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && shared && shared.state !== 'running') { try { shared.resume(); } catch (e) {} }
    });
    var SharedAudio = function () { return getCtx(); };
    window.AudioContext = SharedAudio;
    window.webkitAudioContext = SharedAudio;
  }

  // 3) Exportar CSV / backup: abre a folha de compartilhamento com o arquivo
  //    ("Salvar em Arquivos", AirDrop, WhatsApp...). Se não der, segue o download normal.
  var blobs = new Map();
  var origCreate = URL.createObjectURL.bind(URL);
  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = origCreate(obj);
    if (obj instanceof Blob) blobs.set(u, obj);
    return u;
  };
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { blobs.delete(u); origRevoke(u); }, 60000);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a) return;
    var blob = blobs.get(a.getAttribute('href') || '');
    if (!blob || !navigator.canShare) return;
    var name = a.getAttribute('download') || 'arquivo';
    var type = (blob.type || 'application/octet-stream').split(';')[0];
    var file;
    try { file = new File([blob], name, { type: type }); } catch (err) { return; }
    if (!navigator.canShare({ files: [file] })) return;
    e.preventDefault();
    navigator.share({ files: [file], title: name }).catch(function () {});
  }, true);

  // 4) Dica de instalação no Safari do iPhone
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.navigator.standalone === true ||
                   (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  // Já instalado: esconde o botão "Salvar" do topo (não faz mais sentido)
  if (standalone) document.documentElement.classList.add('is-installed');

  var TIP_KEY = 'monikfit_ios_tip_dismissed';
  var dismissed = false;
  try { dismissed = localStorage.getItem(TIP_KEY) === '1'; } catch (e) {}
  if (isIOS && !standalone && !dismissed) {
    window.addEventListener('load', function () {
      var tip = document.createElement('div');
      tip.id = 'iosInstallTip';
      tip.setAttribute('role', 'note');
      tip.innerHTML =
        '<span style="font-size:1.25rem;line-height:1">📲</span>' +
        '<span><strong>Instale como app:</strong> toque em <b>Compartilhar</b> ' +
        '<span aria-hidden="true">⬆︎</span> e depois em <b>“Adicionar à Tela de Início”</b>. ' +
        'Abre em tela cheia e funciona sem internet.</span>' +
        '<button type="button" aria-label="Fechar dica">✕</button>';
      tip.querySelector('button').addEventListener('click', function () {
        tip.remove();
        try { localStorage.setItem(TIP_KEY, '1'); } catch (e) {}
      });
      document.body.appendChild(tip);
    });
  }
})();
