/**
 * 银河系星云背景动画 v6 (优化版)
 * 优化: 可见性检测、预计算渐变、批量绘制星星、移动端降级
 */

(function() {
    'use strict';

    const isMobile = window.innerWidth < 768;

    // 配置参数 — 移动端自动降级
    const CONFIG = {
        STAR_COUNT: isMobile ? 150 : 350,
        STAR_SIZE_MIN: 0.5,
        STAR_SIZE_MAX: 3.5,
        TWINKLE_FREQ_MIN: 0.5,
        TWINKLE_FREQ_MAX: 3.0,
        NEBULA_COUNT: isMobile ? 6 : 15,
        FOG_LAYERS: isMobile ? 3 : 8,
        METEOR: {
            SPAWN_POINTS: [
                { x: 0.05, y: 0.05 },
                { x: 0.95, y: 0.08 },
                { x: 0.08, y: 0.3 },
                { x: 0.92, y: 0.25 },
                { x: 0.5, y: 0.03 },
            ],
            MIN_INTERVAL: 2,
            MAX_INTERVAL: 5,
            SPEED_MIN: 5,
            SPEED_MAX: 9,
            ANGLE_MIN: 0.15,
            ANGLE_MAX: 0.45,
            LENGTH_MIN: 120,
            LENGTH_MAX: 250,
            WIDTH_MIN: 1.5,
            WIDTH_MAX: 3,
            LIFETIME_MIN: 1.5,
            LIFETIME_MAX: 3,
            TRAIL_POINTS: 25,
        },
        COLORS: {
            warmGold: 'rgba(255, 215, 130,',
            white: 'rgba(255, 255, 255,',
            coolBlue: 'rgba(180, 210, 255,',
            purple: 'rgba(200, 180, 255,',
            nebula: [
                'rgba(80, 60, 150,',
                'rgba(60, 100, 180,',
                'rgba(150, 80, 120,',
                'rgba(100, 60, 140,',
                'rgba(60, 80, 160,',
                'rgba(120, 100, 160,',
                'rgba(90, 70, 170,',
                'rgba(140, 90, 130,'
            ],
            fog: [
                'rgba(60, 50, 100,',
                'rgba(40, 60, 120,',
                'rgba(80, 50, 90,',
                'rgba(50, 40, 110,',
            ],
            meteor: [
                { head: 'rgba(255, 255, 255,', trail: 'rgba(200, 220, 255,' },
                { head: 'rgba(255, 250, 240,', trail: 'rgba(255, 220, 180,' },
                { head: 'rgba(240, 245, 255,', trail: 'rgba(180, 200, 255,' },
            ]
        }
    };

    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let width, height, centerX, centerY;
    let animationId;
    let stars = [];
    let nebulae = [];
    let fogLayers = [];
    let meteors = [];
    let startTime = 0;
    let lastMeteorTime = -10;
    let nextMeteorInterval = 0;
    let isVisible = false;
    let isRunning = false;

    // 预计算的背景渐变 — 不需要每帧重建
    let cachedBgGradient = null;

    // 按颜色分组星星用于批量绘制
    let starsByColor = {};

    function initCanvas() {
        const section = canvas.parentElement;
        width = section.offsetWidth;
        height = section.offsetHeight;
        canvas.width = width;
        canvas.height = height;
        centerX = width / 2;
        centerY = height / 2;
        cachedBgGradient = null; // 尺寸变化时清除缓存
    }

    function createStars() {
        stars = [];
        starsByColor = {};
        for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
            const u1 = Math.random();
            const u2 = Math.random();
            const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
            
            const stdX = width * 0.3;
            const stdY = height * 0.3;
            
            const x = centerX + z0 * stdX;
            const y = centerY + z1 * stdY;
            
            if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;
            
            const size = CONFIG.STAR_SIZE_MIN + Math.random() * (CONFIG.STAR_SIZE_MAX - CONFIG.STAR_SIZE_MIN);
            
            const colorRand = Math.random();
            let color;
            if (colorRand < 0.3) {
                color = CONFIG.COLORS.warmGold;
            } else if (colorRand < 0.6) {
                color = CONFIG.COLORS.white;
            } else if (colorRand < 0.85) {
                color = CONFIG.COLORS.coolBlue;
            } else {
                color = CONFIG.COLORS.purple;
            }
            
            const twinklePhase = Math.random() * Math.PI * 2;
            const twinkleFreq = CONFIG.TWINKLE_FREQ_MIN + Math.random() * (CONFIG.TWINKLE_FREQ_MAX - CONFIG.TWINKLE_FREQ_MIN);
            
            const star = {
                x, y, size, color, twinklePhase, twinkleFreq,
                baseAlpha: 0.4 + Math.random() * 0.6,
                // 是否有光晕 (仅大星星)
                hasGlow: size > 2.0,
                glowRadius: size * 4
            };
            stars.push(star);

            // 按颜色分组
            if (!starsByColor[color]) starsByColor[color] = [];
            starsByColor[color].push(star);
        }
    }

    function createNebulae() {
        nebulae = [];
        for (let i = 0; i < CONFIG.NEBULA_COUNT; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = 100 + Math.random() * 300;
            const color = CONFIG.COLORS.nebula[i % CONFIG.COLORS.nebula.length];
            const alpha = 0.03 + Math.random() * 0.06;
            
            nebulae.push({ x, y, radius, color, alpha });
        }
    }

    function createFogLayers() {
        fogLayers = [];
        for (let i = 0; i < CONFIG.FOG_LAYERS; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radiusX = 150 + Math.random() * 400;
            const radiusY = 100 + Math.random() * 300;
            const color = CONFIG.COLORS.fog[i % CONFIG.COLORS.fog.length];
            const alpha = 0.015 + Math.random() * 0.03;
            const rotation = Math.random() * Math.PI;
            const driftX = (Math.random() - 0.5) * 0.1;
            const driftY = (Math.random() - 0.5) * 0.08;
            
            fogLayers.push({ x, y, radiusX, radiusY, color, alpha, rotation, driftX, driftY, baseX: x, baseY: y });
        }
    }

    function createMeteor() {
        const spawnPoint = CONFIG.METEOR.SPAWN_POINTS[Math.floor(Math.random() * CONFIG.METEOR.SPAWN_POINTS.length)];
        const startX = spawnPoint.x * width;
        const startY = spawnPoint.y * height;
        
        const angle = CONFIG.METEOR.ANGLE_MIN + Math.random() * (CONFIG.METEOR.ANGLE_MAX - CONFIG.METEOR.ANGLE_MIN);
        const speed = CONFIG.METEOR.SPEED_MIN + Math.random() * (CONFIG.METEOR.SPEED_MAX - CONFIG.METEOR.SPEED_MIN);
        const length = CONFIG.METEOR.LENGTH_MIN + Math.random() * (CONFIG.METEOR.LENGTH_MAX - CONFIG.METEOR.LENGTH_MIN);
        const widthMeteor = CONFIG.METEOR.WIDTH_MIN + Math.random() * (CONFIG.METEOR.WIDTH_MAX - CONFIG.METEOR.WIDTH_MIN);
        const lifetime = CONFIG.METEOR.LIFETIME_MIN + Math.random() * (CONFIG.METEOR.LIFETIME_MAX - CONFIG.METEOR.LIFETIME_MIN);
        const colorSet = CONFIG.COLORS.meteor[Math.floor(Math.random() * CONFIG.COLORS.meteor.length)];
        
        meteors.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            length,
            width: widthMeteor,
            colorHead: colorSet.head,
            colorTrail: colorSet.trail,
            lifetime,
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
        
        // swap-and-pop 移除过期流星 (避免 splice 的 O(n) 开销)
        for (let i = meteors.length - 1; i >= 0; i--) {
            const meteor = meteors[i];
            meteor.age += dt;
            meteor.x += meteor.vx;
            meteor.y += meteor.vy;
            
            meteor.trail.push({ x: meteor.x, y: meteor.y });
            if (meteor.trail.length > meteor.maxTrailPoints) {
                meteor.trail.shift();
            }
            
            if (meteor.age >= meteor.lifetime || 
                meteor.x > width + 300 || meteor.x < -300 ||
                meteor.y > height + 300 || meteor.y < -300) {
                // swap-and-pop
                meteors[i] = meteors[meteors.length - 1];
                meteors.pop();
            }
        }
    }

    function drawMeteors() {
        for (const meteor of meteors) {
            let alpha = 1;
            const fadeInTime = 0.2;
            const fadeOutTime = 0.6;
            
            if (meteor.age < fadeInTime) {
                alpha = meteor.age / fadeInTime;
            } else if (meteor.age > meteor.lifetime - fadeOutTime) {
                alpha = Math.max(0, (meteor.lifetime - meteor.age) / fadeOutTime);
            }
            
            if (alpha <= 0.01) continue;
            
            if (meteor.trail.length > 1) {
                const trailLength = meteor.trail.length;
                
                // 批量绘制尾迹 — 合并为单个 beginPath
                ctx.beginPath();
                ctx.lineCap = 'round';
                for (let j = 0; j < trailLength - 1; j++) {
                    const point = meteor.trail[j];
                    const nextPoint = meteor.trail[j + 1];
                    
                    const trailProgress = j / trailLength;
                    const trailAlpha = trailProgress * alpha * 0.7;
                    const trailWidth = meteor.width * (0.2 + 0.8 * trailProgress);
                    
                    ctx.strokeStyle = meteor.colorTrail + trailAlpha + ')';
                    ctx.lineWidth = trailWidth;
                    ctx.moveTo(point.x, point.y);
                    ctx.lineTo(nextPoint.x, nextPoint.y);
                    ctx.stroke();
                    ctx.beginPath();
                }
            }
            
            const headX = meteor.x;
            const headY = meteor.y;
            const headRadius = meteor.width * 1.5;
            
            ctx.fillStyle = meteor.colorHead + alpha + ')';
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.95) + ')';
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 预计算背景渐变 (仅在 init/resize 时调用)
    function createBackgroundGradient() {
        if (cachedBgGradient) return cachedBgGradient;
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(width, height) * 0.8
        );
        gradient.addColorStop(0, '#0d0d20');
        gradient.addColorStop(0.3, '#080815');
        gradient.addColorStop(0.7, '#050510');
        gradient.addColorStop(1, '#020208');
        cachedBgGradient = gradient;
        return gradient;
    }

    function drawBackground() {
        ctx.fillStyle = createBackgroundGradient();
        ctx.fillRect(0, 0, width, height);
    }

    function drawFogLayers() {
        for (const fog of fogLayers) {
            fog.x = fog.baseX + Math.sin(startTime * 0.1) * fog.driftX * 50;
            fog.y = fog.baseY + Math.cos(startTime * 0.08) * fog.driftY * 50;
            
            ctx.save();
            ctx.translate(fog.x, fog.y);
            ctx.rotate(fog.rotation + startTime * 0.02);
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, fog.radiusX);
            gradient.addColorStop(0, fog.color + fog.alpha + ')');
            gradient.addColorStop(0.5, fog.color + (fog.alpha * 0.5) + ')');
            gradient.addColorStop(1, fog.color + '0)');
            
            ctx.fillStyle = gradient;
            ctx.scale(1, fog.radiusY / fog.radiusX);
            ctx.beginPath();
            ctx.arc(0, 0, fog.radiusX, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }

    function drawNebulae() {
        for (const nebula of nebulae) {
            for (let layer = 0; layer < 3; layer++) {
                const layerRadius = nebula.radius * (1 - layer * 0.2);
                const layerAlpha = nebula.alpha * (1 - layer * 0.3);
                
                const gradient = ctx.createRadialGradient(
                    nebula.x, nebula.y, 0,
                    nebula.x, nebula.y, layerRadius
                );
                gradient.addColorStop(0, nebula.color + layerAlpha + ')');
                gradient.addColorStop(0.3, nebula.color + (layerAlpha * 0.7) + ')');
                gradient.addColorStop(0.7, nebula.color + (layerAlpha * 0.3) + ')');
                gradient.addColorStop(1, nebula.color + '0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(nebula.x, nebula.y, layerRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 批量绘制星星 — 先画光晕，再画实心点，减少 fillStyle 切换
    function drawStars() {
        const t = startTime;

        // 第一遍: 绘制所有大星星的光晕
        for (const star of stars) {
            if (!star.hasGlow) continue;
            const twinkle = Math.sin(t * star.twinkleFreq + star.twinklePhase);
            const alpha = star.baseAlpha * (0.7 + 0.3 * twinkle);
            
            const gradient = ctx.createRadialGradient(
                star.x, star.y, 0,
                star.x, star.y, star.glowRadius
            );
            gradient.addColorStop(0, star.color + (alpha * 0.5) + ')');
            gradient.addColorStop(0.5, star.color + (alpha * 0.2) + ')');
            gradient.addColorStop(1, star.color + '0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 第二遍: 按颜色分组批量绘制实心星点
        for (const color in starsByColor) {
            const group = starsByColor[color];
            // 先用不同 alpha 绘制 — 由于每个星星 alpha 不同，
            // 我们仍然逐个绘制但避免了颜色字符串切换
            for (const star of group) {
                const twinkle = Math.sin(t * star.twinkleFreq + star.twinklePhase);
                const alpha = star.baseAlpha * (0.7 + 0.3 * twinkle);
                
                ctx.fillStyle = color + alpha + ')';
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 预计算淡化渐变
    let topFadeGradient = null;
    let bottomFadeGradient = null;

    function createFadeGradients() {
        const fadeHeight = height * 0.25;
        topFadeGradient = ctx.createLinearGradient(0, 0, 0, fadeHeight);
        topFadeGradient.addColorStop(0, '#090a0d');
        topFadeGradient.addColorStop(1, 'rgba(9, 10, 13, 0)');

        bottomFadeGradient = ctx.createLinearGradient(0, height - fadeHeight, 0, height);
        bottomFadeGradient.addColorStop(0, 'rgba(9, 10, 13, 0)');
        bottomFadeGradient.addColorStop(1, '#090a0d');
    }

    function drawFadeEffect() {
        const fadeHeight = height * 0.25;
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

        const currentTime = performance.now() / 1000;
        const dt = Math.min(currentTime - startTime, 0.1);
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
        if (isVisible) startAnimation();
    }

    // 可见性检测 — 只在 canvas 进入视口时运行动画
    const visibilityObserver = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
        if (isVisible) {
            startAnimation();
        } else {
            stopAnimation();
        }
    }, { threshold: 0.01 });
    visibilityObserver.observe(canvas);

    // 窗口大小变化时重新初始化
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            stopAnimation();
            cachedBgGradient = null;
            topFadeGradient = null;
            bottomFadeGradient = null;
            init();
        }, 250);
    });

    init();
})();
