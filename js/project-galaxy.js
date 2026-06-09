(function () {
  "use strict";

  var canvas = document.getElementById("project-galaxy-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var width = 0;
  var height = 0;
  var centerX = 0;
  var centerY = 0;

  var animationId = null;
  var startTime = performance.now() / 1000;
  var lastMeteorTime = startTime - 8;
  var nextMeteorInterval = 1;
  var isRunning = false;
  var isVisible = false;

  var isMobile = window.innerWidth < 768;

  var CONFIG = {
    STAR_COUNT: isMobile ? 120 : 260,
    STAR_SIZE_MIN: 0.4,
    STAR_SIZE_MAX: 3.2,
    TWINKLE_FREQ_MIN: 0.5,
    TWINKLE_FREQ_MAX: 2.6,
    NEBULA_COUNT: isMobile ? 5 : 11,
    FOG_LAYERS: isMobile ? 3 : 6,
    METEOR: {
      SPAWN_POINTS: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.08 },
        { x: 0.08, y: 0.3 },
        { x: 0.92, y: 0.25 },
        { x: 0.5, y: 0.03 }
      ],
      MIN_INTERVAL: 3,
      MAX_INTERVAL: 6,
      SPEED_MIN: 5,
      SPEED_MAX: 8,
      ANGLE_MIN: 0.18,
      ANGLE_MAX: 0.42,
      LENGTH_MIN: 110,
      LENGTH_MAX: 220,
      WIDTH_MIN: 1.4,
      WIDTH_MAX: 2.6,
      LIFETIME_MIN: 1.4,
      LIFETIME_MAX: 2.6,
      TRAIL_POINTS: 22
    },
    COLORS: {
      warmGold: "rgba(255,215,130,",
      white: "rgba(255,255,255,",
      coolBlue: "rgba(180,210,255,",
      purple: "rgba(200,180,255,",
      nebula: [
        "rgba(80,60,150,",
        "rgba(60,100,180,",
        "rgba(150,80,120,",
        "rgba(100,60,140,",
        "rgba(60,80,160,",
        "rgba(120,100,160,",
        "rgba(90,70,170,",
        "rgba(140,90,130,"
      ],
      fog: [
        "rgba(60,50,100,",
        "rgba(40,60,120,",
        "rgba(80,50,90,",
        "rgba(50,40,110,"
      ],
      meteor: [
        { head: "rgba(255,255,255,", trail: "rgba(200,220,255," },
        { head: "rgba(255,250,240,", trail: "rgba(255,220,180," },
        { head: "rgba(240,245,255,", trail: "rgba(180,200,255," }
      ]
    }
  };

  var stars = [];
  var nebulae = [];
  var fogLayers = [];
  var meteors = [];
  var cachedBgGradient = null;
  var topFadeGradient = null;
  var bottomFadeGradient = null;
  var starsByColor = {};

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  function initCanvas() {
    var displayWidth = window.innerWidth || document.documentElement.clientWidth || canvas.clientWidth || 0;
    var displayHeight = window.innerHeight || document.documentElement.clientHeight || canvas.clientHeight || 0;

    width = Math.round(displayWidth);
    height = Math.round(displayHeight);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width / 2;
    centerY = height / 2;
    cachedBgGradient = null;
    topFadeGradient = null;
    bottomFadeGradient = null;
  }

  function createStars() {
    stars = [];
    starsByColor = {};
    for (var i = 0; i < CONFIG.STAR_COUNT; i++) {
      var u1 = Math.random() || 1e-6;
      var u2 = Math.random();
      var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      var z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

      var stdX = width * 0.32;
      var stdY = height * 0.32;

      var x = centerX + z0 * stdX;
      var y = centerY + z1 * stdY;

      if (x < -10 || x > width + 10 || y < -10 || y > height + 10) {
        continue;
      }

      var size = CONFIG.STAR_SIZE_MIN + Math.random() * (CONFIG.STAR_SIZE_MAX - CONFIG.STAR_SIZE_MIN);

      var colorRand = Math.random();
      var color = colorRand < 0.3
        ? CONFIG.COLORS.warmGold
        : colorRand < 0.6
          ? CONFIG.COLORS.white
          : colorRand < 0.85
            ? CONFIG.COLORS.coolBlue
            : CONFIG.COLORS.purple;

      var twinklePhase = Math.random() * Math.PI * 2;
      var twinkleFreq = CONFIG.TWINKLE_FREQ_MIN + Math.random() * (CONFIG.TWINKLE_FREQ_MAX - CONFIG.TWINKLE_FREQ_MIN);

      var star = {
        x: x,
        y: y,
        size: size,
        color: color,
        twinklePhase: twinklePhase,
        twinkleFreq: twinkleFreq,
        baseAlpha: 0.4 + Math.random() * 0.6,
        hasGlow: size > 2.2 && Math.random() < 0.5,
        glowRadius: size * (2.2 + Math.random() * 0.8)
      };

      stars.push(star);

      if (!starsByColor[color]) {
        starsByColor[color] = [];
      }
      starsByColor[color].push(star);
    }
  }

  function createNebulae() {
    nebulae = [];
    for (var i = 0; i < CONFIG.NEBULA_COUNT; i++) {
      nebulae.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 90 + Math.random() * 260,
        color: CONFIG.COLORS.nebula[i % CONFIG.COLORS.nebula.length],
        alpha: 0.03 + Math.random() * 0.055
      });
    }
  }

  function createFogLayers() {
    fogLayers = [];
    for (var i = 0; i < CONFIG.FOG_LAYERS; i++) {
      var baseX = Math.random() * width;
      var baseY = Math.random() * height;
      fogLayers.push({
        x: baseX,
        y: baseY,
        radiusX: 120 + Math.random() * 340,
        radiusY: 80 + Math.random() * 260,
        color: CONFIG.COLORS.fog[i % CONFIG.COLORS.fog.length],
        alpha: 0.014 + Math.random() * 0.025,
        rotation: Math.random() * Math.PI,
        driftX: (Math.random() - 0.5) * 0.08,
        driftY: (Math.random() - 0.5) * 0.06,
        baseX: baseX,
        baseY: baseY
      });
    }
  }

  function createMeteor() {
    var spawnPoint = CONFIG.METEOR.SPAWN_POINTS[Math.floor(Math.random() * CONFIG.METEOR.SPAWN_POINTS.length)];
    var startX = spawnPoint.x * width;
    var startY = spawnPoint.y * height;

    var angle = CONFIG.METEOR.ANGLE_MIN + Math.random() * (CONFIG.METEOR.ANGLE_MAX - CONFIG.METEOR.ANGLE_MIN);
    var speed = CONFIG.METEOR.SPEED_MIN + Math.random() * (CONFIG.METEOR.SPEED_MAX - CONFIG.METEOR.SPEED_MIN);
    var length = CONFIG.METEOR.LENGTH_MIN + Math.random() * (CONFIG.METEOR.LENGTH_MAX - CONFIG.METEOR.LENGTH_MIN);
    var widthMeteor = CONFIG.METEOR.WIDTH_MIN + Math.random() * (CONFIG.METEOR.WIDTH_MAX - CONFIG.METEOR.WIDTH_MIN);
    var lifetime = CONFIG.METEOR.LIFETIME_MIN + Math.random() * (CONFIG.METEOR.LIFETIME_MAX - CONFIG.METEOR.LIFETIME_MIN);
    var colorSet = CONFIG.COLORS.meteor[Math.floor(Math.random() * CONFIG.COLORS.meteor.length)];

    meteors.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: length,
      width: widthMeteor,
      colorHead: colorSet.head,
      colorTrail: colorSet.trail,
      lifetime: lifetime,
      age: 0,
      trail: [{ x: startX, y: startY }],
      maxTrailPoints: CONFIG.METEOR.TRAIL_POINTS
    });
  }

  function updateMeteors(dt, currentTime) {
    if (currentTime - lastMeteorTime >= nextMeteorInterval) {
      createMeteor();
      lastMeteorTime = currentTime;
      nextMeteorInterval = CONFIG.METEOR.MIN_INTERVAL + Math.random() * (CONFIG.METEOR.MAX_INTERVAL - CONFIG.METEOR.MIN_INTERVAL);
    }

    for (var i = meteors.length - 1; i >= 0; i--) {
      var meteor = meteors[i];
      meteor.age += dt;
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;

      meteor.trail.push({ x: meteor.x, y: meteor.y });
      if (meteor.trail.length > meteor.maxTrailPoints) {
        meteor.trail.shift();
      }

      if (
        meteor.age >= meteor.lifetime ||
        meteor.x > width + 300 ||
        meteor.x < -300 ||
        meteor.y > height + 300 ||
        meteor.y < -300
      ) {
        meteors[i] = meteors[meteors.length - 1];
        meteors.pop();
      }
    }
  }

  function drawBackground() {
    if (!cachedBgGradient) {
      cachedBgGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(width, height) * 0.8
      );
      cachedBgGradient.addColorStop(0, "#0f1123");
      cachedBgGradient.addColorStop(0.5, "#0b0d1a");
      cachedBgGradient.addColorStop(1, "#090a0d");
    }

    ctx.fillStyle = cachedBgGradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFogLayers() {
    var currentTime = startTime;
    for (var i = 0; i < fogLayers.length; i++) {
      var fog = fogLayers[i];
      fog.x = fog.baseX + Math.sin(currentTime * 0.15 + i) * 30;
      fog.y = fog.baseY + Math.cos(currentTime * 0.12 + i * 0.7) * 20;

      ctx.save();
      ctx.translate(fog.x, fog.y);
      ctx.rotate(fog.rotation);

      var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(fog.radiusX, fog.radiusY));
      gradient.addColorStop(0, fog.color + fog.alpha + ")");
      gradient.addColorStop(1, fog.color + "0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, fog.radiusX, fog.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawNebulae() {
    for (var i = 0; i < nebulae.length; i++) {
      var nebula = nebulae[i];

      var gradient = ctx.createRadialGradient(
        nebula.x,
        nebula.y,
        0,
        nebula.x,
        nebula.y,
        nebula.radius
      );
      gradient.addColorStop(0, nebula.color + nebula.alpha + ")");
      gradient.addColorStop(0.5, nebula.color + (nebula.alpha * 0.5) + ")");
      gradient.addColorStop(1, nebula.color + "0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStars() {
    var t = startTime;

    var color;
    var group;
    var i;
    var star;
    var twinkle;
    var alpha;
    var gradient;

    for (color in starsByColor) {
      group = starsByColor[color];
      for (i = 0; i < group.length; i++) {
        star = group[i];
        if (!star.hasGlow) {
          continue;
        }
        twinkle = Math.sin(t * star.twinkleFreq + star.twinklePhase);
        alpha = star.baseAlpha * (0.7 + 0.3 * twinkle);

        gradient = ctx.createRadialGradient(
          star.x,
          star.y,
          0,
          star.x,
          star.y,
          star.glowRadius
        );
        gradient.addColorStop(0, star.color + (alpha * 0.5) + ")");
        gradient.addColorStop(0.5, star.color + (alpha * 0.2) + ")");
        gradient.addColorStop(1, star.color + "0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (color in starsByColor) {
      group = starsByColor[color];
      for (i = 0; i < group.length; i++) {
        star = group[i];
        twinkle = Math.sin(t * star.twinkleFreq + star.twinklePhase);
        alpha = star.baseAlpha * (0.7 + 0.3 * twinkle);

        ctx.fillStyle = color + alpha + ")";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMeteors() {
    for (var i = 0; i < meteors.length; i++) {
      var meteor = meteors[i];
      var alpha = 1;
      var fadeInTime = 0.2;
      var fadeOutTime = 0.6;

      if (meteor.age < fadeInTime) {
        alpha = meteor.age / fadeInTime;
      } else if (meteor.age > meteor.lifetime - fadeOutTime) {
        alpha = Math.max(0, (meteor.lifetime - meteor.age) / fadeOutTime);
      }

      if (alpha <= 0.01) {
        continue;
      }

      if (meteor.trail.length > 1) {
        var trail = meteor.trail;
        var tipIndex = trail.length - 2;
        var tipProgress = tipIndex / trail.length;
        var tailAlpha = tipProgress * alpha * 0.7;

        ctx.strokeStyle = meteor.colorTrail + tailAlpha + ")";
        ctx.lineWidth = meteor.width * tipProgress;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (var j = 1; j < trail.length; j++) {
          ctx.lineTo(trail[j].x, trail[j].y);
        }
        ctx.stroke();
      }

      ctx.fillStyle = meteor.colorHead + alpha + ")";
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, meteor.width * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function createFadeGradients() {
    var fadeHeight = Math.max(height * 0.22, 80);
    topFadeGradient = ctx.createLinearGradient(0, 0, 0, fadeHeight);
    topFadeGradient.addColorStop(0, "#090a0d");
    topFadeGradient.addColorStop(1, "rgba(9,10,13,0)");

    bottomFadeGradient = ctx.createLinearGradient(0, height - fadeHeight, 0, height);
    bottomFadeGradient.addColorStop(0, "rgba(9,10,13,0)");
    bottomFadeGradient.addColorStop(1, "#090a0d");
  }

  function drawFadeEffect() {
    if (!topFadeGradient || !bottomFadeGradient) {
      return;
    }
    var fadeHeight = Math.max(height * 0.22, 80);
    ctx.fillStyle = topFadeGradient;
    ctx.fillRect(0, 0, width, fadeHeight);
    ctx.fillStyle = bottomFadeGradient;
    ctx.fillRect(0, height - fadeHeight, width, fadeHeight);
  }

  function animate() {
    if (!isVisible) {
      isRunning = false;
      return;
    }

    var currentTime = performance.now() / 1000;
    var dt = clamp(currentTime - startTime, 0, 0.1);
    startTime = currentTime;

    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawFogLayers();
    drawNebulae();
    drawStars();
    updateMeteors(dt, currentTime);
    drawMeteors();
    drawFadeEffect();

    animationId = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!isRunning) {
      isRunning = true;
      startTime = performance.now() / 1000;
      animate();
    }
  }

  function stopAnimation() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function init() {
    initCanvas();
    createStars();
    createNebulae();
    createFogLayers();
    createFadeGradients();
    meteors = [];
    startTime = performance.now() / 1000;
    lastMeteorTime = startTime - 8;
    nextMeteorInterval = 1;
    if (isVisible) {
      startAnimation();
    }
  }

  var visibilityObserver = new IntersectionObserver(
    function (entries) {
      isVisible = entries[0].isIntersecting;
      if (isVisible) {
        startAnimation();
      } else {
        stopAnimation();
      }
    },
    { threshold: 0.01 }
  );
  visibilityObserver.observe(canvas);

  var resizeTimeout;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      stopAnimation();
      init();
    }, 200);
  });

  init();
})();

