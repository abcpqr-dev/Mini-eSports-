/* ====== FEATURE 3: DEVICE FINGERPRINT & ANTI-CHEAT ====== */
/* Prevents duplicate joins from same device, saves device meta */

(function() {
  // Generate persistent device ID
  function getDeviceId() {
    var did = localStorage.getItem('_minieSport_did');
    if (!did) {
      did = 'D' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('_minieSport_did', did);
    }
    return did;
  }

  // Check if this device already joined a match
  function checkDeviceJoin(matchId, callback) {
    var did = getDeviceId();
    db.ref('deviceJoins/' + did + '/' + matchId).once('value', function(s) {
      if (s.exists()) {
        callback(true, s.val());
      } else {
        callback(false, null);
      }
    });
  }

  // Save device join record
  function saveDeviceJoin(matchId, joinRequestId) {
    var did = getDeviceId();
    db.ref('deviceJoins/' + did + '/' + matchId).set({
      uid: U.uid,
      joinRequestId: joinRequestId,
      joinedAt: Date.now(),
      userAgent: navigator.userAgent.substring(0, 80)
    });
  }

  // Save device meta to join request
  function saveJoinMeta(joinRequestId) {
    var did = getDeviceId();
    db.ref('joinRequests/' + joinRequestId + '/deviceMeta').set({
      deviceId: did,
      userAgent: navigator.userAgent.substring(0, 80),
      joinTime: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenRes: screen.width + 'x' + screen.height,
      language: navigator.language || 'unknown'
    });
  }

  // Export functions
  window.getDeviceId = getDeviceId;
  window.checkDeviceJoin = checkDeviceJoin;
  window.saveDeviceJoin = saveDeviceJoin;
  window.saveJoinMeta = saveJoinMeta;

  // Hook into doJoin to add anti-cheat checks
  var _origDoJoin = window.doJoin;
  if (_origDoJoin) {
    window.doJoin = function(id) {
      checkDeviceJoin(id, function(alreadyJoined, data) {
        if (alreadyJoined && data && data.uid !== U.uid) {
          toast('⚠️ Another account already joined from this device!', 'err');
          return;
        }
        _origDoJoin(id);
      });
    };
  }

  console.log('[Mini eSports] ✅ Feature 3: Anti-Cheat loaded (Device: ' + getDeviceId().substring(0, 8) + ')');
})();
