/**
 * Antigravity — 反重力粒子环效果（vanilla JS 移植版）
 *
 * 移植自 React Bits 开源组件 Antigravity（JavaScript + CSS 变体）。
 * 原组件基于 React + @react-three/fiber + Three.js，本版本改为 vanilla JS，无 React 依赖。
 *
 * 工作原理：
 *   1. 使用 Three.js 创建透视相机（position [0,0,50]，fov 35）与 InstancedMesh；
 *   2. 粒子初始散布于视口范围内，每帧根据粒子“归属位置”与鼠标位置计算目标点；
 *   3. 当粒子落在鼠标磁场半径（magnetRadius）内时，会被吸引到围绕鼠标的环形轨道上，
 *      环半径为 ringRadius，并叠加正弦波动与随机偏移，形成“反重力”悬浮环；
 *   4. 远离磁场的粒子缓慢回归各自归属位置，形成呼吸般的聚散效果；
 *   5. 鼠标空闲超过 2 秒后（autoAnimate=true），自动以正余弦轨迹驱动虚拟鼠标；
 *   6. 使用 ResizeObserver 响应容器尺寸变化，IntersectionObserver 懒加载暂停渲染。
 *
 * 相比原 React 组件的改动：
 *   - 改为 vanilla JS（无 React 依赖），THREE 通过全局 CDN 引入；
 *   - 暴露 initAntigravity(container, options) 自动初始化；
 *   - 新增可见性检测（IntersectionObserver），不可见时暂停渲染节省性能；
 *   - 返回 { dispose } 用于清理 WebGL 资源与事件监听。
 *
 * 依赖：three.js（需在引入本脚本前通过 CDN 全局加载 window.THREE）
 */

(function () {
  'use strict';

  // 未引入 three.js 时给出明确提示，避免后续静默失败
  if (typeof window.THREE === 'undefined') {
    console.warn('[Antigravity] 未检测到 window.THREE，请先通过 CDN 加载 three.js');
    return;
  }

  var THREE = window.THREE;

  /* ============================================================
   * 默认配置参数（与原 React 组件 props 默认值一致）
   * ============================================================ */
  var DEFAULTS = {
    count: 300,              // 粒子数量
    magnetRadius: 10,        // 磁场半径：粒子进入该范围才会被吸引成环
    ringRadius: 10,          // 形成环的基础半径
    waveSpeed: 0.4,          // 环上波动的角速度
    waveAmplitude: 1,        // 波动幅度（0 为完美圆环）
    particleSize: 2,         // 粒子尺寸缩放倍率
    lerpSpeed: 0.1,          // 粒子向目标位置插值的速度
    color: '#FF9FFC',        // 粒子颜色（Hex）
    autoAnimate: false,      // 鼠标空闲时是否自动动画
    particleVariance: 1,     // 粒子尺寸方差（0-1）
    rotationSpeed: 0,        // 环整体旋转速度
    depthFactor: 1,          // Z 轴深度倍率
    pulseSpeed: 3,           // 粒子尺寸脉动速度
    particleShape: 'capsule',// 粒子形状：capsule | sphere | box | tetrahedron
    fieldStrength: 10        // 环紧密度，越大环越规整
  };

  /* ============================================================
   * 根据形状名称构建对应的几何体
   * ============================================================ */
  function buildGeometry(shape) {
    switch (shape) {
      case 'sphere':
        return new THREE.SphereGeometry(0.2, 16, 16);
      case 'box':
        return new THREE.BoxGeometry(0.3, 0.3, 0.3);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(0.3);
      case 'capsule':
      default:
        // 默认胶囊体，与原组件一致
        return new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
    }
  }

  /* ============================================================
   * initAntigravity(container, options)
   *  - container：承载效果的 DOM 元素（应已设置宽高）
   *  - options：覆盖默认配置的参数对象
   *  返回 { dispose } 用于清理 WebGL 资源与事件监听
   * ============================================================ */
  function initAntigravity(container, options) {
    if (!container) return { dispose: function () {} };

    // 合并默认配置与传入配置
    var props = {};
    var key;
    for (key in DEFAULTS) {
      props[key] = (options && options[key] != null) ? options[key] : DEFAULTS[key];
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      // WebGL 不可用时静默降级
      return { dispose: function () {} };
    }

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    // 透视相机：与原组件一致，position [0,0,50]，fov 35
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(0, 0, 50);

    // 复用 Object3D 作为设置每个实例矩阵的临时载体
    var dummy = new THREE.Object3D();

    // 粒子几何体与材质
    var geometry = buildGeometry(props.particleShape);
    var material = new THREE.MeshBasicMaterial({ color: new THREE.Color(props.color) });
    var mesh = new THREE.InstancedMesh(geometry, material, props.count);
    scene.add(mesh);

    /* ----------------------------------------------------------
     * 视口尺寸计算：等价于 @react-three/fiber 的 useThree().viewport
     * 在 z=0 平面上相机可见的世界坐标范围
     * ---------------------------------------------------------- */
    var viewport = { width: 100, height: 100 };
    function updateViewport() {
      var distance = camera.position.z; // 50
      var vFov = (camera.fov * Math.PI) / 180;
      var height = 2 * Math.tan(vFov / 2) * distance;
      var width = height * camera.aspect;
      viewport.width = width || 100;
      viewport.height = height || 100;
    }

    /* ----------------------------------------------------------
     * 粒子数据初始化
     *  - mx/my/mz：粒子归属位置（散布于视口内）
     *  - cx/cy/cz：粒子当前位置（向目标插值）
     *  - randomRadiusOffset：环半径随机偏移，让环更自然
     * ---------------------------------------------------------- */
    var particles = [];
    function initParticles() {
      particles = [];
      var width = viewport.width || 100;
      var height = viewport.height || 100;
      for (var i = 0; i < props.count; i++) {
        var t = Math.random() * 100;
        var factor = 20 + Math.random() * 100;
        var speed = 0.01 + Math.random() / 200;
        var xFactor = -50 + Math.random() * 100;
        var yFactor = -50 + Math.random() * 100;
        var zFactor = -50 + Math.random() * 100;

        var x = (Math.random() - 0.5) * width;
        var y = (Math.random() - 0.5) * height;
        var z = (Math.random() - 0.5) * 20;

        var randomRadiusOffset = (Math.random() - 0.5) * 2;

        particles.push({
          t: t,
          factor: factor,
          speed: speed,
          xFactor: xFactor,
          yFactor: yFactor,
          zFactor: zFactor,
          mx: x,
          my: y,
          mz: z,
          cx: x,
          cy: y,
          cz: z,
          vx: 0,
          vy: 0,
          vz: 0,
          randomRadiusOffset: randomRadiusOffset
        });
      }
    }

    /* ----------------------------------------------------------
     * 鼠标状态
     *  - pointer：归一化设备坐标（NDC，-1 ~ 1），等价于 r3f 的 state.pointer
     *  - virtualMouse：平滑后的鼠标世界坐标
     *  - lastMousePos / lastMouseMoveTime：用于检测空闲触发 autoAnimate
     * ---------------------------------------------------------- */
    var pointer = { x: 0, y: 0 };
    var virtualMouse = { x: 0, y: 0 };
    var lastMousePos = { x: 0, y: 0 };
    var lastMouseMoveTime = 0;

    function onPointerMove(e) {
      var rect = container.getBoundingClientRect();
      // 转换为 NDC（-1 ~ 1），y 轴翻转使向上为正
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }
    // 监听 window 而非 container，使鼠标离开容器后仍能平滑回归
    window.addEventListener('pointermove', onPointerMove);

    /* ----------------------------------------------------------
     * 尺寸自适应：ResizeObserver 监听容器尺寸变化
     * ---------------------------------------------------------- */
    function resize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      updateViewport();
    }
    var resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // 视口确定后初始化粒子
    initParticles();

    /* ----------------------------------------------------------
     * 可见性检测：容器离开视口时暂停渲染，节省性能
     * ---------------------------------------------------------- */
    var isVisible = true;
    var intersectionObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        isVisible = entries[i].isIntersecting;
      }
    }, { threshold: 0 });
    intersectionObserver.observe(container);

    /* ----------------------------------------------------------
     * 动画循环：等价于原组件 useFrame 内的逻辑
     * ---------------------------------------------------------- */
    var rafId = null;
    var clock = {
      // 与 THREE.Clock 行为一致，从启动开始累计秒数
      start: performance.now(),
      getElapsedTime: function () {
        return (performance.now() - this.start) / 1000;
      }
    };

    function animate() {
      rafId = requestAnimationFrame(animate);
      if (!isVisible) return;

      var m = pointer;
      var v = viewport;

      // 检测鼠标是否移动，记录最后移动时间
      var mouseDist = Math.sqrt(
        Math.pow(m.x - lastMousePos.x, 2) + Math.pow(m.y - lastMousePos.y, 2)
      );
      if (mouseDist > 0.001) {
        lastMouseMoveTime = Date.now();
        lastMousePos.x = m.x;
        lastMousePos.y = m.y;
      }

      // 将 NDC 鼠标坐标换算为 z=0 平面上的世界坐标
      var destX = (m.x * v.width) / 2;
      var destY = (m.y * v.height) / 2;

      // 鼠标空闲超过 2 秒时，以正余弦轨迹自动驱动
      if (props.autoAnimate && Date.now() - lastMouseMoveTime > 2000) {
        var time = clock.getElapsedTime();
        destX = Math.sin(time * 0.5) * (v.width / 4);
        destY = Math.cos(time * 0.5 * 2) * (v.height / 4);
      }

      // 平滑虚拟鼠标位置
      var smoothFactor = 0.05;
      virtualMouse.x += (destX - virtualMouse.x) * smoothFactor;
      virtualMouse.y += (destY - virtualMouse.y) * smoothFactor;

      var targetX = virtualMouse.x;
      var targetY = virtualMouse.y;

      var globalRotation = clock.getElapsedTime() * props.rotationSpeed;

      // 遍历所有粒子，计算目标位置并写入实例矩阵
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.t += p.speed / 2;
        var t = p.t;

        // 透视投影因子：越靠前（cz 越大）投影越远离目标
        var projectionFactor = 1 - p.cz / 50;
        var projectedTargetX = targetX * projectionFactor;
        var projectedTargetY = targetY * projectionFactor;

        var dx = p.mx - projectedTargetX;
        var dy = p.my - projectedTargetY;
        var dist = Math.sqrt(dx * dx + dy * dy);

        var targetPos = { x: p.mx, y: p.my, z: p.mz * props.depthFactor };

        // 进入磁场半径的粒子被吸引成环
        if (dist < props.magnetRadius) {
          var angle = Math.atan2(dy, dx) + globalRotation;

          var wave = Math.sin(t * props.waveSpeed + angle) * (0.5 * props.waveAmplitude);
          var deviation = p.randomRadiusOffset * (5 / (props.fieldStrength + 0.1));

          var currentRingRadius = props.ringRadius + wave + deviation;

          targetPos.x = projectedTargetX + currentRingRadius * Math.cos(angle);
          targetPos.y = projectedTargetY + currentRingRadius * Math.sin(angle);
          targetPos.z = p.mz * props.depthFactor + Math.sin(t) * (1 * props.waveAmplitude * props.depthFactor);
        }

        // 向目标位置插值
        p.cx += (targetPos.x - p.cx) * props.lerpSpeed;
        p.cy += (targetPos.y - p.cy) * props.lerpSpeed;
        p.cz += (targetPos.z - p.cz) * props.lerpSpeed;

        dummy.position.set(p.cx, p.cy, p.cz);

        // 朝向目标点并旋转，使胶囊体沿环切方向排列
        dummy.lookAt(projectedTargetX, projectedTargetY, p.cz);
        dummy.rotateX(Math.PI / 2);

        // 距环越近粒子越大，叠加脉动
        var currentDistToMouse = Math.sqrt(
          Math.pow(p.cx - projectedTargetX, 2) + Math.pow(p.cy - projectedTargetY, 2)
        );
        var distFromRing = Math.abs(currentDistToMouse - props.ringRadius);
        var scaleFactor = 1 - distFromRing / 10;
        if (scaleFactor < 0) scaleFactor = 0;
        else if (scaleFactor > 1) scaleFactor = 1;

        var finalScale = scaleFactor *
          (0.8 + Math.sin(t * props.pulseSpeed) * 0.2 * props.particleVariance) *
          props.particleSize;
        dummy.scale.set(finalScale, finalScale, finalScale);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    }
    animate();

    /* ----------------------------------------------------------
     * dispose：清理 WebGL 资源、事件监听与观察者
     * ---------------------------------------------------------- */
    function dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    }

    return { dispose: dispose };
  }

  // 暴露到全局
  window.initAntigravity = initAntigravity;

  /* ============================================================
   * 自动初始化：页面中带 [data-antigravity] 的元素自动启用效果
   *  支持的 data-* 属性：
   *   data-count / data-magnet-radius / data-ring-radius / data-wave-speed
   *   data-wave-amplitude / data-particle-size / data-lerp-speed / data-color
   *   data-auto-animate / data-particle-variance / data-rotation-speed
   *   data-depth-factor / data-pulse-speed / data-particle-shape / data-field-strength
   * ============================================================ */
  function parseBool(v) { return v === 'true' || v === '1'; }
  function parseNum(v, def) {
    var n = parseFloat(v);
    return isNaN(n) ? def : n;
  }

  function autoInit() {
    var nodes = document.querySelectorAll('[data-antigravity]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      initAntigravity(node, {
        count: parseInt(node.getAttribute('data-count'), 10) || DEFAULTS.count,
        magnetRadius: parseNum(node.getAttribute('data-magnet-radius'), DEFAULTS.magnetRadius),
        ringRadius: parseNum(node.getAttribute('data-ring-radius'), DEFAULTS.ringRadius),
        waveSpeed: parseNum(node.getAttribute('data-wave-speed'), DEFAULTS.waveSpeed),
        waveAmplitude: parseNum(node.getAttribute('data-wave-amplitude'), DEFAULTS.waveAmplitude),
        particleSize: parseNum(node.getAttribute('data-particle-size'), DEFAULTS.particleSize),
        lerpSpeed: parseNum(node.getAttribute('data-lerp-speed'), DEFAULTS.lerpSpeed),
        color: node.getAttribute('data-color') || DEFAULTS.color,
        autoAnimate: parseBool(node.getAttribute('data-auto-animate')),
        particleVariance: parseNum(node.getAttribute('data-particle-variance'), DEFAULTS.particleVariance),
        rotationSpeed: parseNum(node.getAttribute('data-rotation-speed'), DEFAULTS.rotationSpeed),
        depthFactor: parseNum(node.getAttribute('data-depth-factor'), DEFAULTS.depthFactor),
        pulseSpeed: parseNum(node.getAttribute('data-pulse-speed'), DEFAULTS.pulseSpeed),
        particleShape: node.getAttribute('data-particle-shape') || DEFAULTS.particleShape,
        fieldStrength: parseNum(node.getAttribute('data-field-strength'), DEFAULTS.fieldStrength)
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
