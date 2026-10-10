// ==UserScript==
// @name         Supreme 再入荷チェッカー: サイズを選んだ状態で開く
// @description  通知から開いた Supreme の商品ページで、指定のサイズを選んだ状態にします（カートには入れません）
// @version      1.3
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

  const SOLD_OUT_WAIT = 800;  // サイズ欄が出てから、売り切れと決めるまでの猶予（在庫の反映が少し遅れることがあるため）
  let selSeenAt = 0, done = false, observer = null, soldOutTimer = 0, giveUpTimer = 0;

  const finish = (text, color) => {
    if (done) return;
    done = true;
    if (observer) observer.disconnect();
    clearTimeout(soldOutTimer); clearTimeout(giveUpTimer);
    show(text, color);
  };

  const tryPick = () => {
    if (done) return;
    const sel = document.querySelector('select[name="size"]');
    if (!sel) return;
    const find = () => [...sel.options].find(o => o.value === variantId) || [...sel.options].find(o => o.text.trim() === sizeTitle);
    const opt = find();
    if (opt && !opt.disabled) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value); // 画面の仕組み（React）にも伝わるように
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.scrollIntoView({ block: 'center' });
      history.replaceState(null, '', location.pathname + location.search); // 再読み込みで選び直さないように
      finish(`✓ ${opt.text.trim()} を選びました（カートに入れるのはご自身で）`, '#1a8f3a');
      return;
    }
    // 売り切れ（または選択肢がまだそろっていない）: 少しだけ待って変わらなければ、すぐ知らせる（在庫のあるサイズも添える）
    if (!selSeenAt) {
      selSeenAt = Date.now();
      soldOutTimer = setTimeout(() => {
        const s = document.querySelector('select[name="size"]') || sel;
        const o = [...s.options].find(x => x.value === variantId) || [...s.options].find(x => x.text.trim() === sizeTitle);
        const left = [...s.options].filter(x => x.value && !x.disabled).map(x => x.text.trim());
        s.scrollIntoView({ block: 'center' });
        // Supreme は売り切れのサイズを一覧から消すので、見つからない＝売り切れとして伝える
        // （ほかのサイズも一つもなければ、ページの作りが変わった可能性があるので「見つかりません」）
        const name = o ? o.text.trim() : (sizeTitle || 'そのサイズ');
        finish(left.length ? `${name} は売り切れです（在庫あり: ${left.join(' / ')}）`
          : o ? `${name} は売り切れです（ほかのサイズも在庫なし）` : `${name} が見つかりませんでした（在庫のあるサイズもなし）`, '#b86200');
      }, SOLD_OUT_WAIT);
    }
  };

  function show(text, color) {
    const tip = document.createElement('div');
    tip.textContent = text;
    tip.style.cssText = `position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:${color};color:#fff;padding:10px 16px;border-radius:18px;font:600 14px -apple-system,sans-serif;box-shadow:0 4px 14px #0004;max-width:92vw;text-align:center`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 6000);
  }

  // サイズ欄が出た瞬間・在庫の表示が変わった瞬間に確かめる
  observer = new MutationObserver(tryPick);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  giveUpTimer = setTimeout(() => finish('サイズ欄が見つかりませんでした', '#b86200'), 15000);
  tryPick();
})();
