/**
 * 二级页面银河系星空背景
 * 与 galaxy.js 功能类似，但针对全屏二级页面优化：
 * - 使用设备像素比 (DPR) 适配高分屏，渲染更清晰
 * - 星星分布标准差更大（0.32 vs 0.3），覆盖全屏
 * - 流星间隔更长（3-6s vs 2-5s），减少视觉干扰
 * - 包含星云、雾气层和淡化边缘效果
 */

(function () {
  "use strict";

  /* 获取画布和上下文，alpha:false 提升性能（不透明背景） */
  var canvas = document.getElementById("project-galaxy-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  // DPR 限制最大 2，避免高分屏过度渲染消耗性能
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var width = 0;
  var height = 0;
  var centerX = 0;
  var centerY = 0;

  var animationId = null;
  var startTime = performance.now() / 1000;
  var lastMeteorTime = startTime - 8;  // 偏移 -8s 确保首次流星快速生成
  var nextMeteorInterval = 1;
  var isRunning = false;
  var isVisible = false;

  var isMobile = window.innerWidth < 768;

  /* 配置参数 — 移动端自动降级 */
  var CONFIG = {
    STAR_COUNT: isMobile ? 120 : 260,    // 星星数量
    STAR_SIZE_MIN: 0.4,
    STAR_SIZE_MAX: 3.2,
    TWINKLE_FREQ_MIN: 0.5,
    TWINKLE_FREQ_MAX: 2.6,
    NEBULA_COUNT: isMobile ? 5 : 11,     // 星云数量
    FOG_LAYERS: isMobile ? 3 : 6,        // 雾气层数
    METEOR: {
      // 流星生成位置（相对画布的比例坐标）
      SPAWN_POINTS: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.08 },
        { x: 0.08, y: 0.3 },
        { x: 0.92, y: 0.25 },
        { x: 0.5, y: 0.03 }
      ],
      MIN_INTERVAL: 3,                    // 流星生成最小间隔（秒）
      MAX_INTERVAL: 6,                    // 流星生成最大间隔（秒）
      SPEED_MIN: 5,
      SPEED_MAX: 8,
      ANGLE_MIN: 0.18,                    // 流星最小角度（弧度）
      ANGLE_MAX: 0.42,                    // 流星最大角度（弧度）
      LENGTH_MIN: 110,
      LENGTH_MAX: 220,
      WIDTH_MIN: 1.4,
      WIDTH_MAX: 2.6,
      LIFETIME_MIN: 1.4,                  // 流星最短存活时间（秒）
      LIFETIME_MAX: 2.6,                  // 流星最长存活时间（秒）
      TRAIL_POINTS: 22                    // 拖尾最大点数
    },
    COLORS: {
      warmGold: "rgba(255,215,130,",      // 暖金色
      white: "rgba(255,255,255,",         // 白色
      coolBlue: "rgba(180,210,255,",      // 冷蓝色
      purple: "rgba(200,180,255,",        // 紫色
      nebula: [                           // 星云颜色池
        "rgba(80,60,150,",
        "rgba(60,100,180,",
        "rgba(150,80,120,",
        "rgba(100,60,140,",
        "rgba(60,80,160,",
        "rgba(120,100,160,",
        "rgba(90,70,170,",
        "rgba(140,90,130,"
      ],
      fog: [                              // 雾气颜色池
        "rgba(60,50,100,",
        "rgba(40,60,120,",
        "rgba(80,50,90,",
        "rgba(50,40,110,"
      ],
      meteor: [                           // 流星颜色组（头部 + 拖尾）
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
  var cachedBgGradient = null;            // 缓存的背景渐变
  var topFadeGradient = null;             // 缓存的顶部淡化渐变
  var bottomFadeGradient = null;          // 缓存的底部淡化渐变
  var starsByColor = {};                  // 按颜色分组的星星

  /* 工具函数：数值限制到 [min, max] 范围 */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  /* 初始化画布 — DPR 适配高分屏，设置 CSS 尺寸和实际像素尺寸 */
  function initCanvas() {
    var displayWidth = window.innerWidth || document.documentElement.clientWidth || canvas.clientWidth || 0;
    var displayHeight = window.innerHeight || document.documentElement.clientHeight || canvas.clientHeight || 0;

    width = Math.round(displayWidth);
    height = Math.round(displayHeight);
    // CSS 尺寸 = 显示尺寸
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    // 实际像素尺寸 = 显示尺寸 * DPR（高分屏渲染更清晰）
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // 设置变换矩阵，后续绘制按 CSS 尺寸坐标，自动缩放到实际像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width / 2;
    centerY = height / 2;
    // 尺寸变化后清除所有缓存的渐变
    cachedBgGradient = null;
    topFadeGradient = null;
    bottomFadeGradient = null;
  }

  /* 创建星星 — Box-Muller 正态分布集中于中心，按颜色分组便于批量绘制 */
  function createStars() {
    stars = [];
    starsByColor = {};
    for (var i = 0; i < CONFIG.STAR_COUNT; i++) {
      // Box-Muller 变换：均匀分布转正态分布
      var u1 = Math.random() || 1e-6;  // 避免 log(0)
      var u2 = Math.random();
      var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      var z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

      // 标准差设为画布尺寸的 32%，使星星集中于中心
      var stdX = width * 0.32;
      var stdY = height * 0.32;

      var x = centerX + z0 * stdX;
      var y = centerY + z1 * stdY;

      // 跳过超出画布边界的星星
      if (x < -10 || x > width + 10 || y < -10 || y > height + 10) {
        continue;
      }

      var size = CONFIG.STAR_SIZE_MIN + Math.random() * (CONFIG.STAR_SIZE_MAX - CONFIG.STAR_SIZE_MIN);

      // 按概率分配颜色：暖金 30% / 白 30% / 冷蓝 25% / 紫 15%
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
        // 大星星（size > 2.2）且有 50% 概率才有光晕
        hasGlow: size > 2.2 && Math.random() < 0.5,
        glowRadius: size * (2.2 + Math.random() * 0.8)
      };

      stars.push(star);

      // 按颜色分组，便于后续批量绘制
      if (!starsByColor[color]) {
        starsByColor[color] = [];
      }
      starsByColor[color].push(star);
    }
  }

  /* 创建星云 — 随机位置和半径的柔和发光圆 */
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

  /* 创建雾气层 — 多层半透明雾气，带漂浮动画 */
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
        driftX: (Math.random() - 0.5) * 0.08,   // X 方向漂浮速度
        driftY: (Math.random() - 0.5) * 0.06,   // Y 方向漂浮速度
        baseX: baseX,                             // 基准位置（漂浮的起点）
        baseY: baseY
      });
    }
  }

  /* 创建单个流星 — 随机选择生成点、角度、速度、颜色 */
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

  /* 更新流星 — 按间隔生成新流星，移除过期或出界流星 */
  function updateMeteors(dt, currentTime) {
    // 按随机间隔生成新流星
    if (currentTime - lastMeteorTime >= nextMeteorInterval) {
      createMeteor();
      lastMeteorTime = currentTime;
      nextMeteorInterval = CONFIG.METEOR.MIN_INTERVAL + Math.random() * (CONFIG.METEOR.MAX_INTERVAL - CONFIG.METEOR.MIN_INTERVAL);
    }

    // 逆序遍历，swap-and-pop 移除过期流星
    for (var i = meteors.length - 1; i >= 0; i--) {
      var meteor = meteors[i];
      meteor.age += dt;
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;

      // 记录拖尾轨迹点
      meteor.trail.push({ x: meteor.x, y: meteor.y });
      if (meteor.trail.length > meteor.maxTrailPoints) {
        meteor.trail.shift();
      }

      // 流星过期或飞出边界时移除
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

  /* 绘制背景 — 使用缓存的径向渐变填充全画布 */
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

  /* 绘制雾气层 — 基于正弦/余弦的缓慢漂浮，椭圆形状 */
  function drawFogLayers() {
    var currentTime = startTime;
    for (var i = 0; i < fogLayers.length; i++) {
      var fog = fogLayers[i];
      // 漂浮位置 = 基准位置 + 正弦/余弦波偏移
      fog.x = fog.baseX + Math.sin(currentTime * 0.15 + i) * 30;
      fog.y = fog.baseY + Math.cos(currentTime * 0.12 + i * 0.7) * 20;

      ctx.save();
      ctx.translate(fog.x, fog.y);
      ctx.rotate(fog.rotation);

      var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(fog.radiusX, fog.radiusY));
      gradient.addColorStop(0, fog.color + fog.alpha + ")");
      gradient.addColorStop(1, fog.color + "0)");

      ctx.fillStyle = gradient;
      // 椭圆雾气
      ctx.beginPath();
      ctx.ellipse(0, 0, fog.radiusX, fog.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* 绘制星云 — 径向渐变的柔和光晕 */
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

  /* 绘制星星 — 两遍绘制：先画光晕，再画实心点，减少 fillStyle 切换 */
  function drawStars() {
    var t = startTime;

    var color;
    var group;
    var i;
    var star;
    var twinkle;
    var alpha;
    var gradient;

    // 第一遍：绘制所有有光晕的星星
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

    // 第二遍：按颜色分组批量绘制实心星点
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

  /* 绘制流星 — 头部光点 + 拖尾渐变线，带淡入淡出 */
  function drawMeteors() {
    for (var i = 0; i < meteors.length; i++) {
      var meteor = meteors[i];
      var alpha = 1;
      var fadeInTime = 0.2;     // 淡入时间（秒）
      var fadeOutTime = 0.6;    // 淡出时间（秒）

      // 生命周期透明度：前 0.2s 淡入，后 0.6s 淡出
      if (meteor.age < fadeInTime) {
        alpha = meteor.age / fadeInTime;
      } else if (meteor.age > meteor.lifetime - fadeOutTime) {
        alpha = Math.max(0, (meteor.lifetime - meteor.age) / fadeOutTime);
      }

      if (alpha <= 0.01) {
        continue;
      }

      // 绘制拖尾：单条路径，透明度和宽度从尾到头递增
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

      // 绘制头部光点
      ctx.fillStyle = meteor.colorHead + alpha + ")";
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, meteor.width * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 创建顶部和底部的淡化渐变 — 用于边缘与页面背景融合 */
  function createFadeGradients() {
    var fadeHeight = Math.max(height * 0.22, 80);
    topFadeGradient = ctx.createLinearGradient(0, 0, 0, fadeHeight);
    topFadeGradient.addColorStop(0, "#090a0d");
    topFadeGradient.addColorStop(1, "rgba(9,10,13,0)");

    bottomFadeGradient = ctx.createLinearGradient(0, height - fadeHeight, 0, height);
    bottomFadeGradient.addColorStop(0, "rgba(9,10,13,0)");
    bottomFadeGradient.addColorStop(1, "#090a0d");
  }

  /* 绘制淡化边缘 — 顶部和底部渐变，使星空与页面背景自然融合 */
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

  /* 主动画循环 — 每帧更新所有绘制元素，仅在可见时运行 */
  function animate() {
    if (!isVisible) {
      isRunning = false;
      return;
    }

    var currentTime = performance.now() / 1000;
    // dt 限制最大 0.1s，避免标签页切回后的大跳跃
    var dt = clamp(currentTime - startTime, 0, 0.1);
    startTime = currentTime;

    ctx.clearRect(0, 0, width, height);
    // 绘制顺序：背景 → 雾气 → 星云 → 星星 → 流星 → 淡化边缘
    drawBackground();
    drawFogLayers();
    drawNebulae();
    drawStars();
    updateMeteors(dt, currentTime);
    drawMeteors();
    drawFadeEffect();

    animationId = requestAnimationFrame(animate);
  }

  /* 启动动画 — 仅在未运行时启动 */
  function startAnimation() {
    if (!isRunning) {
      isRunning = true;
      startTime = performance.now() / 1000;
      animate();
    }
  }

  /* 停止动画 — 取消动画帧请求 */
  function stopAnimation() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  /* 初始化入口 — 创建所有元素并启动动画 */
  function init() {
    initCanvas();
    createStars();
    createNebulae();
    createFogLayers();
    createFadeGradients();
    meteors = [];
    startTime = performance.now() / 1000;
    lastMeteorTime = startTime - 8;  // 偏移 -8s 确保首次流星快速生成
    nextMeteorInterval = 1;
    if (isVisible) {
      startAnimation();
    }
  }

  /* 可见性检测 — 视口内外自动启停动画，节省性能 */
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

  /* 窗口大小变化防抖 — 200ms 后重新初始化 */
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
