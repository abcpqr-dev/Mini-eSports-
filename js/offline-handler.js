/* ====== FEATURE 10: OFFLINE HANDLER ====== */
(function() {
  var _banner = null, _online = true, _lastFresh = Date.now();

  function _show(msg, color) {
    if (!_banner) {
      _banner = document.createElement('div');
      _banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;text-align:center;padding:8px 16px;font-size:12px;font-weight:700;color:#fff;transition:all .3s';
      document.body.prepend(_banner);
    }
    _banner.style.background = color || '#ff6600';
    _banner.textContent = msg;
    _banner.style.display = 'block';
    _banner.style.opacity = '1';
  }

  function _hide() {
    if (_banner) {
      _banner.style.opacity = '0';
      setTimeout(function() { if (_banner) _banner.style.display = 'none'; }, 300);
    }
  }

  if (window.db) {
    db.ref('.info/connected').on('value', function(s) {
      if (s.val() === false) {
        _online = false;
        _show('📡 No connection — cached data dikh raha hai', '#e65c00');
      } else {
        var wasOffline = !_online;
        _online = true; _lastFresh = Date.now(); _hide();
        if (wasOffline) {
          if (window.toast) toast('✅ Back online!', 'ok');
          setTimeout(function() {
            if (window.renderHome) renderHome();
            if (window.renderMM) renderMM();
            if (window.renderWallet) renderWallet();
          }, 600);
        }
      }
    });
  }

  // Stale data warning
  setInterval(function() {
    if (_online && Date.now() - _lastFresh > 300000) {
      _show('⚠️ Data purana ho sakta hai — refresh kar raha hai...', '#885500');
      if (window.renderHome) renderHome();
      _lastFresh = Date.now();
      setTimeout(_hide, 3000);
    }
  }, 120000);

  window._markDataFresh = function() { _lastFresh = Date.now(); };
  console.log('[Mini eSports] ✅ Feature 10: Offline Handler loaded');
})();
