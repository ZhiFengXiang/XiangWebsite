/**
 * #skills section "黑金智能核心" cursor effect
 * AI energy node with golden data particles, energy flows, and geometric connections.
 * Colors: liquid gold, amber gold, warm gold, champagne gold.
 * Movement: intelligent, algorithmic control with rotation, aggregation, diffusion.
 */
(function() {
    'use strict';
    var canvas = document.getElementById('skills-smoke-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var isMobile = window.innerWidth < 768;
    if (isMobile) return;

    var section = document.getElementById('skills');
    var particles = [];
    var energyTrails = [];
    var connections = [];
    var mouseX = -1000, mouseY = -1000;
    var lastMouseX = -1000, lastMouseY = -1000;
    var mouseSpeed = 0;
    var isMouseIn = false;
    var width, height;
    var animationId = null;
    var time = 0;
    
    // Configuration
    var MAX_PARTICLES = 80;
    var MAX_TRAILS = 40;
    var MAX_CONNECTIONS = 20;
    var CONNECTION_DISTANCE = 120;
    var TRAIL_LENGTH = 15;
    
    // Golden color palette
    var goldColors = [
        { r: 255, g: 215, b: 0 },    // Liquid gold
        { r: 255, g: 193, b: 37 },   // Amber gold
        { r: 255, g: 223, b: 0 },    // Warm gold
        { r: 248, g: 222, b: 126 },  // Champagne gold
        { r: 255, g: 228, b: 181 },  // Moccasin
        { r: 255, g: 248, b: 220 },  // Cornsilk
        { r: 255, g: 245, b: 238 },  // Seashell
        { r: 255, g: 250, b: 240 }   // Floral white
    ];

    function initCanvas() {
        width = section.offsetWidth;
        height = section.offsetHeight;
        canvas.width = width;
        canvas.height = height;
    }

    // Particle class with intelligent behavior
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
        this.behavior = Math.random(); // Different AI behaviors
        
        // Initialize based on type
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
            this.life = this.maxLife * 0.3; // Start partially through life
        }
    }

    Particle.prototype.update = function() {
        this.life++;
        if (this.life >= this.maxLife) return false;

        // Life cycle alpha
        var lifeRatio = this.life / this.maxLife;
        if (lifeRatio < 0.15) {
            this.alpha = this.maxAlpha * (lifeRatio / 0.15);
        } else if (lifeRatio > 0.7) {
            this.alpha = this.maxAlpha * (1 - (lifeRatio - 0.7) / 0.3);
        } else {
            this.alpha = this.maxAlpha;
        }

        // Fade when mouse leaves
        if (!isMouseIn) {
            this.alpha *= 0.96;
        }

        // Type-specific behaviors
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

    Particle.prototype.updateDataParticle = function() {
        // Intelligent orbiting with occasional direction changes
        this.orbitAngle += this.orbitSpeed;
        
        if (this.behavior < 0.3) {
            // Orbit behavior
            this.targetX = mouseX + Math.cos(this.orbitAngle) * this.orbitRadius;
            this.targetY = mouseY + Math.sin(this.orbitAngle) * this.orbitRadius;
        } else if (this.behavior < 0.6) {
            // Random walk with attraction to mouse
            var angle = Math.atan2(mouseY - this.y, mouseX - this.x);
            this.vx += Math.cos(angle) * 0.02;
            this.vy += Math.sin(angle) * 0.02;
            this.vx *= 0.98;
            this.vy *= 0.98;
        } else {
            // Linear movement
            this.x += this.vx;
            this.y += this.vy;
            return;
        }

        // Move toward target
        this.x += (this.targetX - this.x) * 0.08;
        this.y += (this.targetY - this.y) * 0.08;
    };

    Particle.prototype.updateEnergyParticle = function() {
        // High-speed flow with trails
        var angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        var distance = Math.sqrt(Math.pow(mouseX - this.x, 2) + Math.pow(mouseY - this.y, 2));
        
        // Attraction to mouse with speed based on distance
        var speed = 0.05 + (distance / 200) * 0.1;
        this.vx += Math.cos(angle) * speed;
        this.vy += Math.sin(angle) * speed;
        
        // Add some orbital motion
        this.vx += Math.sin(time * 0.05 + this.orbitAngle) * 0.02;
        this.vy += Math.cos(time * 0.05 + this.orbitAngle) * 0.02;
        
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        this.x += this.vx;
        this.y += this.vy;
    };

    Particle.prototype.updateCoreParticle = function() {
        // Core particles orbit slowly around mouse
        this.orbitAngle += this.orbitSpeed * 0.5;
        this.targetX = mouseX + Math.cos(this.orbitAngle) * this.orbitRadius * 0.5;
        this.targetY = mouseY + Math.sin(this.orbitAngle) * this.orbitRadius * 0.5;
        
        this.x += (this.targetX - this.x) * 0.05;
        this.y += (this.targetY - this.y) * 0.05;
    };

    Particle.prototype.draw = function() {
        if (this.alpha <= 0) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        var color = goldColors[this.colorIndex];
        
        if (this.type === 'core') {
            // Core particles: larger, more visible, with glow
            var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 3);
            gradient.addColorStop(0, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')');
            gradient.addColorStop(0.5, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + (this.alpha * 0.5) + ')');
            gradient.addColorStop(1, 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner core
            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'energy') {
            // Energy particles: elongated with motion blur
            var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            var length = this.size * (1 + speed * 0.5);
            
            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, length, Math.atan2(this.vy, this.vx), 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Data particles: small, precise
            ctx.fillStyle = 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + this.alpha + ')';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    };

    // Energy trail class
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

    // Connection class for geometric structures
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

    function animate() {
        ctx.clearRect(0, 0, width, height);
        time++;
        
        // Calculate mouse speed
        var dx = mouseX - lastMouseX;
        var dy = mouseY - lastMouseY;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy);
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        
        // Spawn particles based on mouse activity
        if (isMouseIn) {
            var spawnRate = 0.3 + mouseSpeed * 0.02;
            
            if (Math.random() < spawnRate && particles.length < MAX_PARTICLES) {
                var type = Math.random();
                if (type < 0.6) {
                    particles.push(new Particle(mouseX, mouseY, 'data'));
                } else if (type < 0.9) {
                    particles.push(new Particle(mouseX, mouseY, 'energy'));
                } else {
                    particles.push(new Particle(mouseX, mouseY, 'core'));
                }
            }
            
            // Add energy trails
            if (mouseSpeed > 2 && Math.random() < 0.3 && energyTrails.length < MAX_TRAILS) {
                var trail = new EnergyTrail(mouseX, mouseY);
                trail.points = [{ x: mouseX, y: mouseY }];
                energyTrails.push(trail);
            }
            
            // Update existing trails
            for (var t = 0; t < energyTrails.length; t++) {
                if (energyTrails[t].points.length < TRAIL_LENGTH) {
                    energyTrails[t].points.push({ x: mouseX, y: mouseY });
                }
            }
        }
        
        // Update and draw particles (in-place removal to reduce GC pressure)
        for (var i = particles.length - 1; i >= 0; i--) {
            if (particles[i].update()) {
                particles[i].draw();
            } else {
                particles.splice(i, 1);
            }
        }
        
        // Update and draw energy trails (in-place removal)
        for (var j = energyTrails.length - 1; j >= 0; j--) {
            if (energyTrails[j].update()) {
                energyTrails[j].draw();
            } else {
                energyTrails.splice(j, 1);
            }
        }
        
        // Create connections between nearby particles
        if (Math.random() < 0.1 && connections.length < MAX_CONNECTIONS) {
            for (var k = 0; k < particles.length; k++) {
                for (var l = k + 1; l < particles.length; l++) {
                    var p1 = particles[k];
                    var p2 = particles[l];
                    var dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                    
                    if (dist < CONNECTION_DISTANCE && Math.random() < 0.2) {
                        connections.push(new Connection(p1, p2));
                    }
                }
            }
        }
        
        // Update and draw connections (in-place removal)
        for (var m = connections.length - 1; m >= 0; m--) {
            if (connections[m].update()) {
                connections[m].draw();
            } else {
                connections.splice(m, 1);
            }
        }
        
        // Continue animation if needed
        if (particles.length > 0 || energyTrails.length > 0 || connections.length > 0 || isMouseIn) {
            animationId = requestAnimationFrame(animate);
        } else {
            animationId = null;
        }
    }

    function startAnim() {
        if (!animationId) {
            animationId = requestAnimationFrame(animate);
        }
    }

    section.addEventListener('mousemove', function(e) {
        var rect = section.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        isMouseIn = true;
        startAnim();
    });

    section.addEventListener('mouseleave', function() {
        isMouseIn = false;
        document.body.classList.remove('skills-cursor-hide');
        // Let existing particles fade out naturally
        startAnim();
    });

    section.addEventListener('mouseenter', function() {
        isMouseIn = true;
        document.body.classList.add('skills-cursor-hide');
    });

    function init() {
        initCanvas();
        particles = [];
        energyTrails = [];
        connections = [];
    }

    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 250);
    });

    init();
})();
