/**
 * #now 板块星空背景
 * galaxy.js 的简化版本：仅包含星星和光晕，无星云、雾气、流星。
 * 用于"当前状态"板块的轻量级背景动画。
 */
(function() {
    'use strict';
    /* 获取 Canvas 元素和绘图上下文，检测移动端以降低粒子数 */
    var canvas = document.getElementById('now-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var isMobile = window.innerWidth < 768;
    var STAR_COUNT = isMobile ? 100 : 250;  // 移动端 100 颗，桌面端 250 颗
    var width, height, stars = [], animationId = null, isVisible = false, startTime = 0;

    // 星星颜色池：暖金、白、冷蓝、紫
    var COLORS = ['rgba(255,215,130,', 'rgba(255,255,255,', 'rgba(180,210,255,', 'rgba(200,180,255,'];
    /* 初始化画布尺寸 — 跟随父容器 */

    function initCanvas() {
        var section = canvas.parentElement;
        width = section.offsetWidth;
        height = section.offsetHeight;
        canvas.width = width;
        canvas.height = height;
    }
    /* 创建星星 — 随机位置、大小、颜色和闪烁参数 */

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            var x = Math.random() * width;
            var y = Math.random() * height;
            var size = 0.5 + Math.random() * 3;
            var color = COLORS[Math.floor(Math.random() * COLORS.length)];
            stars.push({
                x: x, y: y, size: size, color: color,
                baseAlpha: 0.3 + Math.random() * 0.7,           // 基础透明度
                twinklePhase: Math.random() * Math.PI * 2,       // 闪烁相位
                twinkleFreq: 0.5 + Math.random() * 2.5,          // 闪烁频率
                hasGlow: size > 2.0,                             // 大星星才有光晕
                glowRadius: size * 4
            });
        }
    }
    /* 绘制星星 — 光晕层 + 实心圆点，基于时间的闪烁效果 */

    function draw() {
        var t = performance.now() / 1000;
        ctx.clearRect(0, 0, width, height);

        // 遍历所有星星，先画光晕再画实心点
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            // 闪烁：正弦波控制透明度在 70%~100% 间波动
            var twinkle = Math.sin(t * s.twinkleFreq + s.twinklePhase);
            var alpha = s.baseAlpha * (0.7 + 0.3 * twinkle);

            // 大星星绘制径向渐变光晕
            if (s.hasGlow) {
                var grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.glowRadius);
                grad.addColorStop(0, s.color + (alpha * 0.4) + ')');
                grad.addColorStop(0.5, s.color + (alpha * 0.15) + ')');
                grad.addColorStop(1, s.color + '0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.glowRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 实心星点
            ctx.fillStyle = s.color + alpha + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    /* 主动画循环 — 仅在可见时运行 */

    function animate() {
        if (!isVisible) { animationId = null; return; }
        draw();
        animationId = requestAnimationFrame(animate);
    }
    /* 启动动画 */

    function start() {
        if (!animationId) {
            startTime = performance.now() / 1000;
            animate();
        }
    }
    /* 停止动画 */

    function stop() {
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    }
    /* 初始化入口 */

    function init() {
        initCanvas();
        createStars();
        if (isVisible) start();
    }
    /* 可见性检测 — 进入视口时启动，离开时停止以节省性能 */

    var obs = new IntersectionObserver(function(entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible) start(); else stop();
    }, { threshold: 0.01 });
    obs.observe(canvas);
    /* 窗口大小变化时重新初始化（防抖 250ms） */

    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 250);
    });

    init();
})();