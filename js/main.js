        // ============================================================
        // 加载动画模块
        // 功能：色块依次下落并切换背景色，页面加载完成且动画时间结束后隐藏遮罩
        // ============================================================
        (function() {
            const loader = document.getElementById("loader");
            if (!loader) return;
            const blocks = document.querySelectorAll(".loader-block");
            const mainEl = document.querySelector("main");
            // 页面就绪标志与动画计时结束标志，两者均满足后才隐藏遮罩
            let pageReady = false;
            let timeUp = false;
            // 色块切换的颜色序列：从浅灰渐变到纯黑，营造下沉感
            const animColors = [
                "#eaeaea",
                "#d5d5d5",
                "#bfbfbf",
                "#a8a8a8",
                "#8f8f8f",
                "#737373",
                "#555555",
                "#363636",
                "#000000"
            ];
            // 每个色块触发颜色切换的时间点（毫秒），间隔 80ms
            const delays = [0, 80, 160, 240, 320, 400, 480, 560, 640, 720];
            for (let i = 0; i < blocks.length; i++) {
                (function(idx) {
                    // 用 setTimeout 确保动画开始前背景色已设置，避免闪烁
                    setTimeout(function() {
                        loader.style.backgroundColor = idx === 0 ? "#ffffff" : animColors[idx - 1];
                    }, delays[idx]);
                    // 监听 CSS 动画启动事件，双重保障背景色同步
                    blocks[idx].addEventListener("animationstart", function() {
                        loader.style.backgroundColor = idx === 0 ? "#ffffff" : animColors[idx - 1];
                    });
                })(i);
            }
            // 隐藏加载遮罩：需同时满足"页面加载完成"与"动画计时结束"两个条件
            function hideLoader() {
                if (pageReady && timeUp) {
                    loader.classList.add("hidden");
                    // 过渡结束后移除遮罩并显示主内容
                    loader.addEventListener("transitionend", function() {
                        loader.remove();
                        if (mainEl) mainEl.classList.add("main-visible");
                    }, { once: true });
                }
            }
            // 检测页面是否已加载完成（可能脚本运行时已完成）
            if (document.readyState === "complete") {
                pageReady = true;
                hideLoader();
            } else {
                window.addEventListener("load", function() {
                    pageReady = true;
                    hideLoader();
                });
            }
            // 动画总时长：最后一个色块延迟 0.72s + 播放 0.8s + 缓冲，合计约 1.7s
            setTimeout(function() {
                timeUp = true;
                hideLoader();
            }, 1700);
        })();
        // 非关键功能延迟初始化包装：支持 requestIdleCallback 时用之，否则降级 setTimeout
        // 用于将 3D 倾斜、涟漪、光标等非首屏功能推迟到浏览器空闲时段执行
        const idleCallback = (cb) => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(cb);
            } else {
                setTimeout(cb, 1);
            }
        };
        // ---- 节流函数 ----
        // 限制函数在指定时间间隔内只执行一次，用于高频事件（如 scroll）
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
        // ---- 获取页面元素引用 ----
        // 集中获取 DOM 元素，避免后续重复查询
        const body = document.body;
        const menuButton = document.querySelector(".menu-toggle");
        const navLinks = document.querySelectorAll(".nav-links a");
        // .skill 元素已包含 .reveal 类，无需重复选择
        const revealItems = document.querySelectorAll(".reveal");
        const sections = document.querySelectorAll("section[id]");
        // ---- 手机端菜单开关 ----
        // 点击汉堡按钮切换菜单展开状态，同步更新 aria-expanded 无障碍属性
        if (menuButton) {
            menuButton.addEventListener("click", () => {
                const isOpen = body.classList.toggle("menu-open");
                menuButton.setAttribute("aria-expanded", String(isOpen));
            });
        }
        // 点击导航链接后自动关闭手机菜单
        navLinks.forEach((link) => {
            link.addEventListener("click", () => {
                body.classList.remove("menu-open");
                if (menuButton) menuButton.setAttribute("aria-expanded", "false");
            });
        });
        // ---- 滚动渐显效果（单一 Observer）----
        // 元素进入视口时添加 .is-visible 类，触发 CSS 过渡动画
        // 使用单一 IntersectionObserver 统一管理，触发后立即 unobserve 释放资源
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.16 });
        revealItems.forEach((item) => revealObserver.observe(item));
        // ---- 导航高亮联动 ----
        // 当板块进入视口指定区域时，高亮对应的导航链接
        // rootMargin 调整触发区域为视口中部，避免过早或过晚高亮
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((link) => {
                    link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
                });
            });
        }, { rootMargin: "-38% 0px -56% 0px", threshold: 0.01 });
        sections.forEach((section) => navObserver.observe(section));

        // ============================================================
        // 动画功能模块
        // 包含：Hero TextPressure、问候语 BlurText、交错渐显、导航显隐、技能辉光、
        //       技能计数、反色光标镜头、3D 倾斜、按钮涟漪、自定义光标、兄弟卡片变暗、评价轮播
        // ============================================================
        // ---- 1. Hero 标题 TextPressure 效果 ----
        // 移植自 React Bits TextPressure 组件（JS+CSS 变体），适配为原生 DOM 操作。
        // 配置：flex=true, alpha=false, stroke=false, width=true, weight=true, italic=true
        // 鼠标靠近字符时 wght/wdth 增大（变粗变宽），远离时减小（变细变窄），营造压力波纹。
        // 使用 Roboto Flex 可变字体（opsz/wdth/wght 轴），lerp 缓动追踪鼠标位置。
          const h1El = document.querySelector('h1');
          const loaderEl = document.getElementById('loader');
          // 首页 hero 区域元素 — 用于限定 TextPressure 判定区域为首页横向范围
          const heroEl = document.querySelector('.hero');

          // 计算两点间欧氏距离
          function dist(a, b) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              return Math.sqrt(dx * dx + dy * dy);
          }

          // 根据距离映射可变字体属性值：距离越近值越大，越远值越小
          function getAttr(distance, maxDist, minVal, maxVal) {
              const val = maxVal - Math.abs((maxVal * distance) / maxDist);
              return Math.max(minVal, val + minVal);
          }

          function startTextPressure() {
              if (!h1El) return;

              // 将标题文本拆分为单个字符 span（供逐字测量与可变字体变形）
              if (h1El.querySelectorAll('.hero-char').length === 0) {
                  const text = h1El.textContent;
                  h1El.innerHTML = '';
                  text.split('').forEach(char => {
                      const span = document.createElement('span');
                      span.className = 'hero-char';
                      span.textContent = char;
                      h1El.appendChild(span);
                  });
              }
              const spans = h1El.querySelectorAll('.hero-char');
              if (spans.length === 0) return;

              // 激活 flex 布局（flex=true），字符均匀分布；添加淡入动画类
              h1El.classList.add('text-pressure-active');
              h1El.classList.add('hero-fade-in');

              // 鼠标位置（lerp 缓动）与光标位置（即时）
              const mouse = { x: 0, y: 0 };
              const cursor = { x: 0, y: 0 };

              // 初始化鼠标位置为标题中心
              const initRect = h1El.getBoundingClientRect();
              mouse.x = initRect.left + initRect.width / 2;
              mouse.y = initRect.top + initRect.height / 2;
              cursor.x = mouse.x;
              cursor.y = mouse.y;

              // 性能优化：缓存 span 中心点与 heroRect，避免每帧调用 getBoundingClientRect（强制布局）
              // span 在 flex 布局后位置固定，仅在窗口 resize 时重新计算
              let cachedCenters = [];
              let cachedHeroRect = null;
              function recalcCache() {
                  cachedHeroRect = heroEl ? heroEl.getBoundingClientRect() : h1El.getBoundingClientRect();
                  cachedCenters = Array.from(spans).map(span => {
                      const r = span.getBoundingClientRect();
                      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                  });
              }
              recalcCache();
              // 窗口尺寸变化时重新缓存 rect
              window.addEventListener('resize', recalcCache);

              // 鼠标/触摸移动更新光标位置，并确保 rAF 循环运行
              function handleMouseMove(e) {
                  cursor.x = e.clientX;
                  cursor.y = e.clientY;
                  if (!rafId) rafId = requestAnimationFrame(animate);
              }
              function handleTouchMove(e) {
                  const t = e.touches[0];
                  cursor.x = t.clientX;
                  cursor.y = t.clientY;
                  if (!rafId) rafId = requestAnimationFrame(animate);
              }
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('touchmove', handleTouchMove, { passive: true });

              let rafId = null;
              // 缓存每个 span 上一次写入的 fontVariationSettings，跳过未变化的写入
              const lastSettings = new Array(spans.length).fill(null);

              function animate() {
                  // lerp 缓动：鼠标位置以 1/15 因子追近光标位置
                  mouse.x += (cursor.x - mouse.x) / 15;
                  mouse.y += (cursor.y - mouse.y) / 15;

                  // 光标 Y 超出 hero 底部（滚动到"当前状态"等下一界面）时跳过变形
                  if (mouse.y > cachedHeroRect.bottom) {
                      rafId = requestAnimationFrame(animate);
                      return;
                  }
                  // maxDist 基于 hero 区域宽度的一半
                  const maxDist = cachedHeroRect.width / 2;

                  for (let i = 0; i < spans.length; i++) {
                      const center = cachedCenters[i];
                      const d = dist(mouse, center);

                      // width=true: wdth 轴 100..200（minVal=100 避免默认过窄）
                      const wdth = Math.floor(getAttr(d, maxDist, 100, 200));
                      // weight=true: wght 轴 500..900（minVal=500 默认稍粗）
                      const wght = Math.floor(getAttr(d, maxDist, 500, 900));
                      // italic=true: ital 轴 0..1
                      const ital = getAttr(d, maxDist, 0, 1).toFixed(2);

                      const settings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
                      // 跳过未变化的 fontVariationSettings 写入，减少 DOM 操作
                      if (lastSettings[i] !== settings) {
                          spans[i].style.fontVariationSettings = settings;
                          lastSettings[i] = settings;
                      }
                  }

                  // 光标静止时（lerp 收敛）暂停 rAF 循环，避免空转
                  const dx = cursor.x - mouse.x;
                  const dy = cursor.y - mouse.y;
                  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                      mouse.x = cursor.x;
                      mouse.y = cursor.y;
                      rafId = null; // 暂停循环，下次鼠标移动时重启
                  } else {
                      rafId = requestAnimationFrame(animate);
                  }
              }
              rafId = requestAnimationFrame(animate);

              // 清理函数：页面卸载时取消动画帧并移除事件监听
              function cleanup() {
                  if (rafId) cancelAnimationFrame(rafId);
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('touchmove', handleTouchMove);
                  window.removeEventListener('resize', recalcCache);
              }
              window.addEventListener('pagehide', cleanup, { once: true });
          }

          // ---- 1b. Hero 问候语模糊渐显动画（BlurText，与 TextPressure 同步触发）----
          // 移植自 React Bits BlurText 组件（JS+CSS 变体），适配为原生 DOM 操作。
          // 默认配置：animateBy="words"（按空格拆分）、direction="top"、delay=200ms、
          // stepDuration=0.35s。每个单词包裹 .hero-greeting-word span，由 CSS 关键帧
          // blurTextIn 完成模糊→清晰的渐显；单词间以 \u00A0 非断行空格分隔，避免换行错位。
          function startGreetingBlurAnimation() {
              const greetingEl = document.querySelector('.hero-greeting');
              if (!greetingEl) return;
              const text = greetingEl.textContent;
              // animateBy="words"：按空格拆分为单词数组
              const words = text.split(' ');
              greetingEl.innerHTML = '';
              words.forEach((word, index) => {
                  const span = document.createElement('span');
                  span.className = 'hero-greeting-word';
                  span.textContent = word;
                  // delay=200ms，每个单词递增 0.2s 延迟，实现交错出现
                  span.style.animationDelay = (index * 0.2) + 's';
                  greetingEl.appendChild(span);
                  // words 模式下，非最后一个单词后追加非断行空格保持词间距
                  if (index < words.length - 1) {
                      greetingEl.appendChild(document.createTextNode('\u00A0'));
                  }
              });
          }

          // 检查加载动画是否已完成
          if (loaderEl) {
              // 轮询检测加载遮罩是否已隐藏，隐藏后启动问候语动画，TextPressure 在问候语结束后启动
              const checkLoader = setInterval(() => {
                  if (loaderEl.classList.contains('hidden')) {
                      clearInterval(checkLoader);
                      // 问候语在 loader 过渡完成后（800ms）启动
                      setTimeout(startGreetingBlurAnimation, 800);
                      // 问候语 3 词 × 0.2s 延迟 + 0.7s 动画 = 1.1s，TextPressure 在 800+1100=1900ms 后启动
                      setTimeout(startTextPressure, 1900);
                  }
              }, 100);
          } else {
              // 如果没有加载动画，问候语立即启动，TextPressure 延迟 1100ms（问候语结束后）启动
              startGreetingBlurAnimation();
              setTimeout(startTextPressure, 1100);
          }
        // ---- 2. 交错渐显（Stagger Reveal）----
        // 为网格内的卡片设置递增的 transition-delay，实现逐个出现的效果
        const staggerContainers = document.querySelectorAll(
            '.skills-grid, .work-grid, .quote-strip, .project-grid, .status-mini'
        );
        staggerContainers.forEach(container => {
            const items = container.querySelectorAll('.reveal');
            items.forEach((item, i) => {
                item.style.transitionDelay = (i * 80) + 'ms';
            });
        });
        // 时间线卡片 + resume 经历 + #education 学校卡片：间隔更长（140ms）
        const timelineContainers = document.querySelectorAll('.timeline, #education');
        timelineContainers.forEach(container => {
            const items = container.querySelectorAll('.timeline-item.reveal');
            items.forEach((item, i) => {
                item.style.transitionDelay = (i * 140) + 'ms';
            });
        });
        // 当前状态卡片：带 300ms 起始延迟的逐个出现
        const nowSection = document.getElementById('now');
        if (nowSection) {
            const nowCards = nowSection.querySelectorAll('.status-card.reveal, .fact.reveal');
            nowCards.forEach((item, i) => {
                item.style.transitionDelay = (300 + i * 150) + 'ms';
            });
        }
        // ---- 3. 导航栏隐藏 / 显示 + 滚动进度条 ----
        // 向下滚动超过 120px 时隐藏导航栏，向上滚动时显示
        // 同时更新顶部进度条的宽度以反映滚动进度
        let lastScrollY = 0;
        const header = document.querySelector('.site-header');
        const progressBar = document.querySelector('.scroll-progress');
        const handleScroll = throttle(() => {
            const currentScrollY = window.scrollY;
            // 使用 CSS class 而非直接操作 transform，便于样式管理
            if (header) {
                if (currentScrollY > lastScrollY && currentScrollY > 120) {
                    header.classList.add('header-hidden');
                } else {
                    header.classList.remove('header-hidden');
                }
            }
            lastScrollY = currentScrollY;
            // 滚动进度条：当前滚动位置占总可滚动高度的比例
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0 && progressBar) {
                progressBar.style.width = ((currentScrollY / scrollHeight) * 100) + '%';
            }
        }, 16);
        window.addEventListener('scroll', handleScroll, { passive: true });
        // ---- 4. 技能卡片黄色辉光亮度（按百分比分级）----
        // 百分比越高，黄色越亮。0% 以下用暗黄色，100% 用亮黄
        // 通过 CSS 变量 --glow-low / --glow-high 控制辉光强度
        const skillElements = document.querySelectorAll('.skill');
        skillElements.forEach(skill => {
            const level = parseInt(skill.style.getPropertyValue('--level')) || 0;
            const t = level / 100;
            // low: 0.01 → 0.38,  high: 0.02 → 0.85（线性映射）
            const low  = (0.01 + t * 0.37).toFixed(2);
            const high = (0.02 + t * 0.83).toFixed(2);
            skill.style.setProperty('--glow-low', low);
            skill.style.setProperty('--glow-high', high);
        });
        // ---- 5. 技能数字计数动画（共享单一 Observer）----
        // 当技能方块进入视口时，从 0 递增到目标百分比
        // 使用三次缓出函数（easeOutCubic）实现自然减速效果
        const countObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const skill = entry.target;
                const spanEl = skill.querySelector('span');
                const target = parseInt(spanEl.textContent);
                const duration = 1800;
                const startTime = performance.now();
                function updateCount(now) {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // 三次缓出：1 - (1-t)^3，前期增长快，后期减速
                    const eased = 1 - Math.pow(1 - progress, 3);
                    spanEl.textContent = Math.round(eased * target) + '%';
                    if (progress < 1) requestAnimationFrame(updateCount);
                }
                requestAnimationFrame(updateCount);
                countObserver.unobserve(skill);
            });
        }, { threshold: 0.3 });
        skillElements.forEach(skill => { const c = skill.querySelector('.skill-content'); if (c) countObserver.observe(c); });
        // ---- 卡片反色光标镜头（事件委托）----
        // 在时间线条目和 #now 板块卡片内，跟随鼠标显示反色圆形光标
        // 通过 mix-blend-mode: difference 实现颜色反转效果，增强交互沉浸感
        const lensSelector = '.timeline-item, #now .status-card, #now .fact';
        document.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch') return;
            const card = e.target.closest(lensSelector);
            // 清除其他卡片上的镜头状态
            document.querySelectorAll('.is-lens-active').forEach(el => {
                if (el !== card && el.matches(lensSelector)) {
                    el.classList.remove('is-lens-active');
                }
            });
            if (!card) {
                body.classList.remove('lens-active');
                return;
            }
            // 按需创建镜头元素并跟随鼠标定位
            let lens = card.querySelector('.timeline-cursor-lens');
            if (!lens) {
                lens = document.createElement('div');
                lens.className = 'timeline-cursor-lens';
                card.appendChild(lens);
            }
            const rect = card.getBoundingClientRect();
            lens.style.left = (e.clientX - rect.left) + 'px';
            lens.style.top = (e.clientY - rect.top) + 'px';
            card.classList.add('is-lens-active');
            body.classList.add('lens-active');
        });
        document.addEventListener('pointerleave', e => {
            // 移动到同一卡片内的子元素时不移除镜头效果，防止闪烁
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(lensSelector)) return;
            document.querySelectorAll('.is-lens-active').forEach(el => {
                if (!el.matches(lensSelector)) return;
                el.classList.remove('is-lens-active');
            });
            body.classList.remove('lens-active');
        }, true);
        // ============================================================
        // 非关键功能：延迟到空闲时段初始化，避免阻塞首屏渲染
        // 包含：3D 倾斜、按钮涟漪、自定义光标、兄弟卡片变暗、评价轮播、技能图标弹窗
        // ============================================================
        idleCallback(() => {
            // ---- 6. 3D 卡片倾斜动画（事件委托）----
            // 鼠标在卡片上移动时，根据位置计算倾斜角度和缩放，
            // 实现透视 3D 效果。#now 板块卡片的倾斜幅度减弱至 35%
            // 技能卡片（.skill）禁用放大效果（scaleBoost=1），仅保留倾斜
            const tiltCards = '.statement, .fact, .status-card, .project-card, .timeline-item, .skill, .work, .quote';
            let activeTiltCard = null;
            document.addEventListener('pointermove', e => {
                if (e.pointerType === 'touch') return;
                const hit = e.target.closest(tiltCards) || document.elementFromPoint(e.clientX, e.clientY)?.closest?.(tiltCards) || null;
                const card = hit;
                // 切换到新卡片或离开所有卡片时，平滑重置之前的卡片
                if (activeTiltCard && activeTiltCard !== card) {
                    activeTiltCard.style.transition = 'transform 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease, box-shadow 0.3s ease';
                    activeTiltCard.style.transform = '';
                    skillIcons && skillIcons.hideIcons();
                    activeTiltCard = null;
                }
                if (!card) return;
                // 新卡片进入，设置快速过渡以响应鼠标
                if (activeTiltCard !== card) {
                    card.style.transition = 'transform 0.08s ease-out, border-color 0.3s ease, box-shadow 0.3s ease';
                    activeTiltCard = card;
                    // 技能卡片悬停时显示对应工具图标
                    if (card.classList.contains('skill') && skillIcons) skillIcons.showIcons(card);
                }
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                // 不同板块的卡片倾斜幅度不同：now 减弱、timeline 中等、其他全幅
                const isNowCard = card.closest('#now');
                const isTimeline = card.classList.contains('timeline-item');
                const isSkillCard = card.classList.contains('skill');
                const tiltFactor = isNowCard ? 0.35 : isTimeline ? 0.55 : 1;
                // 技能卡片不放大（1），now 卡片微放大（1.01），其他卡片放大（1.03）
                const scaleBoost = isSkillCard ? 1 : isNowCard ? 1.01 : 1.03;
                // 根据鼠标相对中心位置计算旋转角度（最大 ±12 度）
                const rotateX = ((y - centerY) / centerY) * -12 * tiltFactor;
                const rotateY = ((x - centerX) / centerX) * 12 * tiltFactor;
                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scaleBoost}, ${scaleBoost}, ${scaleBoost})`;
            }, true);
            // 离开页面时重置倾斜，移动到同一卡片子元素时不重置
            document.addEventListener('pointerleave', e => {
                if (!activeTiltCard) return;
                if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(tiltCards)) return;
                activeTiltCard.style.transition = 'transform 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease, box-shadow 0.3s ease';
                activeTiltCard.style.transform = '';
                skillIcons && skillIcons.hideIcons();
                activeTiltCard = null;
            }, true);
            // ---- 7. 按钮涟漪效果（事件委托）----
            // 点击按钮时，从点击位置扩散出圆形涟漪动画
            document.addEventListener('click', e => {
                const btn = e.target.closest('.button');
                if (!btn) return;
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                const rect = btn.getBoundingClientRect();
                // 涟漪直径取按钮宽高较大值，确保覆盖整个按钮
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = size + 'px';
                // 涟漪中心定位到点击位置
                ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
                ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
                btn.appendChild(ripple);
                // 动画结束后自动移除涟漪元素
                ripple.addEventListener('animationend', () => ripple.remove());
            });
            // ---- 8. 自定义光标（按需动画）----
            // 三个光标层：内圈点即时跟随鼠标，扩散环即时跟随，
            // 外圈环缓动跟随（lerp），悬停可交互元素时放大光标
            // 仅在支持精确指针的设备（鼠标）上启用，触屏设备使用系统光标
            if (window.matchMedia('(pointer: fine)').matches) {
                const cursorDot = document.querySelector('.cursor-dot');
                const cursorExpand = document.querySelector('.cursor-expand');
                const cursorRing = document.querySelector('.cursor-ring');
                let ringX = 0, ringY = 0;
                let dotX = 0, dotY = 0;
                let ringAnimId = null;
                // 外圈环缓动动画：每帧向内圈位置靠近 12%，接近后停止以节省性能
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
                    const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('a, button, .button, .contact-list a, .statement, .status-card, .fact') || null;
                    if (!el) return;
                    // work/project-card/timeline-item 已有 3D 倾斜效果，光标不放大避免干扰
                    if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                    cursorDot.classList.add('hover');
                    cursorExpand.classList.add('hover');
                    cursorRing.classList.add('hover');
                }, true);
                document.addEventListener('mouseleave', e => {
                    if (!e.target.closest) return;
                    const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('a, button, .button, .contact-list a, .statement, .status-card, .fact') || null;
                    if (!el) return;
                    if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                    cursorDot.classList.remove('hover');
                    cursorExpand.classList.remove('hover');
                    cursorRing.classList.remove('hover');
                }, true);
            }
            /* 卡片悬停时兄弟卡片变暗 — 突出当前焦点卡片 */
            (function() {
                function setupDimSiblings(gridSelector, cardSelector) {
                    const grid = document.querySelector(gridSelector);
                    if (!grid) return;
                    const cards = grid.querySelectorAll(cardSelector);
                    cards.forEach(function(card) {
                        // 悬停时给其他卡片添加 .dim 类降低亮度
                        card.addEventListener('mouseenter', function() {
                            cards.forEach(function(c) {
                                if (c !== card) c.classList.add('dim');
                            });
                        });
                        // 离开时恢复所有卡片亮度
                        card.addEventListener('mouseleave', function() {
                            cards.forEach(function(c) {
                                c.classList.remove('dim');
                            });
                        });
                    });
                }
                setupDimSiblings('.project-grid', '.project-card');
            })();
            /* 评价卡片轮播效果（双卡一组）— 支持滚轮、触摸、键盘三种交互方式 */
            (function() {
                const strip = document.querySelector('.quote-strip');
                if (!strip) return;
                const cards = strip.querySelectorAll('.quote');
                if (cards.length === 0) return;
                // 将卡片两两分组，每组包裹在 .quote-pair 容器中
                const pairs = [];
                for (let i = 0; i < cards.length; i += 2) {
                    const pairDiv = document.createElement('div');
                    pairDiv.className = 'quote-pair';
                    pairDiv.appendChild(cards[i]);
                    if (cards[i + 1]) pairDiv.appendChild(cards[i + 1]);
                    strip.appendChild(pairDiv);
                    pairs.push(pairDiv);
                }
                let current = 0;
                const total = pairs.length;
                let isAnimating = false;
                // 创建底部圆点指示器，点击跳转到对应组
                const dotsWrap = document.createElement('div');
                dotsWrap.className = 'quote-dots';
                for (let d = 0; d < total; d++) {
                    const dot = document.createElement('button');
                    dot.className = 'quote-dot';
                    dot.setAttribute('aria-label', 'Show pair ' + (d + 1));
                    (function(idx) {
                        dot.addEventListener('click', function() { goTo(idx); });
                    })(d);
                    dotsWrap.appendChild(dot);
                }
                strip.appendChild(dotsWrap);
                // 更新所有组的显示状态：当前组激活，之前的左隐藏，之后的右隐藏
                function updatePairs() {
                    for (let i = 0; i < total; i++) {
                        pairs[i].classList.remove('pair-active', 'pair-hidden-left', 'pair-hidden-right');
                        if (i === current) {
                            pairs[i].classList.add('pair-active');
                        } else if (i < current) {
                            pairs[i].classList.add('pair-hidden-left');
                        } else {
                            pairs[i].classList.add('pair-hidden-right');
                        }
                    }
                    syncHeight();
                    // 同步圆点高亮状态
                    const dots = dotsWrap.querySelectorAll('.quote-dot');
                    for (let j = 0; j < dots.length; j++) {
                        dots[j].classList.toggle('dot-active', j === current);
                    }
                }
                // 跳转到指定组索引，带动画锁防止快速切换
                function goTo(index) {
                    if (index < 0 || index >= total || index === current || isAnimating) return;
                    isAnimating = true;
                    current = index;
                    updatePairs();
                    // 动画持续时间 360ms 后解锁
                    setTimeout(function() { isAnimating = false; }, 360);
                }
                function next() { goTo(current + 1); }
                function prev() { goTo(current - 1); }
                // 鼠标滚轮滚动 —— 当滚轮在 .quote 卡片上时，切换轮播
                strip.addEventListener('wheel', function(e) {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        const target = e.target;
                        if (target && target.closest && !target.closest('.quote')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.deltaY > 15) next();
                        else if (e.deltaY < -15) prev();
                    }
                }, { passive: false });
                // 触摸滑动切换 — 水平滑动距离超过 50px 时触发
                let touchStartX = 0;
                strip.addEventListener('touchstart', function(e) {
                    touchStartX = e.touches[0].clientX;
                }, { passive: true });
                strip.addEventListener('touchend', function(e) {
                    const diff = touchStartX - e.changedTouches[0].clientX;
                    if (Math.abs(diff) > 50) {
                        if (diff > 0) next(); else prev();
                    }
                }, { passive: true });
                // 键盘左右方向键切换
                strip.setAttribute('tabindex', '0');
                strip.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
                });
                // 同步容器高度到当前活动组高度，避免布局跳动
                function syncHeight() {
                    const active = pairs[current];
                    if (active) {
                        strip.style.height = active.offsetHeight + 'px';
                    }
                }
                // 初始化：设置初始状态并测量高度
                updatePairs();
                // 等待 DOM 渲染完成后再测量高度
                requestAnimationFrame(function() {
                    syncHeight();
                });
                window.addEventListener('resize', syncHeight);
            })();

            /* ---- 技能图标弹窗 ---- */
            // 悬停技能卡片时显示对应工具图标，通过模块级 skillIcons 暴露给 3D 倾斜逻辑调用
            const skillIcons = (function() {
                // 图标名 -> 文件扩展名映射（图片存储在 images/icon/ 目录）
                const extMap = {
                    chatgpt: 'webp', claude: 'webp', deepseek: 'webp', gemini: 'webp', copilot: 'webp', blender: 'webp',
                    camera: 'webp', dji: 'webp',
                    ae: 'webp', davinci: 'webp', jianying: 'webp', keling: 'webp', xiaoyunque: 'webp',
                    lr: 'webp', ps: 'webp',
                    musicscore: 'webp',
                    python: 'webp', codex: 'webp'
                };
                const cards = document.querySelectorAll('.skill[data-icons]');
                const skillsGrid = document.querySelector('.skills-grid');
                // 共享的图标容器，挂载到 body 末尾避免被卡片 overflow 裁剪
                const sharedContainer = document.createElement('div');
                sharedContainer.className = 'skill-icons';
                document.body.appendChild(sharedContainer);

                // 根据图标名列表构建图标 img 元素
                function buildIcons(iconNames) {
                    sharedContainer.innerHTML = '';
                    iconNames.forEach(function(name, i) {
                        name = name.trim();
                        const ext = extMap[name] || 'png';
                        const img = document.createElement('img');
                        img.className = 'skill-icon';
                        img.src = 'images/icon/' + name + '.' + ext;
                        img.alt = name;
                        img.draggable = false;
                        // 递增过渡延迟，实现图标依次弹入效果
                        img.style.transitionDelay = (i * 60) + 'ms';
                        sharedContainer.appendChild(img);
                    });
                }

                // 定位图标容器到技能卡片下方，并播放从中心展开的动画
                function positionIcons(skillCard) {
                    const cardRect = skillCard.getBoundingClientRect();

                    const icons = sharedContainer.querySelectorAll('.skill-icon');
                    if (icons.length) {
                        // 计算容器宽度：图标数 * 44px + 间距
                        sharedContainer.style.width = ((icons.length - 1) * 10 + icons.length * 44) + 'px';
                    }

                    // 起始位置：卡片底部中心
                    const fromX = cardRect.left + cardRect.width / 2;
                    const fromY = cardRect.bottom + 12;
                    sharedContainer.style.left = fromX + 'px';
                    sharedContainer.style.top = fromY + 'px';
                    sharedContainer.style.transform = 'translate(-50%, 0)';

                    // 双 rAF 确保浏览器先渲染起始状态，再过渡到目标位置
                    requestAnimationFrame(function() {
                        requestAnimationFrame(function() {
                            sharedContainer.style.transform = 'translate(0, 0)';
                            sharedContainer.style.left = cardRect.left + 'px';
                            sharedContainer.style.top = (cardRect.bottom + 12) + 'px';
                        });
                    });
                }

                // 预解析每个卡片的 data-icons 属性
                cards.forEach(function(card) {
                    card._iconNames = card.getAttribute('data-icons').split(',');
                });
                let activeSkillCard = null;
                let showTimer = null;
                // 显示指定技能卡片的图标
                function showIcons(skillCard) {
                    if (activeSkillCard === skillCard) return;
                    hideIcons();
                    activeSkillCard = skillCard;
                    buildIcons(skillCard._iconNames);
                    positionIcons(skillCard);
                    // 下一帧添加 pop-in 类触发弹入动画
                    showTimer = requestAnimationFrame(function() {
                        const imgs = sharedContainer.querySelectorAll('.skill-icon');
                        for (let i = 0; i < imgs.length; i++) imgs[i].classList.add('pop-in');
                        showTimer = null;
                    });
                }
                // 隐藏图标并清理状态
                function hideIcons() {
                    if (showTimer) { cancelAnimationFrame(showTimer); showTimer = null; }
                    activeSkillCard = null;
                    sharedContainer.innerHTML = '';
                    // 移到屏幕外避免占用布局空间
                    sharedContainer.style.left = '-9999px';
                    sharedContainer.style.top = '-9999px';
                    sharedContainer.style.transform = 'translate(-50%, 0)';
                    sharedContainer.style.width = '0px';
                }
                return { showIcons, hideIcons };
            })();
        });
