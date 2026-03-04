/* ====== FEATURE 1: LIVE COUNTDOWN TIMER ON MATCH CARDS ====== */
/* Shows real-time countdown on every match card, updates every second */

(function() {
  var _timerInterval = null;

  function startMatchTimers() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(function() {
      for (var mid in MT) {
        var el = document.getElementById('timer-' + mid);
        if (!el) continue;
        var t = MT[mid];
        var mt = Number(t.matchTime);
        if (!mt) { el.textContent = ''; continue; }
        var diff = mt - Date.now();

        if (diff > 86400000) {
          // More than 24h — show days
          var days = Math.floor(diff / 86400000);
          el.textContent = days + 'd ' + Math.floor((diff % 86400000) / 3600000) + 'h';
          el.style.color = '#00d4ff';
        } else if (diff > 3600000) {
          // Hours + minutes
          var h = Math.floor(diff / 3600000);
          var m = Math.floor((diff % 3600000) / 60000);
          el.textContent = h + 'h ' + m + 'm';
          el.style.color = '#00d4ff';
        } else if (diff > 60000) {
          // Minutes + seconds
          var m = Math.floor(diff / 60000);
          var s = Math.floor((diff % 60000) / 1000);
          el.textContent = m + 'm ' + s + 's';
          el.style.color = diff < 300000 ? '#ffaa00' : '#00d4ff';
        } else if (diff > 0) {
          // Last minute — urgent
          var s = Math.floor(diff / 1000);
          el.textContent = '⚡ ' + s + 's';
          el.style.color = '#ff003c';
          el.style.fontWeight = '900';
          // Flash effect
          el.style.animation = 'pulse 0.5s infinite';
        } else if (diff > -1200000) {
          // Live (within 20 min after start)
          el.innerHTML = '<span style="color:#ff003c;animation:pulse 1.2s infinite">🔴 LIVE</span>';
        } else {
          el.textContent = 'Ended';
          el.style.color = '#666';
        }
      }
    }, 1000);
  }

  // Hook into renderHome to start timers after cards are rendered
  var _origRenderHome = window.renderHome;
  if (_origRenderHome) {
    window.renderHome = function() {
      _origRenderHome();
      setTimeout(startMatchTimers, 100);
    };
  }

  // Also hook into renderSP and renderMM
  var _origRenderSP = window.renderSP;
  if (_origRenderSP) {
    window.renderSP = function() {
      _origRenderSP();
      setTimeout(startMatchTimers, 100);
    };
  }

  // Export for manual use
  window.startMatchTimers = startMatchTimers;

  console.log('[Mini eSports] ✅ Feature 1: Match Timer loaded');
})();
