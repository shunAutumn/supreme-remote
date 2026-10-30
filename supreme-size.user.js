// ==UserScript==
// @name         Supreme 再入荷チェッカー: サイズを選んだ状態で開く
// @description  通知から開いた Supreme の商品ページで、指定のサイズを選んだ状態にします。「カートへ」のリンクから開いたときだけ、カートに入れて「ご注文手続きへ」まで進めます（新作の予約はカートに入れるだけ。支払い・注文の確定はしません）
// @version      1.6
// @match        https://jp.supreme.com/products/*
// @match        https://*.supreme.com/products/*
// @match        https://jp.supreme.com/cart*
// @match        https://*.supreme.com/cart*
// @run-at       document-end
// @grant        none
// @updateURL    https://shunautumn.github.io/supreme-remote/supreme-size.user.js
// @downloadURL  https://shunautumn.github.io/supreme-remote/supreme-size.user.js
// ==/UserScript==

(function () {
  'use strict';
  const FLAG = 'srwGoCheckout';   // カートに入れたあと、カートのページに移っても「ご注文手続きへ」を押すための目印
  const CHAIN = 'srwChain';       // 新作をまとめてカートへ: 残りの商品 { at, list: [[url, サイズ番号, サイズ名], …], multi }

  function show(text, color) {
    const tip = document.createElement('div');
    tip.textContent = text;
    tip.style.cssText = `position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:${color};color:#fff;padding:10px 16px;border-radius:18px;font:600 14px -apple-system,sans-serif;box-shadow:0 4px 14px #0004;max-width:92vw;text-align:center`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 6000);
  }
  const label = el => (el.textContent || el.value || '').replace(/\s+/g, '');
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };

  // 「ご注文手続きへ」を1回だけ押す（カートの小窓でも、カートのページでもよい）。その先の支払い・注文の確定は押さない
  function goCheckout() {
    const end = Date.now() + 30000;   // 発売直後はカートの処理が遅いので長めに待つ
    const tryGo = () => {
      const btn = [...document.querySelectorAll('a, button, input[type=submit]')]
        .find(el => /ご注文手続き|注文手続き|チェックアウト|checkout/i.test(label(el)) && visible(el) && !el.disabled);
      if (btn) {
        try { sessionStorage.removeItem(FLAG); } catch (e) {}
        btn.click();
        show('「ご注文手続きへ」を押しました。支払いと注文の確定はご自身でどうぞ', '#d11a2a');
        return;
      }
      if (Date.now() > end) { try { sessionStorage.removeItem(FLAG); } catch (e) {} show('「ご注文手続きへ」が見つからないので、ご自身で進んでください', '#b86200'); return; }
      setTimeout(tryGo, 150);
    };
    tryGo();
  }

  // 新作をまとめてカートへ: 次の商品を開く。残りがなければ（まとめてのときは）カートのページへ
  function goNext() {
    let c = null;
    try { c = JSON.parse(sessionStorage.getItem(CHAIN) || 'null'); sessionStorage.removeItem(CHAIN); } catch (e) {}
    if (!c || Date.now() - c.at > 120000) return;
    const list = c.list || [];
    if (!list.length) {
      if (c.multi && !/^\/cart/.test(location.pathname)) location.href = '/cart';
      show('🛒 まとめてカートに入れました。購入手続きはご自身でどうぞ', '#d11a2a');
      return;
    }
    const [u, v, s] = list[0];
    const rest = list.slice(1);
    location.href = u + '#srw=' + encodeURIComponent(v) + '&s=' + encodeURIComponent(s) + '&cart=2' + (rest.length ? '&next=' + encodeURIComponent(JSON.stringify(rest)) : '') + '&multi=1';
  }

  // カートのページ: 直前に「カートへ」から入れたときだけ続きを行う
  if (/^\/cart/.test(location.pathname)) {
    let at = 0, chain = false;
    try { at = +sessionStorage.getItem(FLAG) || 0; chain = !!sessionStorage.getItem(CHAIN); } catch (e) {}
    if (chain) setTimeout(goNext, 800);
    else if (at && Date.now() - at < 120000) goCheckout();   // 発売直後はカートのページに移るのも遅い
    return;
  }

  // 通知のリンクの末尾に付いている「#srw=サイズの番号&s=サイズ名（&cart=1）」を読む
  const h = new URLSearchParams(location.hash.slice(1));
  const variantId = h.get('srw');
  const sizeTitle = h.get('s') || '';
  const cartOnly = h.get('cart') === '2';   // 新作の予約: カートに入れるだけ（ご注文手続きには進まない）
  const addToCart = h.get('cart') === '1' || cartOnly;   // 「カートへ」のリンクから開いたときだけ
  if (!variantId && !sizeTitle) return;
  if (cartOnly) {
    let next = [];
    try { next = JSON.parse(h.get('next') || '[]'); } catch (e) {}
    const multi = h.get('multi') === '1' || next.length > 0;
    try { sessionStorage.setItem(CHAIN, JSON.stringify({ at: Date.now(), list: Array.isArray(next) ? next : [], multi })); } catch (e) {}
  }

  const SOLD_OUT_WAIT = 800;  // サイズ欄が出てから、売り切れと決めるまでの猶予（在庫の反映が少し遅れることがあるため）
  let selSeenAt = 0, done = false, observer = null, soldOutTimer = 0, giveUpTimer = 0;

  const finish = (text, color) => {
    if (done) return;
    done = true;
    if (observer) observer.disconnect();
    clearTimeout(soldOutTimer); clearTimeout(giveUpTimer);
    if (text) show(text, color);
    if (cartOnly && text) setTimeout(goNext, 2000);   // 売り切れなどで入れられなかったときも、次の商品へ
  };

  // サイズを選んだあと「カートに入れる」を1回だけ押し、続けて「ご注文手続きへ」
  function putInCart(sel, size) {
    const findCart = () => {
      const form = sel.closest('form');
      return (form && [...form.querySelectorAll('button, input[type=submit]')].find(b => /カート|cart|bag/i.test(label(b))))
        || document.querySelector('form[action*="/cart/add"] [type=submit]')
        || [...document.querySelectorAll('button, input[type=submit]')].find(b => /カートに入れる|addto(cart|bag)/i.test(label(b)));
    };
    const until = Date.now() + 15000;   // 発売直後はボタンが押せるようになるまで時間がかかる
    const tryCart = () => {
      const btn = findCart();
      if (btn && !btn.disabled) {
        if (cartOnly) {
          btn.click();
          show(`🛒 ${size} をカートに入れました`, '#d11a2a');
          setTimeout(goNext, 1500);   // カートに入ったのが反映されてから次の商品へ（ページが移った場合はカートのページで続きを行う）
          return;
        }
        try { sessionStorage.setItem(FLAG, String(Date.now())); } catch (e) {}
        btn.click();
        show(`🛒 ${size} をカートに入れました`, '#d11a2a');
        setTimeout(goCheckout, 500);   // カートの小窓が開く場合。ページが移った場合はカートのページで続きを行う
        return;
      }
      if (Date.now() > until) { show(`✓ ${size} を選びました。「カートに入れる」が見つからないので、ご自身で押してください`, '#b86200'); if (cartOnly) setTimeout(goNext, 2000); return; }
      setTimeout(tryCart, 150);
    };
    setTimeout(tryCart, 250);   // 選んだサイズが画面に反映されてから
  }

  const tryPick = () => {
    if (done) return;
    const sel = document.querySelector('select[name="size"]');
    if (!sel) return;
    const opt = [...sel.options].find(o => o.value === variantId) || [...sel.options].find(o => o.text.trim() === sizeTitle);
    if (opt && !opt.disabled) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value); // 画面の仕組み（React）にも伝わるように
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.scrollIntoView({ block: 'center' });
      history.replaceState(null, '', location.pathname + location.search); // 再読み込みで選び直さないように
      const size = opt.text.trim();
      if (addToCart) { finish(''); putInCart(sel, size); }
      else finish(`✓ ${size} を選びました（カートに入れるのはご自身で）`, '#1a8f3a');
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

  // サイズ欄が出た瞬間・在庫の表示が変わった瞬間に確かめる
  observer = new MutationObserver(tryPick);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  giveUpTimer = setTimeout(() => finish('サイズ欄が見つかりませんでした', '#b86200'), 45000);   // 発売直後はページが重い
  tryPick();
})();
