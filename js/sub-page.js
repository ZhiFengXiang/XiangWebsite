/**
 * 二级页面通用脚本
 * 功能模块：
 * 1. 滚动渐显效果 — 元素进入视口时添加 .is-visible 类
 * 2. 主内容黑屏解除 — main 默认 opacity:0，需添加 main-visible 类
 * 3. 导航栏显隐 + 滚动进度条更新
 * 4. 自定义光标系统 — 点 + 扩散环 + 跟随环（仅精确指针设备）
 * 5. 段落半圆滚动切换（project-details 专用）— 滚轮/触摸/键盘三种交互
 */
    /* ---- 滚动渐显效果 — 元素进入视口时添加 .is-visible 类，触发后 unobserve 释放资源 ---- */
        const revealItems = document.querySelectorAll(".reveal");
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.16 });
        revealItems.forEach((item) => revealObserver.observe(item));
    /* ---- 解除主内容黑屏 — main 默认 opacity:0，需添加 main-visible 类 ---- */
        (function() {
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.classList.add('main-visible');
        })();
    /* ---- 导航栏隐藏/显示 + 滚动进度条更新 ---- */
    /* 节流函数限制 scroll 事件触发频率至每 16ms 一次（约 60fps） */
        function throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
        let lastScrollY = 0;
        const progressBar = document.querySelector('.scroll-progress');
        const handleScroll = throttle(() => {
            const currentScrollY = window.scrollY;
            lastScrollY = currentScrollY;
            // 滚动进度条：当前滚动位置占总可滚动高度的比例
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0 && progressBar) {
                progressBar.style.width = ((currentScrollY / scrollHeight) * 100) + '%';
            }
        }, 16);
        window.addEventListener('scroll', handleScroll, { passive: true });
    /* ---- 自定义光标系统 — 点 + 扩散环 + 跟随环 ---- */
    /* 仅在支持精确指针的设备（鼠标）上启用，触屏设备使用系统光标 */
        if (window.matchMedia("(pointer: fine)").matches) {
            const cursorDot = document.querySelector('.cursor-dot');
            const cursorExpand = document.querySelector('.cursor-expand');
            const cursorRing = document.querySelector('.cursor-ring');
            let ringX = 0, ringY = 0;
            let dotX = 0, dotY = 0;
            let ringAnimId = null;
            /* 跟随环缓动动画 — 每帧向内圈位置靠近 12%，接近后停止以节省性能 */
            function animateRing() {
                ringX += (dotX - ringX) * 0.12;
                ringY += (dotY - ringY) * 0.12;
                cursorRing.style.left = (ringX - 16) + 'px';
                cursorRing.style.top = (ringY - 16) + 'px';
                // 当外圈足够接近内圈时停止动画（距离平方 < 0.5）
                const dx = dotX - ringX;
                const dy = dotY - ringY;
                if (dx * dx + dy * dy > 0.5) {
                    ringAnimId = requestAnimationFrame(animateRing);
                } else {
                    ringAnimId = null;
                }
            }

            document.addEventListener('mousemove', e => {
                dotX = e.clientX;
                dotY = e.clientY;
                // 内圈点和扩散环即时跟随，无延迟
                cursorDot.style.left = (dotX - 7) + 'px';
                cursorDot.style.top = (dotY - 7) + 'px';
                cursorExpand.style.left = dotX + 'px';
                cursorExpand.style.top = dotY + 'px';
                // 按需启动外圈动画（仅在停止后重新移动时启动）
                if (!ringAnimId) {
                    ringAnimId = requestAnimationFrame(animateRing);
                }
            });

            // hover 到可交互元素时光标放大（事件委托，捕获阶段）
            document.addEventListener('mouseenter', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button');
                // 返回按钮不触发光标放大
                if (!el || el.classList.contains('pj-back-fixed')) return;
                cursorDot.classList.add('hover');
                cursorExpand.classList.add('hover');
                cursorRing.classList.add('hover');
            }, true);

            document.addEventListener('mouseleave', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button');
                if (!el || el.classList.contains('pj-back-fixed')) return;
                cursorDot.classList.remove('hover');
                cursorExpand.classList.remove('hover');
                cursorRing.classList.remove('hover');
            }, true);
        }


/* ---- 段落半圆滚动切换（project-details 专用） ---- */
/* 实现：每个 section 作为固定覆盖层，通过 rotate + opacity 切换。
   切换动画为半圆旋转（-90deg → 0deg），使用指数缓出函数。 */
(function() {
  /* 动画时长和滚轮冷却时间 */
  const ANIM_DURATION = 750;        // section 切换动画时长（毫秒）
  const WHEEL_COOLDOWN = 800;       // 两次 section 切换的最小间隔（毫秒）
  const sections = document.querySelectorAll('.pj-section');
  const total = sections.length;
  if (!total) return;

  let cur = 0;                      // 当前显示的 section 索引
  const barFill = document.querySelector('.pj-section-bar-fill');
  let isAnimating = false;          // 动画锁，防止切换过程中重复触发
  let lastSwitchTime = 0;           // 上次切换时间戳，用于冷却判断
  /* 根据 URL hash 定位到对应 section — 支持通过锚点直接跳转 */
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    for (let h = 0; h < total; h++) {
      if (sections[h].id === hash) { cur = h; break; }
    }
  }
  /* 2. 将所有 section 设为固定覆盖层，仅目标 section 可见 */
  /* 每个 section 独立滚动，初始旋转 -90deg 并隐藏，切换时旋转到 0deg */
  for (let i = 0; i < total; i++) {
    const sec = sections[i];
    sec.style.position = 'fixed';
    sec.style.top = '0';
    sec.style.left = '0';
    sec.style.right = '0';
    sec.style.bottom = '0';
    sec.style.overflowY = 'auto';
    sec.style.overflowX = 'hidden';
    sec.style.height = '100vh';
    sec.style.padding = '0';
    sec.style.margin = '0';
    sec.style.border = 'none';
    sec.style.opacity = '0';
    sec.style.visibility = 'hidden';
    sec.style.transform = 'rotate(-90deg)';
    sec.style.transformOrigin = '0% 50%';
    sec.style.transition = 'none'; // JS 动画控制，禁用 CSS 过渡
    sec.style.zIndex = '1';
    sec.style.willChange = 'transform, opacity';
    // 滚动条样式：细滚动条 + 半透明颜色
    sec.style.scrollbarWidth = 'thin';
    sec.style.scrollbarColor = 'rgba(245,241,232,0.2) transparent';
  }
  // 显示初始 section
  sections[cur].style.opacity = '1';
  sections[cur].style.visibility = 'visible';
  sections[cur].style.transform = 'rotate(0deg)';
  // 更新进度条填充高度
  if (barFill) barFill.style.height = (total > 1 ? (cur / (total - 1) * 100) : 0) + '%';
  /* 3. 检查当前 section 是否需要内部滚动 */
  /* 返回 true 表示内容超出视口，需要先滚动到底再切换 section */
  function needsScroll(dir) {
    const sec = sections[cur];
    if (!sec) return false;
    // 内容不超出视口则无需滚动
    if (sec.scrollHeight <= sec.clientHeight + 2) return false;
    // 向下滚动且未到底
    if (dir > 0 && sec.scrollTop + sec.clientHeight < sec.scrollHeight - 2) return true;
    // 向上滚动且未到顶
    if (dir < 0 && sec.scrollTop > 2) return true;
    return false;
  }
  /* 4. 切换到指定 section — 指数缓出动画 */
  // easeOutExpo: t 从 0 到 1，返回值从 0 到 1，前期快速变化后期缓慢
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  // 执行 section 切换动画：旧 section 旋转出（0→90deg），新 section 旋转入（-90→0deg）
  function animateSection(fromIdx, toIdx) {
    const from = sections[fromIdx];
    const to = sections[toIdx];
    const start = performance.now();
    const dur = ANIM_DURATION;

    // 准备目标 section：从 -90deg 开始，不可见
    to.style.visibility = 'visible';
    to.style.opacity = '0';
    to.scrollTop = 0;  // 重置滚动位置到顶部

    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / dur, 1);
      const e = easeOutExpo(t);

      // 旧 section：旋转 0 → 90deg，透明度 1 → 0
      const oldAngle = e * 90;
      const oldOpacity = 1 - e;
      from.style.transform = 'rotate(' + oldAngle + 'deg)';
      from.style.opacity = oldOpacity;

      // 新 section：旋转 -90 → 0deg，透明度 0 → 1
      const newAngle = -90 * (1 - e);
      const newOpacity = e;
      to.style.transform = 'rotate(' + newAngle + 'deg)';
      to.style.opacity = newOpacity;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // 动画完成：清理旧 section，固定新 section
        from.style.visibility = 'hidden';
        from.style.transform = 'rotate(-90deg)';
        from.style.opacity = '0';
        to.style.transform = 'rotate(0deg)';
        to.style.opacity = '1';
        isAnimating = false;
      }
    }

    requestAnimationFrame(frame);
  }

  // 跳转到指定索引的 section
  function goTo(idx) {
    if (idx === cur || idx < 0 || idx >= total) { isAnimating = false; return; }
    isAnimating = true;
    lastSwitchTime = Date.now();

    const prev = cur;
    cur = idx;
    // 更新进度条
    if (barFill) barFill.style.height = (total > 1 ? (idx / (total - 1) * 100) : 0) + "%";

    // 重置内部滚动状态，确保新 section 从顶部开始
    scrollTarget = 0;
    scrollAnimating = false;
    animateSection(prev, idx);
  }
  /* 5. 平滑内部滚动 + section 切换（滚轮事件） */
  let scrollTarget = 0;            // 目标滚动位置
  let scrollAnimating = false;     // 滚动动画锁
  let wheelAccum = 0;              // 滚轮累积量（用于判断切换阈值）
  let wheelTimer = null;           // 滚轮累积清零计时器
  const WHEEL_BATCH_MS = 50;       // 滚轮累积清零间隔

  // 平滑滚动到目标位置：每帧靠近 25%
  function smoothScroll() {
    const sec = sections[cur];
    if (!sec) { scrollAnimating = false; return; }
    const diff = scrollTarget - sec.scrollTop;
    if (Math.abs(diff) < 1) {
      sec.scrollTop = scrollTarget;
      scrollAnimating = false;
      return;
    }
    sec.scrollTop += diff * 0.25;
    // 到顶时强制归零，避免浮点误差
      if (scrollTarget <= 0 && sec.scrollTop < 2) sec.scrollTop = 0;
    requestAnimationFrame(smoothScroll);
  }

  // 滚轮事件：优先内部滚动，内容滚动完毕后切换 section
  document.addEventListener('wheel', function(e) {
    e.preventDefault();

    if (isAnimating) return;
    if (Date.now() - lastSwitchTime < WHEEL_COOLDOWN) return;

    const dir = e.deltaY > 0 ? 1 : -1;

    // 内部滚动：内容未到底/顶时先滚动内容
    if (needsScroll(dir)) {
      const sec = sections[cur];
      scrollTarget = Math.max(0, Math.min(sec.scrollHeight - sec.clientHeight, sec.scrollTop + e.deltaY));
      if (!scrollAnimating) {
        scrollAnimating = true;
        requestAnimationFrame(smoothScroll);
      }
      return;
    }

    // 累积滚轮量，超过阈值（30）时切换 section
    wheelAccum += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function() { wheelAccum = 0; }, WHEEL_BATCH_MS);

    if (Math.abs(wheelAccum) < 30) return;
    wheelAccum = 0;

    const next = cur + dir;
    if (next >= 0 && next < total) {
      goTo(next);
    }
  }, { passive: false });
  /* 6. 触摸事件支持 — 垂直滑动切换 section 或滚动内容 */
  let tY = 0, tX = 0;
  document.addEventListener('touchstart', function(e) {
    tY = e.touches[0].clientY; tX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (isAnimating) return;
    const dy = tY - e.changedTouches[0].clientY;
    const dx = tX - e.changedTouches[0].clientX;
    // 垂直滑动距离 < 50px 或水平滑动更大时不触发
    if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx)) return;
    const dir = dy > 0 ? 1 : -1;
    // 优先内部滚动
    if (needsScroll(dir)) {
      sections[cur].scrollTop += dir * 200;
      return;
    }
    if (Date.now() - lastSwitchTime < WHEEL_COOLDOWN) return;
    const next = cur + dir;
    if (next >= 0 && next < total) goTo(next);
  }, { passive: true });
  /* 7. 键盘事件支持（方向键、翻页键、空格） */
  document.addEventListener('keydown', function(e) {
    if (isAnimating) return;
    let dir = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
    if (!dir) return;
    e.preventDefault();
    // 优先内部滚动
    if (needsScroll(dir)) {
      sections[cur].scrollTop += dir * 200;
      return;
    }
    if (Date.now() - lastSwitchTime < WHEEL_COOLDOWN) return;
    const next = cur + dir;
    if (next >= 0 && next < total) goTo(next);
  });
})();
