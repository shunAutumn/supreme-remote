// ==UserScript==
// @name         Supreme 再入荷チェッカー: サイズを選んだ状態で開く
// @description  通知から開いた Supreme の商品ページで、指定のサイズを選んだ状態にします（カートには入れません）
// @version      1.1
// @match        https://jp.supreme.com/products/*
// @match        https://*.supreme.com/products/*
// @run-at       document-end
// @grant        none
// @updateURL    https://shunautumn.github.io/supreme-remote/supreme-size.user.js
// @downloadURL  https://shunautumn.github.io/supreme-remote/supreme-size.user.js
// ==/UserScript==

(function () {
  'use strict';
  // 通知のリンクの末尾に付いている「#srw=サイズの番号&s=サイズ名」を読む
  const h = new URLSearchParams(location.hash.slice(1));
  const variantId = h.get('srw');
  const sizeTitle = h.get('s') || '';
  if (!variantId && !sizeTitle) return;

  // かかった時間を測る（ページを開いた瞬間からの秒数）
  const sec = ms => (ms / 1000).toFixed(2) + '秒';
  const nav = performance.getEntriesByType('navigation')[0];
  const tStart = performance.now();  // このスクリプトが動き始めた時刻
  let tSel = 0;                      // サイズ欄が見つかった時刻
  const timing = () => {
    const parts = [];
    if (nav && nav.responseEnd) parts.push(`ページ受信 ${sec(nav.responseEnd)}`);
    parts.push(`スクリプト開始 ${sec(tStart)}`);
    if (tSel) parts.push(`サイズ欄 ${sec(tSel)}`);
    parts.push(`完了 ${sec(performance.now())}`);
    return parts.join(' → ');
  };

  const end = Date.now() + 15000;
  const tryPick = () => {
    const sel = document.querySelector('select[name="size"]');
    if (sel && !tSel) tSel = performance.now();
    const opt = sel && ([...sel.options].find(o => o.value === variantId) || [...sel.options].find(o => o.text.trim() === sizeTitle));
    if (sel && opt && !opt.disabled) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value); // 画面の仕組み（React）にも伝わるように
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.scrollIntoView({ block: 'center' });
      show(`✓ ${opt.text.trim()} を選びました（カートに入れるのはご自身で）`, '#1a8f3a');
      history.replaceState(null, '', location.pathname + location.search); // 再読み込みで選び直さないように
      return;
    }
    if (sel && !opt) { show(`${sizeTitle || 'そのサイズ'} は選べませんでした（売り切れの可能性）`, '#b86200'); return; }
    if (Date.now() < end) { setTimeout(tryPick, 300); return; }
    show(opt ? `${sizeTitle || 'そのサイズ'} は売り切れのため選べませんでした` : 'サイズ欄が見つかりませんでした', '#b86200');
  };
  function show(text, color) {
    const tip = document.createElement('div');
    tip.textContent = text;
    // 測った時間を小さく添える（調べ終わったら消す予定）
    const t = document.createElement('div');
    t.textContent = timing();
    t.style.cssText = 'font-weight:400;font-size:12px;opacity:.9;margin-top:4px';
    tip.appendChild(t);
    tip.style.cssText = `position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:${color};color:#fff;padding:10px 16px;border-radius:18px;font:600 14px -apple-system,sans-serif;box-shadow:0 4px 14px #0004;max-width:92vw;text-align:center`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 10000);
  }
  tryPick();
})();
