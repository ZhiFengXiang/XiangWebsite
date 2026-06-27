/**
 * Cubes 组件（移植自 React Bits）
 * 3D 透视立方体网格，支持鼠标悬停倾斜 + 点击波纹 + 自动动画
 * 依赖：GSAP（通过 CDN 加载）
 *
 * 用法：在页面中添加 <div id="cubes-container"></div>，然后调用 initCubes(containerId, options)
 */

function initCubes(containerId, options = {}) {
  const {
    gridSize = 8,
    cubeSize,
    maxAngle = 60,
    radius = 4,
    easing = 'power3.out',
    duration = { enter: 0.3, leave: 0.6 },
    cellGap,
    borderStyle = '2px dashed #5227FF',
    faceColor = '#1a1a2e',
    shadow = false,
    autoAnimate = true,
    rippleOnClick = true,
    rippleColor = '#ff6b6b',
    rippleSpeed = 1.5
  } = options;

  const container = document.getElementById(containerId);
  if (!container) return;

  // ---- 构建 DOM 结构 ----
  const wrapper = document.createElement('div');
  wrapper.className = 'cubes-wrapper';
  wrapper.style.setProperty('--cube-face-border', borderStyle);
  wrapper.style.setProperty('--cube-face-bg', faceColor);
  wrapper.style.setProperty('--cube-face-shadow', shadow === true ? '0 0 6px rgba(0,0,0,.5)' : shadow || 'none');
  if (cubeSize) {
    wrapper.style.width = `${gridSize * cubeSize}px`;
    wrapper.style.height = `${gridSize * cubeSize}px`;
  }

  const scene = document.createElement('div');
  scene.className = 'cubes-scene';

  const colGap = typeof cellGap === 'number' ? `${cellGap}px` : cellGap?.col !== undefined ? `${cellGap.col}px` : '5%';
  const rowGap = typeof cellGap === 'number' ? `${cellGap}px` : cellGap?.row !== undefined ? `${cellGap.row}px` : '5%';
  scene.style.gridTemplateColumns = cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`;
  scene.style.gridTemplateRows = cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`;
  scene.style.columnGap = colGap;
  scene.style.rowGap = rowGap;

  // 创建所有 cube
  const allCubes = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cube = document.createElement('div');
      cube.className = 'cube';
      cube.dataset.row = r;
      cube.dataset.col = c;
      const faces = ['top', 'bottom', 'left', 'right', 'front', 'back'];
      faces.forEach(face => {
        const div = document.createElement('div');
        div.className = `cube-face cube-face--${face}`;
        cube.appendChild(div);
      });
      scene.appendChild(cube);
      allCubes.push(cube);
    }
  }

  wrapper.appendChild(scene);
  container.appendChild(wrapper);

  // ---- 状态变量 ----
  let rafId = null;
  let idleTimer = null;
  let userActive = false;
  const simPos = { x: 0, y: 0 };
  const simTarget = { x: 0, y: 0 };
  let simRAF = null;

  const enterDur = duration.enter;
  const leaveDur = duration.leave;

  // ---- 核心函数 ----
  function tiltAt(rowCenter, colCenter) {
    allCubes.forEach(cube => {
      const r = +cube.dataset.row;
      const c = +cube.dataset.col;
      const dist = Math.hypot(r - rowCenter, c - colCenter);
      if (dist <= radius) {
        const pct = 1 - dist / radius;
        const angle = pct * maxAngle;
        gsap.to(cube, {
          duration: enterDur,
          ease: easing,
          overwrite: true,
          rotateX: -angle,
          rotateY: angle
        });
      } else {
        gsap.to(cube, {
          duration: leaveDur,
          ease: 'power3.out',
          overwrite: true,
          rotateX: 0,
          rotateY: 0
        });
      }
    });
  }

  function resetAll() {
    allCubes.forEach(cube =>
      gsap.to(cube, {
        duration: leaveDur,
        rotateX: 0,
        rotateY: 0,
        ease: 'power3.out'
      })
    );
  }

  // ---- 事件处理 ----
  function onPointerMove(e) {
    userActive = true;
    if (idleTimer) clearTimeout(idleTimer);

    const rect = scene.getBoundingClientRect();
    const cellW = rect.width / gridSize;
    const cellH = rect.height / gridSize;
    const colCenter = (e.clientX - rect.left) / cellW;
    const rowCenter = (e.clientY - rect.top) / cellH;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

    idleTimer = setTimeout(() => { userActive = false; }, 3000);
  }

  function onTouchMove(e) {
    e.preventDefault();
    userActive = true;
    if (idleTimer) clearTimeout(idleTimer);

    const rect = scene.getBoundingClientRect();
    const cellW = rect.width / gridSize;
    const cellH = rect.height / gridSize;
    const touch = e.touches[0];
    const colCenter = (touch.clientX - rect.left) / cellW;
    const rowCenter = (touch.clientY - rect.top) / cellH;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

    idleTimer = setTimeout(() => { userActive = false; }, 3000);
  }

  function onClick(e) {
    if (!rippleOnClick) return;
    const rect = scene.getBoundingClientRect();
    const cellW = rect.width / gridSize;
    const cellH = rect.height / gridSize;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const colHit = Math.floor((clientX - rect.left) / cellW);
    const rowHit = Math.floor((clientY - rect.top) / cellH);

    const baseRingDelay = 0.15;
    const baseAnimDur = 0.3;
    const baseHold = 0.6;

    const spreadDelay = baseRingDelay / rippleSpeed;
    const animDuration = baseAnimDur / rippleSpeed;
    const holdTime = baseHold / rippleSpeed;

    const rings = {};
    allCubes.forEach(cube => {
      const r = +cube.dataset.row;
      const c = +cube.dataset.col;
      const dist = Math.hypot(r - rowHit, c - colHit);
      const ring = Math.round(dist);
      if (!rings[ring]) rings[ring] = [];
      rings[ring].push(cube);
    });

    Object.keys(rings)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(ring => {
        const delay = ring * spreadDelay;
        const faces = rings[ring].flatMap(cube => Array.from(cube.querySelectorAll('.cube-face')));

        gsap.to(faces, {
          backgroundColor: rippleColor,
          duration: animDuration,
          delay,
          ease: 'power3.out'
        });
        gsap.to(faces, {
          backgroundColor: faceColor,
          duration: animDuration,
          delay: delay + animDuration + holdTime,
          ease: 'power3.out'
        });
      });
  }

  // ---- 事件绑定 ----
  scene.addEventListener('pointermove', onPointerMove);
  scene.addEventListener('pointerleave', resetAll);
  scene.addEventListener('click', onClick);
  scene.addEventListener('touchmove', onTouchMove, { passive: false });
  scene.addEventListener('touchstart', () => { userActive = true; }, { passive: true });
  scene.addEventListener('touchend', resetAll, { passive: true });

  // ---- 自动动画 ----
  if (autoAnimate) {
    simPos.x = Math.random() * gridSize;
    simPos.y = Math.random() * gridSize;
    simTarget.x = Math.random() * gridSize;
    simTarget.y = Math.random() * gridSize;

    const speed = 0.02;
    function loop() {
      if (!userActive) {
        simPos.x += (simTarget.x - simPos.x) * speed;
        simPos.y += (simTarget.y - simPos.y) * speed;
        tiltAt(simPos.y, simPos.x);
        if (Math.hypot(simPos.x - simTarget.x, simPos.y - simTarget.y) < 0.1) {
          simTarget.x = Math.random() * gridSize;
          simTarget.y = Math.random() * gridSize;
        }
      }
      simRAF = requestAnimationFrame(loop);
    }
    simRAF = requestAnimationFrame(loop);
  }
}
