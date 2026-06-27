/**
 * ASCIIText — ASCII 文字效果（vanilla JS 移植版）
 *
 * 移植自 React Bits 开源组件 ASCIIText（JavaScript + CSS 变体）。
 * 原组件来源：https://codepen.io/JuanFuentes/pen/eYEeoyE
 *
 * 工作原理：
 *   1. 用 CanvasTxt 把文字绘制到一张 2D 画布上作为纹理；
 *   2. 将该纹理贴到 Three.js 的平面网格上，并通过自定义着色器做波浪扭曲；
 *   3. 用 AsciiFilter 把 WebGL 渲染结果采样为 ASCII 字符并叠加渐变文字。
 *
 * 相比原 React 组件的改动：
 *   - 改为 vanilla JS（无 React 依赖），THREE 通过全局 CDN 引入；
 *   - CanvasTxt 支持多行文本（按 \n 拆分），用于 "hello\nworld" 换行显示；
 *   - 暴露 initASCIIText(container, options) 自动初始化，内部使用
 *     IntersectionObserver 懒加载 + ResizeObserver 响应尺寸变化。
 *   - 性能优化：可见性暂停、帧率限制、采样网格上限、查找表、静态纹理等。
 *
 * 依赖：three.js（需在引入本脚本前通过 CDN 全局加载 window.THREE）
 */

(function () {
    'use strict';

    // 未引入 three.js 时给出明确提示，避免后续静默失败
    if (typeof window.THREE === 'undefined') {
        console.warn('[ASCIIText] 未检测到 window.THREE，请先通过 CDN 加载 three.js');
        return;
    }

    const THREE = window.THREE;

    /* ============================================================
     * 顶点着色器：对平面顶点施加正弦/余弦波浪位移
     * uEnableWaves 为 0 时关闭波浪，保持平面静止
     * ============================================================ */
    const vertexShader = `
varying vec2 vUv;
uniform float uTime;
uniform float mouse;
uniform float uEnableWaves;

void main() {
    vUv = uv;
    float time = uTime * 5.;

    float waveFactor = uEnableWaves;

    vec3 transformed = position;

    transformed.x += sin(time + position.y) * 0.5 * waveFactor;
    transformed.y += cos(time + position.z) * 0.15 * waveFactor;
    transformed.z += sin(time + position.x) * waveFactor;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

    /* ============================================================
     * 片元着色器：对纹理采样做 RGB 通道偏移，产生色彩流动效果
     * ============================================================ */
    const fragmentShader = `
varying vec2 vUv;
uniform float mouse;
uniform float uTime;
uniform sampler2D uTexture;

void main() {
    float time = uTime;
    vec2 pos = vUv;
    
    float move = sin(time + mouse) * 0.01;
    float r = texture2D(uTexture, pos + cos(time * 2. - time + pos.x) * .01).r;
    float g = texture2D(uTexture, pos + tan(time * .5 + pos.x - time) * .01).g;
    float b = texture2D(uTexture, pos - cos(time * 2. + time + pos.y) * .01).b;
    float a = texture2D(uTexture, pos).a;
    gl_FragColor = vec4(r, g, b, a);
}
`;

    /* ============================================================
     * 工具函数：将一个区间内的值线性映射到另一个区间
     * 对应 p5/Processing 的 map()
     * ============================================================ */
    function mapRange(n, start, stop, start2, stop2) {
        return ((n - start) / (stop - start)) * (stop2 - start2) + start2;
    }

    // 设备像素比，用于鼠标坐标换算
    const PX_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

    /* ============================================================
     * AsciiFilter：把 WebGL 渲染结果转换为 ASCII 字符覆盖层
     *  - domElement：外层容器（含 <pre> 文本层与采样 <canvas>）
     *  - render()：先渲染 3D 场景到离屏画布，再逐像素映射为字符
     *  - hue()：根据鼠标方向旋转色相，产生跟随光标的色彩变化
     * ============================================================ */
    class AsciiFilter {
        constructor(renderer, { fontSize, fontFamily, charset, invert } = {}) {
            this.renderer = renderer;

            // 外层容器：绝对定位铺满父元素
            this.domElement = document.createElement('div');
            this.domElement.style.position = 'absolute';
            this.domElement.style.top = '0';
            this.domElement.style.left = '0';
            this.domElement.style.width = '100%';
            this.domElement.style.height = '100%';

            // <pre> 用于承载 ASCII 字符文本，配合渐变背景裁剪实现彩色字符
            this.pre = document.createElement('pre');
            this.domElement.appendChild(this.pre);

            // 离屏采样画布：尺寸 = 列数 × 行数，每像素对应一个字符
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
            this.domElement.appendChild(this.canvas);

            this.deg = 0;
            // hue() 节流用：记录上次写入 DOM 的角度，避免每帧都触发样式重计算
            this.lastDeg = 999;
            this.invert = invert ?? true;
            this.fontSize = fontSize ?? 12;
            this.fontFamily = fontFamily ?? "'Courier New', monospace";
            // 字符集：从亮到暗排列，用于按灰度映射字符
            this.charset = charset ?? ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

            // 关闭图像平滑，保证像素级采样清晰
            this.context.webkitImageSmoothingEnabled = false;
            this.context.mozImageSmoothingEnabled = false;
            this.context.msImageSmoothingEnabled = false;
            this.context.imageSmoothingEnabled = false;

            // 监听全局鼠标移动以驱动色相旋转
            this.onMouseMove = this.onMouseMove.bind(this);
            document.addEventListener('mousemove', this.onMouseMove);
        }

        setSize(width, height) {
            this.width = width;
            this.height = height;
            // 注意：此处不设置 renderer.setSize，由 reset() 计算后在末尾设置
            this.reset();

            // 中心点与鼠标初始位置（用于计算色相旋转角度）
            this.center = { x: width / 2, y: height / 2 };
            this.mouse = { x: this.center.x, y: this.center.y };
        }

        // 根据字号重新计算列数/行数，并同步 <pre> 样式
        // 性能关键：asciiFontSize 很小（如 1）时采样网格可达百万像素。
        // 为避免卡顿，对采样网格设定上限（MAX_PIXELS），超出时按比例缩小 cols/rows，
        // 再用 CSS transform: scale() 将 <pre> 拉伸回容器尺寸，视觉上保持密集 ASCII 效果。
        // 同时将 WebGL 渲染器设为采样画布尺寸（而非全屏），减少 GPU→CPU 传输量。
        reset() {
            this.context.font = `${this.fontSize}px ${this.fontFamily}`;
            const charWidth = this.context.measureText('A').width;

            let cols = Math.floor(this.width / (this.fontSize * (charWidth / this.fontSize)));
            let rows = Math.floor(this.height / this.fontSize);

            // 采样网格上限：超出时等比缩小，避免百万像素级别的 getImageData + 逐像素循环
            var MAX_PIXELS = 200000;
            var totalPixels = cols * rows;
            var scaleX = 1;
            var scaleY = 1;

            if (totalPixels > MAX_PIXELS) {
                var factor = Math.sqrt(MAX_PIXELS / totalPixels);
                scaleX = 1 / factor;
                scaleY = 1 / factor;
                cols = Math.floor(cols * factor);
                rows = Math.floor(rows * factor);
            }

            this.cols = cols;
            this.rows = rows;
            this.canvas.width = cols;
            this.canvas.height = rows;

            // WebGL 渲染器直接渲染到采样画布尺寸，减少 GPU 渲染和 drawImage 开销
            this.renderer.setSize(cols, rows);

            this.pre.style.fontFamily = this.fontFamily;
            this.pre.style.fontSize = `${this.fontSize}px`;
            this.pre.style.margin = '0';
            this.pre.style.padding = '0';
            this.pre.style.lineHeight = '1em';
            this.pre.style.position = 'absolute';
            this.pre.style.left = '0';
            this.pre.style.top = '0';
            this.pre.style.zIndex = '9';
            this.pre.style.backgroundAttachment = 'fixed';
            this.pre.style.mixBlendMode = 'difference';

            // 当采样网格被缩小时，用 CSS transform 拉伸 <pre> 填满容器
            if (scaleX > 1.01 || scaleY > 1.01) {
                this.pre.style.transformOrigin = '0 0';
                this.pre.style.transform = 'scale(' + scaleX.toFixed(3) + ',' + scaleY.toFixed(3) + ')';
            } else {
                this.pre.style.transformOrigin = '';
                this.pre.style.transform = '';
            }

            // 预计算灰度→字符查找表（256 项），避免每像素做 Math.floor + 除法 + 数组索引
            // asciify 中直接用灰度整数值查表，大幅减少逐像素计算量
            var charset = this.charset;
            var charsetLen = charset.length;
            this.grayLookup = new Array(256);
            for (var g = 0; g < 256; g++) {
                var gray = g / 255;
                var idx = Math.floor((1 - gray) * (charsetLen - 1));
                if (this.invert) idx = charsetLen - idx - 1;
                this.grayLookup[g] = charset[idx];
            }
        }

        // 渲染一帧：3D 场景 → 离屏画布 → ASCII 字符
        // doAsciify=false 时跳过昂贵的像素读取与字符转换，仅更新背景画布
        render(scene, camera, doAsciify) {
            this.renderer.render(scene, camera);

            var w = this.canvas.width;
            var h = this.canvas.height;
            this.context.clearRect(0, 0, w, h);
            if (this.context && w && h) {
                // drawImage 从 renderer canvas（cols×rows）到采样画布（cols×rows），1:1 拷贝
                this.context.drawImage(this.renderer.domElement, 0, 0, w, h);
            }

            // 仅在指定帧执行 asciify（getImageData + 逐像素循环 + DOM 写入）
            // drawImage 每帧执行（廉价），保证背景画布平滑更新
            if (doAsciify) {
                this.asciify(this.context, w, h);
            }
            this.hue();
        }

        onMouseMove(e) {
            this.mouse = { x: e.clientX * PX_RATIO, y: e.clientY * PX_RATIO };
        }

        // 鼠标相对中心的位移（getter）
        get dx() {
            return this.mouse.x - this.center.x;
        }

        get dy() {
            return this.mouse.y - this.center.y;
        }

        // 根据鼠标方向平滑旋转色相，产生跟随光标的色彩变化
        // 节流：仅当角度变化超过 0.1° 时才写入 DOM 样式，减少样式重计算
        hue() {
            var deg = (Math.atan2(this.dy, this.dx) * 180) / Math.PI;
            this.deg += (deg - this.deg) * 0.075;
            if (Math.abs(this.deg - this.lastDeg) > 0.1) {
                this.lastDeg = this.deg;
                this.domElement.style.filter = 'hue-rotate(' + this.deg.toFixed(1) + 'deg)';
            }
        }

        // 逐像素灰度映射为字符，拼接成文本写入 <pre>
        // 优化：用预计算查找表替代逐像素 Math.floor + 除法；用 textContent 替代 innerHTML
        asciify(ctx, w, h) {
            if (w && h) {
                var imgData = ctx.getImageData(0, 0, w, h).data;
                var lookup = this.grayLookup;
                var lines = [];

                for (var y = 0; y < h; y++) {
                    var rowChars = [];
                    var rowOffset = y * 4 * w;
                    for (var x = 0; x < w; x++) {
                        var i = x * 4 + rowOffset;
                        if (imgData[i + 3] === 0) {
                            rowChars.push(' ');
                            continue;
                        }
                        // 灰度值取整后直接查表，避免逐像素浮点运算
                        var grayVal = (0.3 * imgData[i] + 0.6 * imgData[i + 1] + 0.1 * imgData[i + 2]) | 0;
                        rowChars.push(lookup[grayVal]);
                    }
                    lines.push(rowChars.join(''));
                }
                // textContent 比 innerHTML 快（无需 HTML 解析）
                this.pre.textContent = lines.join('\n');
            }
        }

        dispose() {
            document.removeEventListener('mousemove', this.onMouseMove);
        }
    }

    /* ============================================================
     * CanvasTxt：把文字绘制到 2D 画布，作为平面纹理来源
     *  支持多行文本（按 \n 拆分），每行居中绘制
     * ============================================================ */
    class CanvasTxt {
        constructor(txt, { fontSize = 200, fontFamily = 'Arial', color = '#fdf9f3' } = {}) {
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
            this.txt = txt;
            // 按换行符拆分为多行，用于多行渲染（如 "hello\nworld"）
            this.lines = String(txt).split('\n');
            this.fontSize = fontSize;
            this.fontFamily = fontFamily;
            this.color = color;

            this.font = '600 ' + this.fontSize + 'px ' + this.fontFamily;
        }

        // 计算画布尺寸：宽度取最长行，高度 = 行数 × 行高
        resize() {
            this.context.font = this.font;

            var maxLineWidth = 0;
            for (var i = 0; i < this.lines.length; i++) {
                var metrics = this.context.measureText(this.lines[i]);
                if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
            }

            // 行高 = 字号 + 行间距；多行时按行数累加
            // 行间距缩小至 0.08×字号，使 hello/world 两行更紧凑
            var lineGap = this.fontSize * 0.08;
            var lineHeight = this.fontSize + lineGap;

            var textWidth = Math.ceil(maxLineWidth) + 20;
            var textHeight = Math.ceil(lineHeight * this.lines.length) + 20;

            this.lineHeight = lineHeight;

            this.canvas.width = textWidth;
            this.canvas.height = textHeight;
        }

        // 逐行居中绘制文字
        render() {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.fillStyle = this.color;
            this.context.font = this.font;
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';

            var centerX = this.canvas.width / 2;
            // 第一行垂直起点：使多行整体在画布中垂直居中
            var startY = this.lineHeight / 2 + 10;

            for (var i = 0; i < this.lines.length; i++) {
                var y = startY + i * this.lineHeight;
                this.context.fillText(this.lines[i], centerX, y);
            }
        }

        get width() {
            return this.canvas.width;
        }

        get height() {
            return this.canvas.height;
        }

        get texture() {
            return this.canvas;
        }
    }

    /* ============================================================
     * CanvAscii：整合相机/场景/网格/滤镜，驱动动画循环
     *  - init()：等待字体加载后构建网格与渲染器
     *  - load()：启动 requestAnimationFrame 渲染循环
     *  - dispose()：释放资源、移除事件监听
     * ============================================================ */
    class CanvAscii {
        constructor(
            { text, asciiFontSize, textFontSize, textColor, planeBaseHeight, enableWaves, align, alignOffset, verticalOffset },
            containerElem,
            width,
            height
        ) {
            this.textString = text;
            this.asciiFontSize = asciiFontSize;
            this.textFontSize = textFontSize;
            this.textColor = textColor;
            this.planeBaseHeight = planeBaseHeight;
            this.container = containerElem;
            this.width = width;
            this.height = height;
            this.enableWaves = enableWaves;
            // 文字对齐方式：'left' 左对齐，其他值居中
            this.align = align || 'center';
            // 对齐偏移（3D 单位）：正值向右偏移，用于微调左对齐时的左边距
            this.alignOffset = alignOffset || 0;
            // 垂直偏移（3D 单位）：负值向下偏移，用于微调文字整体垂直位置
            this.verticalOffset = verticalOffset || 0;

            this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 1000);
            this.camera.position.z = 30;

            this.scene = new THREE.Scene();
            this.mouse = { x: this.width / 2, y: this.height / 2 };

            this.onMouseMove = this.onMouseMove.bind(this);
        }

        async init() {
            // 等待 IBM Plex Mono 字体加载完成，确保纹理与 ASCII 字形一致
            try {
                await document.fonts.load('600 200px "IBM Plex Mono"');
                await document.fonts.load('500 12px "IBM Plex Mono"');
            } catch (e) {
                // 字体加载失败时回退到默认字体
            }
            await document.fonts.ready;

            this.setMesh();
            this.setRenderer();
        }

        // 构建文字纹理平面网格 + 自定义着色器材质
        setMesh() {
            this.textCanvas = new CanvasTxt(this.textString, {
                fontSize: this.textFontSize,
                fontFamily: 'IBM Plex Mono',
                color: this.textColor
            });
            this.textCanvas.resize();
            this.textCanvas.render();

            this.texture = new THREE.CanvasTexture(this.textCanvas.texture);
            this.texture.minFilter = THREE.NearestFilter;

            // 平面宽高比与文字画布一致，保证文字不被拉伸
            var textAspect = this.textCanvas.width / this.textCanvas.height;
            var baseH = this.planeBaseHeight;
            var planeW = baseH * textAspect;
            var planeH = baseH;

            // 平面分段数降至 20×20（原 36×36），减少顶点着色器计算量
            // 波浪扭曲仍足够平滑，视觉无感知差异
            this.geometry = new THREE.PlaneGeometry(planeW, planeH, 20, 20);
            this.material = new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                transparent: true,
                uniforms: {
                    uTime: { value: 0 },
                    mouse: { value: 1.0 },
                    uTexture: { value: this.texture },
                    uEnableWaves: { value: this.enableWaves ? 1.0 : 0.0 }
                }
            });

            this.mesh = new THREE.Mesh(this.geometry, this.material);
            this.scene.add(this.mesh);

            // 根据对齐方式偏移网格水平位置
            this.updateAlignment();
        }

        // 创建 WebGL 渲染器并挂载 ASCII 滤镜
        setRenderer() {
            this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
            this.renderer.setPixelRatio(1);
            this.renderer.setClearColor(0x000000, 0);

            this.filter = new AsciiFilter(this.renderer, {
                fontFamily: 'IBM Plex Mono',
                fontSize: this.asciiFontSize,
                invert: true
            });

            this.container.appendChild(this.filter.domElement);
            this.setSize(this.width, this.height);

            this.container.addEventListener('mousemove', this.onMouseMove);
            this.container.addEventListener('touchmove', this.onMouseMove);
        }

        setSize(w, h) {
            this.width = w;
            this.height = h;

            // 相机宽高比始终基于容器尺寸（非渲染器尺寸），保证 3D 投影不变形
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();

            this.filter.setSize(w, h);

            this.center = { x: w / 2, y: h / 2 };

            // 尺寸变化后可见区域宽度改变，需重新计算对齐偏移
            this.updateAlignment();
        }

        // 根据对齐方式偏移网格水平位置
        // 左对齐：平面左边缘对齐可见区域左边缘，再叠加 alignOffset 微调
        // 居中：网格位于原点（默认）
        // 垂直偏移：通过 verticalOffset 调整 mesh.position.y（负值=下移）
        updateAlignment() {
            if (!this.mesh || !this.textCanvas) return;

            if (this.align === 'left') {
                // 计算相机在 z=0（平面所在位置）的可见高度与宽度
                var fovRad = (this.camera.fov * Math.PI) / 180;
                var visibleHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.z;
                var visibleWidth = visibleHeight * this.camera.aspect;

                // 平面宽度 = 基准高度 × 文字画布宽高比
                var textAspect = this.textCanvas.width / this.textCanvas.height;
                var planeW = this.planeBaseHeight * textAspect;

                // 左对齐：将平面从居中位置向左偏移，使其左边缘 = 可见区域左边缘
                // 再叠加 alignOffset 向右微调，避免文字紧贴容器左边缘
                this.mesh.position.x = -visibleWidth / 2 + planeW / 2 + this.alignOffset;
            } else {
                this.mesh.position.x = 0;
            }

            // 垂直偏移：负值使文字整体下移
            this.mesh.position.y = this.verticalOffset;
        }

        // 启动：设置可见性观察器，由观察器回调控制动画启停
        // 性能优化：联系区域不可见时不渲染，参照 galaxy.js 的可见性检测模式
        load() {
            this.isRunning = false;
            this.lastFrameTime = 0;

            // 标签页可见性变化：隐藏时暂停，恢复时重启（仅当容器也在视口内时）
            this.onVisibilityChange = () => {
                if (document.hidden) {
                    this.stopAnimation();
                } else if (this.isVisible) {
                    this.startAnimation();
                }
            };
            document.addEventListener('visibilitychange', this.onVisibilityChange);

            // 容器可见性检测：进入视口启动动画，离开视口停止动画
            this.visibilityObserver = new IntersectionObserver((entries) => {
                this.isVisible = entries[0].isIntersecting;
                if (this.isVisible) {
                    this.startAnimation();
                } else {
                    this.stopAnimation();
                }
            }, { threshold: 0.01 });
            this.visibilityObserver.observe(this.container);
        }

        // 启动动画循环（仅在未运行时启动）
        startAnimation() {
            if (!this.isRunning) {
                this.isRunning = true;
                this.lastFrameTime = 0;
                this.animate();
            }
        }

        // 停止动画循环以节省性能
        stopAnimation() {
            this.isRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

        onMouseMove(evt) {
            var e = evt.touches ? evt.touches[0] : evt;
            var bounds = this.container.getBoundingClientRect();
            var x = e.clientX - bounds.left;
            var y = e.clientY - bounds.top;
            this.mouse = { x: x, y: y };
        }

        // 动画循环：帧率限制约 30fps（间隔 ≥ 33ms 才渲染），减少 CPU 占用
        animate() {
            var self = this;
            var animateFrame = function () {
                if (!self.isRunning) return;
                self.animationFrameId = requestAnimationFrame(animateFrame);

                var now = performance.now();
                if (now - self.lastFrameTime < 33) return;
                self.lastFrameTime = now;

                self.render();
            };
            animateFrame();
        }

        // 渲染一帧：更新着色器时间，旋转网格，输出 ASCII
        // 优化：文字纹理为静态内容，无需每帧重绘 textCanvas 或重传纹理到 GPU；
        //       着色器基于 uTime 对静态纹理做 UV 偏移采样，波浪与色彩动画完全保留
        //       asciify 每隔一帧执行（getImageData 是最大性能瓶颈），背景画布每帧更新保持平滑
        render() {
            var time = performance.now() * 0.001;

            this.mesh.material.uniforms.uTime.value = Math.sin(time);

            this.updateRotation();
            // 帧计数器：偶数帧执行 asciify，奇数帧仅更新背景画布
            this._asciifyFrame = (this._asciifyFrame || 0) + 1;
            this.filter.render(this.scene, this.camera, this._asciifyFrame % 2 === 0);
        }

        // 根据鼠标位置平滑旋转网格，产生视差感
        updateRotation() {
            var x = mapRange(this.mouse.y, 0, this.height, 0.5, -0.5);
            var y = mapRange(this.mouse.x, 0, this.width, -0.5, 0.5);

            this.mesh.rotation.x += (x - this.mesh.rotation.x) * 0.05;
            this.mesh.rotation.y += (y - this.mesh.rotation.y) * 0.05;
        }

        // 遍历场景释放几何体/材质/纹理资源
        clear() {
            this.scene.traverse(function (obj) {
                if (obj.isMesh && typeof obj.material === 'object' && obj.material !== null) {
                    Object.keys(obj.material).forEach(function (key) {
                        var matProp = obj.material[key];
                        if (matProp !== null && typeof matProp === 'object' && typeof matProp.dispose === 'function') {
                            matProp.dispose();
                        }
                    });
                    obj.material.dispose();
                    obj.geometry.dispose();
                }
            });
            this.scene.clear();
        }

        // 完整清理：停止动画、断开观察器、移除 DOM、释放 WebGL 上下文
        dispose() {
            this.stopAnimation();
            if (this.visibilityObserver) {
                this.visibilityObserver.disconnect();
                this.visibilityObserver = null;
            }
            if (this.onVisibilityChange) {
                document.removeEventListener('visibilitychange', this.onVisibilityChange);
                this.onVisibilityChange = null;
            }
            if (this.filter) {
                this.filter.dispose();
                if (this.filter.domElement.parentNode) {
                    this.container.removeChild(this.filter.domElement);
                }
            }
            this.container.removeEventListener('mousemove', this.onMouseMove);
            this.container.removeEventListener('touchmove', this.onMouseMove);
            this.clear();
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer.forceContextLoss();
            }
        }
    }

    /* ============================================================
     * 对外接口：initASCIIText(container, options)
     *  - container：承载效果的 DOM 元素（应已设置宽高）
     *  - options：text / asciiFontSize / textFontSize / textColor /
     *             planeBaseHeight / enableWaves / align / alignOffset / verticalOffset
     *  返回 { dispose } 用于清理
     * ============================================================ */
    function initASCIIText(container, options) {
        if (!container) return { dispose: function () {} };
        options = options || {};

        var text = options.text != null ? options.text : 'hello\nworld';
        var asciiFontSize = options.asciiFontSize != null ? options.asciiFontSize : 8;
        var textFontSize = options.textFontSize != null ? options.textFontSize : 200;
        var textColor = options.textColor != null ? options.textColor : '#fdf9f3';
        var planeBaseHeight = options.planeBaseHeight != null ? options.planeBaseHeight : 8;
        var enableWaves = options.enableWaves != null ? options.enableWaves : true;
        var align = options.align || 'center';
        var alignOffset = options.alignOffset || 0;
        var verticalOffset = options.verticalOffset || 0;

        var cancelled = false;
        var instance = null;
        var observer = null;
        var ro = null;

        // 创建并初始化一个 CanvAscii 实例
        var createAndInit = async function (w, h) {
            var inst = new CanvAscii(
                {
                    text,
                    asciiFontSize,
                    textFontSize,
                    textColor,
                    planeBaseHeight,
                    enableWaves,
                    align,
                    alignOffset,
                    verticalOffset
                },
                container,
                w,
                h
            );
            await inst.init();
            return inst;
        };

        var setup = async function () {
            var rect = container.getBoundingClientRect();
            var width = rect.width;
            var height = rect.height;

            // 容器尚无尺寸时，等待进入视口后再初始化
            if (width === 0 || height === 0) {
                observer = new IntersectionObserver(
                    async function ([entry]) {
                        if (cancelled) return;
                        if (entry.isIntersecting && entry.boundingClientRect.width > 0 && entry.boundingClientRect.height > 0) {
                            var w = entry.boundingClientRect.width;
                            var h = entry.boundingClientRect.height;
                            observer.disconnect();
                            observer = null;

                            if (!cancelled) {
                                instance = await createAndInit(w, h);
                                if (!cancelled && instance) {
                                    instance.load();
                                }
                            }
                        }
                    },
                    { threshold: 0.1 }
                );
                observer.observe(container);
                return;
            }

            instance = await createAndInit(width, height);
            if (cancelled || !instance) return;
            instance.load();

            // 监听容器尺寸变化，同步更新相机与滤镜
            ro = new ResizeObserver(function (entries) {
                if (!entries[0] || !instance) return;
                var w = entries[0].contentRect.width;
                var h = entries[0].contentRect.height;
                if (w > 0 && h > 0) {
                    instance.setSize(w, h);
                }
            });
            ro.observe(container);
        };

        setup();

        // 返回清理句柄，供外部在卸载时释放资源
        return {
            dispose: function () {
                cancelled = true;
                if (observer) observer.disconnect();
                if (ro) ro.disconnect();
                if (instance) {
                    instance.dispose();
                    instance = null;
                }
            }
        };
    }

    // 暴露到全局
    window.initASCIIText = initASCIIText;

    /* ============================================================
     * 自动初始化：页面中带 [data-ascii-text] 的元素自动启用效果
     *  通过 data-text 属性指定文本（支持 \n 换行）
     *  注意：HTML 属性中的 \n 是字面量（反斜杠+n），需转换为真正的换行符
     * ============================================================ */
    function autoInit() {
        var nodes = document.querySelectorAll('[data-ascii-text]');
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            // 将属性中的字面量 \n 转换为真正的换行符，使多行文本生效
            var rawText = node.getAttribute('data-text') || 'hello\\nworld';
            var text = rawText.replace(/\\n/g, '\n');
            initASCIIText(node, {
                text: text,
                enableWaves: true,
                asciiFontSize: parseInt(node.getAttribute('data-ascii-font-size'), 10) || 8,
                textFontSize: parseInt(node.getAttribute('data-text-font-size'), 10) || 200,
                planeBaseHeight: parseFloat(node.getAttribute('data-plane-height')) || 8,
                textColor: node.getAttribute('data-text-color') || '#fdf9f3',
                align: node.getAttribute('data-align') || 'center',
                alignOffset: parseFloat(node.getAttribute('data-align-offset')) || 0,
                verticalOffset: parseFloat(node.getAttribute('data-vertical-offset')) || 0
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})();
