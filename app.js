/* ====== FIREBASE INIT ====== */
firebase.initializeApp({
  apiKey:"AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec",
  authDomain:"fft-app-1e283.firebaseapp.com",
  databaseURL:"https://fft-app-1e283-default-rtdb.firebaseio.com",
  projectId:"fft-app-1e283",
  storageBucket:"fft-app-1e283.firebasestorage.app",
  messagingSenderId:"247829466483",
  appId:"1:247829466483:web:6961488f1d3c4e3fff4906"
});

var auth = firebase.auth(), db = firebase.database(), gp = new firebase.auth.GoogleAuthProvider();
var U = null, UD = null, MT = {}, JR = {}, NOTIFS = [], PAY = {}, WH = [], REFS = [];
var curScr = 'home', prevScr = 'home', hSF = 'upcoming', hCF = 'paid', mmSF = 'upcoming', spType = 'weekly', cdInt = null;
var prevMTKeys = {}, partnerCache = {}, wfStep = 0, wfAmt = 0, wfScreenshot = '';

/* ====== HELPERS ====== */
function $(id) { return document.getElementById(id); }

function toast(msg, type) {
  var w = $('toast-wrap'); if (!w) return;
  var d = document.createElement('div');
  d.className = 'toast-item t' + (type || 'ok');
  var ic = type === 'err' ? 'exclamation-circle' : type === 'inf' ? 'info-circle' : 'check-circle';
  d.innerHTML = '<i class="fas fa-' + ic + '"></i>' + msg;
  w.appendChild(d);
  setTimeout(function() { d.remove(); }, 3500);
}

function timeAgo(ts) {
  if (!ts) return '';
  var d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return Math.floor(d / 86400000) + 'd ago';
}

function fmtTime(mt) {
  if (!mt) return 'Time Not Announced';
  var ts = Number(mt);
  if (isNaN(ts) || ts <= 0) return 'Time Not Announced';
  var now = Date.now(), diff = ts - now;
  // Match time has passed
  if (diff <= 0) {
    var elapsed = now - ts;
    if (elapsed < 3600000) return 'Live Now'; // within 1 hour after start
    return 'Match Ended';
  }
  // Within 5 minutes — going live soon
  if (diff <= 300000) {
    var mins = Math.ceil(diff / 60000);
    return 'Starting in ' + mins + ' min!';
  }
  // Within 24 hours
  if (diff < 86400000) {
    var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    return 'Starts in: ' + h + 'h ' + m + 'm';
  }
  // More than 24 hours — show full date
  var d = new Date(ts);
  var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var hr = d.getHours(), ap = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return d.getDate().toString().padStart(2, '0') + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hr.toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ' ' + ap;
}

function titleCase(s) {
  if (!s) return '';
  return s.replace(/\w\S*/g, function(t) { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase(); });
}

function copyTxt(t) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t).then(function() { toast('Copied!', 'ok'); }).catch(function() { fbCopy(t); });
  } else { fbCopy(t); }
}
function fbCopy(t) {
  var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Copied!', 'ok'); } catch (e) { toast('Copy failed', 'err'); }
  document.body.removeChild(ta);
}

/* ====== SMART MATCH STATUS ====== */
/* Rules (STRICT — recalculated FRESH on every call):
   - Admin terminal states ALWAYS win (cancelled/completed/finished/ended/done)
   - Time-based automatic transitions:
     * Upcoming: now < matchTime - 5 minutes
     * Live: matchTime - 5min <= now < matchTime + 20min
     * Completed: now >= matchTime + 20 minutes (auto on UI)
   - Room ID release does NOT change status
   - 5 min early = players can see room & prepare
   - 20 min after = match auto-completes on UI
   - If Admin updates matchTime, status recalculates based on NEW time
   - Match status NEVER jumps to completed before 20 min past start
*/
function effSt(t) {
  if (!t) return 'upcoming';
  var st = (t.status || '').toString().toLowerCase().trim();

  // Admin-controlled terminal states (HIGHEST PRIORITY — stop calculation)
  if (st === 'cancelled' || st === 'canceled') return 'cancelled';
  if (st === 'completed' || st === 'finished' || st === 'ended' || st === 'done') return 'completed';

  // Time-based automatic logic (recalculated FRESH every call)
  var mt = Number(t.matchTime);
  if (!mt || mt <= 0) return 'upcoming';

  var now = Date.now();
  var liveStartTime = mt - 300000;   // 5 minutes BEFORE match time
  var autoEndTime = mt + 1200000;    // 20 minutes AFTER match time

  // STRICT: Status based ONLY on current time vs match time
  if (now < liveStartTime) return 'upcoming';
  if (now >= liveStartTime && now < autoEndTime) return 'live';
  if (now >= autoEndTime) return 'completed';

  return 'upcoming';
}

/* ====== SMART DUO/SQUAD JOIN HELPER ====== */
/* Checks if user has a saved partner for duo/squad.
   Returns the saved team data or null.
   Priority: Firebase profile > localStorage */
function getSavedTeam(mode) {
  if (!UD) return null;
  if (mode === 'duo') {
    // Priority 1: duoTeam object
    var duoT = UD.duoTeam;
    if (duoT && duoT.memberUid) return { partners: [duoT] };
    // Priority 2: partnerUid field (quick lookup)
    if (UD.partnerUid) return { partners: [{ memberUid: UD.partnerUid, memberName: 'Linked Partner' }] };
    // Priority 3: localStorage fallback
    try {
      var saved = JSON.parse(localStorage.getItem('lastDuoPartner'));
      if (saved && saved.uid) return { partners: [{ memberUid: saved.uid, memberName: saved.name || 'Partner' }] };
    } catch(e) {}
  }
  if (mode === 'squad') {
    var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
    if (sqMembers.length > 0) return { partners: sqMembers.map(function(m) { return { memberUid: m.uid, memberName: m.name }; }) };
    try {
      var saved = JSON.parse(localStorage.getItem('lastSquadPartners'));
      if (saved && saved.length) return { partners: saved.map(function(m) { return { memberUid: m.uid, memberName: m.name }; }) };
    } catch(e) {}
  }
  return null;
}

/* Validate saved partners in background before allowing join */
function validateSavedPartners(partners, callback) {
  var validated = [];
  var pending = partners.length;
  if (pending === 0) { callback([]); return; }
  partners.forEach(function(p, idx) {
    if (!p.memberUid) { pending--; if (pending === 0) callback(validated); return; }
    db.ref('users').orderByChild('ffUid').equalTo(p.memberUid).once('value', function(s) {
      if (s.exists()) {
        var found = null;
        s.forEach(function(c) { found = c.val(); });
        validated.push({
          index: idx,
          uid: p.memberUid,
          name: found ? (found.ign || found.displayName || p.memberName) : p.memberName,
          data: found,
          valid: true
        });
      } else {
        validated.push({ index: idx, uid: p.memberUid, name: p.memberName, valid: false });
      }
      pending--;
      if (pending === 0) callback(validated);
    });
  });
}

/* ====== AUTO-FILL SAVED TEAM HELPER ====== */
/* After join modal renders, auto-fill partner fields from saved team data
   Priority: 1) Saved team in Firebase profile, 2) Last used team in localStorage */
function autoFillSavedTeam(mode) {
  if (!UD) return;
  
  if (mode === 'duo') {
    var duoT = UD.duoTeam;
    /* Fallback to localStorage if no saved team in profile */
    if (!duoT || !duoT.memberUid) {
      try {
        var saved = JSON.parse(localStorage.getItem('lastDuoPartner'));
        if (saved && saved.uid) duoT = { memberUid: saved.uid, memberName: saved.name || 'Partner' };
      } catch(e) {}
    }
    if (duoT && duoT.memberUid) {
      var inp = $('partnerUid1');
      if (inp) {
        inp.value = duoT.memberUid;
        var nm = $('partnerName1');
        if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ Auto-filled: ' + (duoT.memberName || 'Partner') + '</span>';
        valPartner(1);
      }
    }
  }
  
  if (mode === 'squad') {
    var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
    /* Fallback to localStorage */
    if (!sqMembers.length) {
      try {
        var saved = JSON.parse(localStorage.getItem('lastSquadPartners'));
        if (saved && saved.length) sqMembers = saved;
      } catch(e) {}
    }
    for (var i = 0; i < Math.min(sqMembers.length, 3); i++) {
      var inp = $('partnerUid' + (i + 1));
      if (inp && sqMembers[i] && sqMembers[i].uid) {
        inp.value = sqMembers[i].uid;
        var nm = $('partnerName' + (i + 1));
        if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ Auto-filled: ' + (sqMembers[i].name || 'Partner') + '</span>';
        valPartner(i + 1);
      }
    }
  }
  
  console.log('[Mini eSports] ✅ Auto-fill team complete for mode: ' + mode);
}

/* ====== 1-HOUR STATUS (Alternate — used where needed) ====== */
function getMatchStatus(matchTime) {
  var now = Date.now();
  var startTime = Number(matchTime);
  if (!startTime || startTime <= 0) return 'upcoming';
  var endTime = startTime + 3600000; // 1 hour = 60 * 60 * 1000
  if (now < startTime) return 'upcoming';
  if (now >= startTime && now < endTime) return 'live';
  return 'completed';
}

/* ====== SHARE APP FUNCTION ====== */
function shareApp() {
  var refCode = (UD && UD.referralCode) ? UD.referralCode : (U ? U.uid.substring(0, 8).toUpperCase() : '');
  var text = '🎮 Join me on Mini eSports and win REAL CASH in Free Fire tournaments! 🔥\n\n💰 Play matches, win prizes!\n🪙 Use my referral code: ' + refCode + ' to get bonus coins!\n\n👇 Download now:';
  var url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Win Real Cash!', text: text, url: url }).catch(function(err) {
      if (err.name !== 'AbortError') {
        copyTxt(text + '\n' + url);
        toast('Invite link copied!', 'ok');
      }
    });
  } else {
    copyTxt(text + '\n' + url);
    toast('Invite link copied to clipboard!', 'ok');
  }
}

/* ====== SHARE MATCH FUNCTION ====== */
function shareMatch(id) {
  var t = MT[id]; if (!t) return;
  var isCoin = ((t.entryType || '').toLowerCase() === 'coin' || Number(t.entryFee) === 0);
  var entryText = isCoin ? '🪙 ' + (t.entryFee || 0) + ' Coins' : '₹' + (t.entryFee || 0);
  var refCode = (UD && UD.referralCode) ? UD.referralCode : '';
  var text = '🎮 Join "' + (t.name || 'Match') + '" on Mini eSports!\n\n💰 Prize Pool: ₹' + (t.prizePool || 0) + '\n🎯 Entry Fee: ' + entryText + '\n🗺️ Map: ' + titleCase(t.map || 'Unknown') + '\n⏰ ' + fmtTime(t.matchTime);
  if (refCode) text += '\n\n🎁 Use code ' + refCode + ' for bonus coins!';
  var url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: t.name || 'Mini eSports Match', text: text, url: url }).catch(function(err) {
      if (err.name !== 'AbortError') {
        copyTxt(text + '\n\n' + url);
        toast('Match details copied!', 'ok');
      }
    });
  } else {
    copyTxt(text + '\n\n' + url);
    toast('Match details copied!', 'ok');
  }
}

/* ====== ACCESS CONTROL ====== */
function isOk() { return UD && UD.profileStatus === 'approved'; }
function isVO() { return !UD || UD.profileStatus !== 'approved'; }
function hasJ(mid) {
  for (var k in JR) {
    if (JR[k].matchId === mid) return true;
  }
  return false;
}
function getJoinRole(mid) {
  for (var k in JR) {
    var jr = JR[k]; if (jr.matchId !== mid) continue;
    if (jr.isTeamMember && jr.captainUid) return 'member';
    if (jr.captainUid === undefined || jr.captainUid === null) return 'captain';
  }
  return null;
}
function getMoneyBal() {
  if (!UD) return 0;
  var rm = UD.realMoney || { deposited: 0, winnings: 0, bonus: 0 };
  return Math.max(Number(rm.deposited) || 0, 0) + Math.max(Number(rm.winnings) || 0, 0) + Math.max(Number(rm.bonus) || 0, 0);
}

/* ====== BACK BUTTON (ENHANCED) ====== */
/* Push state on load so first back press doesn't exit */
history.pushState(null, null, null);
window.addEventListener('popstate', function(e) {
  /* ALWAYS prevent default browser back behavior */
  e.preventDefault();
  /* Re-push state so we never run out of history entries */
  history.pushState(null, null, null);
  /* Handle what to close/navigate */
  goBack();
});

function goBack() {
  /* Priority 1: Close Room ID Popup */
  var rp = $('rpContainer');
  if (rp && rp.children.length > 0) { rp.innerHTML = ''; return; }
  /* Priority 2: Close any open modal */
  var mo = $('modalOv');
  if (mo && mo.classList.contains('show')) { closeModal(); return; }
  /* Priority 3: Close wallet flow (back to wallet main) */
  var wf = $('walletFlow');
  if (wf && wf.style.display !== 'none' && wf.style.display !== '') { cancelWF(); return; }
  /* Priority 4: Navigate back from sub-screens */
  if (curScr === 'notif' || curScr === 'chat') { navTo(prevScr || 'home'); return; }
  /* Priority 5: Navigate to home from any other screen */
  if (curScr !== 'home') { navTo('home'); return; }
  /* Priority 6: Already on home — re-push state to prevent exit */
  history.pushState(null, null, null);
}

/* ====== NAVIGATION ====== */
function navTo(scr) {
  if (scr === curScr && scr !== 'notif' && scr !== 'chat') return;
  prevScr = curScr; curScr = scr;
  history.pushState(null, null, null);
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var el = $('scr' + scr.charAt(0).toUpperCase() + scr.slice(1));
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.toggle('active', n.dataset.nav === scr); });
  if (scr === 'rank') renderRank();
  if (scr === 'profile') renderProfile();
  if (scr === 'chat') startChat();
  if (scr === 'wallet') renderWallet();
  if (scr === 'notif') renderNotifs();
}
function setST(w, v) {
  if (w === 'home') {
    hSF = v;
    document.querySelectorAll('#homeST .s-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.st === v); });
    renderHome();
  } else {
    mmSF = v;
    document.querySelectorAll('#mmST .s-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.st === v); });
    renderMM();
  }
}
function setCat(v) {
  hCF = v;
  document.querySelectorAll('#homeCat .c-pill').forEach(function(p) { p.classList.toggle('active', p.dataset.cat === v); });
  renderHome();
}

/* ====== MODAL ====== */
function openModal(title, html) {
  history.pushState(null, null, null);
  $('modalT').textContent = title; $('modalB').innerHTML = html; $('modalOv').classList.add('show');
}
function closeModal() { $('modalOv').classList.remove('show'); }

/* ====== STATE BANNER ====== */
function applyState() {
  var b = $('stateBanner'); if (!b) return;
  if (!UD) { b.style.display = 'none'; return; }
  if (UD.profileStatus === 'approved') {
    b.style.display = 'none';
  } else if (UD.profileStatus === 'pending') {
    b.className = 'state-banner yellow';
    b.innerHTML = '<i class="fas fa-clock"></i> Profile verification pending. App is in view-only mode until admin approval.';
    b.style.display = 'flex';
  } else {
    b.className = 'state-banner blue';
    b.innerHTML = '<i class="fas fa-info-circle"></i> Complete your profile to participate. <a onclick="navTo(\'profile\')">Go to Profile →</a>';
    b.style.display = 'flex';
  }
}

/* ====== GOOGLE LOGIN ====== */
function doGoogleLogin() {
  var btn = $('googleBtn'); btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
  auth.signInWithPopup(gp).catch(function(err) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google';
    if (err.code === 'auth/popup-closed-by-user') toast('Login cancelled', 'inf');
    else if (err.code === 'auth/popup-blocked') toast('Popup blocked! Allow popups.', 'err');
    else if (err.code === 'auth/network-request-failed') toast('Network error', 'err');
    else toast(err.message, 'err');
  });
}
function doLogout() {
  auth.signOut(); UD = null; U = null; MT = {}; JR = {}; NOTIFS = []; WH = []; REFS = [];
  $('header').style.display = 'none'; $('bottomNav').style.display = 'none';
  $('mainContent').style.display = 'none'; $('loginScreen').style.display = 'flex';
}

/* ====== AUTH STATE ====== */
auth.onAuthStateChanged(function(user) {
  if (user) {
    U = user; $('splash').style.display = 'none'; $('loginScreen').style.display = 'none'; afterLogin(user);
  } else {
    $('splash').style.display = 'none'; $('loginScreen').style.display = 'flex';
    $('header').style.display = 'none'; $('bottomNav').style.display = 'none'; $('mainContent').style.display = 'none';
  }
});

function afterLogin(user) {
  db.ref('users/' + user.uid).once('value').then(function(snap) {
    if (!snap.exists()) {
      var rc = user.uid.substring(0, 8).toUpperCase();
      db.ref('users/' + user.uid).set({
        uid: user.uid, email: user.email || '', displayName: user.displayName || '',
        profileStatus: 'not_requested', role: 'user', coins: 0,
        realMoney: { deposited: 0, winnings: 0, bonus: 0 },
        stats: { matches: 0, wins: 0, kills: 0, earnings: 0 },
        referralCode: rc, referralCount: 0, referralCoinsEarned: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (user.photoURL) db.ref('users/' + user.uid + '/profileImage').set(user.photoURL);
    } else {
      var d = snap.val();
      if (d.profileStatus === 'pending') {
        db.ref('profileRequests').orderByChild('uid').equalTo(user.uid).once('value', function(rs) {
          var real = false;
          if (rs.exists()) rs.forEach(function(c) { if (c.val().status === 'pending') real = true; });
          if (!real) db.ref('users/' + user.uid + '/profileStatus').set('not_requested');
        });
      }
    }
    boot();
  });
}

/* ====== BOOT - ALL REAL-TIME LISTENERS ====== */
function boot() {
  if (!U) return;
  $('header').style.display = ''; $('bottomNav').style.display = ''; $('mainContent').style.display = '';

  // L1: User Data
  db.ref('users/' + U.uid).on('value', function(s) {
    if (s.exists()) { UD = s.val(); updateHdr(); applyState(); renderHome(); renderProfile(); renderWallet(); }
  });

  // L2: matches/ node (PRIMARY)
  db.ref('matches').on('value', function(s) {
    for (var k in MT) if (MT[k]._src === 'matches') delete MT[k];
    if (s.exists()) {
      var cnt = 0, skip = 0;
      s.forEach(function(c) {
        var v = c.val(); if (!v) { skip++; return; }
        var st = (v.status || '').toString().toLowerCase().trim();
        var blocked = ['cancelled','canceled','cancel','deleted','removed','hidden','disabled','closed'];
        if (blocked.indexOf(st) !== -1) { skip++; return; }
        v.id = c.key; v._src = 'matches'; MT[c.key] = v; cnt++;
      });
      console.log('[Mini eSports] ✅ Loaded ' + cnt + ' matches from matches/ (blocked ' + skip + ')');
    } else { console.warn('[Mini eSports] ⚠️ matches/ node is EMPTY'); }
    detectChanges(); renderHome(); renderSP(); renderMM();
  });

  // L3: tournaments/ node (FALLBACK)
  db.ref('tournaments').on('value', function(s) {
    for (var k in MT) if (MT[k]._src === 'tournaments') delete MT[k];
    if (s.exists()) {
      var cnt = 0;
      s.forEach(function(c) {
        if (MT[c.key]) return;
        var v = c.val(); if (!v) return;
        var st = (v.status || '').toString().toLowerCase().trim();
        var blocked = ['cancelled','canceled','cancel','deleted','removed','hidden','disabled','closed'];
        if (blocked.indexOf(st) !== -1) return;
        v.id = c.key; v._src = 'tournaments'; MT[c.key] = v; cnt++;
      });
      console.log('[Mini eSports] Loaded ' + cnt + ' from tournaments/');
    }
    renderHome(); renderSP(); renderMM();
  });

  // L4: Join Requests
  db.ref('joinRequests').orderByChild('userId').equalTo(U.uid).on('value', function(s) {
    JR = {};
    if (s.exists()) s.forEach(function(c) { JR[c.key] = c.val(); });
    renderHome(); renderMM(); checkRefunds();
  });

  // L5: Notifications — real-time listener with auto Room ID popup
  db.ref('notifications').limitToLast(50).on('value', function(s) {
    NOTIFS = [];
    if (s.exists()) s.forEach(function(c) {
      var n = c.val();
      if (n && (n.targetUserId === 'all' || n.targetUserId === U.uid)) { n._key = c.key; NOTIFS.push(n); }
    });
    NOTIFS.reverse(); updateBell();
    if (curScr === 'notif') renderNotifs();
  });

  // L5b: Notification child_added — INSTANT reaction to new notifications
  // This fires for each NEW notification added, perfect for Room ID auto-popup
  db.ref('notifications').orderByChild('createdAt').startAt(Date.now()).on('child_added', function(s) {
    var n = s.val();
    if (!n) return;
    // Only process notifications meant for this user
    if (n.targetUserId !== 'all' && n.targetUserId !== U.uid) return;

    console.log('[Mini eSports] 🔔 New notification: ' + n.type + ' — ' + (n.title || ''));

    // AUTO-SHOW Room ID popup when admin releases Room ID
    if (n.type === 'room_released' && n.matchId) {
      var t = MT[n.matchId];
      if (t && t.roomId && t.roomPassword && hasJ(n.matchId)) {
        toast('🔑 Room ID released for "' + (t.name || 'Match') + '"!', 'ok');
        // Show popup after a short delay so toast appears first
        setTimeout(function() { showRP(t); }, 800);
      }
    }

    // AUTO-SHOW Room ID when match is about to start
    if (n.type === 'match_starting' && n.matchId) {
      var t = MT[n.matchId];
      if (t && t.roomId && t.roomPassword && hasJ(n.matchId)) {
        toast('⏰ Match starting soon! Room ID ready!', 'inf');
        setTimeout(function() { showRP(t); }, 800);
      }
    }

    // Show wallet notification toasts instantly
    if (n.type === 'wallet_approved') toast('✅ ' + (n.title || 'Deposit approved!'), 'ok');
    if (n.type === 'wallet_rejected') toast('❌ ' + (n.title || 'Deposit rejected'), 'err');
    if (n.type === 'withdraw_done') toast('✅ ' + (n.title || 'Withdrawal processed!'), 'ok');
    if (n.type === 'withdraw_rejected') toast('❌ ' + (n.title || 'Withdrawal rejected'), 'err');
    if (n.type === 'result') toast('🏆 ' + (n.title || 'Results announced!'), 'ok');
  });

  // L6: Payment Settings
  db.ref('appSettings/payment').on('value', function(s) { if (s.exists()) PAY = s.val(); });

  // L7: Ticker
  db.ref('appSettings/ticker').on('value', function(s) {
    if (s.exists()) { var tt = $('tickerTxt'); if (tt) tt.textContent = s.val(); }
  });

  // L8: Profile Requests Sync — handles multiple field name formats for compatibility
  db.ref('profileRequests').orderByChild('uid').equalTo(U.uid).on('value', function(s) {
    if (!s.exists()) return;
    s.forEach(function(c) {
      var r = c.val();
      if (r.status === 'approved') {
        /* Handle multiple field name formats: ign/ffUid OR requestedIgn/requestedUid OR newIgn/newUid */
        var finalIgn = r.ign || r.requestedIgn || r.newIgn || '';
        var finalUid = r.ffUid || r.requestedUid || r.newUid || '';
        
        db.ref('users/' + U.uid).update({ 
          ign: finalIgn, 
          ffUid: finalUid, 
          profileStatus: 'approved', 
          profileRequired: null,
          /* Clear pending fields */
          pendingIgn: null,
          pendingUid: null
        });
        
        console.log('[Mini eSports] ✅ Profile approved! IGN=' + finalIgn + ', UID=' + finalUid);
        toast('Profile approved! Full access unlocked! 🎉', 'ok');
      }
    });
  });

  // L13: User-specific Notifications (BUG FIX #3)
  // Listen to users/{uid}/notifications for admin-pushed personal notifications
  db.ref('users/' + U.uid + '/notifications').orderByChild('timestamp').limitToLast(30).once('value', function(s) {
    if (s.exists()) {
      s.forEach(function(c) {
        var n = c.val();
        if (n) {
          n._key = c.key;
          n._src = 'user';
          NOTIFS.push(n);
        }
      });
      NOTIFS.sort(function(a, b) { return (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0); });
      updateBell();
      if (curScr === 'notif') renderNotifs();
    }
  });
  // Real-time listener for NEW personal notifications
  db.ref('users/' + U.uid + '/notifications').orderByChild('timestamp').startAt(Date.now()).on('child_added', function(s) {
    var n = s.val();
    if (!n || n.read) return;
    n._key = s.key;
    n._src = 'user';
    NOTIFS.unshift(n);
    updateBell();
    if (curScr !== 'notif') toast('🔔 ' + (n.title || 'New notification'), 'ok');
    // Mark as read
    db.ref('users/' + U.uid + '/notifications/' + s.key + '/read').set(true);
  });

  // L14: Match Results Path Fix (BUG FIX #2)
  // Listen to each joined match's results for this user
  function setupResultListeners() {
    for (var k in JR) {
      var jr = JR[k];
      if (!jr || !jr.matchId) continue;
      var matchId = jr.matchId;
      // Listen to matches/{matchId}/results/{userId}
      db.ref('matches/' + matchId + '/results/' + U.uid).on('value', function(mid) {
        return function(s) {
          if (!s.exists()) return;
          var r = s.val();
          if (r.syncedToUser) return; // Already synced
          var up = {};
          if (r.winnings) up['realMoney/winnings'] = firebase.database.ServerValue.increment(Number(r.winnings) || 0);
          if (r.kills) up['stats/kills'] = firebase.database.ServerValue.increment(Number(r.kills) || 0);
          if (r.winnings) up['stats/earnings'] = firebase.database.ServerValue.increment(Number(r.winnings) || 0);
          if (r.won) up['stats/wins'] = firebase.database.ServerValue.increment(1);
          if (Object.keys(up).length > 0) {
            db.ref('users/' + U.uid).update(up);
            db.ref('matches/' + mid + '/results/' + U.uid + '/syncedToUser').set(true);
            toast('🎉 Result synced! Won ₹' + (r.winnings || 0) + '!', 'ok');
            console.log('[Mini eSports] ✅ Result synced from matches/' + mid + '/results/' + U.uid);
          }
        };
      }(matchId));
    }
  }
  // Setup result listeners after JR loads
  setTimeout(setupResultListeners, 2000);

  // L9: Wallet Requests — with notification on status change
  var prevWHStatus = {};
  db.ref('walletRequests').orderByChild('uid').equalTo(U.uid).on('value', function(s) {
    WH = [];
    if (s.exists()) s.forEach(function(c) {
      var v = c.val(); v._key = c.key; WH.push(v);
      var key = c.key;
      var st = (v.status || '').toString().toLowerCase();
      var prevSt = prevWHStatus[key];
      // Detect status change → send notification
      if (prevSt && prevSt !== st) {
        if (v.type === 'deposit') {
          if (st === 'approved' || st === 'done') {
            toast('✅ Deposit of ₹' + (v.amount || 0) + ' approved!', 'ok');
            pushLocalNotif('wallet_approved', '✅ Deposit Approved!',
              'Your deposit of ₹' + (v.amount || 0) + ' has been approved and added to your wallet.',
              '', key);
          } else if (st === 'rejected' || st === 'failed') {
            toast('❌ Deposit of ₹' + (v.amount || 0) + ' was rejected.', 'err');
            pushLocalNotif('wallet_rejected', '❌ Deposit Rejected',
              'Your deposit of ₹' + (v.amount || 0) + ' was rejected. Contact support for help.',
              '', key);
          }
        } else if (v.type === 'withdraw') {
          if (st === 'approved' || st === 'done') {
            toast('✅ Withdrawal of ₹' + (v.amount || 0) + ' processed!', 'ok');
            pushLocalNotif('withdraw_done', '✅ Withdrawal Processed!',
              'Your withdrawal of ₹' + (v.amount || 0) + ' has been sent to your UPI.',
              '', key);
          } else if (st === 'rejected' || st === 'failed') {
            toast('❌ Withdrawal of ₹' + (v.amount || 0) + ' was rejected.', 'err');
            pushLocalNotif('withdraw_rejected', '❌ Withdrawal Rejected',
              'Your withdrawal of ₹' + (v.amount || 0) + ' was rejected. Amount refunded to wallet.',
              '', key);
            // Auto-refund rejected withdrawal back to winnings
            db.ref('users/' + U.uid + '/realMoney/winnings').transaction(function(w) {
              return (w || 0) + (Number(v.amount) || 0);
            });
          }
        }
      }
      prevWHStatus[key] = st;
    });
    WH.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    renderWallet();
  });

  // L10: Results Auto-Sync — REMOVED old results/ listener (BUG FIX A)
  // Correct listener is L14 above: matches/{matchId}/results/{uid}
  // Old results/ path kept as fallback for legacy data only
  db.ref('results').orderByChild('userId').equalTo(U.uid).limitToLast(10).once('value', function(s) {
    if (!s.exists()) return;
    s.forEach(function(c) {
      var r = c.val(); if (r.synced) return;
      var up = {};
      if (r.winnings) up['realMoney/winnings'] = firebase.database.ServerValue.increment(Number(r.winnings) || 0);
      if (r.kills) up['stats/kills'] = firebase.database.ServerValue.increment(Number(r.kills) || 0);
      if (r.winnings) up['stats/earnings'] = firebase.database.ServerValue.increment(Number(r.winnings) || 0);
      if (r.won) up['stats/wins'] = firebase.database.ServerValue.increment(1);
      if (Object.keys(up).length > 0) {
        db.ref('users/' + U.uid).update(up);
        db.ref('results/' + c.key + '/synced').set(true);
        toast('🎉 You won ₹' + (r.winnings || 0) + '!', 'ok');
      }
    });
  });

  // L11: Referrals
  db.ref('referrals').orderByChild('referrerId').equalTo(U.uid).on('value', function(s) {
    REFS = [];
    if (s.exists()) s.forEach(function(c) { REFS.push(c.val()); });
    if (curScr === 'profile') renderProfile();
  });

  // L12: Chat global listener — BUG FIX B: ONLY support/ path (Admin's primary)
  // chats/ path COMPLETELY REMOVED to avoid confusion
  db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').startAt(Date.now()).on('child_added', function(s) {
    var m = s.val();
    if (m && (m.senderId === 'admin' || m.senderRole === 'admin') && curScr !== 'chat') {
      toast('💬 Admin replied: ' + (m.text || '').substring(0, 40), 'inf');
      pushLocalNotif('chat_reply', '💬 Admin Reply',
        'Admin replied: "' + (m.text || '').substring(0, 80) + '"', '', 'chat_' + Date.now());
    }
  });

  // Auto-refresh every 30s
  setInterval(function() { renderHome(); renderMM(); renderSP(); }, 30000);

  // ====== SMART MATCH NOTIFICATION SYSTEM ======
  // Checks every 30 seconds for upcoming matches
  var notifiedMatches = {};

  function checkMatchTimers() {
    for (var mid in MT) {
      var t = MT[mid];
      if (!t || !t.matchTime || !hasJ(mid)) continue;
      var mt = Number(t.matchTime);
      var diff = mt - Date.now();

      // 5 min before → match goes LIVE in our system, notify user
      if (diff > 0 && diff <= 300000 && !notifiedMatches[mid + '_5min']) {
        notifiedMatches[mid + '_5min'] = true;
        var mins = Math.ceil(diff / 60000);
        var roomMsg = '';
        h += '<div id="room-cd-' + t.id + '" style="font-size:11px;color:#ffaa00;margin-top:4px;min-height:14px"></div>';
    if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
          roomMsg = ' Room ID: ' + t.roomId;
          toast('⏰ "' + (t.name || 'Match') + '" starts in ' + mins + ' min! Room ID ready!', 'inf');
          setTimeout(function(match) {
            showRP(match);
          }.bind(null, t), 1500);
        } else {
          toast('⏰ "' + (t.name || 'Match') + '" starts in ' + mins + ' min! Get ready!', 'inf');
        }
        pushLocalNotif('match_starting', '⏰ Match Starting Soon!',
          '"' + (t.name || 'Match') + '" starts in ' + mins + ' minutes.' + roomMsg + ' Join the room now!',
          t.name, mid);
      }

      // 1 min before → urgent alert
      if (diff > 0 && diff <= 60000 && !notifiedMatches[mid + '_1min']) {
        notifiedMatches[mid + '_1min'] = true;
        toast('🔴 "' + (t.name || 'Match') + '" starts in 1 MINUTE!', 'err');
        if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
          showRP(t);
        }
      }

      // Match just started (within 30 sec window)
      if (diff <= 0 && diff > -30000 && !notifiedMatches[mid + '_started']) {
        notifiedMatches[mid + '_started'] = true;
        toast('🎮 "' + (t.name || 'Match') + '" is LIVE NOW! 🔥', 'ok');
        if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
          showRP(t);
        }
      }

      // 15 min after start → match ending soon warning
      if (diff <= -900000 && diff > -930000 && !notifiedMatches[mid + '_ending']) {
        notifiedMatches[mid + '_ending'] = true;
        toast('⚠️ "' + (t.name || 'Match') + '" ends in 5 minutes!', 'inf');
      }

      // 20 min after start → match auto-completed on UI
      if (diff <= -1200000 && !notifiedMatches[mid + '_done']) {
        notifiedMatches[mid + '_done'] = true;
        toast('✅ "' + (t.name || 'Match') + '" has ended. Results coming soon!', 'ok');
        // Re-render to move match to completed tab
        renderHome(); renderMM();
      }

      // Room ID available but not yet notified — notify immediately
      if (t.roomStatus === 'released' && t.roomId && t.roomPassword && !notifiedMatches[mid + '_room']) {
        notifiedMatches[mid + '_room'] = true;
        // Show popup if match is within 30 min range (before or after start)
        if (diff > -1800000 && diff < 1800000) {
          toast('🔑 Room ID ready for "' + (t.name || 'Match') + '"!', 'ok');
          setTimeout(function(match) { showRP(match); }.bind(null, t), 500);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      }
    }
  }

  // Run every 30 seconds
  setInterval(checkMatchTimers, 30000);

  // Also run immediately after 2 seconds (let data load first)
  setTimeout(checkMatchTimers, 2000);
}

/* ====== HEADER UPDATE ====== */
function updateHdr() {
  if (!UD) return;
  var coins = Number(UD.coins) || 0;
  var money = getMoneyBal();
  var hc = $('hdrCoins'), hm = $('hdrMoney');
  if (hc) {
    var oldC = Number(hc.textContent) || 0;
    hc.textContent = coins;
    if (coins !== oldC && oldC > 0) {
      hc.parentElement.style.animation = 'none';
      hc.parentElement.offsetHeight;
      hc.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
  if (hm) {
    var oldM = Number(hm.textContent) || 0;
    hm.textContent = money;
    if (money !== oldM && oldM > 0) {
      hm.parentElement.style.animation = 'none';
      hm.parentElement.offsetHeight;
      hm.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
}

/* ====== BELL ====== */
function updateBell() {
  var dot = $('bellDot'); if (!dot) return;
  var unread = 0, rd = (UD && UD.readNotifications) || {};
  NOTIFS.forEach(function(n) { if (!rd[n._key]) unread++; });
  dot.style.display = unread > 0 ? 'block' : 'none';
}

/* ====== DETECT CHANGES ====== */
function detectChanges() {
  var newKeys = {};
  for (var k in MT) newKeys[k] = true;
  for (var k in newKeys) {
    var t = MT[k]; if (!t) continue;
    // New match detected
    if (!prevMTKeys[k]) {
      if (effSt(t) === 'upcoming') pushLocalNotif('new_match', '🏆 New Tournament!', t.name || 'New match', t.name, k);
    }
    // Room ID released — ONLY notify joined users + auto-show popup
    if (t.roomStatus === 'released' && t.roomId && t.roomPassword && !prevMTKeys[k + '_room']) {
      prevMTKeys[k + '_room'] = true;
      if (hasJ(k)) {
        // Push notification to database
        pushLocalNotif('room_released', '🔑 Room Details Released!',
          'Room ID & Password ready for "' + (t.name || 'Match') + '". Tap to view & copy.',
          t.name, k);
        // Show toast
        toast('🔑 Room details released for "' + (t.name || 'Match') + '"!', 'ok');
        // Auto-show Room ID popup with slight delay
        setTimeout(function(match) { showRP(match); }.bind(null, t), 500);
        // Vibrate if supported (haptic feedback)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }
    // Match status changed to completed by admin — notify joined users
    var adminSt = (t.status || '').toString().toLowerCase().trim();
    if ((adminSt === 'completed' || adminSt === 'finished' || adminSt === 'ended') && !prevMTKeys[k + '_done']) {
      prevMTKeys[k + '_done'] = true;
      if (hasJ(k)) {
        pushLocalNotif('match_completed', '✅ Match Completed!',
          '"' + (t.name || 'Match') + '" has ended. Results will be announced soon.',
          t.name, k);
      }
    }
  }
  for (var k in newKeys) prevMTKeys[k] = true;
}
function pushLocalNotif(type, title, msg, matchName, matchId) {
  var exists = false;
  // For wallet/chat notifications, use matchId as unique key — don't duplicate
  NOTIFS.forEach(function(n) {
    if (n.matchId === matchId && n.type === type) exists = true;
  });
  if (exists) return;

  // Smart icon based on notification type
  var icon = 'fa-bell';
  if (type === 'room_released') icon = 'fa-key';
  else if (type === 'new_match' || type === 'match_starting' || type === 'match_completed') icon = 'fa-trophy';
  else if (type === 'wallet_approved' || type === 'withdraw_done') icon = 'fa-check-circle';
  else if (type === 'wallet_rejected' || type === 'withdraw_rejected') icon = 'fa-times-circle';
  else if (type === 'chat_reply') icon = 'fa-comments';
  else if (type === 'result') icon = 'fa-medal';

  var id = db.ref('notifications').push().key;
  db.ref('notifications/' + id).set({
    id: id, targetUserId: U.uid, type: type, title: title, message: msg,
    matchName: matchName || '', matchId: matchId || '',
    faIcon: icon,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
}

/* ====== MATCH CARD HTML ====== */
function mcHTML(t) {
  var es = effSt(t);
  /* Check t.mode FIRST (preferred), then t.type as fallback */
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  console.log('[Mini eSports] Card: ' + (t.name||'?') + ' mode=' + tp + ' (mode=' + t.mode + ', type=' + t.type + ')');
  var et = (t.entryType || '').toString().toLowerCase().trim();
  var isCoin = et === 'coin' || Number(t.entryFee) === 0;
  var joined = hasJ(t.id);
  var js = Number(t.joinedSlots) || 0, ms = Number(t.maxSlots) || 1;
  var pct = Math.min(Math.round(js / ms * 100), 100);
  var bc = tp === 'duo' ? 'badge-duo' : tp === 'squad' ? 'badge-squad' : 'badge-solo';
  var feeHTML = isCoin ? '<span class="fee-coin">🪙 ' + (t.entryFee || 0) + '</span>' : '<span class="fee-money">₹' + (t.entryFee || 0) + '</span>';
  var timeHTML = fmtTime(t.matchTime);
  if (timeHTML === 'Time Not Announced') timeHTML = '<span class="time-val">Time Not Announced</span>';
  else timeHTML = '<span class="time-val">' + timeHTML + '</span>';

  var modeClr = tp==='squad' ? '#b964ff' : tp==='duo' ? '#00d4ff' : '#00ff9c';
  var h = '<div class="m-card" style="border-top:3px solid ' + modeClr + ';position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.35),0 0 0 0 ' + modeClr + '">';
  h += '<div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;background:radial-gradient(circle,' + modeClr + '18,transparent 70%);pointer-events:none"></div>';
  h += '<div class="mc-top"><div class="mc-head"><span class="mc-name" style="font-size:16px;font-weight:800;letter-spacing:-.2px">' + (t.name || 'Match') + '</span><div class="mc-badges"><span class="badge ' + bc + '" style="background:' + modeClr + '22;color:' + modeClr + ';border:1px solid ' + modeClr + '55;font-weight:800">' + tp.toUpperCase() + '</span>';
  if (isCoin) h += '<span class="badge badge-coin">COIN</span>';
  if (es === 'live') h += '<span class="badge badge-live">LIVE</span>';
  h += '</div></div>';
  if (es === 'live') {
    var matchStarted = t.matchTime && Date.now() >= Number(t.matchTime);
    if (matchStarted) {
      h += '<div class="mc-live"><i class="fas fa-circle"></i> Match is Live Now</div>';
    } else {
      h += '<div class="mc-live" style="color:var(--yellow)"><i class="fas fa-clock" style="animation:none"></i> Starting Soon — Get Ready!</div>';
    }
  }
  h += '<div class="mc-sub"><span><i class="fas fa-gamepad"></i> ' + (t.matchType || 'Battle Royale') + '</span>';
  if (t.map) h += '<span><i class="fas fa-map"></i> ' + titleCase(t.map) + '</span>';
  var _pk = t.perKillPrize || t.perKill || 0;
  if (_pk) h += '<span><i class="fas fa-skull"></i> ₹' + _pk + '/Kill</span>';
  h += '</div></div>';
  h += '<div class="mc-mid"><div class="mc-cell"><label>🏆 Prize Pool</label><span class="prize">₹' + (t.prizePool || 0) + '</span></div>';
  h += '<div class="mc-cell"><label>Entry Fee</label>' + feeHTML + '</div>';
  h += '<div class="mc-cell"><label>Start Time</label>' + timeHTML + '</div></div>';
  h += '<div class="mc-bot"><div class="mc-slots"><div class="mc-slots-txt">' + js + '/' + ms + ' Slots (' + pct + '% Full)</div>';
  h += '<div class="mc-bar"><div class="mc-bar-fill" style="width:' + pct + '%"></div></div>';
  h += '<div id="timer-' + t.id + '" style="font-size:11px;font-weight:700;margin-top:4px;color:#ffaa00;min-height:14px"></div></div>';
  h += '<div class="mc-info-btn" onclick="shareMatch(\'' + t.id + '\')" title="Share"><i class="fas fa-share-alt"></i></div>';
  h += '<div class="mc-info-btn" onclick="showDet(\'' + t.id + '\')"><i class="fas fa-info-circle"></i></div>';

  // Determine if match actually started (past matchTime) or just in prep window
  var matchActuallyStarted = t.matchTime && Date.now() >= Number(t.matchTime);

  if (isVO()) h += '<button class="mc-join join-vo" disabled>View Only</button>';
  else if (joined) h += '<button class="mc-join joined" disabled>Joined ✔️</button>';
  else if (js >= ms) h += '<button class="mc-join join-full" disabled>Full</button>';
  else if (es === 'completed') h += '<button class="mc-join join-dis" disabled>Ended</button>';
  else if (es === 'live' && matchActuallyStarted) h += '<button class="mc-join join-dis" disabled>Started</button>';
  else if (es === 'live' && !matchActuallyStarted) h += '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')">Join</button>';
  else h += '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')" style="background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;letter-spacing:0.5px;border:none">⚡ JOIN</button>';
  h += '</div></div>';
  return h;
}

/* ====== RENDER HOME ====== */
function renderHome() {
  var l = $('homeList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id];
    if (!t.maxSlots || t.maxSlots <= 0) continue;
    var es = effSt(t);
    if (es === 'cancelled') continue;
    if (es !== hSF) continue;
    if (t.isSpecial === true) continue;
    var tEntry = (t.entryType || '').toString().toLowerCase().trim();
    var wantCat = hCF.toString().toLowerCase().trim();
    var catMatch = false;
    if (wantCat === 'coin') catMatch = (tEntry === 'coin' || Number(t.entryFee) === 0);
    else catMatch = (tEntry !== 'coin' && Number(t.entryFee) > 0);
    if (!catMatch) continue;
    f.push(t);
  }
  f.sort(function(a, b) { return (Number(a.matchTime) || 0) - (Number(b.matchTime) || 0); });
  console.log('[Mini eSports] renderHome: ' + f.length + ' matches for tab=' + hCF + ' status=' + hSF);
  l.innerHTML = f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ' + hCF + ' matches ' + hSF + '</p></div>';
  if (window.startMatchTimers) startMatchTimers();
}

/* ====== RENDER SPECIAL ====== */
function renderSP() {
  var l = $('specialList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id]; if (t.isSpecial !== true) continue;
    var st = (t.specialType || 'weekly').toString().toLowerCase();
    if (st !== spType) continue; f.push(t);
  }
  f.sort(function(a, b) { return (Number(a.matchTime) || 0) - (Number(b.matchTime) || 0); });
  l.innerHTML = f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-crown"></i><p>No ' + spType + ' special matches</p></div>';
  updateCD(f);
}
function setSpec(type, el) {
  spType = type;
  document.querySelectorAll('.sp-tog-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderSP();
}
function updateCD(list) {
  if (cdInt) clearInterval(cdInt);
  var next = null;
  list.forEach(function(t) { var mt = Number(t.matchTime); if (mt && mt > Date.now() && (!next || mt < next)) next = mt; });
  if (!next) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; return; }
  function tick() {
    var diff = next - Date.now();
    if (diff <= 0) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; clearInterval(cdInt); return; }
    $('cdD').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    $('cdH').textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    $('cdM').textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    $('cdS').textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  }
  tick(); cdInt = setInterval(tick, 1000);
}

/* ====== RENDER MY MATCHES ====== */
function renderMM() {
  var l = $('mmList'); if (!l) return;
  var f = [];
  for (var k in JR) {
    var jr = JR[k], t = MT[jr.matchId]; if (!t) continue;
    var es = effSt(t); if (es !== mmSF) continue;
    f.push({ jr: jr, t: t, k: k });
  }
  if (!f.length) { l.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No ' + mmSF + ' matches</p></div>'; return; }
  var h = '';
  f.forEach(function(item) {
    var jr = item.jr, t = item.t;
    var tp = (t.mode || t.type || jr.mode || 'solo').toString().toLowerCase().trim();
    if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
    h += '<div class="mm-card"><div class="mm-head"><span class="mm-name">' + (t.name || jr.matchName || 'Match') + '</span>';
    var _isTeamMember = jr.isTeamMember && jr.captainUid;
    var _statusLabel = _isTeamMember ? '👥 Team' : '✅ Joined';
    var _captainNote = _isTeamMember ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px"><i class="fas fa-crown" style="color:#ffd700;font-size:9px"></i> Captain: ' + (jr.captainName || 'Teammate') + ' ne join kiya</div>' : '';
    h += '<span class="mm-status ms-a">' + _statusLabel + '</span></div>' + _captainNote;
    h += '<div class="mm-details"><span><i class="fas fa-gamepad"></i> ' + tp.toUpperCase() + '</span>';
    h += '<span><i class="fas fa-coins"></i> ' + (jr.entryFee || 0) + '</span>';
    if (t.map) h += '<span><i class="fas fa-map"></i> ' + titleCase(t.map) + '</span>';
    h += '<span><i class="fas fa-clock"></i> ' + fmtTime(t.matchTime) + '</span></div>';
    if (jr.teamMembers && jr.teamMembers.length > 1) {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
      jr.teamMembers.forEach(function(m) { h += '<span style="padding:3px 8px;border-radius:6px;font-size:11px;background:rgba(185,100,255,.1);color:var(--purple)">' + m.name + (m.role === 'captain' ? ' 👑' : '') + '</span>'; });
      h += '</div>';
    }
    if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
      h += '<div class="room-box rb-green" style="margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center"><span><strong>Room ID:</strong> ' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span><strong>Password:</strong> ' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    }
    if (t.status === 'cancelled' && jr.refunded) {
      h += '<div style="background:rgba(0,255,106,.08);border:1px solid rgba(0,255,106,.2);border-radius:10px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--green)"><i class="fas fa-check-circle"></i> Entry fee refunded</div>';
    }
    h += '</div>';
  });
  l.innerHTML = h;
  if (window.updateRoomCountdowns) updateRoomCountdowns();
}

/* ====== SHOW MATCH DETAILS ====== */
function showDet(id) {
  var t = MT[id]; if (!t) return;
  history.pushState(null, null, null);
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var h = '<div class="d-row"><span class="dl">Match Name</span><span class="dv">' + (t.name || 'Match') + '</span></div>';
  h += '<div class="d-row"><span class="dl">Mode</span><span class="dv">' + tp.toUpperCase() + '</span></div>';
  h += '<div class="d-row"><span class="dl">Match Type</span><span class="dv">' + (t.matchType || 'Battle Royale') + '</span></div>';
  if (t.map) h += '<div class="d-row"><span class="dl">Map</span><span class="dv">' + titleCase(t.map) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Start Time</span><span class="dv blue">' + fmtTime(t.matchTime) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Prize Pool</span><span class="dv green">₹' + (t.prizePool || 0) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Entry Fee</span><span class="dv ' + (isCoin ? 'yellow' : 'green') + '">' + (isCoin ? '🪙 ' : '₹') + (t.entryFee || 0) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Slots</span><span class="dv">' + (t.joinedSlots || 0) + '/' + (t.maxSlots || 0) + '</span></div>';
  var _dk = t.perKillPrize || t.perKill || 0;
  var _d1 = t.firstPrize || t.prize1st || 0;
  var _d2 = t.secondPrize || t.prize2nd || 0;
  var _d3 = t.thirdPrize || t.prize3rd || 0;
  if (_dk || _d1 || _d2 || _d3) {
    h += '<div style="margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,215,0,.02));border:1px solid rgba(255,215,0,.2);border-radius:12px">';
    h += '<div style="font-size:14px;font-weight:700;color:var(--yellow);margin-bottom:10px"><i class="fas fa-trophy"></i> Prize Breakdown</div>';
    if (_d1) h += '<div class="d-row"><span class="dl">🥇 1st Prize</span><span class="dv green">₹' + _d1 + '</span></div>';
    if (_d2) h += '<div class="d-row"><span class="dl">🥈 2nd Prize</span><span class="dv">₹' + _d2 + '</span></div>';
    if (_d3) h += '<div class="d-row"><span class="dl">🥉 3rd Prize</span><span class="dv">₹' + _d3 + '</span></div>';
    if (_dk) h += '<div class="d-row"><span class="dl">💀 Per Kill</span><span class="dv yellow">₹' + _dk + '</span></div>';
    h += '</div>';
  }
  if (t.description) h += '<div style="margin-top:12px;padding:12px;background:var(--card);border-radius:10px;font-size:13px;color:var(--txt2);line-height:1.5">' + t.description + '</div>';
  if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
    if (hasJ(id)) {
      h += '<div class="room-box rb-green" style="margin-top:12px"><div class="rp-label">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div class="rp-label" style="margin-top:8px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    } else { h += '<div class="room-box rb-yellow" style="margin-top:12px"><i class="fas fa-lock"></i> Join the match to see room details</div>'; }
  } else { h += '<div class="room-box rb-blue" style="margin-top:12px"><i class="fas fa-clock"></i> Room details will be shared before match start</div>'; }
  h += '<button onclick="shareMatch(\'' + id + '\')" style="width:100%;margin-top:14px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.08));color:var(--blue);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> Share Match</button>';
  openModal('Match Details', h);
}

/* ====== JOIN SYSTEM ====== */
function cJoin(id) {
  // Check if already joined (as captain or team member)
  var _role = getJoinRole(id);
  if (_role === 'member') {
    toast('✅ Tum already team mein ho — captain ne join kar liya!', 'ok');
    navTo('matches'); return;
  }
  var t = MT[id]; if (!t || isVO()) return;
  if (hasJ(id)) { toast('Already joined!', 'inf'); return; }
  var es = effSt(t);
  var matchActuallyStarted = t.matchTime && Date.now() >= Number(t.matchTime);
  // Allow join during upcoming OR early live window (5 min before start)
  if (es === 'completed') { toast('Match has ended', 'err'); return; }
  if (es === 'live' && matchActuallyStarted) { toast('Match already started', 'err'); return; }
  if (es === 'cancelled') { toast('Match cancelled', 'err'); return; }
  var js = Number(t.joinedSlots) || 0, ms = Number(t.maxSlots) || 1;
  if (js >= ms) { toast('Slots full!', 'err'); return; }
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var fee = Number(t.entryFee) || 0;
  var bal = isCoin ? (UD.coins || 0) : getMoneyBal();
  var enough = bal >= fee;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  var h = '<div class="confirm-info">';
  h += '<div class="ci-row"><span class="cl">Match</span><span class="cv">' + (t.name || 'Match') + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Mode</span><span class="cv">' + tp.toUpperCase() + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Entry Fee</span><span class="cv">' + (isCoin ? '🪙 ' : '₹') + fee + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Slots Needed</span><span class="cv">' + slotsNeeded + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Your Balance</span><span class="cv" style="color:' + (enough ? 'var(--green)' : 'var(--red)') + '">' + (isCoin ? '🪙 ' : '₹') + bal + '</span></div></div>';
  if (UD.ign && UD.ffUid) h += '<div class="ci-locked"><i class="fas fa-lock"></i> Playing as: <strong>' + UD.ign + '</strong> (UID: ' + UD.ffUid + ')</div>';
  if (tp === 'duo') {
    var savedDuo = getSavedTeam('duo');
    h += '<div style="margin:14px 0"><div style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-users"></i> Partner Details</div>';
    h += '<div style="font-size:12px;color:var(--purple);background:rgba(185,100,255,.08);border-radius:8px;padding:8px;margin-bottom:8px"><i class="fas fa-info-circle"></i> You (Captain) pay the full fee. Partner plays free.</div>';
    if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) {
      /* SAVED PARTNER EXISTS — HIDE UID input completely, use saved partner silently */
      h += '<div id="savedTeamCard" style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.2);border-radius:12px;padding:12px;margin-bottom:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><i class="fas fa-link" style="color:var(--green);font-size:16px"></i><span style="font-size:13px;font-weight:700;color:var(--green)">Linked Partner — Auto Joined!</span></div>';
      h += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card);border-radius:10px">';
      h += '<div style="width:40px;height:40px;border-radius:50%;background:rgba(0,255,106,.12);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--green)">' + (savedDuo.partners[0].memberName || 'P').charAt(0).toUpperCase() + '</div>';
      h += '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + (savedDuo.partners[0].memberName || 'Partner') + '</div>';
      h += '<div style="font-size:11px;color:var(--txt2)">FF UID: ' + savedDuo.partners[0].memberUid + '</div></div>';
      h += '<span id="savedPartnerSt1" style="font-size:11px;color:var(--blue);padding:4px 8px;border-radius:6px;background:rgba(0,212,255,.1)">Verifying...</span></div>';
      h += '<div style="font-size:11px;color:var(--txt2);margin-top:8px;text-align:center"><i class="fas fa-info-circle"></i> Partner will be auto-added. No action needed.</div></div>';
      h += '<div style="text-align:center;margin-bottom:4px"><span style="font-size:11px;color:var(--txt2);cursor:pointer;text-decoration:underline" onclick="showManualPartner(\'duo\')">Use different partner?</span></div>';
      h += '<div id="manualPartnerWrap" style="display:none">';
    }
    h += '<div class="partner-field"><span class="pf-num">2</span><input type="text" id="partnerUid1" placeholder="Enter Partner FF UID" oninput="valPartner(1)"><span id="partnerSt1" class="pf-status"></span></div>';
    h += '<div id="partnerName1" style="font-size:12px;color:var(--txt2);margin-top:-6px;margin-bottom:8px"></div>';
    if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) h += '</div>';
    h += '</div>';
  }
  if (tp === 'squad') {
    var savedSquad = getSavedTeam('squad');
    h += '<div style="margin:14px 0"><div style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-users"></i> Squad Details</div>';
    h += '<div style="font-size:12px;color:var(--purple);background:rgba(185,100,255,.08);border-radius:8px;padding:8px;margin-bottom:8px"><i class="fas fa-info-circle"></i> You (Captain) pay the full fee. Partners play free.</div>';
    if (savedSquad && savedSquad.partners.length === 3) {
      /* ALL 3 LINKED — HIDE UID inputs, use saved squad silently */
      h += '<div id="savedTeamCard" style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.2);border-radius:12px;padding:12px;margin-bottom:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-link" style="color:var(--green);font-size:16px"></i><span style="font-size:13px;font-weight:700;color:var(--green)">Linked Squad — Auto Joined!</span></div>';
      savedSquad.partners.forEach(function(p, pi) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card);border-radius:10px;margin-bottom:4px">';
        h += '<div style="width:32px;height:32px;border-radius:50%;background:rgba(0,255,106,.12);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--green)">' + (pi + 2) + '</div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (p.memberName || 'Partner') + '</div>';
        h += '<div style="font-size:11px;color:var(--txt2)">FF UID: ' + p.memberUid + '</div></div>';
        h += '<span id="savedPartnerSt' + (pi + 1) + '" style="font-size:11px;color:var(--blue);padding:3px 6px;border-radius:6px;background:rgba(0,212,255,.1)">Verifying...</span></div>';
      });
      h += '<div style="font-size:11px;color:var(--txt2);margin-top:8px;text-align:center"><i class="fas fa-info-circle"></i> All partners auto-added. No action needed.</div></div>';
      h += '<div style="text-align:center;margin-bottom:4px"><span style="font-size:11px;color:var(--txt2);cursor:pointer;text-decoration:underline" onclick="showManualPartner(\'squad\')">Enter manually instead?</span></div>';
      h += '<div id="manualPartnerWrap" style="display:none">';
    } else if (savedSquad && savedSquad.partners.length > 0) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.15);border-radius:10px"><i class="fas fa-bolt" style="color:var(--green)"></i><span style="flex:1;font-size:12px;color:var(--green);font-weight:600">Saved ' + savedSquad.partners.length + ' member(s)! Auto-filling...</span></div>';
    }
    for (var i = 1; i <= 3; i++) {
      h += '<div class="partner-field"><span class="pf-num">' + (i + 1) + '</span><input type="text" id="partnerUid' + i + '" placeholder="Partner ' + i + ' FF UID" oninput="valPartner(' + i + ')"><span id="partnerSt' + i + '" class="pf-status"></span></div>';
      h += '<div id="partnerName' + i + '" style="font-size:12px;color:var(--txt2);margin-top:-6px;margin-bottom:8px"></div>';
    }
    if (savedSquad && savedSquad.partners.length === 3) h += '</div>';
    h += '</div>';
  }
  h += '<div class="ci-warn"><i class="fas fa-exclamation-triangle"></i> You must play using your registered IGN & UID. Mismatch = disqualification.</div>';
  if (!enough) h += '<div style="color:var(--red);font-size:13px;font-weight:600;margin-top:10px;text-align:center">❌ Insufficient balance!</div>';
  h += '<button class="f-btn fb-green" style="margin-top:14px" onclick="doJoin(\'' + id + '\')" ' + (enough ? '' : 'disabled') + '>Confirm Join (' + slotsNeeded + ' Slot' + (slotsNeeded > 1 ? 's' : '') + ')</button>';
  openModal('Join Tournament', h);
  
  /* AUTO-FILL or AUTO-VALIDATE saved teammates after modal renders */
  if (tp === 'duo' || tp === 'squad') {
    setTimeout(function() {
      var saved = getSavedTeam(tp);
      if (saved && saved.partners.length > 0) {
        /* If saved team card is showing (all partners saved), validate in background */
        var savedCard = $('savedTeamCard');
        if (savedCard) {
          validateSavedPartners(saved.partners, function(results) {
            var allValid = true;
            results.forEach(function(r) {
              var stEl = $('savedPartnerSt' + (r.index + 1));
              if (r.valid) {
                if (stEl) stEl.innerHTML = '<span style="color:var(--green)">✓ Verified</span>';
                partnerCache[r.index + 1] = r.data;
              } else {
                if (stEl) stEl.innerHTML = '<span style="color:var(--red)">✗ Not found</span>';
                allValid = false;
              }
            });
            if (!allValid) {
              toast('Some saved partners not found. Enter manually.', 'err');
              showManualPartner(tp);
            } else {
              console.log('[Mini eSports] ✅ All saved partners verified for ' + tp);
            }
          });
        } else {
          /* Partial saved team — auto-fill the fields */
          autoFillSavedTeam(tp);
        }
      }
    }, 300);
  }
}

/* Show manual partner entry fields (when user wants different partner) */
function showManualPartner(mode) {
  var wrap = $('manualPartnerWrap');
  var card = $('savedTeamCard');
  if (wrap) wrap.style.display = '';
  if (card) card.style.display = 'none';
  /* Clear partnerCache so user must fill manually */
  partnerCache = {};
  /* Auto-fill from saved data as starting point */
  setTimeout(function() { autoFillSavedTeam(mode); }, 100);
}

function valPartner(n) {
  var inp = $('partnerUid' + n), st = $('partnerSt' + n), nm = $('partnerName' + n);
  if (!inp || !st) return;
  var uid = inp.value.trim();
  if (!uid) { st.innerHTML = ''; if (nm) nm.textContent = ''; return; }
  if (uid.length < 5) { st.innerHTML = '<span class="pf-err">Too short</span>'; if (nm) nm.textContent = ''; return; }
  if (uid === UD.ffUid) { st.innerHTML = '<span class="pf-err">Can\'t add yourself</span>'; if (nm) nm.textContent = ''; return; }
  st.innerHTML = '<span style="color:var(--blue)">...</span>';
  db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
    if (s.exists()) {
      var found = null, foundKey = null; s.forEach(function(c) { found = c.val(); foundKey = c.key; });
      st.innerHTML = '<span class="pf-ok">✓ Found</span>';
      if (nm) nm.textContent = found.ign || found.displayName || 'Player';
      partnerCache[n] = found;
      partnerCache[n]._fbUid = foundKey; // Store Firebase UID for partner joinRequest
    } else { st.innerHTML = '<span class="pf-err">✗ Not found</span>'; if (nm) nm.textContent = ''; delete partnerCache[n]; }
  });
}

function doJoin(id) {
  var t = MT[id]; if (!t) return;
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var fee = Number(t.entryFee) || 0;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  var team = [{ uid: UD.ffUid || '', name: UD.ign || UD.displayName || '', role: 'captain' }];
  if (tp === 'duo') {
    /* Check if partner is linked (saved) — use directly without manual input */
    if (!partnerCache[1]) {
      /* No partner validated yet — check if saved partner is available */
      var savedDuo = getSavedTeam('duo');
      if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) {
        /* Use saved partner silently — but need to verify they exist */
        toast('Verifying linked partner...', 'inf');
        return; /* Wait for background validation to populate partnerCache */
      }
      toast('Validate partner UID first', 'err'); return;
    }
    team.push({ uid: partnerCache[1].ffUid, name: partnerCache[1].ign || partnerCache[1].displayName || '', role: 'member' });
  }
  if (tp === 'squad') {
    for (var i = 1; i <= 3; i++) {
      if (!partnerCache[i]) {
        /* Check if saved squad exists — use directly */
        var savedSquad = getSavedTeam('squad');
        if (savedSquad && savedSquad.partners.length === 3) {
          toast('Verifying linked squad...', 'inf');
          return; /* Wait for background validation */
        }
        toast('Validate all 3 partner UIDs', 'err'); return;
      }
      for (var j = 1; j < i; j++) { if (partnerCache[j].ffUid === partnerCache[i].ffUid) { toast('Duplicate partner UID!', 'err'); return; } }
      team.push({ uid: partnerCache[i].ffUid, name: partnerCache[i].ign || partnerCache[i].displayName || '', role: 'member' });
    }
  }
  var matchPath = (t._src || 'matches') + '/' + id;
  var ref = db.ref(matchPath + '/joinedSlots');
  ref.transaction(function(cur) {
    cur = (cur || 0) + slotsNeeded;
    if (cur > (Number(t.maxSlots) || 1)) return;
    return cur;
  }, function(err, committed) {
    if (err || !committed) { toast('Failed to book slots', 'err'); return; }
    /* BUG FIX #5: Also update filledSlots for Admin panel sync */
    db.ref(matchPath + '/filledSlots').transaction(function(v) {
      return (v || 0) + slotsNeeded;
    });
    var jid = db.ref('joinRequests').push().key;
    db.ref('joinRequests/' + jid).set({
      requestId: jid, userId: U.uid, userName: UD.ign || '', userFFUID: UD.ffUid || '',
      displayName: UD.displayName || '', userEmail: UD.email || '',
      matchId: id, matchName: t.name || '', entryFee: fee, entryType: isCoin ? 'coin' : 'money',
      mode: tp, status: 'joined', slotsBooked: slotsNeeded, teamMembers: team,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    if (isCoin) db.ref('users/' + U.uid + '/coins').transaction(function(c) { return Math.max((c || 0) - fee, 0); });
    else deductMoney(fee);
    db.ref('users/' + U.uid + '/stats/matches').transaction(function(m) { return (m || 0) + 1; });
    /* Save last used team to localStorage for quick join next time */
    if (tp === 'duo' && partnerCache[1]) {
      try { localStorage.setItem('lastDuoPartner', JSON.stringify({ uid: partnerCache[1].ffUid, name: partnerCache[1].ign || partnerCache[1].displayName || '' })); } catch(e) {}
    }
    if (tp === 'squad') {
      var savedSquad = [];
      for (var si = 1; si <= 3; si++) { if (partnerCache[si]) savedSquad.push({ uid: partnerCache[si].ffUid, name: partnerCache[si].ign || partnerCache[si].displayName || '' }); }
      try { localStorage.setItem('lastSquadPartners', JSON.stringify(savedSquad)); } catch(e) {}
    }
    // Partner joinRequests banao taaki unhe My Matches mein dikhe
    var _makePartnerJR = function(pUid, pName, pFFUid) {
      if (!pUid || pUid === U.uid) return;
      var pjid = db.ref('joinRequests').push().key;
      db.ref('joinRequests/' + pjid).set({
        requestId: pjid, userId: pUid, userName: pName || '', userFFUID: pFFUid || '',
        matchId: id, matchName: t.name || '', entryFee: 0,
        entryType: isCoin ? 'coin' : 'money', mode: tp, status: 'joined',
        slotsBooked: 0, teamMembers: team, captainUid: U.uid,
        captainName: UD.ign || UD.displayName || '',
        isTeamMember: true,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      db.ref('users/' + pUid + '/stats/matches').transaction(function(m) { return (m||0)+1; });
      // Notify partner
      var notifId = db.ref('users/' + pUid + '/notifications').push().key;
      db.ref('users/' + pUid + '/notifications/' + notifId).set({
        type: 'team_joined', title: '🎮 Match Joined by Captain!',
        body: (UD.ign || 'Your teammate') + ' ne "' + (t.name||'match') + '" join kiya — tum bhi team mein ho!',
        matchId: id, read: false, createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    };
    if (tp === 'duo' && partnerCache[1] && partnerCache[1]._fbUid) {
      _makePartnerJR(partnerCache[1]._fbUid, partnerCache[1].ign||'', partnerCache[1].ffUid||'');
    }
    if (tp === 'squad') {
      for (var _si = 1; _si <= 3; _si++) {
        if (partnerCache[_si] && partnerCache[_si]._fbUid) {
          _makePartnerJR(partnerCache[_si]._fbUid, partnerCache[_si].ign||'', partnerCache[_si].ffUid||'');
        }
      }
    }
    partnerCache = {}; closeModal(); toast('Joined successfully! 🎮', 'ok');
  }, false);
}

function deductMoney(amt) {
  var rm = UD.realMoney || {};
  var dep = Number(rm.deposited) || 0, win = Number(rm.winnings) || 0, bon = Number(rm.bonus) || 0;
  var left = amt;
  if (dep >= left) { db.ref('users/' + U.uid + '/realMoney/deposited').set(dep - left); return; }
  left -= dep; db.ref('users/' + U.uid + '/realMoney/deposited').set(0);
  if (win >= left) { db.ref('users/' + U.uid + '/realMoney/winnings').set(win - left); return; }
  left -= win; db.ref('users/' + U.uid + '/realMoney/winnings').set(0);
  db.ref('users/' + U.uid + '/realMoney/bonus').set(Math.max(bon - left, 0));
}

/* ====== REFUND SYSTEM ====== */
function checkRefunds() {
  for (var k in JR) {
    var jr = JR[k]; if (jr.refunded) continue;
    var t = MT[jr.matchId]; if (!t) continue;
    var st = (t.status || '').toString().toLowerCase().trim();
    if (st === 'cancelled' || st === 'canceled') {
      var fee = Number(jr.entryFee) || 0; if (fee <= 0) continue;
      if (jr.entryType === 'coin') db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + fee; });
      else db.ref('users/' + U.uid + '/realMoney/deposited').transaction(function(d) { return (d || 0) + fee; });
      db.ref('joinRequests/' + k + '/refunded').set(true);
      toast('₹' + fee + ' refunded for cancelled match!', 'ok');
    }
  }
}

/* ====== ROOM POPUP ====== */
function showRP(t) {
  if (!t || !t.roomId || !t.roomPassword) return;
  history.pushState(null, null, null);
  var h = '<div class="room-popup-overlay" onclick="if(event.target===this)this.remove()"><div class="room-popup"><div class="rp-icon">🔑</div><div class="rp-title">Room Details Released!</div><div class="rp-match">' + (t.name || 'Match') + '</div>';
  h += '<div class="rp-box"><div class="rp-label">Room ID</div><div class="rp-value"><span>' + t.roomId + '</span><button class="rp-copy" onclick="copyTxt(\'' + t.roomId + '\')"><i class="fas fa-copy"></i></button></div></div>';
  h += '<div class="rp-box"><div class="rp-label">Password</div><div class="rp-value"><span>' + t.roomPassword + '</span><button class="rp-copy" onclick="copyTxt(\'' + t.roomPassword + '\')"><i class="fas fa-copy"></i></button></div></div>';
  h += '<button class="rp-close" onclick="this.closest(\'.room-popup-overlay\').remove()">Got it!</button></div></div>';
  $('rpContainer').innerHTML = h;
}

/* ====== WALLET ====== */
function renderWallet() {
  if (!UD) return;
  // Null-safe balance calculation — ALWAYS works even if realMoney missing
  var rm = UD.realMoney || { deposited: 0, winnings: 0, bonus: 0 };
  var dep = Math.max(Number(rm.deposited) || 0, 0);
  var win = Math.max(Number(rm.winnings) || 0, 0);
  var bon = Math.max(Number(rm.bonus) || 0, 0);
  var total = dep + win + bon;
  var coins = Math.max(Number(UD.coins) || 0, 0);

  // Update wallet UI elements
  var wt = $('wTotal'), wb = $('wBreak'), wc = $('wCoins');
  if (wt) wt.textContent = '₹' + total;
  if (wb) wb.innerHTML = 'Deposited: ₹' + dep + ' | Winnings: ₹' + win + ' | Bonus: ₹' + bon;
  if (wc) wc.textContent = '🪙 ' + coins;

  // ALWAYS update header balance in real-time
  updateHdr();
  console.log('[Mini eSports] 💰 Wallet: ₹' + total + ' (D:' + dep + ' W:' + win + ' B:' + bon + ') Coins:' + coins);
  var wh = $('walletHist'); if (!wh) return;
  if (!WH.length) { wh.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">No transactions yet</div>'; return; }
  var h = '';
  WH.forEach(function(w) {
    var isD = w.type === 'deposit';
    var sc = w.status === 'approved' || w.status === 'done' ? 'whs-a' : w.status === 'rejected' ? 'whs-r' : 'whs-p';
    var sl = w.status === 'approved' || w.status === 'done' ? 'Done' : w.status === 'rejected' ? 'Failed' : 'Pending';
    h += '<div class="wh-card"><div class="wh-icon ' + (isD ? 'whi-g' : 'whi-r') + '"><i class="fas fa-' + (isD ? 'arrow-up' : 'arrow-down') + '"></i></div>';
    h += '<div class="wh-info"><div class="wh-name">' + (isD ? 'Deposit' : 'Withdrawal') + '</div><div class="wh-time">' + timeAgo(w.createdAt) + '</div>';
    if (w.utr || w.transactionId) h += '<div class="wh-utr">UTR: ' + (w.utr || w.transactionId) + '</div>';
    h += '</div><div class="wh-amt ' + (isD ? 'wha-g' : 'wha-r') + '">' + (isD ? '+' : '-') + '₹' + (w.amount || 0) + '</div>';
    h += '<span class="wh-status ' + sc + '">' + sl + '</span></div>';
  });
  wh.innerHTML = h;
}

function startAdd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  history.pushState(null, null, null); wfStep = 1; wfAmt = 0; wfScreenshot = ''; showWFStep();
}
function startWd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  history.pushState(null, null, null);
  var win = Number((UD.realMoney || {}).winnings) || 0;
  var h = '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><i class="fas fa-arrow-down"></i> Withdraw Winnings</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Available: <strong style="color:var(--green)">₹' + win + '</strong> (min ₹50)</div>';
  h += '<div class="f-group"><label>Amount (₹)</label><input type="number" class="f-input" id="wdAmt" placeholder="Enter amount" min="50"></div>';
  h += '<div class="f-group"><label>Your UPI ID</label><input type="text" class="f-input" id="wdUpi" placeholder="yourname@upi"></div>';
  h += '<button class="f-btn fb-green" onclick="submitWd()">Request Withdrawal</button>';
  openModal('Withdraw', h);
}
function submitWd() {
  var amt = Number($('wdAmt').value), upi = ($('wdUpi').value || '').trim();
  var win = Number((UD.realMoney || {}).winnings) || 0;
  if (!amt || amt < 50) { toast('Minimum ₹50', 'err'); return; }
  if (amt > win) { toast('Insufficient winnings', 'err'); return; }
  if (!upi || !upi.includes('@')) { toast('Enter valid UPI ID', 'err'); return; }
  var id = db.ref('walletRequests').push().key;
  var data = { requestId: id, uid: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', amount: amt, upiId: upi, status: 'pending', type: 'withdraw', createdAt: firebase.database.ServerValue.TIMESTAMP };
  db.ref('walletRequests/' + id).set(data);
  db.ref('paymentRequests/' + id).set(data);
  db.ref('users/' + U.uid + '/realMoney/winnings').transaction(function(w) { return Math.max((w || 0) - amt, 0); });
  closeModal(); toast('Withdrawal request submitted!', 'ok');
}
function cancelWF() { $('walletFlow').style.display = 'none'; $('walletMain').style.display = ''; }

function showWFStep() {
  $('walletMain').style.display = 'none'; var wf = $('walletFlow'); wf.style.display = '';
  var prog = '<div class="w-progress"><div class="w-step-dot ' + (wfStep >= 1 ? 'active' : '') + '">1</div><div class="w-step-line ' + (wfStep >= 2 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 2 ? 'active' : '') + '">2</div><div class="w-step-line ' + (wfStep >= 3 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 3 ? 'active' : '') + '">3</div></div>';
  var h = prog;
  if (wfStep === 1) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Amount</div>';
    h += '<div class="f-group"><label>Amount (₹) — Min ₹10</label><input type="number" class="f-input" id="addAmt" placeholder="Enter amount" min="10" value="' + (wfAmt || '') + '"></div>';
    h += '<div class="w-amt-grid"><div class="w-amt-btn" onclick="pickAmt(50)">₹50</div><div class="w-amt-btn" onclick="pickAmt(100)">₹100</div><div class="w-amt-btn" onclick="pickAmt(200)">₹200</div><div class="w-amt-btn" onclick="pickAmt(500)">₹500</div></div>';
    h += '<button class="f-btn fb-green" onclick="wfNext()">Continue</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 2) {
    var upiId = PAY.upiId || 'merchant@upi', payeeName = PAY.payeeName || 'Mini eSports';
    var upiLink = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports_Wallet';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Pay ₹' + wfAmt + '</div>';
    h += '<div style="text-align:center;margin-bottom:16px"><a href="' + upiLink + '" style="display:inline-block;padding:14px 32px;border-radius:14px;background:linear-gradient(135deg,#00c853,#00e676);color:#000;font-weight:700;font-size:16px;text-decoration:none"><i class="fas fa-external-link-alt"></i> Pay via UPI App</a></div>';
    h += '<div style="background:var(--card);border-radius:12px;padding:14px;margin-bottom:14px"><div style="font-size:13px;color:var(--txt2);margin-bottom:4px">UPI ID</div><div style="font-size:16px;font-weight:700;display:flex;justify-content:space-between;align-items:center">' + upiId + '<button onclick="copyTxt(\'' + upiId + '\')" style="background:rgba(0,255,106,.1);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px"><i class="fas fa-copy"></i></button></div><div style="font-size:13px;color:var(--txt2);margin-top:4px">Amount: <strong>₹' + wfAmt + '</strong></div></div>';
    h += '<div class="f-warn"><i class="fas fa-info-circle"></i> After payment, click "I Have Paid" to proceed.</div>';
    h += '<button class="f-btn fb-green" style="margin-top:12px" onclick="wfNext()">I Have Paid →</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 3) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Transaction Details</div>';
    h += '<div class="f-group"><label>UTR Number (Mandatory)</label><input type="text" class="f-input" id="addUtr" placeholder="Enter UTR from your UPI app"><div style="font-size:11px;color:var(--txt2);margin-top:4px">Find UTR in your UPI app payment history</div></div>';
    h += '<div class="f-group"><label>Payment Screenshot</label><div class="upload-area" onclick="$(\'ssInput\').click()"><i class="fas fa-cloud-upload-alt" style="display:block;font-size:28px;color:var(--txt2);margin-bottom:8px"></i><p>Tap to upload screenshot</p><input type="file" id="ssInput" accept="image/*" style="display:none" onchange="handleSS(this)"></div><img id="ssPreview" class="upload-preview" style="display:none"></div>';
    h += '<button class="f-btn fb-green" onclick="submitAddMoney()">Submit for Verification</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  }
  wf.innerHTML = h;
}
function pickAmt(v) { var inp = $('addAmt'); if (inp) inp.value = v; wfAmt = v; }
function wfNext() { if (wfStep === 1) { var a = Number(($('addAmt') || {}).value); if (!a || a < 10) { toast('Minimum ₹10', 'err'); return; } wfAmt = a; } wfStep++; showWFStep(); }
function handleSS(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 800, 0.7, 150, function(b64) { wfScreenshot = b64; var prev = $('ssPreview'); if (prev) { prev.src = b64; prev.style.display = 'block'; } });
}
function compImg(file, maxDim, quality, maxKB, cb) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { if (w > h) { h = h * (maxDim / w); w = maxDim; } else { w = w * (maxDim / h); h = maxDim; } }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      var q = quality, result = c.toDataURL('image/jpeg', q);
      while (result.length > maxKB * 1370 && q > 0.1) { q -= 0.1; result = c.toDataURL('image/jpeg', q); }
      cb(result);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function submitAddMoney() {
  if (!wfScreenshot || wfScreenshot.length < 100) { toast("Payment screenshot upload karo — mandatory hai!", "err"); return; }
  var utr = ($('addUtr') || {}).value;
  if (!utr || utr.trim().length < 6) { toast('Enter valid UTR (min 6 chars)', 'err'); return; }
  utr = utr.trim();
  db.ref('walletRequests').orderByChild('utr').equalTo(utr).once('value', function(s) {
    if (s.exists()) { toast('This UTR has already been submitted!', 'err'); return; }
    var id = db.ref('walletRequests').push().key;
    var data = { requestId: id, uid: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', amount: wfAmt, transactionId: utr, utr: utr, screenshotBase64: wfScreenshot || '', status: 'pending', type: 'deposit', createdAt: firebase.database.ServerValue.TIMESTAMP };
    db.ref('walletRequests/' + id).set(data);
    db.ref('paymentRequests/' + id).set(data);
    cancelWF(); toast('Payment submitted for verification!', 'ok');
  });
}
function watchAd() {
  if (window.Android && window.Android.showRewardedAd) window.Android.showRewardedAd();
  else toast('Ads available only in APK version', 'inf');
}
window.onAdReward = function() { db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + 5; }); toast('+5 Coins earned! 🪙', 'ok'); };

/* ====== RANK ====== */
function calcRk(stats) {
  var s = ((stats.wins || 0) * 100) + ((stats.kills || 0) * 10) + (stats.earnings || 0);
  if (s >= 10000) return { badge: 'Diamond', emoji: '💎', color: '#b964ff', bg: 'rgba(185,100,255,.12)' };
  if (s >= 5000) return { badge: 'Platinum', emoji: '🔷', color: '#00d4ff', bg: 'rgba(0,212,255,.12)' };
  if (s >= 2000) return { badge: 'Gold', emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.12)' };
  if (s >= 500) return { badge: 'Silver', emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.12)' };
  return { badge: 'Bronze', emoji: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,.12)' };
}
function renderRank() {
  var rc = $('rankContent'); if (!rc) return;
  rc.innerHTML = '<div style="text-align:center;padding:40px"><div class="sp-spinner"></div></div>';
  db.ref('users').orderByChild('stats/earnings').limitToLast(50).once('value', function(s) {
    var users = [];
    if (s.exists()) s.forEach(function(c) { var u = c.val(); if (u && u.stats && (u.ign || u.displayName)) users.push(u); });
    users.sort(function(a, b) { return (b.stats.earnings || 0) - (a.stats.earnings || 0); });
    var h = '';
    var podCount = Math.min(users.length, 3);
    if (podCount >= 1) {
      var podOrder = podCount === 1 ? [users[0]] : podCount === 2 ? [users[1], users[0]] : [users[1], users[0], users[2]];
      var podClasses = podCount === 1 ? ['p1'] : podCount === 2 ? ['p2','p1'] : ['p2','p1','p3'];
      var podMedals = podCount === 1 ? ['👑'] : podCount === 2 ? ['🥈','👑'] : ['🥈','👑','🥉'];
      var podNums = podCount === 1 ? ['1'] : podCount === 2 ? ['2','1'] : ['2','1','3'];
      h += '<div class="rank-podium">';
      for (var i = 0; i < podCount; i++) {
        var u = podOrder[i];
        var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
        h += '<div class="pod-item ' + podClasses[i] + '">';
        if (podClasses[i] === 'p1') h += '<div class="pod-crown">👑</div>';
        h += '<div class="pod-ava">' + av + '</div>';
        h += '<div class="pod-medal">' + podMedals[i] + '</div>';
        h += '<div class="pod-name">' + (u.ign || u.displayName || 'Player') + '</div>';
        h += '<div class="pod-stats">K:' + ((u.stats||{}).kills || 0) + '</div>';
        h += '<div class="pod-earn">₹' + ((u.stats||{}).earnings || 0) + '</div>';
        h += '<div class="pod-pedestal">' + podNums[i] + '</div></div>';
      }
      h += '</div>';
    }
    for (var i = 3; i < users.length; i++) {
      var u = users[i], rk = calcRk(u.stats || {});
      var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
      h += '<div class="rank-row"><div class="rank-num">#' + (i + 1) + '</div>';
      h += '<div class="rank-ava">' + av + '</div>';
      h += '<div class="rank-info"><div class="rn">' + (u.ign || u.displayName || 'Player') + '</div>';
      h += '<div class="rs">K:' + (u.stats.kills || 0) + ' E:₹' + (u.stats.earnings || 0) + '</div></div>';
      h += '<span class="rank-badge" style="background:' + rk.bg + ';color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</span>';
      h += '<div class="rank-earn">₹' + (u.stats.earnings || 0) + '</div></div>';
    }
    if (!users.length) h = '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ranked players yet</p></div>';
    rc.innerHTML = h;
  });
}

/* ====== PROFILE ====== */
function renderProfile() {
  var pc = $('profileContent'); if (!pc || !UD) return;
  var av = UD.profileImage ? '<img src="' + UD.profileImage + '">' : (UD.ign || UD.displayName || '?').charAt(0).toUpperCase();
  var st = UD.stats || {}, rk = calcRk(st);
  var lv = 1 + Math.floor((st.matches||0)/3) + Math.floor((st.wins||0)*2) + Math.floor((st.kills||0)/10) + Math.floor((st.earnings||0)/50);
  var xp = ((st.matches||0)%3)*3 + ((st.kills||0)%10);
  var maxXp = 10, xpPct = Math.min(Math.round((xp/maxXp)*100), 100);
  
  /* Get display UID — show FF UID if available, otherwise show partial Firebase UID */
  var displayUid = UD.ffUid || U.uid.substring(0, 12);
  
  var h = '<div class="prof-header"><div class="prof-ava-wrap"><div class="prof-ava">' + av + '</div><div class="prof-edit-btn" onclick="$(\'profImgIn\').click()"><i class="fas fa-pencil-alt"></i></div><input type="file" id="profImgIn" accept="image/*" style="display:none" onchange="uploadProfImg(this)"></div>';
  h += '<div class="prof-name">' + (UD.ign || UD.displayName || 'Player') + '</div>';
  /* ALWAYS show UID below name in large text */
  h += '<div style="font-size:13px;color:var(--txt2);margin-top:2px;font-weight:600">UID: ' + displayUid + '</div>';
  h += '<div class="prof-email">' + (UD.email || '') + '</div></div>';
  h += '<div class="prof-stats"><div class="ps-box psb"><div class="ps-val">' + (st.matches || 0) + '</div><div class="ps-lbl">Matches</div></div>';
  h += '<div class="ps-box psr"><div class="ps-val">' + (st.kills || 0) + '</div><div class="ps-lbl">Kills</div></div>';
  h += '<div class="ps-box psy"><div class="ps-val">₹' + (st.earnings || 0) + '</div><div class="ps-lbl">Earned</div></div></div>';
  h += '<div class="xp-bar-wrap"><div class="xp-bar-top"><span class="xp-level">Level ' + lv + ' — ' + rk.emoji + ' ' + rk.badge + '</span><span class="xp-text">' + xp + '/' + maxXp + ' XP</span></div>';
  h += '<div class="xp-track"><div class="xp-fill" style="width:' + xpPct + '%"></div></div></div>';
  h += '<div class="prof-section"><h3><i class="fas fa-gamepad"></i> Game Info</h3>';
  h += '<div class="gi-row"><span class="gi-l">IGN</span><span class="gi-v">' + (UD.ign || '-') + '</span></div>';
  h += '<div class="gi-row"><span class="gi-l">FF UID</span><span class="gi-v">' + (UD.ffUid || '-') + '</span></div></div>';
  /* Show pending status with submitted details */
  if (UD.profileRequired === true || UD.profileStatus === 'pending') {
    h += '<div class="pending-box" style="flex-direction:column;align-items:flex-start">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-clock"></i> Profile update pending admin approval...</div>';
    /* Show what user submitted */
    var pendingIgn = UD.pendingIgn || UD.ign || '-';
    var pendingUid = UD.pendingUid || UD.ffUid || '-';
    h += '<div style="width:100%;padding:10px;background:rgba(0,0,0,.2);border-radius:8px;margin-top:4px">';
    h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">You submitted:</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt)">IGN: ' + pendingIgn + '</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-top:2px">UID: ' + pendingUid + '</div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:6px">Admin will verify and approve these details</div>';
    h += '</div>';
  }
  h += '<button class="prof-btn pb-orange" onclick="showProfileUpdate()" ' + (UD.profileStatus === 'pending' ? 'disabled' : '') + '><i class="fas fa-edit"></i> Request Profile Update</button>';
  // My Team
  h += '<div class="prof-section"><h3><i class="fas fa-users"></i> My Team</h3>';
  h += '<div class="team-card"><h4><i class="fas fa-user-friends"></i> Duo Partner</h4><div class="team-members">';
  h += '<div class="tm-slot"><div class="tm-ava filled">' + (UD.profileImage ? '<img src="' + UD.profileImage + '">' : (UD.ign || 'Y').charAt(0)) + '</div><div class="tm-name you">You 👑</div></div>';
  var duoT = UD.duoTeam;
  if (duoT && duoT.memberUid) h += '<div class="tm-slot"><div class="tm-ava filled">' + (duoT.memberName || 'T').charAt(0) + '</div><div class="tm-name">' + (duoT.memberName || 'Teammate') + '</div><div class="tm-remove" onclick="removeTM(\'duo\',0)">✕ Remove</div></div>';
  else h += '<div class="tm-slot"><div class="tm-ava" onclick="addTM(\'duo\')"><i class="fas fa-plus"></i></div><div class="tm-name">Add</div></div>';
  h += '</div></div>';
  h += '<div class="team-card"><h4><i class="fas fa-users"></i> Squad Team</h4><div class="team-members">';
  h += '<div class="tm-slot"><div class="tm-ava filled">' + (UD.profileImage ? '<img src="' + UD.profileImage + '">' : (UD.ign || 'Y').charAt(0)) + '</div><div class="tm-name you">You 👑</div></div>';
  var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
  for (var i = 0; i < 3; i++) {
    if (sqMembers[i]) h += '<div class="tm-slot"><div class="tm-ava filled">' + (sqMembers[i].name || 'T').charAt(0) + '</div><div class="tm-name">' + (sqMembers[i].name || 'Teammate') + '</div><div class="tm-remove" onclick="removeTM(\'squad\',' + i + ')">✕ Remove</div></div>';
    else h += '<div class="tm-slot"><div class="tm-ava" onclick="addTM(\'squad\')"><i class="fas fa-plus"></i></div><div class="tm-name">Add</div></div>';
  }
  h += '</div></div></div>';
  // Refer & Earn
  var refCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
  h += '<div class="ref-card"><div class="ref-icon">🎁</div><div class="ref-title">Refer & Earn</div>';
  h += '<div class="ref-sub">Invite friends and earn 🪙 10 Coins per referral!</div>';
  h += '<div class="ref-code-box"><span class="rc-code">' + refCode + '</span><button class="rc-copy" onclick="copyTxt(\'' + refCode + '\')"><i class="fas fa-copy"></i></button></div>';
  h += '<button class="ref-share-btn" onclick="shareRef(\'' + refCode + '\')" style="background:linear-gradient(135deg,#25d366,#128c7e);color:#fff"><i class="fab fa-whatsapp"></i> Share via WhatsApp</button>';
  if (!UD.referredBy) {
    h += '<div style="margin-top:12px;padding:12px;background:var(--card2);border-radius:12px">';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:8px">👥 Friend ka referral code enter karo:</div>';
    h += '<div style="display:flex;gap:8px">';
    h += '<input type="text" id="applyRefInput" placeholder="Enter code" style="flex:1;padding:10px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--txt);font-size:13px;text-transform:uppercase">';
    h += '<button onclick="applyReferralCode()" style="padding:10px 14px;border-radius:10px;background:var(--primary);color:#000;font-weight:700;border:none;cursor:pointer">Apply</button>';
    h += '</div></div>';
  } else {
    h += '<div style="margin-top:10px;font-size:11px;color:var(--green);text-align:center"><i class="fas fa-check-circle"></i> Referral code already applied</div>';
  }
  h += '<div class="ref-stats"><div class="ref-stat-box"><div class="rsv">' + (UD.referralCount || 0) + '</div><div class="rsl">Friends Joined</div></div>';
  h += '<div class="ref-stat-box"><div class="rsv">🪙 ' + (UD.referralCoinsEarned || 0) + '</div><div class="rsl">Coins Earned</div></div></div>';
  if (REFS.length > 0) {
    h += '<div style="margin-top:12px;text-align:left">';
    REFS.forEach(function(r) { h += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card);border-radius:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:10px;background:rgba(185,100,255,.12);color:var(--purple);display:flex;align-items:center;justify-content:center;font-size:12px"><i class="fas fa-user-plus"></i></div><div style="flex:1"><div style="font-size:13px;font-weight:600">' + (r.referredName || 'User') + '</div><div style="font-size:11px;color:var(--txt2)">' + timeAgo(r.createdAt) + '</div></div><div style="font-size:13px;font-weight:700;color:var(--yellow)">+🪙 10</div></div>'; });
    h += '</div>';
  }
  h += '</div>';
  // Voucher
  h += '<div class="prof-section"><h3><i class="fas fa-ticket-alt"></i> Redeem Voucher</h3>';
  h += '<div class="voucher-box"><input type="text" id="voucherIn" placeholder="Enter voucher code"><button onclick="redeemVoucher()">Redeem</button></div></div>';
  // Buttons
  h += '<button class="prof-btn pb-green" onclick="navTo(\'chat\')"><i class="fas fa-headset"></i> Live Chat Support</button>';
  h += '<button class="prof-btn pb-gray" onclick="showSupportForm()"><i class="fas fa-ticket-alt"></i> Submit Ticket</button>';
  h += '<button class="prof-btn pb-gray" onclick="showRules()"><i class="fas fa-book"></i> Rules & Fair Play</button>';

  // Achievements section
  h += '<div class="prof-section"><h3 style="display:flex;align-items:center;gap:8px"><i class="fas fa-medal" style="color:var(--yellow)"></i> Achievements</h3>';
  if (window.renderAchievementsHTML) {
    h += renderAchievementsHTML();
  } else {
    h += '<p style="color:var(--txt2);font-size:13px;text-align:center;padding:12px">No achievements yet — play more!</p>';
  }
  h += '</div>';
  // Share card button
  h += '<button class="prof-btn" onclick="window.generateProfileCard && generateProfileCard()" style="background:linear-gradient(135deg,rgba(0,255,156,.15),rgba(0,255,156,.05));color:var(--green);border:1px solid rgba(0,255,156,.25)"><i class="fas fa-id-card"></i> Share Player Card</button>';
  h += '<button class="prof-btn pb-red" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> Logout</button>';
  pc.innerHTML = h;
}

function uploadProfImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 400, 0.8, 150, function(b64) { db.ref('users/' + U.uid + '/profileImage').set(b64); toast('Photo updated!', 'ok'); });
}
function applyReferralCode() {
  var inp = document.getElementById('applyRefInput');
  var code = inp ? inp.value.trim().toUpperCase() : '';
  if (!code || code.length < 4) { toast('Valid code enter karo', 'err'); return; }
  var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
  if (code === myCode) { toast('Apna code nahi laga sakte!', 'err'); return; }
  db.ref('users').orderByChild('referralCode').equalTo(code).once('value', function(s) {
    if (!s.exists()) { toast('Yeh code nahi mila', 'err'); return; }
    var referrerUid = null;
    s.forEach(function(c) { referrerUid = c.key; });
    if (!referrerUid || referrerUid === U.uid) { toast('Invalid code', 'err'); return; }
    db.ref('users/' + U.uid).update({ referredBy: referrerUid, referredByCode: code });
    db.ref('users/' + referrerUid + '/referralCount').transaction(function(v) { return (v||0)+1; });
    db.ref('users/' + referrerUid + '/referralCoinsEarned').transaction(function(v) { return (v||0)+10; });
    db.ref('users/' + referrerUid + '/coins').transaction(function(v) { return (v||0)+10; });
    var rrid = db.ref('referrals').push().key;
    db.ref('referrals/' + rrid).set({
      referrerId: referrerUid, referredUid: U.uid, referredName: UD.ign || '',
      code: code, reward: 10, verified: true, createdAt: Date.now()
    });
    toast('✅ Code apply hua! Tumhare dost ko 🪙10 coins mile!', 'ok');
    renderProfile();
  });
}
function shareRef(code) {
  var url = window.location.href;
  var msg = '🎮 Join Mini eSports — India\'s Best Free Fire Tournament App! 🔥\n\n💰 Win Real Cash Prizes!\n🪙 Get FREE bonus coins on signup!\n\n👉 Use my referral code: ' + code + '\n📲 Download now:';
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Refer & Earn', text: msg, url: url }).catch(function() {
      window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
    });
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
  }
}
function addTM(mode) {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  var h = '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><i class="fas fa-user-plus"></i> Add ' + (mode === 'duo' ? 'Duo Partner' : 'Squad Member') + '</div>';
  h += '<div class="f-group"><label>Teammate FF UID (Required)</label><input type="text" class="f-input" id="tmUid" placeholder="Enter FF UID"></div>';
  h += '<div class="f-group"><label>Teammate IGN (Required)</label><input type="text" class="f-input" id="tmIgn" placeholder="Enter IGN"></div>';
  h += '<button class="f-btn fb-green" onclick="saveTM(\'' + mode + '\')">Add Teammate</button>';
  openModal('Add Teammate', h);
}
function saveTM(mode) {
  var uid = ($('tmUid') || {}).value, ign = ($('tmIgn') || {}).value;
  if (!uid || uid.trim().length < 5) { toast('Enter valid UID (min 5 digits)', 'err'); return; }
  if (!ign || !ign.trim()) { toast('Enter IGN', 'err'); return; }
  uid = uid.trim(); ign = ign.trim();
  // Self-check
  if (uid === (UD.ffUid || '')) { toast('Cannot add yourself!', 'err'); return; }
  db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
    if (!s.exists()) { toast('UID "' + uid + '" not found in database!', 'err'); return; }
    var partnerData = null, partnerKey = null;
    s.forEach(function(c) { partnerData = c.val(); partnerKey = c.key; });
    if (!partnerData || !partnerKey) { toast('Error loading partner data', 'err'); return; }
    var myUid = UD.ffUid || '';
    var myName = UD.ign || UD.displayName || 'Player';
    var partnerName = partnerData.ign || partnerData.displayName || ign;
    if (mode === 'duo') {
      // TWO-WAY SYNC: Save in BOTH users' profiles (duoTeam + partnerUid)
      var myTeamData = { memberUid: uid, memberName: partnerName };
      var partnerTeamData = { memberUid: myUid, memberName: myName };
      // Save duoTeam object
      db.ref('users/' + U.uid + '/duoTeam').set(myTeamData);
      db.ref('users/' + partnerKey + '/duoTeam').set(partnerTeamData);
      // ALSO save partnerUid for quick lookup
      db.ref('users/' + U.uid + '/partnerUid').set(uid);
      db.ref('users/' + partnerKey + '/partnerUid').set(myUid);
      console.log('[Mini eSports] ✅ Duo sync (2-way): ' + myName + ' ↔ ' + partnerName);
      console.log('[Mini eSports]   users/' + U.uid + '/partnerUid = ' + uid);
      console.log('[Mini eSports]   users/' + partnerKey + '/partnerUid = ' + myUid);
    } else {
      // Check squad not full
      var myMembers = (UD.squadTeam && UD.squadTeam.members) || [];
      if (myMembers.length >= 3) { toast('Squad full! (Max 3 teammates)', 'err'); return; }
      // Check not already in squad
      var alreadyInMySquad = false;
      myMembers.forEach(function(m) { if (m.uid === uid) alreadyInMySquad = true; });
      if (alreadyInMySquad) { toast('Already in your squad!', 'inf'); return; }
      // TWO-WAY SYNC: Add to BOTH users' squads
      myMembers.push({ uid: uid, name: partnerName });
      db.ref('users/' + U.uid + '/squadTeam/members').set(myMembers);
      // Also save squad UIDs array for quick lookup
      db.ref('users/' + U.uid + '/squadUids').set(myMembers.map(function(m) { return m.uid; }));
      var partnerMembers = (partnerData.squadTeam && partnerData.squadTeam.members) || [];
      var alreadyInPartnerSquad = false;
      partnerMembers.forEach(function(m) { if (m.uid === myUid) alreadyInPartnerSquad = true; });
      if (!alreadyInPartnerSquad) {
        partnerMembers.push({ uid: myUid, name: myName });
        db.ref('users/' + partnerKey + '/squadTeam/members').set(partnerMembers);
        db.ref('users/' + partnerKey + '/squadUids').set(partnerMembers.map(function(m) { return m.uid; }));
      }
      console.log('[Mini eSports] ✅ Squad sync (2-way): ' + myName + ' ↔ ' + partnerName);
    }
    closeModal(); toast('✅ ' + partnerName + ' added as teammate! (Synced both profiles)', 'ok');
  });
}
function removeTM(mode, idx) {
  if (mode === 'duo') {
    var old = UD.duoTeam;
    // Remove from MY profile (both duoTeam + partnerUid)
    db.ref('users/' + U.uid + '/duoTeam').remove();
    db.ref('users/' + U.uid + '/partnerUid').remove();
    // TWO-WAY: Remove from PARTNER's profile too
    if (old && old.memberUid) {
      db.ref('users').orderByChild('ffuid').equalTo(old.memberUid).once('value', function(s) {
        if (s.exists()) s.forEach(function(c) {
          db.ref('users/' + c.key + '/duoTeam').remove();
          db.ref('users/' + c.key + '/partnerUid').remove();
          console.log('[Mini eSports] ✅ Duo removed from both profiles (duoTeam + partnerUid)');
        });
      });
    }
    toast('Duo partner removed (both profiles updated)', 'ok');
  } else {
    var members = (UD.squadTeam && UD.squadTeam.members) || [];
    if (idx < 0 || idx >= members.length) return;
    var removed = members[idx];
    // Remove from MY squad
    members.splice(idx, 1);
    db.ref('users/' + U.uid + '/squadTeam/members').set(members.length > 0 ? members : null);
    db.ref('users/' + U.uid + '/squadUids').set(members.length > 0 ? members.map(function(m) { return m.uid; }) : null);
    // TWO-WAY: Remove ME from PARTNER's squad
    if (removed && removed.uid) {
      db.ref('users').orderByChild('ffuid').equalTo(removed.uid).once('value', function(s) {
        if (s.exists()) s.forEach(function(c) {
          var pm = (c.val().squadTeam && c.val().squadTeam.members) || [];
          pm = pm.filter(function(m) { return m.uid !== (UD.ffUid || ''); });
          db.ref('users/' + c.key + '/squadTeam/members').set(pm.length > 0 ? pm : null);
          db.ref('users/' + c.key + '/squadUids').set(pm.length > 0 ? pm.map(function(m) { return m.uid; }) : null);
          console.log('[Mini eSports] ✅ Squad member removed from both profiles (members + UIDs)');
        });
      });
    }
    toast('Squad member removed (both profiles updated)', 'ok');
  }
}
function showProfileUpdate() {
  var h = '<div class="f-group"><label>In-Game Name (IGN)</label><input type="text" class="f-input" id="puIgn" placeholder="Your Free Fire IGN" value="' + (UD.ign || '') + '"></div>';
  h += '<div class="f-group"><label>Free Fire UID (5-15 digits)</label><input type="text" class="f-input" id="puUid" placeholder="Your FF UID" value="' + (UD.ffUid || '') + '"></div>';
  h += '<div class="f-warn"><i class="fas fa-exclamation-triangle"></i> Only real Free Fire IGN and UID allowed. Fake info = disqualified.</div>';
  h += '<button class="f-btn fb-orange" style="margin-top:14px" onclick="doProfileUpdate()">Submit for Verification</button>';
  openModal('Profile Update', h);
}
function doProfileUpdate() {
  var ign = ($('puIgn') || {}).value, uid = ($('puUid') || {}).value;
  if (!ign || !ign.trim()) { toast('Enter IGN', 'err'); return; }
  if (!uid || uid.trim().length < 5 || uid.trim().length > 15 || !/^\d+$/.test(uid.trim())) { toast('UID must be 5-15 digits', 'err'); return; }
  ign = ign.trim(); uid = uid.trim();
  db.ref('users').orderByChild('ign').equalTo(ign).once('value', function(s) {
    var dup = false;
    if (s.exists()) s.forEach(function(c) { if (c.key !== U.uid) dup = true; });
    if (dup) { toast('IGN already taken!', 'err'); return; }
    
    /* Determine request type: verification (new user) or update (existing verified user) */
    var isVerified = (UD.profileStatus === 'approved');
    var reqType = isVerified ? 'update' : 'verification';
    
    /* Save to profileRequests/{uid} — use user's UID as key for easy lookup */
    var requestData = {
      /* User identity */
      uid: U.uid,
      name: UD.displayName || '',
      userName: UD.ign || UD.displayName || '',
      displayName: UD.displayName || '',
      userEmail: UD.email || '',
      
      /* Requested new values (EXPLICIT fields for Admin) */
      requestedIgn: ign,
      requestedUid: uid,
      
      /* Also save as ign/ffuid for backward compatibility */
      ign: ign,
      ffUid: uid,
      
      /* Old values for comparison */
      oldIgn: UD.ign || '',
      oldUid: UD.ffUid || '',
      
      /* Request metadata */
      type: reqType,
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    /* Save to profileRequests/{uid} path — one request per user */
    db.ref('profileRequests/' + U.uid).set(requestData);
    
    /* Also update user's profile with requested values (for display while pending) */
    db.ref('users/' + U.uid).update({ 
      profileStatus: 'pending', 
      profileRequired: true,
      pendingIgn: ign,
      pendingUid: uid
    });
    
    closeModal(); 
    toast('Profile sent for verification!', 'ok');
    console.log('[Mini eSports] ✅ Profile request submitted: type=' + reqType + ', requestedIgn=' + ign + ', requestedUid=' + uid);
  });
}
function redeemVoucher() {
  var code = ($('voucherIn') || {}).value;
  if (!code || !code.trim()) { toast('Enter voucher code', 'err'); return; }
  code = code.trim().toUpperCase();
  db.ref('vouchers/' + code).once('value', function(s) {
    if (!s.exists()) { toast('Invalid voucher code', 'err'); return; }
    var v = s.val();
    if (v.status !== 'active') { toast('Voucher expired', 'err'); return; }
    if (v.usedBy && v.usedBy[U.uid]) { toast('Already redeemed!', 'inf'); return; }
    if (v.maxUses && (v.usedCount || 0) >= v.maxUses) { toast('Voucher limit reached', 'err'); return; }
    var rt = v.rewardType || 'coins', ra = Number(v.rewardAmount) || 0;
    if (rt === 'coins') db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + ra; });
    else db.ref('users/' + U.uid + '/realMoney/bonus').transaction(function(b) { return (b || 0) + ra; });
    db.ref('vouchers/' + code + '/usedBy/' + U.uid).set(true);
    db.ref('vouchers/' + code + '/usedCount').transaction(function(c) { return (c || 0) + 1; });
    toast('Voucher redeemed! +' + (rt === 'coins' ? '🪙 ' : '₹') + ra, 'ok');
  });
}
function showSupportForm() {
  var h = '<div class="f-group"><label>Issue Type</label><select class="f-input" id="supType"><option value="payment">Payment Issue</option><option value="match">Match Issue</option><option value="account">Account Issue</option><option value="bug">Bug Report</option><option value="other">Other</option></select></div>';
  h += '<div class="f-group"><label>Describe your issue</label><textarea class="f-input" id="supMsg" placeholder="Explain your problem in detail..."></textarea></div>';
  h += '<button class="f-btn fb-green" onclick="submitSupport()">Submit Ticket</button>';
  openModal('Support Ticket', h);
}
function submitSupport() {
  var type = ($('supType') || {}).value, msg = ($('supMsg') || {}).value;
  if (!msg || !msg.trim()) { toast('Describe your issue', 'err'); return; }
  var id = db.ref('supportRequests').push().key;
  db.ref('supportRequests/' + id).set({ requestId: id, userId: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', userIGN: UD.ign || '', userFFUID: UD.ffUid || '', type: type, message: msg.trim(), status: 'open', createdAt: firebase.database.ServerValue.TIMESTAMP });
  closeModal(); toast('Ticket submitted!', 'ok');
}
function showRules() {
  var rules = ['Use only your registered IGN and UID. Mismatch = disqualification.', 'No teaming with enemies. Fair play only.', 'Join the room on time. Late = no refund.', 'Screenshots/proof may be required for disputes.', 'Admin decisions are final in all matters.', 'No abusive language in chat or support.', 'Multiple accounts will result in permanent ban.'];
  var h = '';
  rules.forEach(function(r, i) { h += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:24px;height:24px;border-radius:8px;background:rgba(0,255,106,.1);color:var(--green);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.5;color:var(--txt2)">' + r + '</div></div>'; });
  openModal('Rules & Fair Play', h);
}

/* ====== CHAT (STANDARDIZED - support/ path only) ====== */
/* BUG FIX #4: Use ONLY support/{uid} path for consistency with Admin panel */
function startChat() {
  if (!U) return;
  /* Sync FULL user identity to support/ path (Admin's primary path) */
  var userInfo = {
    userId: U.uid, uid: U.uid,
    userName: UD ? (UD.ign || UD.displayName || '') : '',
    displayName: UD ? (UD.displayName || '') : '',
    userEmail: UD ? (UD.email || '') : '',
    userIGN: UD ? (UD.ign || '') : '',
    userFFUID: UD ? (UD.ffUid || '') : '',
    profileImage: UD ? (UD.profileImage || '') : ''
  };
  db.ref('support/' + U.uid + '/info').update(userInfo);

  /* Check admin online status */
  db.ref('appSettings/supportOnline').on('value', function(s) {
    var el = $('chatSt');
    if (el) {
      if (s.val()) {
        el.textContent = 'Online';
        el.style.color = 'var(--green)';
      } else {
        el.textContent = 'Away';
        el.style.color = 'var(--txt2)';
      }
    }
  });

  /* Listen ONLY to support/{uid}/messages — single source of truth */
  db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').on('value', function(s) {
    renderChatMsgs(s);
  });
}

function renderChatMsgs(s) {
  var cm = $('chatMsgs'); if (!cm) return;
  var msgs = []; if (s.exists()) s.forEach(function(c) { msgs.push(c.val()); });
  if (!msgs.length) {
    cm.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--txt2)"><div style="font-size:40px;margin-bottom:8px;opacity:.2">💬</div><p style="font-size:13px">Koi message nahi — say hi!</p></div>';
    return;
  }
  var h = '', ld = '';
  msgs.forEach(function(m) {
    var isAdmin = m.senderId === 'admin' || m.senderRole === 'admin';
    var ts = new Date(m.createdAt || m.timestamp || Date.now());
    var ds = ts.toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    var tm = ts.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (ds !== ld) {
      ld = ds;
      h += '<div style="text-align:center;margin:12px 0"><span style="font-size:10px;color:var(--txt2);background:var(--card2);padding:4px 12px;border-radius:20px;border:1px solid var(--border)">' + ds + '</span></div>';
    }
    if (isAdmin) {
      h += '<div style="display:flex;justify-content:flex-start;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:var(--card2);border:1px solid var(--border);border-radius:4px 16px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="font-size:10px;color:var(--primary);margin-bottom:4px;font-weight:700;display:flex;align-items:center;gap:4px"><span>🛡️</span> Admin</div>' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + '</div>' +
           '</div></div>';
    } else {
      h += '<div style="display:flex;justify-content:flex-end;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);border-radius:16px 4px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + ' <span style="color:var(--green)">✓✓</span></div>' +
           '</div></div>';
    }
  });
  cm.innerHTML = h;
  cm.scrollTop = cm.scrollHeight;
}

function sendChat() {
  var inp = $('chatIn'); if (!inp) return;
  var msg = inp.value.trim(); if (!msg) return; inp.value = '';

  var msgData = {
    senderId: U.uid,
    senderUid: U.uid,
    senderName: UD ? (UD.ign || UD.displayName || '') : '',
    senderDisplayName: UD ? (UD.displayName || '') : '',
    senderEmail: UD ? (UD.email || '') : '',
    senderRole: 'user',
    text: msg,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };

  /* BUG FIX #4: Save ONLY to support/ path — Admin's primary path */
  var id = db.ref('support/' + U.uid + '/messages').push().key;
  db.ref('support/' + U.uid + '/messages/' + id).set(msgData);

  /* Update chat info for admin panel to show latest message */
  var infoUpdate = {
    lastMessage: msg,
    lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
    unreadByAdmin: true
  };
  db.ref('support/' + U.uid + '/info').update(infoUpdate);
}

/* ====== NOTIFICATIONS ====== */
function renderNotifs() {
  var nl = $('notifList'); if (!nl) return;
  if (!NOTIFS.length) { nl.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>'; return; }
  var rd = (UD && UD.readNotifications) || {}, h = '';
  NOTIFS.forEach(function(n) {
    var unread = !rd[n._key];
    var ic = 'ny'; // default yellow
    if (n.type === 'room_released') ic = 'ng';
    else if (n.type === 'new_match' || n.type === 'match_starting') ic = 'nb';
    else if (n.type === 'chat_reply') ic = 'np';
    else if (n.type === 'wallet_approved' || n.type === 'withdraw_done') ic = 'ng';
    else if (n.type === 'wallet_rejected' || n.type === 'withdraw_rejected') ic = 'nr';
    else if (n.type === 'match_completed' || n.type === 'result') ic = 'ng';
    h += '<div class="notif-card' + (unread ? ' unread' : '') + '" onclick="openNotif(\'' + n._key + '\')">';
    h += '<div class="notif-icon ' + ic + '"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
    h += '<div class="notif-body"><div class="notif-title">' + (n.title || 'Notification') + '</div>';
    h += '<div class="notif-msg">' + (n.message || '') + '</div>';
    h += '<div class="notif-time">' + timeAgo(n.createdAt) + '</div>';
    if (n.matchName) h += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:rgba(185,100,255,.1);color:var(--purple);margin-top:4px">' + n.matchName + '</span>';
    h += '</div></div>';
  });
  nl.innerHTML = h;
}
function openNotif(key) {
  db.ref('users/' + U.uid + '/readNotifications/' + key).set(true);
  var n = null; NOTIFS.forEach(function(x) { if (x._key === key) n = x; }); if (!n) return;
  var h = '<div style="text-align:center;font-size:36px;margin-bottom:12px"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
  h += '<div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">' + (n.title || 'Notification') + '</div>';
  h += '<div style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:14px">' + timeAgo(n.createdAt) + '</div>';
  h += '<div style="font-size:14px;line-height:1.6;color:var(--txt)">' + (n.message || '') + '</div>';
  if (n.matchId && n.type === 'room_released') {
    var t = MT[n.matchId];
    if (t && t.roomId && t.roomPassword && hasJ(n.matchId)) {
      h += '<div class="room-box rb-green" style="margin-top:14px"><div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-top:8px;margin-bottom:4px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    }
  }
  openModal('Notification', h);
}