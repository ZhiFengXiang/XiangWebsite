/**
 * #skills 区域"黑金智能核心"光标粒子效果
 * 鼠标在技能区域移动时生成金色粒子系统，包含：
 * - 数据粒子（data）：围绕鼠标轨道运动
 * - 能量粒子（energy）：螺旋上升，带运动模糊
 * - 核心粒子（core）：脉冲呼吸，带光晕
 * - 能量轨迹：鼠标移动留下的金色拖尾
 * - 几何连线：粒子间的连接线
 *
 * 颜色：液态金、琥珀金、暖金、香槟金等金色系。
 * 仅在桌面端启用（移动端直接 return）。
 */
(function() {
    'use strict';
    /* 获取 Canvas 和上下文，仅在桌面端启用 */
    var canvas = document.getElementById('skills-smoke-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var isMobile = window.innerWidth < 768;
    if (isMobile) return;  // 移动端不启用粒子效果

    var section = document.getElementById('skills');
    var particles = [];        // 粒子数组
    var energyTrails = [];     // 能量轨迹数组
    var connections = [];      // 粒子间连线数组
    var mouseX = -1000, mouseY = -1000;          // 当前鼠标位置
    var lastMouseX = -1000, lastMouseY = -1000;  // 上一帧鼠标位置（用于计算速度）
    var mouseSpeed = 0;        // 鼠标移动速度
    var isMouseIn = false;     // 鼠标是否在区域内
    var width, height;
    var animationId = null;
    var time = 0;              // 全局时间计数器
    /* ---- 配置常量 ---- */
    var MAX_PARTICLES = 80;              // 最大粒子数
    var MAX_TRAILS = 40;                 // 最大轨迹数
    var MAX_CONNECTIONS = 20;            // 最大连线数
    var CONNECTION_DISTANCE = 120;       // 连线最大距离
    var TRAIL_LENGTH = 15;               // 轨迹最大长度
    /* 金色调色板 — 从深金到浅白的渐变系列 */
    var goldColors = [
        { r: 255, g: 215, b: 0 },    // Liquid gold 液态金
        { r: 255, g: 193, b: 37 },   // Amber gold 琥珀金
        { r: 255, g: 223, b: 0 },    // Warm gold 暖金
        { r: 248, g: 222, b: 126 },  // Champagne gold 香槟金
        { r: 255, g: 228, b: 181 },  // Moccasin 鹿皮色
        { r: 255, g: 248, b: 220 },  // Cornsilk 玉米丝色
        { r: 255, g: 245, b: 238 },  // Seashell 海贝色
        { r: 255, g: 250, b: 240 }   // Floral white 花白色
    ];
    /* 初始化画布尺寸 */

    function initCanvas() {
        width = section.offsetWidth;
        height = section.offsetHeight;
        canvas.width = width;
        canvas.height = height;
    }
    /* 粒子类 — 包含智能行为的数据点、能量点和核心点三种类型 */
    function Particle(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'data', 'energy', 'core'
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.maxLife = 80 + Math.random() * 60;
        this.alpha = 0;
        this.maxAlpha = 0.3 + Math.random() * 0.4;
        this.size = 1 + Math.random() * 3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.orbitRadius = 20 + Math.random() * 60;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitSpeed = 0.02 + Math.random() * 0.05;
        this.colorIndex = Math.floor(Math.random() * goldColors.length);
        this.targetX = x;
        this.targetY = y;
        this.behavior = Math.random(); // 不同 AI 行为模式

        // 根据类型初始化不同属性
        if (type === 'data') {
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
            this.size = 1 + Math.random() * 2;
        } else if (type === 'energy') {
            this.size = 2 + Math.random() * 4;
            this.maxAlpha = 0.4 + Math.random() * 0.3;
        } else if (type === 'core') {
            this.size = 4 + Math.random() * 6;
            this.maxAlpha = 0.6 + Math.random() * 0.3;
            this.life = this.maxLife * 0.3; // 核心粒子从生命周期 30% 处开始
        }
    }
    /* 粒子更新 — 生命周期管理、透明度计算、类型分发 */

    Particle.prototype.update = function() {
        this.life++;
        if (this.life >= this.maxLife) return false;

        // 生命周期透明度：前 15% 淡入，后 30% 淡出，中间保持最大值
        var lifeRatio = this.life / this.maxLife;
        if (lifeRatio < 0.15) {
            this.alpha = this.maxAlpha * (lifeRatio / 0.15);
        } else if (lifeRatio > 0.7) {
            this.alpha = this.maxAlpha * (1 - (lifeRatio - 0.7) / 0.3);
        } else {
            this.alpha = this.maxAlpha;
        }

        // 鼠标离开时加速淡出
        if (!isMouseIn) {
            this.alpha *= 0.96;
        }

        // 根据类型调用不同的更新行为
        if (this.type === 'data') {
            this.updateDataParticle();
        } else if (this.type === 'energy') {
            this.updateEnergyParticle();
        } else if (this.type === 'core') {
            this.updateCoreParticle();
        }

        this.rotation += this.rotationSpeed;
        return this.alpha > 0.001;
    };
    /* 数据粒子行为 — 围绕鼠标轨道运动，三种随机行为模式 */

    Particle.prototype.updateDataParticle = function() {
        // 智能轨道运动，偶尔改变方向
        this.orbitAngle += this.orbitSpeed;

        if (this.behavior < 0.3) {
            // 模式 1：围绕鼠标做圆周轨道运动
            this.targetX = mouseX + Math.cos(this.orbitAngle) * this.orbitRadius;
            this.targetY = mouseY + Math.sin(this.orbitAngle) * this.orbitRadius;
        } else if (this.behavior < 0.6) {
            // 模式 2：随机游走 + 鼠标吸引力
            var angle = Math.atan2(mouseY - this.y, mouseX - this.x);
            this.vx += Math.cos(angle) * 0.02;
            this.vy += Math.sin(angle) * 0.02;
            this.vx *= 0.98;  // 阻尼
            this.vy *= 0.98;
        } else {
            // 模式 3：线性运动
            this.x += this.vx;
            this.y += this.vy;
            return;
        }

        // 向目标位置缓动移动
        this.x += (this.targetX - this.x) * 0.08;
        this.y += (this.targetY - this.y) * 0.08;
    };
    /* 能量粒子行为 — 螺旋上升运动，带速度模糊 */

    Particle.prototype.updateEnergyParticle = function() {
        // 高速流动，带轨迹效果
        var angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        var distance = Math.sqrt(Math.pow(mouseX - this.x, 2) + Math.pow(mouseY - this.y, 2));

        // 吸引力强度随距离增加
        var speed = 0.05 + (distance / 200) * 0.1;
        this.vx += Math.cos(angle) * speed;
        this.vy += Math.sin(angle) * speed;

        // 叠加轨道运动，形成螺旋效果
        this.vx += Math.sin(time * 0.05 + this.orbitAngle) * 0.02;
        this.vy += Math.cos(time * 0.05 + this.orbitAngle) * 0.02;

        this.vx *= 0.95;  // 阻尼
        this.vy *= 0.95;

        this.x += this.vx;
        this.y += this.vy;
    };
    /* 核心粒子行为 — 脉冲呼吸效果，缓慢围绕鼠标 */

    Particle.prototype.updateCoreParticle = function() {
        // 核心粒子以半速围绕鼠标缓慢运动
        this.orbitAngle += this.orbitSpeed * 0.5;
        this.targetX = mouseX + Math.cos(this.orbitAngle) * this.orbitRadius * 0.5;
        this.targetY = mouseY + Math.sin(this.orbitAngle) * this.orbitRadius * 0.5;

        this.x += (this.targetX - this.x) * 0.05;
        this.y += (this.targetY - this.y) * 0.05;
    };
    /* 绘制粒子 — 根据类型选择不同的绘制方式 */

    Particle.prototype.draw = function() {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        var color = goldColors[this.colorIndex];

        if (this.type === 'core') {
            // 核心粒子：大尺寸 + 径向渐变光晕 + 实心内核
            var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 3);
            gradient.addColorStop(0, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')');
            gradient.addColorStop(0.5, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + (this.alpha * 0.5) + ')');
            gradient.addColorStop(1, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 3, 0, Math.PI * 2);
            ctx.fill();

            // 内核实心圆
            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'energy') {
            // 能量粒子：椭圆 + 运动模糊（长度随速度增加）
            var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            var length = this.size * (1 + speed * 0.5);

            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            // 椭圆方向跟随速度方向
            ctx.ellipse(0, 0, this.size, length, Math.atan2(this.vy, this.vx), 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 数据粒子：小实心圆点
            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    };
    /* 能量轨迹类 — 鼠标移动留下的金色拖尾 */
    function EnergyTrail(x, y) {
        this.points = [{ x: x, y: y }];
        this.alpha = 0.6;
        this.maxAlpha = 0.6;
        this.life = 0;
        this.maxLife = 30 + Math.random() * 20;
        this.colorIndex = Math.floor(Math.random() * goldColors.length);
        this.width = 1 + Math.random() * 2;
    }

    EnergyTrail.prototype.update = function() {
        this.life++;
        if (this.life >= this.maxLife) return false;

        // 生命周期透明度：前 20% 淡入，后 40% 淡出
        var lifeRatio = this.life / this.maxLife;
        if (lifeRatio < 0.2) {
            this.alpha = this.maxAlpha * (lifeRatio / 0.2);
        } else if (lifeRatio > 0.6) {
            this.alpha = this.maxAlpha * (1 - (lifeRatio - 0.6) / 0.4);
        }

        return this.alpha > 0.001;
    };

    EnergyTrail.prototype.draw = function() {
        if (this.points.length < 2 || this.alpha <= 0) return;

        var color = goldColors[this.colorIndex];

        // 逐段绘制轨迹，透明度和宽度从尾到头递减
        for (var i = 1; i < this.points.length; i++) {
            var p1 = this.points[i - 1];
            var p2 = this.points[i];
            var segmentAlpha = this.alpha * (i / this.points.length);

            ctx.strokeStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + segmentAlpha + ')';
            ctx.lineWidth = this.width * (1 - i / this.points.length);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    };
    /* 连线类 — 粒子间的几何连接线 */
    function Connection(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
        this.alpha = 0;
        this.maxAlpha = 0.2 + Math.random() * 0.3;
        this.life = 0;
        this.maxLife = 20 + Math.random() * 30;
        this.colorIndex = Math.floor(Math.random() * goldColors.length);
    }

    Connection.prototype.update = function() {
        this.life++;
        if (this.life >= this.maxLife) return false;

        // 生命周期透明度：前 30% 淡入，后 30% 淡出
        var lifeRatio = this.life / this.maxLife;
        if (lifeRatio < 0.3) {
            this.alpha = this.maxAlpha * (lifeRatio / 0.3);
        } else if (lifeRatio > 0.7) {
            this.alpha = this.maxAlpha * (1 - (lifeRatio - 0.7) / 0.3);
        }

        return this.alpha > 0.001;
    };

    Connection.prototype.draw = function() {
        if (this.alpha <= 0) return;

        var color = goldColors[this.colorIndex];

        ctx.strokeStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
    };
    /* 主动画循环 — 更新和绘制所有粒子、轨迹、连线 */

    function animate() {
        ctx.clearRect(0, 0, width, height);
        time++;

        // 计算鼠标移动速度
        var dx = mouseX - lastMouseX;
        var dy = mouseY - lastMouseY;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy);
        lastMouseX = mouseX;
        lastMouseY = mouseY;

        // 根据鼠标活动生成粒子
        if (isMouseIn) {
            // 生成速率随鼠标速度增加
            var spawnRate = 0.3 + mouseSpeed * 0.02;

            if (Math.random() < spawnRate && particles.length < MAX_PARTICLES) {
                var type = Math.random();
                // 60% 数据粒子，30% 能量粒子，10% 核心粒子
                if (type < 0.6) {
                    particles.push(new Particle(mouseX, mouseY, 'data'));
                } else if (type < 0.9) {
                    particles.push(new Particle(mouseX, mouseY, 'energy'));
                } else {
                    particles.push(new Particle(mouseX, mouseY, 'core'));
                }
            }

            // 鼠标快速移动时生成能量轨迹
            if (mouseSpeed > 2 && Math.random() < 0.3 && energyTrails.length < MAX_TRAILS) {
                var trail = new EnergyTrail(mouseX, mouseY);
                trail.points = [{ x: mouseX, y: mouseY }];
                energyTrails.push(trail);
            }

            // 更新现有轨迹的点列表
            for (var t = 0; t < energyTrails.length; t++) {
                if (energyTrails[t].points.length < TRAIL_LENGTH) {
                    energyTrails[t].points.push({ x: mouseX, y: mouseY });
                }
            }
        }

        // 更新并绘制粒子（原地移除以减少 GC 压力）
        for (var i = particles.length - 1; i >= 0; i--) {
            if (particles[i].update()) {
                particles[i].draw();
            } else {
                particles.splice(i, 1);
            }
        }

        // 更新并绘制能量轨迹（原地移除）
        for (var j = energyTrails.length - 1; j >= 0; j--) {
            if (energyTrails[j].update()) {
                energyTrails[j].draw();
            } else {
                energyTrails.splice(j, 1);
            }
        }

        // 在邻近粒子间创建连线
        if (Math.random() < 0.1 && connections.length < MAX_CONNECTIONS) {
            for (var k = 0; k < particles.length; k++) {
                for (var l = k + 1; l < particles.length; l++) {
                    var p1 = particles[k];
                    var p2 = particles[l];
                    var dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

                    // 距离小于阈值且随机命中时创建连线
                    if (dist < CONNECTION_DISTANCE && Math.random() < 0.2) {
                        connections.push(new Connection(p1, p2));
                    }
                }
            }
        }

        // 更新并绘制连线（原地移除）
        for (var m = connections.length - 1; m >= 0; m--) {
            if (connections[m].update()) {
                connections[m].draw();
            } else {
                connections.splice(m, 1);
            }
        }

        // 有粒子或鼠标在内时继续动画，否则停止以节省性能
        if (particles.length > 0 || energyTrails.length > 0 || connections.length > 0 || isMouseIn) {
            animationId = requestAnimationFrame(animate);
        } else {
            animationId = null;
        }
    }

    // 启动动画（仅在未运行时启动）
    function startAnim() {
        if (!animationId) {
            animationId = requestAnimationFrame(animate);
        }
    }

    // 鼠标移动事件：更新位置并启动动画
    section.addEventListener('mousemove', function(e) {
        var rect = section.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        isMouseIn = true;
        startAnim();
    });

    // 鼠标离开：标记离开，让现有粒子自然淡出
    section.addEventListener('mouseleave', function() {
        isMouseIn = false;
        document.body.classList.remove('skills-cursor-hide');
        startAnim();  // 继续动画以播放淡出效果
    });

    // 鼠标进入：隐藏系统光标
    section.addEventListener('mouseenter', function() {
        isMouseIn = true;
        document.body.classList.add('skills-cursor-hide');
    });
    /* 初始化 — 设置画布并清空粒子数组 */

    function init() {
        initCanvas();
        particles = [];
        energyTrails = [];
        connections = [];
    }
    /* 窗口大小变化时重新初始化（防抖） */

    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 250);
    });

    init();
})();
