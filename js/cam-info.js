/**
 * Photography card hover — shows camera info card at bottom-left
 */
(function() {
    'use strict';
    var card = document.getElementById('cam-info');
    var specText = document.getElementById('cam-spec-text');
    var camIcon = document.querySelector('.cam-icon');
    if (!card || !specText || !camIcon) return;

    // 定义设备类型判断函数
    function getDeviceType(camInfo) {
        var info = camInfo.toLowerCase();
        
        // 检查是否是胶片拍摄（包含胶卷信息）
        if (info.includes('foma') || info.includes('kodak') || info.includes('fuji') || 
            info.includes('ilford') || info.includes('agfa') || info.includes('胶卷') || 
            info.includes('film') || info.includes('pan') || info.includes('portra') ||
            info.includes('ektar') || info.includes('velvia') || info.includes('provia')) {
            return 'film';
        }
        
        // 检查是否是手机拍摄
        if (info.includes('xiaomi') || info.includes('iphone') || info.includes('samsung') || 
            info.includes('huawei') || info.includes('oppo') || info.includes('vivo') || 
            info.includes('oneplus') || info.includes('pixel') || info.includes('realme') ||
            info.includes('手机') || info.includes('mobile') || info.includes('phone')) {
            return 'phone';
        }
        
        // 检查是否是相机拍摄（包含相机品牌信息）
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
        
        // 默认为相机
        return 'camera';
    }

    // 定义emoji映射
    var emojiMap = {
        'phone': '📱',
        'camera': '📷',
        'film': '🎞️'
    };

    var works = document.querySelectorAll('.work[data-cam]');

    works.forEach(function(work) {
        work.addEventListener('mouseenter', function() {
            var data = work.getAttribute('data-cam');
            if (!data) return;
            
            // 根据设备类型设置emoji
            var deviceType = getDeviceType(data);
            camIcon.textContent = emojiMap[deviceType];
            
            specText.textContent = data;
            card.classList.add('is-visible');
        });
        
        work.addEventListener('mouseleave', function() {
            card.classList.remove('is-visible');
        });
    });
})();
