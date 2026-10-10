// ==UserScript==
// @name         Supreme 再入荷チェッカー: サイズを選んだ状態で開く
// @description  通知から開いた Supreme の商品ページで、指定のサイズを選んだ状態にします（カートには入れません）
// @version      1.0
// @match        https://jp.supreme.com/products/*
// @match        https://*.supreme.com/products/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // 通知のリンクの末尾に付いている「#srw=サイズの番号&s=サイズ名」を読む
  const h = new URLSearchParams(location.hash.slice(1));
  const variantId = h.get('srw');
  const sizeTitle = h.get('s') || '';
  if (!variantId && !sizeTitle) return;

  const end = Date.now() + 15000;
  const tryPick = () => {
    const sel = document.querySelector('select[name="size"]');
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
    if (Date.now() < end) setTimeout(tryPick, 300);
  };
  function show(text, color) {
    const tip = document.createElement('div');
    tip.textContent = text;
    tip.style.cssText = `position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:${color};color:#fff;padding:10px 16px;border-radius:999px;font:600 14px -apple-system,sans-serif;box-shadow:0 4px 14px #0004;max-width:92vw;text-align:center`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 5000);
  }
  tryPick();
})();
