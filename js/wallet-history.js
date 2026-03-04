/* ====== FEATURE 4: DETAILED WALLET TRANSACTION HISTORY ====== */
/* Shows complete transaction history with filters */

(function() {
  var txFilter = 'all';

  function renderWalletHistory() {
    var container = document.getElementById('walletHist');
    if (!container || !U) return;

    // Combine wallet requests + any stored transactions
    var allTx = [];

    // Add wallet requests
    if (window.WH) {
      WH.forEach(function(w) {
        allTx.push({
          type: w.type || 'deposit',
          amount: w.type === 'withdraw' ? -(Number(w.amount) || 0) : (Number(w.amount) || 0),
          description: w.type === 'deposit' ? 'Deposit via UPI' : 'Withdrawal to UPI',
          status: w.status || 'pending',
          utr: w.utr || w.transactionId || '',
          timestamp: w.createdAt || 0,
          icon: w.type === 'deposit' ? '💰' : '💸'
        });
      });
    }

    // Sort by timestamp descending
    allTx.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    // Apply filter
    var filtered = allTx;
    if (txFilter === 'credits') filtered = allTx.filter(function(t) { return t.amount > 0; });
    if (txFilter === 'debits') filtered = allTx.filter(function(t) { return t.amount < 0; });

    var h = '';
    
    // Filter buttons
    h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
    h += '<button onclick="setTxFilter(\'all\')" style="flex:1;padding:6px;border-radius:8px;border:1px solid ' + (txFilter === 'all' ? 'var(--green)' : 'var(--border)') + ';background:' + (txFilter === 'all' ? 'rgba(0,255,106,.1)' : 'var(--card)') + ';color:' + (txFilter === 'all' ? 'var(--green)' : 'var(--txt2)') + ';font-size:11px;font-weight:600;cursor:pointer">All</button>';
    h += '<button onclick="setTxFilter(\'credits\')" style="flex:1;padding:6px;border-radius:8px;border:1px solid ' + (txFilter === 'credits' ? 'var(--green)' : 'var(--border)') + ';background:' + (txFilter === 'credits' ? 'rgba(0,255,106,.1)' : 'var(--card)') + ';color:' + (txFilter === 'credits' ? 'var(--green)' : 'var(--txt2)') + ';font-size:11px;font-weight:600;cursor:pointer">Credits (+)</button>';
    h += '<button onclick="setTxFilter(\'debits\')" style="flex:1;padding:6px;border-radius:8px;border:1px solid ' + (txFilter === 'debits' ? 'var(--red)' : 'var(--border)') + ';background:' + (txFilter === 'debits' ? 'rgba(255,46,46,.1)' : 'var(--card)') + ';color:' + (txFilter === 'debits' ? 'var(--red)' : 'var(--txt2)') + ';font-size:11px;font-weight:600;cursor:pointer">Debits (-)</button>';
    h += '</div>';

    if (!filtered.length) {
      h += '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">No transactions found</div>';
    }

    filtered.forEach(function(tx) {
      var isPositive = tx.amount >= 0;
      var statusClass = tx.status === 'approved' || tx.status === 'done' ? 'whs-a' : tx.status === 'rejected' ? 'whs-r' : 'whs-p';
      var statusText = tx.status === 'approved' || tx.status === 'done' ? 'Done' : tx.status === 'rejected' ? 'Failed' : 'Pending';

      h += '<div class="wh-card">';
      h += '<div class="wh-icon ' + (isPositive ? 'whi-g' : 'whi-r') + '"><i class="fas fa-' + (isPositive ? 'arrow-up' : 'arrow-down') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + tx.description + '</div>';
      h += '<div class="wh-time">' + (tx.timestamp ? timeAgo(tx.timestamp) : '') + '</div>';
      if (tx.utr) h += '<div class="wh-utr">UTR: ' + tx.utr + '</div>';
      h += '</div>';
      h += '<div class="wh-amt ' + (isPositive ? 'wha-g' : 'wha-r') + '">' + (isPositive ? '+' : '') + '₹' + Math.abs(tx.amount) + '</div>';
      h += '<span class="wh-status ' + statusClass + '">' + statusText + '</span>';
      h += '</div>';
    });

    container.innerHTML = h;
  }

  window.setTxFilter = function(f) {
    txFilter = f;
    renderWalletHistory();
  };

  // Hook into renderWallet
  var _origRenderWallet = window.renderWallet;
  if (_origRenderWallet) {
    window.renderWallet = function() {
      _origRenderWallet();
      renderWalletHistory();
    };
  }

  console.log('[Mini eSports] ✅ Feature 4: Wallet History loaded');
})();
