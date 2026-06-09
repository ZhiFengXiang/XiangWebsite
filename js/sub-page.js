        // ---- 滚动渐显 ----
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

        // ---- 解除主内容黑屏：main 默认 opacity: 0，需要 main-visible 类才显示 ----
        (function() {
            var mainEl = document.querySelector('main');
            if (mainEl) mainEl.classList.add('main-visible');
        })();

        // ---- 导航栏隐藏/显示 + 滚动进度条 ----
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
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0 && progressBar) {
                progressBar.style.width = ((currentScrollY / scrollHeight) * 100) + '%';
            }
        }, 16);
        window.addEventListener('scroll', handleScroll, { passive: true });

        // ---- 自定义光标 ----
        if (window.matchMedia("(pointer: fine)").matches) {
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
                if (!ringAnimId) {
                    ringAnimId = requestAnimationFrame(animateRing);
                }
            });

            document.addEventListener('mouseenter', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button');
                if (!el) return;
                cursorDot.classList.add('hover');
                cursorExpand.classList.add('hover');
                cursorRing.classList.add('hover');
            }, true);

            document.addEventListener('mouseleave', e => {
                if (!e.target.closest) return;
                const el = e.target.closest('a, button, .button');
                if (!el) return;
                cursorDot.classList.remove('hover');
                cursorExpand.classList.remove('hover');
                cursorRing.classList.remove('hover');
            }, true);
        }
