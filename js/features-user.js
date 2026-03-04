/* ====================================================
   MINI ESPORTS — 25 ADVANCED USER FEATURES
   ==================================================== */
(function() {
'use strict';
var db = window.db, auth = window.auth;
function _$(id){return document.getElementById(id);}
function _toast(m,t){if(window.toast)toast(m,t||'ok');}

/* ─── FEATURE 1: DAILY LOGIN BONUS ─── */
window.checkDailyBonus = function() {
  if (!window.U || !window.UD) return;
  var uid = window.U.uid;
  var today = new Date().toDateString();
  db.ref('users/' + uid + '/lastLoginDate').once('value', function(s) {
    if (s.val() === today) return; // Already claimed today
    var streak = 0;
    db.ref('users/' + uid + '/loginStreak').once('value', function(ss) {
      streak = (ss.val() || 0) + 1;
      var bonus = streak >= 7 ? 25 : streak >= 3 ? 15 : 10;
      db.ref('users/' + uid).update({ lastLoginDate: today, loginStreak: streak });
      db.ref('users/' + uid + '/coins').transaction(function(c) { return (c||0) + bonus; });
      setTimeout(function() {
        _toast('🎁 Daily Bonus: +🪙' + bonus + ' Coins! (Day ' + streak + ' streak)');
      }, 2000);
    });
  });
};

/* ─── FEATURE 2: LUCKY SPIN WHEEL ─── */
window.showSpinWheel = function() {
  if (!window.U || !window.UD) return;
  var uid = window.U.uid, UD = window.UD;
  var today = new Date().toDateString();
  db.ref('users/' + uid + '/lastSpinDate').once('value', function(s) {
    var lastSpin = s.val();
    var canSpin = lastSpin !== today;
    var prizes = ['🪙5','🪙10','🪙25','🪙50','₹1','🪙5','🪙15','💎 Rare'];
    var colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6b6b','#ffd93d','#6bcb77','#b964ff'];
    var h = '<div style="padding:16px;text-align:center">';
    h += '<h3 style="color:var(--primary);margin-bottom:4px">🎡 Lucky Spin</h3>';
    h += '<p style="font-size:12px;color:var(--txt2);margin-bottom:16px">' + (canSpin ? 'Aaj ka spin available hai!' : 'Kal phir aao! (1 spin/day)') + '</p>';
    h += '<div id="spinWheel" style="width:200px;height:200px;border-radius:50%;border:4px solid var(--primary);margin:0 auto;position:relative;overflow:hidden;transition:transform 3s cubic-bezier(.2,.8,.3,1)">';
    prizes.forEach(function(p, i) {
      var rot = (i * 45) + 'deg';
      h += '<div style="position:absolute;width:50%;height:50%;left:50%;top:0;transform-origin:0% 100%;transform:rotate(' + rot + ');background:' + colors[i] + '22;border-left:1px solid ' + colors[i] + '44;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;font-size:10px;font-weight:700;color:' + colors[i] + '">' + p + '</div>';
    });
    h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:var(--bg);border:2px solid var(--primary);z-index:2"></div></div>';
    h += '<div style="position:absolute;top:calc(50% - 120px);left:50%;transform:translateX(-50%);font-size:20px">▼</div>';
    if (canSpin) h += '<button onclick="window._doSpin()" style="margin-top:20px;padding:12px 32px;border-radius:14px;background:linear-gradient(135deg,var(--primary),var(--green));color:#000;font-weight:900;border:none;cursor:pointer;font-size:15px;width:100%">🎰 SPIN!</button>';
    else h += '<div style="margin-top:16px;padding:10px;border-radius:10px;background:rgba(255,170,0,.1);border:1px solid rgba(255,170,0,.2);font-size:12px;color:var(--yellow)">⏰ Next spin tomorrow!</div>';
    h += '</div>';
    if (window.showModal) showModal('🎡 Lucky Spin', h);
  });
};

window._doSpin = function() {
  var uid = window.U.uid;
  var today = new Date().toDateString();
  var prizes = [5,10,25,50,100,5,15,0];
  var labels = ['🪙5','🪙10','🪙25','🪙50','₹1 Cash','🪙5','🪙15','💎 Jackpot'];
  var w = _$('spinWheel'); if (!w) return;
  var idx = Math.floor(Math.random() * 8);
  var deg = 360 * 5 + (idx * 45) + Math.floor(Math.random() * 40);
  w.style.transform = 'rotate(' + deg + 'deg)';
  db.ref('users/' + uid + '/lastSpinDate').set(today);
  setTimeout(function() {
    var reward = prizes[idx];
    if (idx === 7) { _toast('💎 JACKPOT! +🪙100 Coins!!'); db.ref('users/' + uid + '/coins').transaction(function(c){return (c||0)+100;}); }
    else if (idx === 4) { _toast('🎉 Cash prize! ₹1 added!'); db.ref('users/' + uid + '/realMoney/bonus').transaction(function(v){return (v||0)+1;}); }
    else { _toast('🎁 Won: ' + labels[idx]); db.ref('users/' + uid + '/coins').transaction(function(c){return (c||0)+reward;}); }
    if(window.closeModal) closeModal();
  }, 3200);
};

/* ─── FEATURE 3: MATCH REMINDER ─── */
window.setMatchReminder = function(matchId, matchTime, matchName) {
  if (!('Notification' in window)) { _toast('Browser notifications support nahi karta', 'err'); return; }
  Notification.requestPermission().then(function(p) {
    if (p !== 'granted') { _toast('Notification permission do', 'err'); return; }
    var ms = Number(matchTime) - Date.now() - 600000; // 10 min before
    if (ms < 0) { _toast('Match jaldi shuru hoga!', 'inf'); return; }
    setTimeout(function() {
      new Notification('⚡ Match shuru hone wala hai!', {
        body: matchName + ' 10 minutes mein start hoga. Room ID ready rakho!',
        icon: '/favicon.ico'
      });
    }, ms);
    _toast('⏰ Reminder set! 10 min pehle notification aayega.', 'ok');
    var saved = JSON.parse(localStorage.getItem('reminders') || '[]');
    saved.push({ matchId: matchId, matchTime: matchTime, set: Date.now() });
    localStorage.setItem('reminders', JSON.stringify(saved.slice(-10)));
  });
};

/* ─── FEATURE 4: PROFILE COMPLETION % ─── */
window.getProfileCompletion = function() {
  var UD = window.UD; if (!UD) return 0;
  var fields = [
    { k: 'ign', w: 20 }, { k: 'ffUid', w: 20 }, { k: 'phone', w: 15 },
    { k: 'email', w: 10 }, { k: 'profileImage', w: 15 }, { k: 'duoTeam', w: 10 },
    { k: 'referralCode', w: 5 }, { k: 'bio', w: 5 }
  ];
  var total = 0;
  fields.forEach(function(f) { if (UD[f.k]) total += f.w; });
  return Math.min(total, 100);
};

window.renderProfileCompletion = function() {
  var pct = window.getProfileCompletion();
  var color = pct >= 80 ? '#00ff9c' : pct >= 50 ? '#ffd700' : '#ff6b6b';
  var h = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<span style="font-size:13px;font-weight:700"><i class="fas fa-id-card" style="color:' + color + '"></i> Profile ' + pct + '% Complete</span>';
  if (pct < 100) h += '<span style="font-size:11px;color:var(--txt2)">Complete karo!</span>';
  h += '</div>';
  h += '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">';
  h += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',#00cc7a);border-radius:4px;transition:width .5s"></div></div>';
  if (pct < 100 && !window.UD.phone) h += '<div style="font-size:11px;color:var(--txt2);margin-top:6px"><i class="fas fa-info-circle"></i> Phone number add karo +15%</div>';
  h += '</div>';
  return h;
};

/* ─── FEATURE 5: HOT STREAK SYSTEM ─── */
window.getStreakInfo = function() {
  var UD = window.UD; if (!UD || !UD.stats) return null;
  var wins = UD.stats.wins || 0;
  var matches = UD.stats.matches || 0;
  if (wins >= 5) return { emoji: '🔥', label: wins + ' Win Streak!', color: '#ff6b6b' };
  if (wins >= 3) return { emoji: '⚡', label: '3+ Wins!', color: '#ffd700' };
  if (matches >= 10) return { emoji: '💪', label: 'Veteran Player', color: '#4d96ff' };
  return null;
};

/* ─── FEATURE 6: VIP STATUS SYSTEM ─── */
window.getVipStatus = function() {
  var UD = window.UD; if (!UD) return null;
  var dep = (UD.realMoney && UD.realMoney.deposited) ? Number(UD.realMoney.deposited) : 0;
  if (dep >= 5000) return { level: 'Diamond', emoji: '💎', color: '#b964ff', bg: 'rgba(185,100,255,.12)', perks: ['Priority support','5% cashback','Exclusive tournaments'] };
  if (dep >= 2000) return { level: 'Gold', emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.12)', perks: ['Fast withdrawals','3% cashback','Special badge'] };
  if (dep >= 500) return { level: 'Silver', emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.12)', perks: ['Priority queue','1% cashback'] };
  return null;
};

/* ─── FEATURE 7: COIN SHOP ─── */
window.showCoinShop = function() {
  var UD = window.UD; if (!UD) return;
  var coins = UD.coins || 0;
  var items = [
    { id: 'bonus10', name: '₹10 Bonus Cash', desc: 'Wallet mein add hoga', cost: 200, icon: '💵' },
    { id: 'bonus25', name: '₹25 Bonus Cash', desc: 'Best value!', cost: 450, icon: '💰' },
    { id: 'entry_free', name: 'Free Entry Pass', desc: 'Ek match free join karo', cost: 100, icon: '🎟️' },
    { id: 'avatar_frame', name: 'Gold Avatar Frame', desc: 'Profile pe special frame', cost: 300, icon: '🖼️' },
    { id: 'lucky_spin', name: 'Extra Spin', desc: 'Bonus lucky spin', cost: 50, icon: '🎡' },
  ];
  var h = '<div style="padding:4px 0">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,215,0,.08);border-radius:12px;margin-bottom:14px;border:1px solid rgba(255,215,0,.2)">';
  h += '<span style="font-size:14px;font-weight:700">Your Coins</span>';
  h += '<span style="font-size:18px;font-weight:900;color:#ffd700">🪙 ' + coins + '</span></div>';
  items.forEach(function(item) {
    var canBuy = coins >= item.cost;
    h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--card2);border-radius:12px;margin-bottom:8px;border:1px solid var(--border)">';
    h += '<div style="font-size:24px">' + item.icon + '</div>';
    h += '<div style="flex:1"><div style="font-weight:700;font-size:13px">' + item.name + '</div>';
    h += '<div style="font-size:11px;color:var(--txt2)">' + item.desc + '</div></div>';
    h += '<button onclick="window._buyShopItem(\'' + item.id + '\',' + item.cost + ')" ' +
         (canBuy ? '' : 'disabled ') +
         'style="padding:8px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:700;font-size:12px;background:' +
         (canBuy ? 'linear-gradient(135deg,#ffd700,#ffaa00)' : 'rgba(255,255,255,.05)') +
         ';color:' + (canBuy ? '#000' : 'var(--txt2)') + '">🪙 ' + item.cost + '</button>';
    h += '</div>';
  });
  h += '</div>';
  if (window.showModal) showModal('🛒 Coin Shop', h);
};

window._buyShopItem = function(id, cost) {
  var uid = window.U.uid, UD = window.UD;
  var coins = UD.coins || 0;
  if (coins < cost) { _toast('Coins kam hain!', 'err'); return; }
  db.ref('users/' + uid + '/coins').transaction(function(c) { return Math.max(0, (c||0) - cost); }, function(err, committed) {
    if (!committed) { _toast('Transaction failed', 'err'); return; }
    if (id === 'bonus10') { db.ref('users/' + uid + '/realMoney/bonus').transaction(function(v){return (v||0)+10;}); _toast('✅ ₹10 wallet mein add hua!'); }
    else if (id === 'bonus25') { db.ref('users/' + uid + '/realMoney/bonus').transaction(function(v){return (v||0)+25;}); _toast('✅ ₹25 wallet mein add hua!'); }
    else if (id === 'entry_free') { db.ref('users/' + uid + '/freePasses').transaction(function(v){return (v||0)+1;}); _toast('✅ Free Entry Pass mila!'); }
    else if (id === 'lucky_spin') { db.ref('users/' + uid + '/lastSpinDate').set(''); _toast('✅ Extra spin unlocked!'); }
    else { _toast('✅ Item purchased!'); }
    db.ref('users/' + uid).once('value', function(s){ if(s.val())window.UD=s.val(); });
    if(window.closeModal) closeModal();
  });
};

/* ─── FEATURE 8: MATCH WATCHLIST (BOOKMARK) ─── */
var _watchlist = JSON.parse(localStorage.getItem('matchWatchlist') || '[]');
window.toggleWatchlist = function(matchId) {
  var idx = _watchlist.indexOf(matchId);
  if (idx >= 0) {
    _watchlist.splice(idx, 1);
    _toast('Watchlist se hataya', 'inf');
  } else {
    _watchlist.push(matchId);
    _toast('⭐ Watchlist mein add hua!');
  }
  localStorage.setItem('matchWatchlist', JSON.stringify(_watchlist));
  if (window.renderHome) renderHome();
};
window.isWatchlisted = function(id) { return _watchlist.indexOf(id) >= 0; };

/* ─── FEATURE 9: DYNAMIC "FILLING FAST" BADGE ─── */
window.getSlotBadge = function(filled, total) {
  var pct = filled / total * 100;
  if (pct >= 90) return '<span style="padding:2px 6px;border-radius:5px;font-size:9px;font-weight:700;background:rgba(255,0,60,.15);color:#ff003c;animation:redPulse 1s infinite">🔥 Almost Full</span>';
  if (pct >= 70) return '<span style="padding:2px 6px;border-radius:5px;font-size:9px;font-weight:700;background:rgba(255,170,0,.12);color:#ffaa00">⚡ Filling Fast</span>';
  if (pct <= 10) return '<span style="padding:2px 6px;border-radius:5px;font-size:9px;font-weight:700;background:rgba(0,255,106,.1);color:var(--green)">✨ New</span>';
  return '';
};

/* ─── FEATURE 10: PLAYER STATS MINI CHART ─── */
window.renderStatsChart = function() {
  var UD = window.UD; if (!UD || !UD.stats) return '';
  var st = UD.stats;
  var bars = [
    { label: 'Matches', val: st.matches||0, max: 100, color: '#4d96ff' },
    { label: 'Wins', val: st.wins||0, max: (st.matches||1), color: '#00ff9c' },
    { label: 'Kills', val: st.kills||0, max: 200, color: '#ff6b6b' },
    { label: 'Earned', val: st.earnings||0, max: 5000, color: '#ffd700' }
  ];
  var h = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px"><i class="fas fa-chart-bar" style="color:#4d96ff"></i> Stats Overview</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  bars.forEach(function(b) {
    var pct = Math.min(100, b.max > 0 ? (b.val / b.max * 100) : 0);
    h += '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--txt2)">' + b.label + '</span><span style="font-weight:700;color:' + b.color + '">' + b.val + '</span></div>';
    h += '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px"><div style="height:100%;width:' + pct + '%;background:' + b.color + ';border-radius:3px"></div></div></div>';
  });
  h += '</div>';
  var wr = st.matches > 0 ? Math.round((st.wins||0)/st.matches*100) : 0;
  h += '<div style="margin-top:10px;padding:8px;background:rgba(0,255,106,.06);border-radius:8px;text-align:center;font-size:12px">';
  h += '<span style="color:var(--txt2)">Win Rate: </span><strong style="color:var(--green)">' + wr + '%</strong> · ';
  h += '<span style="color:var(--txt2)">Avg Kill: </span><strong style="color:#ff6b6b">' + (st.matches > 0 ? ((st.kills||0)/st.matches).toFixed(1) : 0) + '</strong></div>';
  h += '</div>';
  return h;
};

/* ─── FEATURE 11: LUCKY DRAW ─── */
window.showLuckyDraw = function() {
  var uid = window.U.uid, UD = window.UD;
  db.ref('luckyDraw').once('value', function(s) {
    var draw = s.val() || {};
    var myEntries = (draw.entries && draw.entries[uid]) || 0;
    var totalEntries = 0;
    if (draw.entries) Object.values(draw.entries).forEach(function(e){totalEntries+=e;});
    var h = '<div style="padding:8px;text-align:center">';
    h += '<div style="font-size:36px;margin-bottom:8px">🎰</div>';
    h += '<div style="font-weight:800;font-size:18px;color:var(--primary);margin-bottom:4px">Lucky Draw</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Prize Pool: <strong style="color:#ffd700">₹' + (draw.prizePool||500) + '</strong></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">';
    h += '<div style="padding:12px;background:var(--card2);border-radius:10px"><div style="font-size:22px;font-weight:900;color:var(--primary)">' + myEntries + '</div><div style="font-size:11px;color:var(--txt2)">My Entries</div></div>';
    h += '<div style="padding:12px;background:var(--card2);border-radius:10px"><div style="font-size:22px;font-weight:900">' + totalEntries + '</div><div style="font-size:11px;color:var(--txt2)">Total Entries</div></div></div>';
    h += '<button onclick="window._buyDrawEntry()" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#b964ff,#6400ff);color:#fff;font-weight:900;border:none;cursor:pointer;font-size:14px">🪙 50 Coins — Buy Entry</button>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:8px">Draw: ' + (draw.drawDate || 'Every Sunday') + '</div>';
    h += '</div>';
    if (window.showModal) showModal('🎰 Lucky Draw', h);
  });
};

window._buyDrawEntry = function() {
  var uid = window.U.uid, UD = window.UD;
  if ((UD.coins||0) < 50) { _toast('Coins kam hain! (50 chahiye)', 'err'); return; }
  db.ref('users/' + uid + '/coins').transaction(function(c){return Math.max(0,(c||0)-50);});
  db.ref('luckyDraw/entries/' + uid).transaction(function(v){return (v||0)+1;});
  _toast('✅ Lucky Draw entry buy ki! Good luck! 🍀');
  if(window.closeModal) closeModal();
};

/* ─── FEATURE 12: PLAYER PROFILE BIO/STATUS ─── */
window.showSetBio = function() {
  var UD = window.UD;
  var h = '<div style="padding:8px">';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Apna gaming status set karo (60 chars max)</div>';
  h += '<input type="text" id="bioInput" maxlength="60" placeholder="e.g. Headshots only 🎯" value="' + (UD.bio||'') + '" style="width:100%;padding:12px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:14px;box-sizing:border-box">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">';
  ['Headshots only 🎯','Top Fragger 💀','Clutch King 👑','Rush or Die 🔥','Solo Carry 💪','Squad Goals 🤝'].forEach(function(s){
    h += '<div onclick="document.getElementById(\'bioInput\').value=\'' + s + '\'" style="padding:8px;border-radius:8px;background:var(--card2);border:1px solid var(--border);font-size:11px;cursor:pointer;text-align:center">' + s + '</div>';
  });
  h += '</div>';
  h += '<button onclick="window._saveBio()" style="width:100%;margin-top:14px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer;font-size:14px">Save Bio</button>';
  h += '</div>';
  if (window.showModal) showModal('✏️ Set Bio', h);
};

window._saveBio = function() {
  var val = (_$('bioInput') || {}).value || '';
  db.ref('users/' + window.U.uid + '/bio').set(val);
  db.ref('users/' + window.U.uid).once('value', function(s){window.UD=s.val();});
  _toast('✅ Bio saved!');
  if(window.closeModal) closeModal();
  setTimeout(function(){if(window.renderProfile)renderProfile();}, 500);
};

/* ─── FEATURE 13: TOURNAMENT BRACKET VIEWER ─── */
window.showTournamentBracket = function(matchId) {
  var t = window.MT && window.MT[matchId]; if (!t) return;
  db.ref('joinRequests').orderByChild('matchId').equalTo(matchId).once('value', function(s) {
    var players = [];
    if (s.exists()) s.forEach(function(c) {
      var d = c.val();
      if (d.status === 'joined' && !d.isTeamMember) players.push(d.userName || 'Player');
    });
    var h = '<div style="padding:8px;text-align:center">';
    h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px">' + (t.name||'Match') + ' — ' + players.length + ' Players Joined</div>';
    if (!players.length) { h += '<p style="color:var(--txt2)">Abhi koi join nahi hua</p></div>'; }
    else {
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      players.forEach(function(p, i) {
        h += '<div style="padding:8px 10px;border-radius:8px;background:var(--card2);border:1px solid var(--border);font-size:12px;display:flex;align-items:center;gap:6px"><span style="color:var(--txt2);font-size:10px">#' + (i+1) + '</span><span>' + p + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    if (window.showModal) showModal('🏆 Match Roster', h);
  });
};

/* ─── FEATURE 14: KILL PROOF UPLOAD ─── */
window.showKillProof = function(matchId) {
  var uid = window.U.uid;
  var h = '<div style="padding:8px">';
  h += '<p style="font-size:13px;color:var(--txt2);margin-bottom:14px">Kill proof screenshot upload karo dispute ke liye</p>';
  h += '<div onclick="document.getElementById(\'kpFile\').click()" style="border:2px dashed var(--border);border-radius:12px;padding:30px;text-align:center;cursor:pointer;background:var(--card2)">';
  h += '<i class="fas fa-cloud-upload-alt" style="font-size:28px;color:var(--txt2);display:block;margin-bottom:8px"></i>';
  h += '<span style="font-size:13px;color:var(--txt2)">Tap to upload</span>';
  h += '<input type="file" id="kpFile" accept="image/*" style="display:none" onchange="window._uploadKP(this,\'' + matchId + '\')">';
  h += '</div><img id="kpPreview" style="display:none;width:100%;border-radius:10px;margin-top:10px">';
  h += '<button onclick="window._submitKP(\'' + matchId + '\')" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Submit Proof</button>';
  h += '</div>';
  if (window.showModal) showModal('📸 Kill Proof', h);
};
window._kpData = '';
window._uploadKP = function(input, mid) {
  var file = input.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    window._kpData = e.target.result;
    var img = _$('kpPreview'); if (img) { img.src = window._kpData; img.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
};
window._submitKP = function(mid) {
  if (!window._kpData) { _toast('Screenshot select karo!', 'err'); return; }
  db.ref('killProofs/' + window.U.uid + '/' + mid).set({
    screenshot: window._kpData, matchId: mid, userId: window.U.uid,
    userName: window.UD.ign || '', createdAt: Date.now(), status: 'pending'
  });
  _toast('✅ Kill proof submitted! Admin verify karega.');
  window._kpData = '';
  if(window.closeModal) closeModal();
};

/* ─── FEATURE 15: RESULT SHARE CARD ─── */
window.shareResultCard = function(matchName, rank, kills, prize) {
  var UD = window.UD;
  var canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 220;
  var ctx = canvas.getContext('2d');
  var grd = ctx.createLinearGradient(0,0,400,220);
  grd.addColorStop(0,'#0a0a0f'); grd.addColorStop(1,'#1a1a2e');
  ctx.fillStyle = grd; ctx.fillRect(0,0,400,220);
  ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 22px Arial';
  ctx.fillText('Mini eSports', 20, 36);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial';
  ctx.fillText(matchName || 'Tournament Result', 20, 68);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 48px Arial';
  ctx.fillText('#' + (rank||1), 20, 140);
  ctx.fillStyle = '#aaa'; ctx.font = '14px Arial';
  ctx.fillText('Rank', 20, 160);
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 36px Arial';
  ctx.fillText((kills||0) + '💀', 130, 140);
  ctx.fillStyle = '#aaa'; ctx.font = '14px Arial';
  ctx.fillText('Kills', 130, 160);
  ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 36px Arial';
  ctx.fillText('₹' + (prize||0), 250, 140);
  ctx.fillStyle = '#aaa'; ctx.font = '14px Arial';
  ctx.fillText('Won', 250, 160);
  ctx.fillStyle = '#555'; ctx.font = '12px Arial';
  ctx.fillText((UD ? UD.ign : '') + ' | mini-esports.app', 20, 200);
  var url = canvas.toDataURL();
  var a = document.createElement('a');
  a.href = url; a.download = 'result-card.png'; a.click();
  _toast('🖼️ Result card download ho rahi hai!');
};

/* ─── FEATURE 16: SEASONAL CHAMPIONSHIP ─── */
window.showSeasonStats = function() {
  var uid = window.U.uid;
  db.ref('season').once('value', function(s) {
    var season = s.val() || { name: 'Season 1', endDate: null };
    db.ref('seasonStats/' + uid).once('value', function(ss) {
      var st = ss.val() || { points: 0, rank: '—' };
      var h = '<div style="padding:8px;text-align:center">';
      h += '<div style="font-size:24px;font-weight:900;color:var(--primary);margin-bottom:4px">' + (season.name||'Season 1') + '</div>';
      h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Ek season mein sabse zyada points jito!</div>';
      h += '<div style="font-size:48px;font-weight:900;color:#ffd700">' + (st.points||0) + '</div>';
      h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Season Points</div>';
      h += '<div style="padding:12px;background:var(--card2);border-radius:12px;font-size:13px">';
      h += '<div>🏆 Win = +50 pts | 💀 Kill = +5 pts | 🎮 Match = +10 pts</div></div>';
      if (season.endDate) h += '<div style="margin-top:10px;font-size:11px;color:var(--txt2)">Season ends: ' + new Date(season.endDate).toLocaleDateString() + '</div>';
      h += '</div>';
      if (window.showModal) showModal('🏆 Season Championship', h);
    });
  });
};

/* ─── FEATURE 17: MATCH LIVE FEED / WATCHMODE ─── */
window.showMatchFeed = function(matchId) {
  var t = window.MT && window.MT[matchId];
  db.ref('matchFeed/' + matchId).limitToLast(10).once('value', function(s) {
    var events = [];
    if (s.exists()) s.forEach(function(c){events.unshift(c.val());});
    var h = '<div style="padding:4px 0">';
    if (!events.length) h += '<div style="text-align:center;padding:30px;color:var(--txt2)">Live feed match start hone par dikhe ga</div>';
    events.forEach(function(e) {
      var icon = e.type === 'kill' ? '💀' : e.type === 'elim' ? '🔴' : '📢';
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border)">';
      h += '<span style="font-size:18px">' + icon + '</span>';
      h += '<div><div style="font-size:13px;font-weight:600">' + (e.text||'Event') + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">' + new Date(e.ts||Date.now()).toLocaleTimeString() + '</div></div>';
      h += '</div>';
    });
    h += '</div>';
    if (window.showModal) showModal('📡 Live Feed', h);
  });
};

/* ─── FEATURE 18: ONBOARDING FIRST TUTORIAL ─── */
window.checkShowTutorial = function() {
  if (localStorage.getItem('tutorialSeen')) return;
  setTimeout(function() {
    var steps = [
      { title: '👋 Welcome to Mini eSports!', body: 'India ka best Free Fire tournament platform!' },
      { title: '🎮 Matches Join Karo', body: 'Home screen pe matches dekhao, entry fee bharo aur join karo.' },
      { title: '💰 Wallet', body: 'UPI se paise add karo aur jeetne par direct bank mein lo.' },
      { title: '👥 Team Mode', body: 'Profile mein Duo/Squad partner set karo aur ek saath khelo.' },
      { title: '🏆 Rank karo!', body: 'Matches jeeto, kills lo aur leaderboard pe aao. Good luck!' }
    ];
    var cur = 0;
    function showStep() {
      var s = steps[cur];
      var h = '<div style="text-align:center;padding:10px">';
      h += '<div style="font-size:48px;margin-bottom:12px">' + s.title.split(' ')[0] + '</div>';
      h += '<div style="font-size:18px;font-weight:800;margin-bottom:8px">' + s.title.slice(s.title.indexOf(' ')+1) + '</div>';
      h += '<div style="font-size:14px;color:var(--txt2);margin-bottom:20px">' + s.body + '</div>';
      h += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px">';
      steps.forEach(function(_,i){h+='<div style="width:8px;height:8px;border-radius:50%;background:'+(i===cur?'var(--primary)':'rgba(255,255,255,.2)')+'"></div>';});
      h += '</div>';
      if (cur < steps.length - 1) {
        h += '<button onclick="window._tutNext()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Next →</button>';
      } else {
        h += '<button onclick="window._tutDone()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,var(--primary),#00cc7a);color:#000;font-weight:800;border:none;cursor:pointer">🎮 Let\'s Play!</button>';
      }
      h += '</div>';
      if (window.showModal) showModal('', h);
    }
    window._tutNext = function() { cur++; showStep(); };
    window._tutDone = function() { localStorage.setItem('tutorialSeen','1'); if(window.closeModal)closeModal(); };
    showStep();
  }, 1500);
};

/* ─── FEATURE 19: QUICK STATS HOME WIDGET ─── */
window.renderHomeWidget = function() {
  var UD = window.UD; if (!UD) return '';
  var st = UD.stats || {};
  var coins = UD.coins || 0;
  var rm = UD.realMoney || {};
  var total = (rm.deposited||0) + (rm.winnings||0) + (rm.bonus||0);
  var streak = getStreakInfo ? getStreakInfo() : null;
  var h = '<div style="background:linear-gradient(135deg,rgba(0,255,156,.06),rgba(0,212,255,.04));border:1px solid rgba(0,255,156,.15);border-radius:16px;padding:14px 16px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<span style="font-size:13px;font-weight:700"><i class="fas fa-fire" style="color:#ff6b6b"></i> Today\'s Dashboard</span>';
  if (streak) h += '<span style="font-size:11px;font-weight:700;color:' + streak.color + '">' + streak.emoji + ' ' + streak.label + '</span>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
  [['🎮', st.matches||0, 'Played'],['🏆', st.wins||0, 'Wins'],['💀', st.kills||0, 'Kills'],['💰', '₹'+total, 'Balance']].forEach(function(d) {
    h += '<div style="text-align:center"><div style="font-size:18px">' + d[0] + '</div><div style="font-size:14px;font-weight:800">' + d[1] + '</div><div style="font-size:10px;color:var(--txt2)">' + d[2] + '</div></div>';
  });
  h += '</div></div>';
  return h;
};

/* ─── FEATURE 20: MATCH ALERT SYSTEM ─── */
window.setupMatchAlerts = function() {
  if (!window.MT || !window.db) return;
  Object.keys(window.MT).forEach(function(mid) {
    var t = window.MT[mid];
    if (!t.matchTime) return;
    var ms = Number(t.matchTime) - Date.now() - 300000; // 5 min before
    if (ms > 0 && ms < 3600000) { // Only within 1 hour
      setTimeout(function() {
        if (window.JR) {
          for (var k in window.JR) {
            if (window.JR[k].matchId === mid) {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⚡ Match Starting!', { body: (t.name||'Your match') + ' 5 minutes mein start hoga!' });
              } else {
                if (window.pushLocalNotif) pushLocalNotif('match_alert', '⚡ Match Starting!', (t.name||'Match') + ' 5 min mein!', mid, 'match_alert_'+mid);
              }
              break;
            }
          }
        }
      }, ms);
    }
  });
};

/* ─── FEATURE 21: WALLET STATS ─── */
window.renderWalletStats = function() {
  var UD = window.UD; if (!UD) return '';
  var wh = window.WH || [];
  var deps = wh.filter(function(w){return w.type==='deposit' && (w.status==='approved'||w.status==='done');});
  var wds = wh.filter(function(w){return w.type==='withdraw' && (w.status==='approved'||w.status==='done');});
  var totalDep = deps.reduce(function(s,w){return s+(w.amount||0);},0);
  var totalWd = wds.reduce(function(s,w){return s+(w.amount||0);},0);
  var h = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">';
  [['📥 Deposits', deps.length, 'Total: ₹'+totalDep],['📤 Withdrawals', wds.length, 'Total: ₹'+totalWd],['🏆 Winnings', '₹'+((UD.realMoney||{}).winnings||0), 'Earned']].forEach(function(d){
    h += '<div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--txt2);margin-bottom:4px">' + d[0] + '</div><div style="font-size:18px;font-weight:800">' + d[1] + '</div><div style="font-size:10px;color:var(--txt2)">' + d[2] + '</div></div>';
  });
  h += '</div>';
  return h;
};

/* ─── FEATURE 22: PARTNER RATING SYSTEM ─── */
window.ratePartner = function(partnerUid, matchId) {
  var h = '<div style="padding:8px;text-align:center">';
  h += '<div style="font-size:16px;font-weight:700;margin-bottom:16px">Partner ko rate karo</div>';
  h += '<div id="starRating" style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">';
  for (var i = 1; i <= 5; i++) {
    h += '<span onclick="window._setStar(' + i + ')" style="font-size:36px;cursor:pointer" data-star="' + i + '">⭐</span>';
  }
  h += '</div>';
  h += '<textarea id="rateNote" placeholder="Optional feedback..." style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;resize:none;height:70px;box-sizing:border-box"></textarea>';
  h += '<button onclick="window._submitRating(\'' + partnerUid + '\',\'' + matchId + '\')" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Submit Rating</button>';
  h += '</div>';
  window._starVal = 5;
  if (window.showModal) showModal('⭐ Rate Partner', h);
};
window._setStar = function(n) {
  window._starVal = n;
  document.querySelectorAll('[data-star]').forEach(function(el) {
    el.style.opacity = parseInt(el.dataset.star) <= n ? '1' : '0.3';
  });
};
window._submitRating = function(uid, mid) {
  db.ref('partnerRatings/' + uid + '/' + mid).set({
    rating: window._starVal||5, note: (_$('rateNote')||{}).value||'',
    raterUid: window.U.uid, matchId: mid, createdAt: Date.now()
  });
  db.ref('users/' + uid + '/avgRating').transaction(function(v){ return ((v||5)*0.8 + (window._starVal||5)*0.2); });
  _toast('✅ Rating submit hua!');
  if(window.closeModal) closeModal();
};

/* ─── FEATURE 23: PUSH NOTIFICATION REGISTER ─── */
window.enablePushNotifs = function() {
  if (!('Notification' in window)) { _toast('Browser support nahi karta', 'err'); return; }
  Notification.requestPermission().then(function(p) {
    if (p === 'granted') {
      _toast('✅ Push notifications enabled!');
      db.ref('users/' + window.U.uid + '/pushEnabled').set(true);
    } else {
      _toast('Notifications block hain — browser settings check karo', 'err');
    }
  });
};

/* ─── FEATURE 24: ACHIEVEMENT DETAILS ─── */
window.showAchievements = function() {
  var UD = window.UD; if (!UD) return;
  var st = UD.stats || {};
  var achievements = [
    { id: 'first_win', title: 'First Blood 🩸', desc: 'Pehli jeet!', earned: (st.wins||0) >= 1, icon: '🏆' },
    { id: 'five_wins', title: 'High Flyer 🚀', desc: '5 matches jeete', earned: (st.wins||0) >= 5, icon: '🚀' },
    { id: 'kill_machine', title: 'Kill Machine 💀', desc: '50 kills total', earned: (st.kills||0) >= 50, icon: '💀' },
    { id: 'earner', title: 'Money Maker 💰', desc: '₹100 kamaaya', earned: (st.earnings||0) >= 100, icon: '💰' },
    { id: 'veteran', title: 'Veteran 🎖️', desc: '25 matches played', earned: (st.matches||0) >= 25, icon: '🎖️' },
    { id: 'rich', title: 'High Roller 💎', desc: '₹500 total deposit', earned: ((UD.realMoney||{}).deposited||0) >= 500, icon: '💎' },
    { id: 'referrer', title: 'Influencer 🌟', desc: '5 friends refer kiye', earned: (UD.referralCount||0) >= 5, icon: '🌟' },
    { id: 'loyal', title: 'Daily Player 🔥', desc: '7 day login streak', earned: (UD.loginStreak||0) >= 7, icon: '🔥' },
  ];
  var earned = achievements.filter(function(a){return a.earned;}).length;
  var h = '<div><div style="text-align:center;margin-bottom:14px"><span style="font-size:24px;font-weight:900;color:var(--primary)">' + earned + '/' + achievements.length + '</span><div style="font-size:12px;color:var(--txt2)">Achievements Unlocked</div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  achievements.forEach(function(a) {
    h += '<div style="padding:12px;border-radius:12px;background:' + (a.earned ? 'rgba(0,255,156,.08)' : 'rgba(255,255,255,.03)') + ';border:1px solid ' + (a.earned ? 'rgba(0,255,156,.2)' : 'var(--border)') + ';opacity:' + (a.earned ? '1' : '.5') + '">';
    h += '<div style="font-size:24px;margin-bottom:4px">' + a.icon + '</div>';
    h += '<div style="font-size:12px;font-weight:700">' + a.title + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2)">' + a.desc + '</div>';
    if (a.earned) h += '<div style="font-size:10px;color:var(--green);margin-top:4px">✅ Earned</div>';
    h += '</div>';
  });
  h += '</div></div>';
  if (window.showModal) showModal('🏅 Achievements', h);
};

/* ─── FEATURE 25: SMART MATCH RECOMMENDATION ─── */
window.getRecommendedMatch = function() {
  var UD = window.UD, MT = window.MT;
  if (!UD || !MT) return null;
  var dep = (UD.realMoney && UD.realMoney.deposited) ? Number(UD.realMoney.deposited) : 0;
  var budget = dep > 0 ? Math.min(dep * 0.1, 100) : 10;
  var best = null, bestScore = -1;
  var tp = UD.duoTeam ? 'duo' : 'solo';
  Object.values(MT).forEach(function(t) {
    if (!t || !t.id) return;
    if (window.hasJ && hasJ(t.id)) return;
    var fee = Number(t.entryFee) || 0;
    if (fee > budget) return;
    var slots = Number(t.joinedSlots||0), max = Number(t.maxSlots||1);
    var fill = slots / max;
    if (fill >= 1) return;
    var score = (t.prizePool||0) - fee * 2 + (fill > 0.3 ? 10 : 0);
    if ((t.mode||t.type||'').toLowerCase() === tp) score += 20;
    if (score > bestScore) { bestScore = score; best = t; }
  });
  return best;
};

/* ─── AUTO INIT ─── */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (window.checkDailyBonus) checkDailyBonus();
    if (window.checkShowTutorial) checkShowTutorial();
    if (window.setupMatchAlerts) setupMatchAlerts();
  }, 3000);
});

console.log('[Mini eSports] ✅ 25 User Features loaded');
})();
