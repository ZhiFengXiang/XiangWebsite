/**
 * 摄影作品悬浮信息卡片模块
 *
 * 功能说明：
 * - 当鼠标悬停在带有 data-cam 属性的摄影作品上时，在页面左下角显示拍摄设备信息卡片
 * - 自动识别设备类型（手机 / 相机 / 胶片），并显示对应的 emoji 图标
 * - 鼠标离开作品时自动隐藏信息卡片
 *
 * 依赖 DOM 结构：
 * - #cam-info        信息卡片容器（含 .cam-icon 和 #cam-spec-text）
 * - .work[data-cam]  摄影作品元素，data-cam 属性存放设备描述文本
 */
(function() {
    'use strict';

    // 获取信息卡片相关 DOM 元素，任一缺失则直接退出（容错处理）
    const card = document.getElementById('cam-info');          // 卡片容器
    const specText = document.getElementById('cam-spec-text'); // 设备信息文本节点
    const camIcon = document.querySelector('.cam-icon');       // emoji 图标节点
    if (!card || !specText || !camIcon) return;

    /**
     * 根据设备信息字符串判断设备类型
     * 优先级：胶片 > 手机 > 相机（默认）
     *
     * @param {string} camInfo - 摄影作品的 data-cam 属性值，例如 "Sony A7C | 35mm f1.4"
     * @returns {'film'|'phone'|'camera'} 设备类型标识
     */
    function getDeviceType(camInfo) {
        const info = camInfo.toLowerCase();

        // 胶片检测：匹配常见胶卷品牌和型号关键词
        // 包括 Foma、Kodak、Fuji、Ilford、Agfa 等品牌，以及 Portra/Ektar/Velvia/Provia 等胶卷型号
        if (info.includes('foma') || info.includes('kodak') || info.includes('fuji') ||
            info.includes('ilford') || info.includes('agfa') || info.includes('胶卷') ||
            info.includes('film') || info.includes('pan') || info.includes('portra') ||
            info.includes('ektar') || info.includes('velvia') || info.includes('provia')) {
            return 'film';
        }

        // 手机检测：匹配主流手机品牌关键词
        // 包括小米、iPhone、三星、华为、OPPO、vivo、一加、Pixel、realme 等
        if (info.includes('xiaomi') || info.includes('iphone') || info.includes('samsung') ||
            info.includes('huawei') || info.includes('oppo') || info.includes('vivo') ||
            info.includes('oneplus') || info.includes('pixel') || info.includes('realme') ||
            info.includes('手机') || info.includes('mobile') || info.includes('phone')) {
            return 'phone';
        }

        // 相机检测：匹配主流相机品牌和型号关键词
        // 包括 Sony/Canon/Nikon/Fuji/Olympus/Panasonic/Leica/Pentax 等品牌，
        // 以及 A7C/A7/EOS/R5/R6/Z5/Z6/Z7/GFX/X-T/X-H/X-Pro 等具体型号
        if (info.includes('sony') || info.includes('canon') || info.includes('nikon') ||
            info.includes('fuji') || info.includes('olympus') || info.includes('panasonic') ||
            info.includes('leica') || info.includes('pentax') || info.includes('olympus') ||
            info.includes('a7c') || info.includes('a7') || info.includes('eos') ||
            info.includes('r5') || info.includes('r6') || info.includes('z5') ||
            info.includes('z6') || info.includes('z7') || info.includes('gfx') ||
            info.includes('x-t') || info.includes('x-h') || info.includes('x-pro') ||
            info.includes('相机') || info.includes('camera') || info.includes('dslr') ||
            info.includes('mirrorless') || info.includes('微单') || info.includes('单反')) {
            return 'camera';
        }

        // 默认归类为相机（覆盖未匹配关键词但实际为相机的情况）
        return 'camera';
    }

    // 设备类型与 emoji 图标的映射表
    const emojiMap = {
        'phone': '📱',   // 手机
        'camera': '📷',  // 相机
        'film': '🎞️'     // 胶片
    };

    // 获取所有带 data-cam 属性的摄影作品元素
    const works = document.querySelectorAll('.work[data-cam]');

    // 为每个作品绑定鼠标事件 — 进入时显示卡片，离开时隐藏
    works.forEach(function(work) {
        // 鼠标进入：读取 data-cam 属性，识别设备类型，更新卡片内容并显示
        work.addEventListener('mouseenter', function() {
            const data = work.getAttribute('data-cam');
            if (!data) return;

            // 根据设备类型选择对应 emoji 图标
            const deviceType = getDeviceType(data);
            camIcon.textContent = emojiMap[deviceType];

            // 显示设备信息文本并添加可见类触发过渡动画
            specText.textContent = data;
            card.classList.add('is-visible');
        });

        // 鼠标离开：移除可见类，触发隐藏过渡动画
        work.addEventListener('mouseleave', function() {
            card.classList.remove('is-visible');
        });
    });
})();
