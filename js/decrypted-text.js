/**
 * DecryptedText — 文字解密动画效果（原生 JS 版，移植自 React Bits）
 * 元素进入视口时触发：文字先被随机字符替换，然后从中间向两侧逐字揭示为原文。
 * 通过 data-decrypt-text 属性自动初始化。
 */
;(function () {
  'use strict';

  var CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';
  var SPEED = 50;
  var MAX_ITERATIONS = 10;

  /**
   * 判断字符是否为 emoji / 组合字符等不应被扰乱的符号
   * 通过比较 String.length 与 Array.from 长度来检测多码点字符
   */
  function isEmoji(ch) {
    return ch.length > 1 || /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u.test(ch);
  }

  /**
   * 对单个元素执行解密动画
   */
  function animate(el) {
    var originalText = el.getAttribute('data-original-text') || el.textContent;
    if (!originalText.trim()) return;

    el.setAttribute('data-original-text', originalText);
    if (el.dataset.decryptDone === 'true') return;
    el.dataset.decryptDone = 'true';

    var chars = Array.from(originalText);
    var len = chars.length;
    var order = computeCenterOrder(len);
    var revealed = new Set();

    setTimeout(function () {
    el.textContent = scramble(chars, revealed);

    var timer = setInterval(function () {
      var batchSize = Math.max(1, Math.ceil(len / MAX_ITERATIONS));
      for (var i = 0; i < batchSize && revealed.size < len; i++) {
        revealed.add(order[revealed.size]);
      }

      if (revealed.size >= len) {
        el.textContent = originalText;
        clearInterval(timer);
        return;
      }

      el.textContent = scramble(chars, revealed);
    }, SPEED);
    }, 200);
  }

  /**
   * 生成中心向两侧扩展的索引顺序
   */
  function computeCenterOrder(len) {
    var order = [];
    var middle = Math.floor(len / 2);
    var offset = 0;
    while (order.length < len) {
      if (offset % 2 === 0) {
        var idx = middle + offset / 2;
        if (idx >= 0 && idx < len) order.push(idx);
      } else {
        var idx2 = middle - Math.ceil(offset / 2);
        if (idx2 >= 0 && idx2 < len) order.push(idx2);
      }
      offset++;
    }
    return order;
  }

  /**
   * 生成乱码文本：emoji 保持不变，已揭示位置显示原文，其余显示随机字符
   */
  function scramble(chars, revealed) {
    return chars.map(function (ch, i) {
      if (ch === ' ') return ' ';
      if (isEmoji(ch)) return ch;
      if (revealed.has(i)) return ch;
      return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    }).join('');
  }

  // ===== IntersectionObserver 自动初始化 =====
  function init() {
    var els = document.querySelectorAll('[data-decrypt-text]');
    if (!els.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    els.forEach(function (el) { observer.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
