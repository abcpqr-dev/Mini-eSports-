/* ====== FEATURE 7: REAL-TIME REFERRAL DASHBOARD ====== */
/* Enhanced referral tracking with live stats */

(function() {
  function loadReferralDashboard(container) {
    if (!container || !UD || !U) return;
    var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();

    // Load referral stats
    db.ref('referrals').orderByChild('referrerId').equalTo(U.uid).once('value', function(s) {
      var total = 0, verified = 0, pending = 0, earned = 0;
      var refList = [];

      if (s.exists()) {
        s.forEach(function(c) {
          var r = c.val();
          total++;
          if (r.verified) { verified++; earned += (r.reward || 10); }
          else pending++;
          refList.push(r);
        });
      }

      var h = '';
      // Stats grid
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0">';
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">';
      h += '<div style="font-size:20px;font-weight:900;color:var(--green)">' + total + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">Total Joined</div></div>';
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">';
      h += '<div style="font-size:20px;font-weight:900;color:var(--yellow)">' + pending + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">Pending</div></div>';
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">';
      h += '<div style="font-size:20px;font-weight:900;color:var(--purple)">🪙 ' + earned + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">Earned</div></div>';
      h += '</div>';

      // Referral list
      if (refList.length > 0) {
        h += '<div style="font-size:13px;font-weight:700;margin:12px 0 8px;color:var(--txt2)">Recent Referrals</div>';
        refList.slice(0, 10).forEach(function(r) {
          h += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card);border-radius:10px;margin-bottom:6px">';
          h += '<div style="width:32px;height:32px;border-radius:10px;background:rgba(185,100,255,.12);color:var(--purple);display:flex;align-items:center;justify-content:center;font-size:12px"><i class="fas fa-user-plus"></i></div>';
          h += '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (r.referredName || 'User') + '</div>';
          h += '<div style="font-size:11px;color:var(--txt2)">' + timeAgo(r.createdAt) + '</div></div>';
          h += '<div style="font-size:13px;font-weight:700;color:' + (r.verified ? 'var(--green)' : 'var(--yellow)') + '">' + (r.verified ? '+🪙 10' : '⏳') + '</div>';
          h += '</div>';
        });
      }

      container.innerHTML = h;
    });
  }

  window.loadReferralDashboard = loadReferralDashboard;

  console.log('[Mini eSports] ✅ Feature 7: Referral Tracker loaded');
})();
