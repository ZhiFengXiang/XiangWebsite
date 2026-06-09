        // ---- Loader: waits for full animation + page load ----
        // ---- ���ض���������ɫ�淽���л� ----
        (function() {
            var loader = document.getElementById("loader");
            if (!loader) return;
            var blocks = document.querySelectorAll(".loader-block");
            var mainEl = document.querySelector("main");
            var pageReady = false;
            var timeUp = false;
            // ������ɫ�淽���л���setTimeout ȷ���ɿ�������
            var animColors = [
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
            var delays = [0, 80, 160, 240, 320, 400, 480, 560, 640, 720];
            for (var i = 0; i < blocks.length; i++) {
                (function(idx) {
                    setTimeout(function() {
                        loader.style.backgroundColor = idx === 0 ? "#ffffff" : animColors[idx - 1];
                    }, delays[idx]);
                    blocks[idx].addEventListener("animationstart", function() {
                        loader.style.backgroundColor = idx === 0 ? "#ffffff" : animColors[idx - 1];
                    });
                })(i);
            }
            // ���غ�������ҳ�������?+ ��������
            function hideLoader() {
                if (pageReady && timeUp) {
                    loader.classList.add("hidden");
                    loader.addEventListener("transitionend", function() {
                        loader.remove();
                        if (mainEl) mainEl.classList.add("main-visible");
                    }, { once: true });
                }
            }
            // ҳ�������ɱ��?
            if (document.readyState === "complete") {
                pageReady = true;
                hideLoader();
            } else {
                window.addEventListener("load", function() {
                    pageReady = true;
                    hideLoader();
                });
            }
            // �ȴ�������ʱ�������һ��?delay 0.72s + ���� 0.8s + ���壩
            setTimeout(function() {
                timeUp = true;
                hideLoader();
            }, 1700);
        })();
        // ---- �������� ----
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
        const body = document.body;
        const menuButton = document.querySelector(".menu-toggle");
        const navLinks = document.querySelectorAll(".nav-links a");
        // .skill 元素已包??.reveal 类，无需重复选择
        const revealItems = document.querySelectorAll(".reveal");
        const sections = document.querySelectorAll("section[id]");
        // ---- 手机端菜单开??----
        if (menuButton) {
            menuButton.addEventListener("click", () => {
                const isOpen = body.classList.toggle("menu-open");
                menuButton.setAttribute("aria-expanded", String(isOpen));
            });
        }
        // 点击导航链接后自动关闭手机菜??
        navLinks.forEach((link) => {
            link.addEventListener("click", () => {
                body.classList.remove("menu-open");
                if (menuButton) menuButton.setAttribute("aria-expanded", "false");
            });
        });
        // ---- 滚动渐显效果（单一 Observer??---
        // 元素进入视口时添??.is-visible 类，触�??CSS 过渡动画
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.16 });
        revealItems.forEach((item) => revealObserver.observe(item));
        // ---- 导航高亮联�??----
        // 当板块进入视口时，高亮对应的导航链接
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
        // 动画功能

        // ============================================================
        // ---- 1. Hero 标�逐字动画 ----
          // 在加载动画完全消失后开始打字机动画
          const h1El = document.querySelector('h1');
          const loaderEl = document.getElementById('loader');
          
          function startTypewriterAnimation() {
              if (h1El) {
                  const text = h1El.textContent;
                  h1El.innerHTML = '';
                  text.split('').forEach((char, i) => {
                      const span = document.createElement('span');
                      span.className = 'hero-char';
                      span.textContent = char;
                      span.style.animationDelay = (i * 0.1) + 's';
                      h1El.appendChild(span);
                  });
              }
          }
          
          // 检查加载动画是否已完成
          if (loaderEl) {
              // 如果加载动画还在，等待它完成
              const checkLoader = setInterval(() => {
                  if (loaderEl.classList.contains('hidden')) {
                      clearInterval(checkLoader);
                      // 等待加载动画的过渡效果完成（0.8秒）
                      setTimeout(startTypewriterAnimation, 800);
                  }
              }, 100);
          } else {
              // 如果没有加载动画，立即开�?
              startTypewriterAnimation();
          }
        // ---- 2. 交错渐显（Stagger Reveal??---
        // 为网格内的卡片设置递增�?transition-delay，实现逐个出现的效??
        const staggerContainers = document.querySelectorAll(
            '.skills-grid, .work-grid, .quote-strip, .project-grid, .status-mini'
        );
        staggerContainers.forEach(container => {
            const items = container.querySelectorAll('.reveal');
            items.forEach((item, i) => {
                item.style.transitionDelay = (i * 80) + 'ms';
            });
        });
        // 时间线卡片�??resume 经�??+ #education 学校�?
        const timelineContainers = document.querySelectorAll('.timeline, #education');
        timelineContainers.forEach(container => {
            const items = container.querySelectorAll('.timeline-item.reveal');
            items.forEach((item, i) => {
                item.style.transitionDelay = (i * 140) + 'ms';
            });
        });
        // 当前状态卡片：带额外延迟的逐个出现
        const nowSection = document.getElementById('now');
        if (nowSection) {
            const nowCards = nowSection.querySelectorAll('.status-card.reveal, .fact.reveal');
            nowCards.forEach((item, i) => {
                item.style.transitionDelay = (300 + i * 150) + 'ms';
            });
        }
        // ---- 3. 导航栏隐??显�??+ 滚动进度??----
        // 向下滚动超�??120px 时隐藏导航栏，向上滚动时显示�?
        // 同时更新顶部进度条的宽�??
        let lastScrollY = 0;
        const header = document.querySelector('.site-header');
        const progressBar = document.querySelector('.scroll-progress');
        const handleScroll = throttle(() => {
            const currentScrollY = window.scrollY;
            // 使�??CSS class 而非直接操�??transform
            if (header) {
                if (currentScrollY > lastScrollY && currentScrollY > 120) {
                    header.classList.add('header-hidden');
                } else {
                    header.classList.remove('header-hidden');
                }
            }
            lastScrollY = currentScrollY;
            // 滚动进度??
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0 && progressBar) {
                progressBar.style.width = ((currentScrollY / scrollHeight) * 100) + '%';
            }
        }, 16);
        window.addEventListener('scroll', handleScroll, { passive: true });
        // ---- 4. 技能卡片黄色辉光亮度（按百分比分级??---
        // 百分比越高，黄色越亮�?0% 以下用暗黄�??00% 用亮�?
        const skillElements = document.querySelectorAll('.skill');
        skillElements.forEach(skill => {
            const level = parseInt(skill.style.getPropertyValue('--level')) || 0;
            const t = level / 100;
            // low: 0.01 ??0.38,  high: 0.02 ??0.85
            const low  = (0.01 + t * 0.37).toFixed(2);
            const high = (0.02 + t * 0.83).toFixed(2);
            skill.style.setProperty('--glow-low', low);
            skill.style.setProperty('--glow-high', high);
        });
        // ---- 5. 技能数字计数动画（共享单�??Observer??---
        // 当技能方块进入视口时，从 0 递增到目标百分比
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
                    const eased = 1 - Math.pow(1 - progress, 3);
                    spanEl.textContent = Math.round(eased * target) + '%';
                    if (progress < 1) requestAnimationFrame(updateCount);
                }
                requestAnimationFrame(updateCount);
                countObserver.unobserve(skill);
            });
        }, { threshold: 0.3 });
        skillElements.forEach(skill => { const c = skill.querySelector('.skill-content'); if (c) countObserver.observe(c); });
        // ---- 卡片反色光标镜头（事件委托�??---
        // 在时间线条目�?#now 板块卡片内，跟随鼠标显示反色圆形??
        // 通�??mix-blend-mode: difference 实现颜色反转效果
        const lensSelector = '.timeline-item, #now .status-card, #now .fact';
        document.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch') return;
            const card = e.target.closest(lensSelector);
            document.querySelectorAll('.is-lens-active').forEach(el => {
                if (el !== card && el.matches(lensSelector)) {
                    el.classList.remove('is-lens-active');
                }
            });
            if (!card) {
                body.classList.remove('lens-active');
                return;
            }
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
            // 移动到同一卡片内的子元素时不移除镜头效果，防止闪�??
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(lensSelector)) return;
            document.querySelectorAll('.is-lens-active').forEach(el => {
                if (!el.matches(lensSelector)) return;
                el.classList.remove('is-lens-active');
            });
            body.classList.remove('lens-active');
        }, true);
        // ---- 6. 3D 卡片倾斜动画（事件委托）----
        // 鼠标在卡片上移动时，根据位置计算倾斜角度和缩放，
        // 实现透视 3D 效果�?now 板块卡片的倾斜幅度减弱�?35%??
        const tiltCards = '.statement, .fact, .status-card, .project-card, .timeline-item, .skill, .work, .quote';
        let activeTiltCard = null;
        document.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch') return;
            const hit = e.target.closest(tiltCards) || document.elementFromPoint(e.clientX, e.clientY)?.closest?.(tiltCards) || null;
            const card = hit;
            // 切换到新卡片或离开所有卡片时，平滑重置之前的卡�??
            if (activeTiltCard && activeTiltCard !== card) {
                activeTiltCard.style.transition = 'transform 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease, box-shadow 0.3s ease';
                activeTiltCard.style.transform = '';
                window._skillIconsHide && window._skillIconsHide();
                activeTiltCard = null;
            }
            if (!card) return;
            // 新卡片进入，设置快速过�?
            if (activeTiltCard !== card) {
                card.style.transition = 'transform 0.08s ease-out, border-color 0.3s ease, box-shadow 0.3s ease';
                activeTiltCard = card;
                if (card.classList.contains('skill') && window._skillIconsShow) window._skillIconsShow(card);
            }
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const isNowCard = card.closest('#now');
            const isTimeline = card.classList.contains('timeline-item');
            const tiltFactor = isNowCard ? 0.35 : isTimeline ? 0.55 : 1;
            const scaleBoost = isNowCard ? 1.01 : 1.03;
            const rotateX = ((y - centerY) / centerY) * -12 * tiltFactor;
            const rotateY = ((x - centerX) / centerX) * 12 * tiltFactor;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scaleBoost}, ${scaleBoost}, ${scaleBoost})`;
        }, true);
        // 离开页面时重置倾斜，移动到同一卡片子元素时不重�?
        document.addEventListener('pointerleave', e => {
            if (!activeTiltCard) return;
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(tiltCards)) return;
            activeTiltCard.style.transition = 'transform 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease, box-shadow 0.3s ease';
            activeTiltCard.style.transform = '';
            window._skillIconsHide && window._skillIconsHide();
            activeTiltCard = null;
        }, true);
        // ---- 7. 按钮涟漪效果（事件委托）----
        // 点击按钮时，从点击位置扩散出圆形涟�??
        document.addEventListener('click', e => {
            const btn = e.target.closest('.button');
            if (!btn) return;
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
        // ---- 8. 自定义光标（按需动画�?---
        // 三个光标层：内圈跟随鼠标即时移动，外圈缓动跟随，
        // 悬停可交互元素时放大外圈。仅在有精确指针的设备上启用�?
        if (window.matchMedia('(pointer: fine)').matches) {
            const cursorDot = document.querySelector('.cursor-dot');
            const cursorExpand = document.querySelector('.cursor-expand');
            const cursorRing = document.querySelector('.cursor-ring');
            let ringX = 0, ringY = 0;
            let dotX = 0, dotY = 0;
            let ringAnimId = null;
            function animateRing() {
                ringX += (dotX - ringX) * 0.12;
                ringY += (dotY - ringY) * 0.12;
                cursorRing.style.left = (ringX - 16) + 'px';
                cursorRing.style.top = (ringY - 16) + 'px';
                // 当外圈足够接近内圈时停止动�??
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
                cursorDot.style.left = (dotX - 7) + 'px';
                cursorDot.style.top = (dotY - 7) + 'px';
                cursorExpand.style.left = dotX + 'px';
                cursorExpand.style.top = dotY + 'px';
                // 按需启动外圈动�??
                if (!ringAnimId) {
                    ringAnimId = requestAnimationFrame(animateRing);
                }
            });
            // hover 到可交互元素时光标放�?(事件委�??
            document.addEventListener('mouseenter', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact, .skill') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('a, button, .button, .contact-list a, .statement, .status-card, .fact, .skill') || null;
                if (!el) return;
                if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                cursorDot.classList.add('hover');
                cursorExpand.classList.add('hover');
                cursorRing.classList.add('hover');
            }, true);
            document.addEventListener('mouseleave', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact, .skill') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('a, button, .button, .contact-list a, .statement, .status-card, .fact, .skill') || null;
                if (!el) return;
                if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                cursorDot.classList.remove('hover');
                cursorExpand.classList.remove('hover');
                cursorRing.classList.remove('hover');
            }, true);
        }
        /* 卡片悬停时，兄弟卡片显示阴影 */
        (function() {
            function setupDimSiblings(gridSelector, cardSelector) {
                var grid = document.querySelector(gridSelector);
                if (!grid) return;
                var cards = grid.querySelectorAll(cardSelector);
                cards.forEach(function(card) {
                    card.addEventListener('mouseenter', function() {
                        cards.forEach(function(c) {
                            if (c !== card) c.classList.add('dim');
                        });
                    });
                    card.addEventListener('mouseleave', function() {
                        cards.forEach(function(c) {
                            c.classList.remove('dim');
                        });
                    });
                });
            }
            setupDimSiblings('.project-grid', '.project-card');
        })();
        /* 评价卡片轮播效果（双卡一组�??*/
        (function() {
            var strip = document.querySelector('.quote-strip');
            if (!strip) return;
            var cards = strip.querySelectorAll('.quote');
            if (cards.length === 0) return;
            // Wrap cards into pairs of 2
            var pairs = [];
            for (var i = 0; i < cards.length; i += 2) {
                var pairDiv = document.createElement('div');
                pairDiv.className = 'quote-pair';
                pairDiv.appendChild(cards[i]);
                if (cards[i + 1]) pairDiv.appendChild(cards[i + 1]);
                strip.appendChild(pairDiv);
                pairs.push(pairDiv);
            }
            var current = 0;
            var total = pairs.length;
            var isAnimating = false;
            // Create dot indicators
            var dotsWrap = document.createElement('div');
            dotsWrap.className = 'quote-dots';
            for (var d = 0; d < total; d++) {
                var dot = document.createElement('button');
                dot.className = 'quote-dot';
                dot.setAttribute('aria-label', 'Show pair ' + (d + 1));
                (function(idx) {
                    dot.addEventListener('click', function() { goTo(idx); });
                })(d);
                dotsWrap.appendChild(dot);
            }
            strip.appendChild(dotsWrap);
            function updatePairs() {
                for (var i = 0; i < total; i++) {
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
                var dots = dotsWrap.querySelectorAll('.quote-dot');
                for (var j = 0; j < dots.length; j++) {
                    dots[j].classList.toggle('dot-active', j === current);
                }
            }
            function goTo(index) {
                if (index < 0 || index >= total || index === current || isAnimating) return;
                isAnimating = true;
                current = index;
                updatePairs();
                setTimeout(function() { isAnimating = false; }, 360);
            }
            function next() { goTo(current + 1); }
            function prev() { goTo(current - 1); }
                        // Wheel scroll �� ���ڹ��λ��?.quote ��Ƭ��ʱ�����ع���
            strip.addEventListener('wheel', function(e) {
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    var target = e.target;
                    if (target && target.closest && !target.closest('.quote')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.deltaY > 15) next();
                    else if (e.deltaY < -15) prev();
                }
            }, { passive: false });
            // Touch swipe
            var touchStartX = 0;
            strip.addEventListener('touchstart', function(e) {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });
            strip.addEventListener('touchend', function(e) {
                var diff = touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0) next(); else prev();
                }
            }, { passive: true });
            // Keyboard
            strip.setAttribute('tabindex', '0');
            strip.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            });
            // Sync container height to active pair
            function syncHeight() {
                var active = pairs[current];
                if (active) {
                    strip.style.height = active.offsetHeight + 'px';
                }
            }
            // Init
            updatePairs();
            // Measure after pairs are in DOM
            requestAnimationFrame(function() {
                syncHeight();
            });
            window.addEventListener('resize', syncHeight);
        })();








        /* ---- Skill card icon popup on hover ---- */
        (function() {
            // Map icon name -> file extension (as stored in images/icon/)
                        var extMap = {
                chatgpt: 'webp', claude: 'webp', deepseek: 'webp', gemini: 'webp', copilot: 'webp', blender: 'webp',
                camera: 'webp', dji: 'webp',
                ae: 'webp', davinci: 'webp', jianying: 'webp', keling: 'webp', xiaoyunque: 'webp',
                lr: 'webp', ps: 'webp',
                musicscore: 'webp',
                python: 'webp', codex: 'webp'
            };
            var cards = document.querySelectorAll('.skill[data-icons]');
            var skillsGrid = document.querySelector('.skills-grid');
            var sharedContainer = document.createElement('div');
            sharedContainer.className = 'skill-icons';
            document.body.appendChild(sharedContainer);

            function buildIcons(iconNames) {
                sharedContainer.innerHTML = '';
                iconNames.forEach(function(name, i) {
                    name = name.trim();
                    var ext = extMap[name] || 'png';
                    var img = document.createElement('img');
                    img.className = 'skill-icon';
                    img.src = 'images/icon/' + name + '.' + ext;
                    img.alt = name;
                    img.draggable = false;
                    img.style.transitionDelay = (i * 60) + 'ms';
                    sharedContainer.appendChild(img);
                });
            }

            function positionIcons(skillCard) {
                var cardRect = skillCard.getBoundingClientRect();

                var icons = sharedContainer.querySelectorAll('.skill-icon');
                if (icons.length) {
                    sharedContainer.style.width = ((icons.length - 1) * 10 + icons.length * 44) + 'px';
                }

                var fromX = cardRect.left + cardRect.width / 2;
                var fromY = cardRect.bottom + 12;
                sharedContainer.style.left = fromX + 'px';
                sharedContainer.style.top = fromY + 'px';
                sharedContainer.style.transform = 'translate(-50%, 0)';

                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        sharedContainer.style.transform = 'translate(0, 0)';
                        sharedContainer.style.left = cardRect.left + 'px';
                        sharedContainer.style.top = (cardRect.bottom + 12) + 'px';
                    });
                });
            }

            cards.forEach(function(card) {
                card._iconNames = card.getAttribute('data-icons').split(',');
            });
            var activeSkillCard = null;
            var showTimer = null;
            function showIcons(skillCard) {
                if (activeSkillCard === skillCard) return;
                hideIcons();
                activeSkillCard = skillCard;
                buildIcons(skillCard._iconNames);
                positionIcons(skillCard);
                showTimer = requestAnimationFrame(function() {
                    var imgs = sharedContainer.querySelectorAll('.skill-icon');
                    for (var i = 0; i < imgs.length; i++) imgs[i].classList.add('pop-in');
                    showTimer = null;
                });
            }
            function hideIcons() {
                if (showTimer) { cancelAnimationFrame(showTimer); showTimer = null; }
                activeSkillCard = null;
                sharedContainer.innerHTML = '';
                sharedContainer.style.left = '-9999px';
                sharedContainer.style.top = '-9999px';
                sharedContainer.style.transform = 'translate(-50%, 0)';
                sharedContainer.style.width = '0px';
            }
            window._skillIconsShow = showIcons;
            window._skillIconsHide = hideIcons;
        })();