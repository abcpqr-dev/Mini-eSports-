/* ====== FEATURE 6: WIN STREAK & ACHIEVEMENT BADGES ====== */
/* Tracks achievements and shows badges in profile */

(function() {
  var ACHIEVEMENTS = [
    { id: 'first_drop', title: '🎮 First Drop', desc: 'Join your first match', check: function(s) { return s.matches >= 1; } },
    { id: 'on_fire', title: '🔥 On Fire', desc: 'Join 3 matches', check: function(s) { return s.matches >= 3; } },
    { id: 'loyal', title: '🏅 Loyal Player', desc: 'Join 10 matches', check: function(s) { return s.matches >= 10; } },
    { id: 'pro', title: '🚀 Pro Player', desc: 'Join 25 matches', check: function(s) { return s.matches >= 25; } },
    { id: 'veteran', title: '⭐ Veteran', desc: 'Join 50 matches', check: function(s) { return s.matches >= 50; } },
    { id: 'hat_trick', title: '⚡ Hat-Trick', desc: 'Win 3 matches', check: function(s) { return s.wins >= 3; } },
    { id: 'champion', title: '🏆 Champion', desc: 'Win 10 matches', check: function(s) { return s.wins >= 10; } },
    { id: 'kill_machine', title: '💀 Kill Machine', desc: 'Get 50 kills total', check: function(s) { return s.kills >= 50; } },
    { id: 'terminator', title: '🤖 Terminator', desc: 'Get 200 kills total', check: function(s) { return s.kills >= 200; } },
    { id: 'earner', title: '💵 Money Maker', desc: 'Earn ₹100 total', check: function(s) { return s.earnings >= 100; } },
    { id: 'diamond', title: '💎 Diamond', desc: 'Earn ₹1000 total', check: function(s) { return s.earnings >= 1000; } },
    { id: 'legend', title: '👑 Legend', desc: 'Earn ₹5000 total', check: function(s) { return s.earnings >= 5000; } }
  ];

  function checkAchievements() {
    if (!UD || !U) return;
    var stats = UD.stats || { matches: 0, wins: 0, kills: 0, earnings: 0 };
    var existing = UD.achievements || {};

    ACHIEVEMENTS.forEach(function(a) {
      if (a.check(stats) && !existing[a.id]) {
        // New achievement unlocked!
        db.ref('users/' + U.uid + '/achievements/' + a.id).set({
          title: a.title,
          desc: a.desc,
          unlockedAt: Date.now()
        });
        toast(a.title + ' Achievement Unlocked! 🎉', 'ok');
        console.log('[Mini eSports] 🏅 Achievement unlocked: ' + a.title);
      }
    });
  }

  function renderAchievementsHTML() {
    var existing = (UD && UD.achievements) || {};
    var h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">';
    ACHIEVEMENTS.forEach(function(a) {
      var unlocked = !!existing[a.id];
      h += '<div style="background:' + (unlocked ? 'rgba(0,255,106,.06)' : 'var(--card2)') + ';border:1px solid ' + (unlocked ? 'rgba(0,255,106,.2)' : 'var(--border)') + ';border-radius:10px;padding:10px;text-align:center;' + (unlocked ? '' : 'opacity:0.4;filter:grayscale(1);') + '">';
      h += '<div style="font-size:20px">' + a.title.split(' ')[0] + '</div>';
      h += '<div style="font-size:10px;font-weight:600;margin-top:4px;color:' + (unlocked ? 'var(--green)' : 'var(--txt2)') + '">' + a.title.split(' ').slice(1).join(' ') + '</div>';
      h += '<div style="font-size:9px;color:var(--txt2);margin-top:2px">' + a.desc + '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  // Export functions
  window.checkAchievements = checkAchievements;
  window.renderAchievementsHTML = renderAchievementsHTML;

  // Hook into user data update to check achievements
  var _checkTimer = null;
  var _origApplyState = window.applyState;
  if (_origApplyState) {
    window.applyState = function() {
      _origApplyState();
      // Debounce achievement check to avoid rapid fire
      clearTimeout(_checkTimer);
      _checkTimer = setTimeout(checkAchievements, 2000);
    };
  }

  console.log('[Mini eSports] ✅ Feature 6: Achievements loaded');
})();
