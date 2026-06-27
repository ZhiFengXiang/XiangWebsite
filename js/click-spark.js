/**
 * ClickSpark — 点击火花效果（原生 JS 版，移植自 React Bits）
 * 在页面任意位置点击时，在光标处绘制放射状火花线条动画。
 * 全屏固定 canvas 覆盖，pointer-events: none 不影响页面交互。
 */
;(function () {
  'use strict';

  // ===== 配置 =====
  var CONFIG = {
    sparkColor: '#fff',
    sparkSize: 12,
    sparkRadius: 35,
    sparkCount: 9,
    duration: 500,
    easing: 'ease-out',
    extraScale: 1.0
  };

  // ===== 创建覆盖层 canvas =====
  var canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:99999;display:block;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var sparks = [];

  // ===== 尺寸同步 =====
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ===== 缓动函数 =====
  function easeFunc(t) {
    switch (CONFIG.easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: // ease-out
        return t * (2 - t);
    }
  }

  // ===== 动画循环 =====
  function draw(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sparks = sparks.filter(function (spark) {
      var elapsed = timestamp - spark.startTime;
      if (elapsed >= CONFIG.duration) return false;

      var progress = elapsed / CONFIG.duration;
      var eased = easeFunc(progress);

      var distance = eased * CONFIG.sparkRadius * CONFIG.extraScale;
      var lineLength = CONFIG.sparkSize * (1 - eased);

      var cosA = Math.cos(spark.angle);
      var sinA = Math.sin(spark.angle);

      var x1 = spark.x + distance * cosA;
      var y1 = spark.y + distance * sinA;
      var x2 = spark.x + (distance + lineLength) * cosA;
      var y2 = spark.y + (distance + lineLength) * sinA;

      ctx.strokeStyle = CONFIG.sparkColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      return true;
    });

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ===== 点击事件 =====
  document.addEventListener('click', function (e) {
    var x = e.clientX;
    var y = e.clientY;
    var now = performance.now();

    for (var i = 0; i < CONFIG.sparkCount; i++) {
      sparks.push({
        x: x,
        y: y,
        angle: (2 * Math.PI * i) / CONFIG.sparkCount,
        startTime: now
      });
    }
  });
})();
