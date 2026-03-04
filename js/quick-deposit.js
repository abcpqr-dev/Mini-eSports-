/* ====== FEATURE 9: QUICK DEPOSIT ====== */
(function() {
  var _selAmt = 0;
  var presets = [50, 100, 200, 500, 1000];

  window.showQuickDepositScreen = function() {
    var el = document.getElementById('wfContent'); if (!el) return;
    var upi = (window.PAY && window.PAY.upiId) ? window.PAY.upiId : '';
    var h = '<div style="padding:4px 0">';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:14px;text-align:center">Select Amount</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">';
    presets.forEach(function(a) {
      h += '<button onclick="window._qdPick(' + a + ',this)" style="padding:14px 8px;border-radius:12px;background:var(--card2);border:2px solid var(--border);color:var(--txt);font-size:16px;font-weight:800;cursor:pointer;transition:all .15s">₹' + a + '</button>';
    });
    h += '</div>';
    h += '<input type="number" id="qdCustom" placeholder="Ya amount type karo..." style="width:100%;padding:12px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:15px;text-align:center;margin-bottom:14px;box-sizing:border-box" oninput="window._qdPick(Number(this.value),null)">';
    h += '<button onclick="window._qdGo(\'' + upi + '\')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:900;font-size:15px;border:none;cursor:pointer;letter-spacing:.5px">💳 Open UPI & Pay</button>';
    h += '<div style="font-size:11px;color:var(--txt2);margin-top:10px;text-align:center">Payment ke baad wapas aao aur UTR enter karo</div>';
    h += '</div>';
    el.innerHTML = h;
  };

  window._qdPick = function(a, btn) {
    _selAmt = a;
    if (window.wfAmt !== undefined) window.wfAmt = a;
    document.querySelectorAll('#wfContent button[onclick*="_qdPick"]').forEach(function(b) {
      b.style.borderColor = 'var(--border)'; b.style.color = 'var(--txt)'; b.style.background = 'var(--card2)';
    });
    if (btn) { btn.style.borderColor = '#00ff9c'; btn.style.color = '#00ff9c'; btn.style.background = 'rgba(0,255,156,.1)'; }
    if (btn) { var ci = document.getElementById('qdCustom'); if (ci) ci.value = a; }
  };

  window._qdGo = function(upi) {
    var a = _selAmt || Number((document.getElementById('qdCustom') || {}).value) || 0;
    if (a < 10) { if (window.toast) toast('Minimum ₹10', 'err'); return; }
    if (window.wfAmt !== undefined) window.wfAmt = a;
    if (upi) window.location.href = 'upi://pay?pa=' + encodeURIComponent(upi) + '&am=' + a + '&pn=MiniEsport&cu=INR';
    setTimeout(function() { if (window.showWFStep) showWFStep(2); }, 3000);
  };

  // Hook step 1
  var _orig = window.showWFStep;
  if (_orig) {
    window.showWFStep = function(s) {
      _orig(s);
      if (s === 1) setTimeout(window.showQuickDepositScreen, 60);
    };
  }
  console.log('[Mini eSports] ✅ Feature 9: Quick Deposit loaded');
})();
