/**
 * #now section star field background
 * Simpler version of galaxy.js — stars + subtle nebula glow, no meteors.
 */
(function() {
    'use strict';
    var canvas = document.getElementById('now-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var isMobile = window.innerWidth < 768;
    var STAR_COUNT = isMobile ? 100 : 250;
    var width, height, stars = [], animationId = null, isVisible = false, startTime = 0;

    var COLORS = ['rgba(255,215,130,', 'rgba(255,255,255,', 'rgba(180,210,255,', 'rgba(200,180,255,'];

    function initCanvas() {
        var section = canvas.parentElement;
        width = section.offsetWidth;
        height = section.offsetHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            var x = Math.random() * width;
            var y = Math.random() * height;
            var size = 0.5 + Math.random() * 3;
            var color = COLORS[Math.floor(Math.random() * COLORS.length)];
            stars.push({
                x: x, y: y, size: size, color: color,
                baseAlpha: 0.3 + Math.random() * 0.7,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleFreq: 0.5 + Math.random() * 2.5,
                hasGlow: size > 2.0,
                glowRadius: size * 4
            });
        }
    }

    function draw() {
        var t = performance.now() / 1000;
        ctx.clearRect(0, 0, width, height);

        // Draw glow for bright stars
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var twinkle = Math.sin(t * s.twinkleFreq + s.twinklePhase);
            var alpha = s.baseAlpha * (0.7 + 0.3 * twinkle);

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

            ctx.fillStyle = s.color + alpha + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function animate() {
        if (!isVisible) { animationId = null; return; }
        draw();
        animationId = requestAnimationFrame(animate);
    }

    function start() {
        if (!animationId) {
            startTime = performance.now() / 1000;
            animate();
        }
    }
    function stop() {
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    }

    function init() {
        initCanvas();
        createStars();
        if (isVisible) start();
    }

    var obs = new IntersectionObserver(function(entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible) start(); else stop();
    }, { threshold: 0.01 });
    obs.observe(canvas);

    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 250);
    });

    init();
})();