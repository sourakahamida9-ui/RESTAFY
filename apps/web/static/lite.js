/**
 * =====================================================================
 * LITE.JS - Widget vanilla sans dépendances
 * =====================================================================
 * 
 * Widget完全 autonome qui fonctionne sur n'importe quel site:
 * - Pas de React requis
 * - Pas d'iframe
 * - Pas de script externe bloquant
 * 
 * Usage:
 * <div id="restafy-lite" data-restaurant="mon-slug"></div>
 * <script src="https://restafy.shop/lite.js" async></script>
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

(function() {
  'use strict';

  const API_URL = 'https://restafy.shop';
  const DEFALUT_THEME = { primary: '#FF5C00', radius: 12 };

  // Styles CSS inline (pas de fichier externe!)
  const STYLES = `
    #restafy-lite{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--primary:#FF5C00;--bg:#fff;--text:#1f2937;--muted:#6b7280;--border:#e5e7eb;background:var(--bg);color:var(--text);border-radius:12px;max-width:420px;margin:0 auto;overflow:hidden}
    #restafy-lite *{box-sizing:border-box}
    .rl-header{padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
    .rl-logo{width:48px;height:48px;border-radius:8px;object-fit:cover}
    .rl-logo-p{width:48px;height:48px;border-radius:8px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}
    .rl-title{font-size:16px;font-weight:700;margin:0}
    .rl-sub{font-size:12px;color:var(--muted);margin:4px 0 0;display:flex;gap:12px}
    .rl-search{padding:12px 16px;border-bottom:1px solid var(--border)}
    .rl-search input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px}
    .rl-cats{display:flex;gap:8px;padding:12px 16px;overflow-x:auto}
    .rl-cat{padding:6px 12px;border-radius:16px;font-size:12px;font-weight:500;white-space:nowrap;background:#f3f4f6;border:none;cursor:pointer;flex-shrink:0}
    .rl-cat.active,.rl-cat:hover{background:var(--primary);color:#fff}
    .rl-items{padding:8px 16px;max-height:380px;overflow-y:auto}
    .rl-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:center}
    .rl-item:last-child{border-bottom:none}
    .rl-item-img{width:64px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#f3f4f6}
    .rl-info{flex:1;min-width:0}
    .rl-name{font-size:14px;font-weight:600;margin:0 0 4px}
    .rl-desc{font-size:11px;color:var(--muted);margin:0}
    .rl-price{font-size:14px;font-weight:700;color:var(--primary);margin:6px 0 0}
    .rl-add{width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .rl-add:hover{opacity:0.9}
    .rl-fixed{position:sticky;bottom:0;background:#fff;padding:12px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
    .rl-btn{flex:1;padding:12px;border-radius:10px;background:var(--primary);color:#fff;font-weight:600;border:none;cursor:pointer;font-size:14px;text-decoration:none;display:block;text-align:center}
    .rl-btn:disabled{background:#d1d5db;cursor:not-allowed}
    .rl-badge{background:var(--primary);color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;position:relative;top:-8px;right:-8px}
    .rl-empty{text-align:center;padding:40px 20px;color:var(--muted)}
    .rl-load{display:flex;align-items:center;justify-content:center;padding:60px 20px}
    .rl-price-sm{font-size:12px}
    .rl-price-tot{font-size:14px;font-weight:700}
    @keyframes rl-spin{to{transform:rotate(360deg)}}
    .rl-spin{animation:rl-spin 1s linear infinite}
    @media(max-width:480px){
      #restafy-lite{max-width:100%;border-radius:0}
    }
  `;

  // Injecter styles
  function injectStyles() {
    if (document.getElementById('restafy-lite-styles')) return;
    const style = document.createElement('style');
    style.id = 'restafy-lite-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // Créer widget
  function createWidget(container, slug) {
    container.innerHTML = '<div class="rl-load"><span class="rl-spin">⏳</span></div>';
    
    fetch(`${API_URL}/api/lite?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          container.innerHTML = '<div class="rl-empty"><p>' + data.error + '</p></div>';
          return;
        }
        renderWidget(container, data);
      })
      .catch(err => {
        container.innerHTML = '<div class="rl-empty"><p>Erreur de chargement</p></div>';
      });
  }

  // Rendu widget
  function renderWidget(container, data) {
    const { restaurant, items, categories } = data;
    let cart = [];
    let cat = 'all';
    let search = '';

    function render() {
      const filtered = items.filter(i => {
        const c = cat === 'all' || i.category_id === cat;
        const s = !search || i.name.toLowerCase().includes(search.toLowerCase());
        return c && s;
      });

      const total = cart.reduce((t, i) => t + i.price * i.qty, 0);
      const count = cart.reduce((t, i) => t + i.qty, 0);

      container.innerHTML = `
        <style>${STYLES}</style>
        <div class="rl-header">
          ${restaurant.logo_url 
            ? `<img src="${restaurant.logo_url}" class="rl-logo" alt="${restaurant.name}">`
            : `<div class="rl-logo-p">${restaurant.name[0]}</div>`
          }
          <div>
            <h2 class="rl-title">${restaurant.name}</h2>
            <p class="rl-sub">🕒 ${restaurant.delivery_time} ${restaurant.min_order ? '• Min: ' + restaurant.min_order + ' F' : ''}</p>
          </div>
        </div>
        <div class="rl-search">
          <input type="text" placeholder="Rechercher un plat..." value="${search}">
        </div>
        <div class="rl-cats">
          <button class="rl-cat ${cat === 'all' ? 'active' : ''}" data-cat="all">Tout</button>
          ${categories.map(c => `<button class="rl-cat ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>`).join('')}
        </div>
        <div class="rl-items">
          ${filtered.length === 0 
            ? '<div class="rl-empty"><p>Aucun plat trouvé</p></div>'
            : filtered.map(i => `
              <div class="rl-item">
                ${i.image_url ? `<img src="${i.image_url}" class="rl-item-img" alt="${i.name}">` : ''}
                <div class="rl-info">
                  <h3 class="rl-name">${i.name}</h3>
                  ${i.description ? `<p class="rl-desc">${i.description}</p>` : ''}
                  <p class="rl-price">${i.price.toLocaleString()} F</p>
                </div>
                <button class="rl-add" data-id="${i.id}" data-name="${i.name}" data-price="${i.price}">+</button>
              </div>
            `).join('')
          }
        </div>
        ${count > 0 ? `
        <div class="rl-fixed">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="position:relative">🛒<span class="rl-badge">${count}</span></span>
            <div>
              <p class="rl-price-sm">${count} plat${count > 1 ? 's' : ''}</p>
              <p class="rl-price-tot">${total.toLocaleString()} F</p>
            </div>
          </div>
          <a class="rl-btn" href="${API_URL}/r/${restaurant.slug}?from=lite">Commander →</a>
        </div>
        ` : ''}
      `;

      // Events
      container.querySelector('.rl-search input').addEventListener('input', e => {
        search = e.target.value.toLowerCase();
        render();
      });

      container.querySelectorAll('.rl-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          cat = btn.dataset.cat;
          render();
        });
      });

      container.querySelectorAll('.rl-add').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const name = btn.dataset.name;
          const price = parseInt(btn.dataset.price);
          const exists = cart.find(i => i.id === id);
          if (exists) exists.qty++; else cart.push({ id, name, price, qty: 1 });
          
          // Feedback
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = '+', 500);
          render();
        });
      });

      // Click outside input
      container.querySelector('.rl-search input').addEventListener('blur', () => {
        search = container.querySelector('.rl-search input').value;
        render();
      });
    }

    render();
  }

  // Initialiser
  function init() {
    injectStyles();
    const containers = document.querySelectorAll('[data-restafy-lite]');
    containers.forEach(el => {
      const slug = el.dataset.restaurant;
      if (slug) createWidget(el, slug);
    });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();