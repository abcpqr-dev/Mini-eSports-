/* ====== FEATURE 8: SHAREABLE PLAYER PROFILE CARD ====== */
/* Generates a canvas-based profile card for sharing */

(function() {
  window.generateProfileCard = function() {
    if (!UD || !U) { toast('Login required', 'err'); return; }

    var canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 240;
    var ctx = canvas.getContext('2d');

    // Background gradient
    var bg = ctx.createLinearGradient(0, 0, 400, 240);
    bg.addColorStop(0, '#050507');
    bg.addColorStop(1, '#0c0b10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 400, 240);

    // Neon border
    ctx.strokeStyle = '#00ff6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, 4, 392, 232, 12);
    ctx.stroke();

    // Inner glow line
    ctx.strokeStyle = 'rgba(0,255,106,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, 384, 224, 10);
    ctx.stroke();

    // Avatar circle
    ctx.fillStyle = '#00cc7a';
    ctx.beginPath();
    ctx.arc(60, 75, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((UD.ign || UD.displayName || 'P').charAt(0).toUpperCase(), 60, 75);

    // Name
    ctx.fillStyle = '#00ff6a';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(UD.ign || UD.displayName || 'Player', 115, 45);

    // UID
    ctx.fillStyle = '#7a7a8e';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('FF UID: ' + (UD.ffUid || '-'), 115, 70);

    // Rank badge
    var stats = UD.stats || {};
    var rk = calcRk(stats);
    ctx.fillStyle = rk.color;
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(rk.emoji + ' ' + rk.badge, 115, 90);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 125);
    ctx.lineTo(370, 125);
    ctx.stroke();

    // Stats
    var statX = [70, 200, 330];
    var statLabels = ['Matches', 'Kills', 'Earnings'];
    var statValues = [String(stats.matches || 0), String(stats.kills || 0), '₹' + (stats.earnings || 0)];
    var statColors = ['#00d4ff', '#ff2e2e', '#ffd700'];

    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = statColors[i];
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(statValues[i], statX[i], 148);
      ctx.fillStyle = '#7a7a8e';
      ctx.font = '10px Arial, sans-serif';
      ctx.fillText(statLabels[i], statX[i], 172);
    }

    // Watermark
    ctx.fillStyle = 'rgba(0,255,106,0.3)';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎮 Mini eSports', 200, 210);
    ctx.fillStyle = '#333';
    ctx.font = '9px Arial, sans-serif';
    ctx.fillText('Play & Win Real Cash!', 200, 224);

    // Convert to blob and share/download
    try {
      canvas.toBlob(function(blob) {
        if (!blob) { downloadCanvas(canvas); return; }
        if (navigator.share && navigator.canShare) {
          var file = new File([blob], 'mini-esports-profile.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({
              title: 'My Mini eSports Profile',
              text: '🎮 Check out my eSports profile!',
              files: [file]
            }).catch(function() { downloadCanvas(canvas); });
          } else {
            downloadCanvas(canvas);
          }
        } else {
          downloadCanvas(canvas);
        }
      }, 'image/png');
    } catch (e) {
      downloadCanvas(canvas);
    }
  };

  function downloadCanvas(canvas) {
    var link = document.createElement('a');
    link.download = 'mini-esports-profile.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Profile card downloaded!', 'ok');
  }

  console.log('[Mini eSports] ✅ Feature 8: Profile Card loaded');
})();
