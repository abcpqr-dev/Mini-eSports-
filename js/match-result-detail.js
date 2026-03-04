/* ====== FEATURE 5: MATCH RESULT DETAIL SCREEN ====== */
/* Shows detailed results for completed matches */

(function() {
  var lastResult = null;

  window.showResultDetail = function(matchId) {
    var t = MT[matchId];
    if (!t) { toast('Match not found', 'err'); return; }

    // Try matches/{matchId}/results/{uid} first
    db.ref('matches/' + matchId + '/results/' + U.uid).once('value', function(s) {
      if (s.exists()) {
        renderResultModal(s.val(), t, matchId);
      } else {
        // Fallback to results/ node
        db.ref('results').orderByChild('userId').equalTo(U.uid).once('value', function(rs) {
          var found = null;
          if (rs.exists()) rs.forEach(function(c) {
            var r = c.val();
            if (r.matchId === matchId) found = r;
          });
          if (found) {
            renderResultModal(found, t, matchId);
          } else {
            toast('Results not yet published for this match', 'inf');
          }
        });
      }
    });
  };

  function renderResultModal(r, t, matchId) {
    lastResult = r;
    var totalWin = (Number(r.winnings) || 0) + (Number(r.killPrize) || 0);
    if (r.totalWinning) totalWin = Number(r.totalWinning);

    var rankEmoji = '🏆';
    if (r.rank == 1) rankEmoji = '🥇';
    else if (r.rank == 2) rankEmoji = '🥈';
    else if (r.rank == 3) rankEmoji = '🥉';
    else rankEmoji = '#' + (r.rank || '?');

    var h = '<div style="text-align:center;margin-bottom:16px">';
    h += '<div style="font-size:48px;margin-bottom:8px">' + (r.rank <= 3 ? rankEmoji : '🏆') + '</div>';
    h += '<div style="font-size:20px;font-weight:900;color:var(--green)">Match Result</div>';
    h += '<div style="font-size:13px;color:var(--txt2);margin-top:4px">' + (t.name || 'Match') + '</div>';
    h += '</div>';

    h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">';
    h += '<div class="d-row"><span class="dl">🏆 Rank</span><span class="dv" style="font-size:20px;font-weight:900;color:var(--yellow)">' + rankEmoji + '</span></div>';
    h += '<div class="d-row"><span class="dl">💀 Kills</span><span class="dv" style="color:var(--red)">' + (r.kills || 0) + '</span></div>';
    if (r.killPrize || r.perKill) h += '<div class="d-row"><span class="dl">💀 Kill Prize</span><span class="dv green">₹' + (r.killPrize || ((r.kills || 0) * (Number(t.perKill) || 0))) + '</span></div>';
    if (r.rankPrize || r.winnings) h += '<div class="d-row"><span class="dl">🏅 Rank Prize</span><span class="dv green">₹' + (r.rankPrize || r.winnings || 0) + '</span></div>';
    h += '</div>';

    h += '<div style="background:linear-gradient(135deg,rgba(0,255,106,.08),rgba(0,255,106,.02));border:1px solid rgba(0,255,106,.2);border-radius:14px;padding:16px;text-align:center;margin-bottom:14px">';
    h += '<div style="font-size:12px;color:var(--txt2);text-transform:uppercase;letter-spacing:1px">Total Earned</div>';
    h += '<div style="font-size:28px;font-weight:900;color:var(--green);margin-top:4px">₹' + totalWin + '</div>';
    h += '</div>';

    h += '<button onclick="shareResult(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.08));color:var(--blue);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> Share Result</button>';

    openModal('Match Result', h);
  }

  window.shareResult = function(matchId) {
    if (!lastResult) return;
    var r = lastResult;
    var t = MT[matchId];
    var text = '🎮 Mini eSports — Match Result!\n\n' +
      '🏆 Match: ' + (t ? t.name : 'Match') + '\n' +
      '📊 Rank: #' + (r.rank || '?') + '\n' +
      '💀 Kills: ' + (r.kills || 0) + '\n' +
      '💰 Earned: ₹' + (r.totalWinning || r.winnings || 0) + '\n\n' +
      '🔥 Play on Mini eSports and win real cash!';

    if (navigator.share) {
      navigator.share({ title: 'My Match Result', text: text, url: window.location.href }).catch(function() {
        copyTxt(text);
        toast('Result copied!', 'ok');
      });
    } else {
      copyTxt(text);
      toast('Result copied to clipboard!', 'ok');
    }
  };

  console.log('[Mini eSports] ✅ Feature 5: Result Detail loaded');
})();
