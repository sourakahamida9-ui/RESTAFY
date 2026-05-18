(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  window.addEventListener('load', function () {
    var loader = document.getElementById('loader');
    if (!loader || prefersReducedMotion) {
      if (loader) loader.classList.add('hidden');
      return;
    }
    setTimeout(function () {
      loader.classList.add('hidden');
    }, 2200);
  });

  if (!isCoarsePointer && !prefersReducedMotion) {
    var cursor = document.getElementById('cursor');
    var cursorDot = document.getElementById('cursor-dot');
    if (cursor && cursorDot) {
      var cx = 0;
      var cy = 0;
      var tx = 0;
      var ty = 0;
      document.addEventListener('mousemove', function (e) {
        tx = e.clientX;
        ty = e.clientY;
        cursorDot.style.left = tx + 'px';
        cursorDot.style.top = ty + 'px';
      });
      (function animateCursor() {
        cx += (tx - cx) * 0.14;
        cy += (ty - cy) * 0.14;
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
        requestAnimationFrame(animateCursor);
      })();
    }
  }

  var progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    document.addEventListener('scroll', function () {
      var scrollTop = document.documentElement.scrollTop;
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      progressBar.style.width = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 + '%' : '0%';
    });
  }

  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    });
  }

  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  document.querySelectorAll('.accordion-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = this.closest('.accordion-item');
      if (!item) return;
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item').forEach(function (i) {
        i.classList.remove('open');
      });
      document.querySelectorAll('.accordion-trigger').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  var currentLang = 'fr';
  var langBtn = document.getElementById('lang-btn');
  function applyLang(lang) {
    document.querySelectorAll('[data-fr], [data-en]').forEach(function (el) {
      var text = el.getAttribute('data-' + lang);
      if (text) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = text;
        } else {
          el.innerHTML = text;
        }
      }
    });
    if (langBtn) langBtn.textContent = lang === 'fr' ? 'EN' : 'FR';
    document.documentElement.lang = lang;
  }
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      currentLang = currentLang === 'fr' ? 'en' : 'fr';
      applyLang(currentLang);
    });
  }

  var themeBtn = document.getElementById('theme-btn');
  var html = document.documentElement;
  function applyTheme(theme) {
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      if (themeBtn) themeBtn.textContent = '🌙';
    } else {
      html.removeAttribute('data-theme');
      if (themeBtn) themeBtn.textContent = '☀';
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }
  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem('theme');
    } catch (e) {}
    var theme = saved;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = 'dark';
      try {
        current = localStorage.getItem('theme') || 'dark';
      } catch (e) {}
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
  initTheme();

  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobile-nav');
  var navOpen = false;
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      navOpen = !navOpen;
      hamburger.setAttribute('aria-expanded', navOpen.toString());
      mobileNav.classList.toggle('open', navOpen);
      var spans = hamburger.querySelectorAll('span');
      if (navOpen) {
        spans[0].style.transform = 'translateY(6px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-6px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '1';
        spans[2].style.transform = '';
      }
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navOpen = false;
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        var spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '1';
        spans[2].style.transform = '';
      });
    });
  }
})();
