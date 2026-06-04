
        // ---- 节流函数 ----
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
        // .skill 元素已包含 .reveal 类，无需重复选择
        const revealItems = document.querySelectorAll(".reveal");
        const sections = document.querySelectorAll("section[id]");

        // ---- 手机端菜单开关 ----
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
                menuButton.setAttribute("aria-expanded", "false");
            });
        });

        // ---- 滚动渐显效果（单一 Observer）----
        // 元素进入视口时添加 .is-visible 类，触发 CSS 过渡动画
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

        // ---- 1. Hero 标题逐字动画 ----
        // 将 h1 文字拆分为单独的 span，每个字符依次出现
        const h1El = document.querySelector('h1');
        if (h1El) {
            const text = h1El.textContent;
            h1El.innerHTML = '';
            text.split('').forEach((char, i) => {
                const span = document.createElement('span');
                span.className = 'hero-char';
                span.textContent = char;
                span.style.animationDelay = (0.6 + i * 0.1) + 's';
                h1El.appendChild(span);
            });
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

        // 时间线卡片（#resume 经历 + #education 学校）
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

        // ---- 3. 导航栏隐藏/显示 + 滚动进度条 ----
        // 向下滚动超过 120px 时隐藏导航栏，向上滚动时显示；
        // 同时更新顶部进度条的宽度
        let lastScrollY = 0;
        const header = document.querySelector('.site-header');
        const progressBar = document.querySelector('.scroll-progress');
        const handleScroll = throttle(() => {
            const currentScrollY = window.scrollY;
            // 使用 CSS class 而非直接操作 transform
            if (currentScrollY > lastScrollY && currentScrollY > 120) {
                header.classList.add('header-hidden');
            } else {
                header.classList.remove('header-hidden');
            }
            lastScrollY = currentScrollY;
            // 滚动进度条
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0) {
                progressBar.style.width = ((currentScrollY / scrollHeight) * 100) + '%';
            }
        }, 16);
        window.addEventListener('scroll', handleScroll, { passive: true });

        // ---- 4. 技能卡片黄色辉光亮度（按百分比分级）----
        // 百分比越高，黄色越亮；30% 以下用暗黄，100% 用亮黄
        const skillElements = document.querySelectorAll('.skill');
        skillElements.forEach(skill => {
            const level = parseInt(skill.style.getPropertyValue('--level')) || 0;
            const t = level / 100;
            // low: 0.01 → 0.38,  high: 0.02 → 0.85
            const low  = (0.01 + t * 0.37).toFixed(2);
            const high = (0.02 + t * 0.83).toFixed(2);
            skill.style.setProperty('--glow-low', low);
            skill.style.setProperty('--glow-high', high);
        });

        // ---- 5. 技能数字计数动画（共享单一 Observer）----
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
        skillElements.forEach(skill => countObserver.observe(skill));


        // ---- 卡片反色光标镜头（事件委托）----
        // 在时间线条目和 #now 板块卡片内，跟随鼠标显示反色圆形，
        // 通过 mix-blend-mode: difference 实现颜色反转效果
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
            // 移动到同一卡片内的子元素时不移除镜头效果，防止闪烁
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(lensSelector)) return;
            document.querySelectorAll('.is-lens-active').forEach(el => {
                if (!el.matches(lensSelector)) return;
                el.classList.remove('is-lens-active');
            });
            body.classList.remove('lens-active');
        }, true);

        // ---- 6. 3D 卡片倾斜动画（事件委托）----
        // 鼠标在卡片上移动时，根据位置计算倾斜角度和缩放，
        // 实现透视 3D 效果。#now 板块卡片的倾斜幅度减弱至 35%。
        const tiltCards = '.statement, .fact, .status-card, .project-card, .timeline-item, .skill, .work, .quote';
        let activeTiltCard = null;

        document.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch') return;
            const card = e.target.closest(tiltCards);

            // 切换到新卡片或离开所有卡片时，平滑重置之前的卡片
            if (activeTiltCard && activeTiltCard !== card) {
                activeTiltCard.style.transition = 'transform 0.5s cubic-bezier(.2,.8,.2,1), border-color 0.3s ease, box-shadow 0.3s ease';
                activeTiltCard.style.transform = '';
                activeTiltCard = null;
            }

            if (!card) return;

            // 新卡片进入，设置快速过渡
            if (activeTiltCard !== card) {
                card.style.transition = 'transform 0.08s ease-out, border-color 0.3s ease, box-shadow 0.3s ease';
                activeTiltCard = card;
            }

            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const isNowCard = card.closest('#now');
            const tiltFactor = isNowCard ? 0.35 : 1;
            const scaleBoost = isNowCard ? 1.01 : 1.03;
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
            activeTiltCard = null;
        }, true);

        // ---- 7. 按钮涟漪效果（事件委托）----
        // 点击按钮时，从点击位置扩散出圆形涟漪
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

        // ---- 8. 自定义光标（按需动画）----
        // 三个光标层：内圈跟随鼠标即时移动，外圈缓动跟随，
        // 悬停可交互元素时放大外圈。仅在有精确指针的设备上启用。
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
                // 当外圈足够接近内圈时停止动画
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
                // 按需启动外圈动画
                if (!ringAnimId) {
                    ringAnimId = requestAnimationFrame(animateRing);
                }
            });

            // hover 到可交互元素时光标放大 (事件委托)
            document.addEventListener('mouseenter', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact, .quote');
                if (!el) return;
                if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                cursorDot.classList.add('hover');
                cursorExpand.classList.add('hover');
                cursorRing.classList.add('hover');
            }, true);

            document.addEventListener('mouseleave', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button, .contact-list a, .statement, .status-card, .fact, .quote');
                if (!el) return;
                if (el.classList.contains('work') || el.classList.contains('project-card') || el.classList.contains('timeline-item')) return;
                cursorDot.classList.remove('hover');
                cursorExpand.classList.remove('hover');
                cursorRing.classList.remove('hover');
            }, true);
        }
