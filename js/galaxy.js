/**
 * 银河系星云背景动画 v6（优化版）
 * 用于首页 Hero 区域的 Canvas 星空背景。
 *
 * 视觉元素：星星（正态分布 + 闪烁）、星云（柔和光晕）、雾气层（漂浮）、流星（拖尾）。
 * 性能优化：可见性检测（离开视口停止动画）、预计算渐变缓存、按颜色分组批量绘制、移动端降级。
 */

(function() {
    'use strict';

    // 移动端检测：屏幕宽度 < 768px 视为移动端，自动降低粒子数量
    const isMobile = window.innerWidth < 768;

    /* 配置参数 — 移动端自动降级，包含星星、星云、雾气、流星、颜色等全部参数 */
    const CONFIG = {
        STAR_COUNT: isMobile ? 150 : 350,           // 星星数量
        STAR_SIZE_MIN: 0.5,                          // 星星最小尺寸
        STAR_SIZE_MAX: 3.5,                          // 星星最大尺寸
        TWINKLE_FREQ_MIN: 0.5,                       // 闪烁最低频率
        TWINKLE_FREQ_MAX: 3.0,                       // 闪烁最高频率
        NEBULA_COUNT: isMobile ? 6 : 15,             // 星云数量
        FOG_LAYERS: isMobile ? 3 : 8,                // 雾气层数
        METEOR: {
            // 流星生成位置（相对画布的比例坐标）
            SPAWN_POINTS: [
                { x: 0.05, y: 0.05 },
                { x: 0.95, y: 0.08 },
                { x: 0.08, y: 0.3 },
                { x: 0.92, y: 0.25 },
                { x: 0.5, y: 0.03 },
            ],
            MIN_INTERVAL: 2,                         // 流星生成最小间隔（秒）
            MAX_INTERVAL: 5,                         // 流星生成最大间隔（秒）
            SPEED_MIN: 5,                            // 流星最小速度
            SPEED_MAX: 9,                            // 流星最大速度
            ANGLE_MIN: 0.15,                         // 流星最小角度（弧度）
            ANGLE_MAX: 0.45,                         // 流星最大角度（弧度）
            LENGTH_MIN: 120,                         // 拖尾最小长度
            LENGTH_MAX: 250,                         // 拖尾最大长度
            WIDTH_MIN: 1.5,                          // 流星最小宽度
            WIDTH_MAX: 3,                            // 流星最大宽度
            LIFETIME_MIN: 1.5,                       // 流星最短存活时间（秒）
            LIFETIME_MAX: 3,                         // 流星最长存活时间（秒）
            TRAIL_POINTS: 25,                        // 拖尾最大点数
        },
        COLORS: {
            warmGold: 'rgba(255, 215, 130,',         // 暖金色（30% 概率）
            white: 'rgba(255, 255, 255,',            // 白色（30% 概率）
            coolBlue: 'rgba(180, 210, 255,',         // 冷蓝色（25% 概率）
            purple: 'rgba(200, 180, 255,',           // 紫色（15% 概率）
            nebula: [                                // 星云颜色池
                'rgba(80, 60, 150,',
                'rgba(60, 100, 180,',
                'rgba(150, 80, 120,',
                'rgba(100, 60, 140,',
                'rgba(60, 80, 160,',
                'rgba(120, 100, 160,',
                'rgba(90, 70, 170,',
                'rgba(140, 90, 130,'
            ],
            fog: [                                   // 雾气颜色池
                'rgba(60, 50, 100,',
                'rgba(40, 60, 120,',
                'rgba(80, 50, 90,',
                'rgba(50, 40, 110,',
            ],
            meteor: [                                // 流星颜色组（头部 + 拖尾）
                { head: 'rgba(255, 255, 255,', trail: 'rgba(200, 220, 255,' },
                { head: 'rgba(255, 250, 240,', trail: 'rgba(255, 220, 180,' },
                { head: 'rgba(240, 245, 255,', trail: 'rgba(180, 200, 255,' },
            ]
        }
    };
    /* 获取 Canvas 元素并初始化绘制上下文 */

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
    let lastMeteorTime = -10;       // 上次流星生成时间（初始为负数确保首次快速生成）
    let nextMeteorInterval = 0;     // 下次流星生成的间隔
    let isVisible = false;          // Canvas 是否在视口内
    let isRunning = false;          // 动画是否正在运行

    // 预计算的背景渐变缓存 — 不需要每帧重建，仅在尺寸变化时清除
    let cachedBgGradient = null;

    // 按颜色分组星星用于批量绘制，减少 fillStyle 切换开销
    let starsByColor = {};
    /* 初始化画布尺寸 — 跟随父容器大小，并计算中心点 */

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
    /* 创建星星 — 使用 Box-Muller 正态分布集中于中心区域，随机颜色和闪烁参数 */

    function createStars() {
        stars = [];
        starsByColor = {};
        for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
            // Box-Muller 变换：均匀分布转正态分布
            const u1 = Math.random();
            const u2 = Math.random();
            const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

            // 标准差设为画布尺寸的 30%，使星星集中于中心
            const stdX = width * 0.3;
            const stdY = height * 0.3;

            const x = centerX + z0 * stdX;
            const y = centerY + z1 * stdY;

            // 跳过超出画布边界的星星
            if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;

            const size = CONFIG.STAR_SIZE_MIN + Math.random() * (CONFIG.STAR_SIZE_MAX - CONFIG.STAR_SIZE_MIN);

            // 按概率分配颜色：暖金 30% / 白 30% / 冷蓝 25% / 紫 15%
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
                // 大星星（size > 2.0）才有光晕
                hasGlow: size > 2.0,
                glowRadius: size * 4
            };
            stars.push(star);

            // 按颜色分组，便于后续批量绘制
            if (!starsByColor[color]) starsByColor[color] = [];
            starsByColor[color].push(star);
        }
    }
    /* 创建星云 — 随机位置和半径的柔和发光圆，多层叠加增加层次感 */

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
    /* 创建雾气层 — 多层半透明雾气增加深度感，带缓慢漂浮动画 */

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
            // 漂移速度：X 和 Y 方向的微小偏移
            const driftX = (Math.random() - 0.5) * 0.1;
            const driftY = (Math.random() - 0.5) * 0.08;

            fogLayers.push({ x, y, radiusX, radiusY, color, alpha, rotation, driftX, driftY, baseX: x, baseY: y });
        }
    }

    /* 创建单个流星 — 随机选择生成点、角度、速度、颜色 */
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
    /* 更新流星位置和生命周期 — 按间隔生成新流星，移除过期流星 */

    function updateMeteors(dt, currentTime) {
        // 按随机间隔生成新流星
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

            // 记录拖尾轨迹点，超出最大点数时移除最早的
            meteor.trail.push({ x: meteor.x, y: meteor.y });
            if (meteor.trail.length > meteor.maxTrailPoints) {
                meteor.trail.shift();
            }

            // 流星过期或飞出边界时移除
            if (meteor.age >= meteor.lifetime ||
                meteor.x > width + 300 || meteor.x < -300 ||
                meteor.y > height + 300 || meteor.y < -300) {
                // swap-and-pop：用末尾元素替换当前位置，再 pop 末尾
                meteors[i] = meteors[meteors.length - 1];
                meteors.pop();
            }
        }
    }
    /* 绘制流星 — 头部光点 + 拖尾渐变线，带淡入淡出效果 */

    function drawMeteors() {
        for (const meteor of meteors) {
            let alpha = 1;
            const fadeInTime = 0.2;     // 淡入时间（秒）
            const fadeOutTime = 0.6;    // 淡出时间（秒）

            // 生命周期内的透明度：前 0.2s 淡入，后 0.6s 淡出
            if (meteor.age < fadeInTime) {
                alpha = meteor.age / fadeInTime;
            } else if (meteor.age > meteor.lifetime - fadeOutTime) {
                alpha = Math.max(0, (meteor.lifetime - meteor.age) / fadeOutTime);
            }

            if (alpha <= 0.01) continue;

            // 绘制拖尾：逐段绘制，透明度和宽度从尾到头递增
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

            // 绘制头部光点：外层彩色 + 内层白色高光
            const headX = meteor.x;
            const headY = meteor.y;
            const headRadius = meteor.width * 1.5;

            ctx.fillStyle = meteor.colorHead + alpha + ')';
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
            ctx.fill();

            // 内层白色高光，增强亮度
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.95) + ')';
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 预计算背景渐变 (仅在 init/resize 时调用，避免每帧重建)
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
    /* 绘制背景 — 使用缓存的径向渐变填充全画布 */

    function drawBackground() {
        ctx.fillStyle = createBackgroundGradient();
        ctx.fillRect(0, 0, width, height);
    }
    /* 绘制雾气层 — 基于正弦/余弦的缓慢漂浮，旋转 + 径向渐变 */

    function drawFogLayers() {
        for (const fog of fogLayers) {
            // 漂浮位置 = 基准位置 + 正弦波偏移
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
            // Y 方向缩放形成椭圆雾气
            ctx.scale(1, fog.radiusY / fog.radiusX);
            ctx.beginPath();
            ctx.arc(0, 0, fog.radiusX, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
    /* 绘制星云 — 三层径向渐变叠加，营造柔和光晕效果 */

    function drawNebulae() {
        for (const nebula of nebulae) {
            // 三层叠加：每层半径递减、透明度递增，形成中心更亮的效果
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
    /* 绘制星星 — 两遍绘制：先画光晕，再画实心点，减少 fillStyle 切换 */
    function drawStars() {
        const t = startTime;

        // 第一遍: 绘制所有大星星的光晕（仅 hasGlow 为 true 的星星）
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

    // 预计算顶部和底部的淡化渐变（用于边缘融合背景）
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
    /* 绘制淡化效果 — 顶部和底部边缘渐变，使星空与页面背景自然融合 */

    function drawFadeEffect() {
        const fadeHeight = height * 0.25;
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

        const currentTime = performance.now() / 1000;
        // dt 限制最大 0.1s，避免标签页切回后的大跳跃
        const dt = Math.min(currentTime - startTime, 0.1);
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
    /* 启动动画循环 — 仅在未运行时启动 */

    function startAnimation() {
        if (!isRunning) {
            isRunning = true;
            // 不在此处重置 startTime，由 animate() 首帧处理
            animate();
        }
    }
    /* 停止动画循环以节省性能 */

    function stopAnimation() {
        isRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }
    /* 初始化 — 创建所有元素并启动动画 */

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
        if (isVisible) startAnimation();
    }
    /* 可见性检测 — 只在 canvas 进入视口时运行动画，节省性能 */
    const visibilityObserver = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
        if (isVisible) {
            startAnimation();
        } else {
            stopAnimation();
        }
    }, { threshold: 0.01 });
    visibilityObserver.observe(canvas);
    /* 窗口大小变化时重新初始化 — 防抖 250ms 避免频繁触发 */
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            stopAnimation();
            // 清除所有缓存的渐变，尺寸变化后需重建
            cachedBgGradient = null;
            topFadeGradient = null;
            bottomFadeGradient = null;
            init();
        }, 250);
    });

    init();
})();
