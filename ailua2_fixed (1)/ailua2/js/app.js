const isTouch = window.matchMedia('(hover: none)').matches || ('ontouchstart' in window);

function syncTouchMode() {
  const narrow = window.innerWidth <= 900;
  const touch = window.matchMedia('(hover: none)').matches || ('ontouchstart' in window);
  const active = touch || narrow;
  document.body.classList.toggle('is-touch', active);
  const cur = document.getElementById('cursor');
  if (cur) cur.style.display = active ? 'none' : '';
}

window.addEventListener('resize', syncTouchMode);
const lenis = new Lenis({ duration: 2.2, lerp: 0.05, smoothWheel: true });
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

const cursor = document.getElementById('cursor');
const servicePreview = document.getElementById('service-preview');
let currentAngle = 0;
const interactables = document.querySelectorAll('a, button, .dropdown-item, .service-row');

let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;
let prevCursorX = 0, prevCursorY = 0;
let mouseActive = false;
let hasCaughtUp = false;
let isIdle = false;
let idleTimer = null;
let wanderPauseTimer = null;
let wanderTargetX = 0, wanderTargetY = 0;
let wanderMoving = false;
let lastInsideRow = null;
let dragScrolling = false;
let _slideDist = 0;
const _SLIDE_THRESHOLD = 90;
let _wanderOnRow = false;
let dragStartY = 0;
let dragStartScroll = 0;
let isMiddleDrag = false;
let velocityHistory = [];
let lastMouseY = 0;
let lastMouseTime = 0;
let leftSmoother = null;
let rightSmoother = null;
let sliderCursorX = 0;

function updateAngle() {
  const dx = cursorX - prevCursorX;
  const dy = cursorY - prevCursorY;
  if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) {
    let target = Math.atan2(dy, dx) * (180 / Math.PI);
    let diff = target - currentAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    currentAngle += diff * 0.25;
  }
}

function masterLoop() {
  prevCursorX = cursorX;
  prevCursorY = cursorY;

  if (isIdle && wanderMoving) {
    const dx = wanderTargetX - cursorX;
    const dy = wanderTargetY - cursorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 6) {
      wanderMoving = false;
      const pauseTime = _wanderOnRow ? 650 + Math.random() * 1100 : 200 + Math.random() * 600;
      wanderPauseTimer = setTimeout(() => {
        if (!isIdle) return;
        pickWanderTarget();
        wanderMoving = true;
      }, pauseTime);
    } else {
      const prevCX = cursorX, prevCY = cursorY;
      cursorX += dx * 0.022;
      cursorY += dy * 0.022;
      const moved = Math.sqrt((cursorX - prevCX) ** 2 + (cursorY - prevCY) ** 2);
      _slideDist += moved;
      if (_slideDist >= _SLIDE_THRESHOLD) {
        _slideDist = 0;
        const openStrip = document.querySelector('.service-media-strip.strip-open');
        openStrip && openStrip._nextSlide && openStrip._nextSlide();
      }
      let tAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      let diff = tAngle - currentAngle;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      currentAngle += diff * 0.07;
    }
  } else if (mouseActive && !isIdle) {
    const dx = mouseX - cursorX;
    const dy = mouseY - cursorY;
    const lerp = hasCaughtUp ? 0.20 : 0.10;
    if (!hasCaughtUp && Math.sqrt(dx * dx + dy * dy) < 3) hasCaughtUp = true;
    const prevCX2 = cursorX, prevCY2 = cursorY;
    cursorX += dx * lerp;
    cursorY += dy * lerp;
    const moved2 = Math.sqrt((cursorX - prevCX2) ** 2 + (cursorY - prevCY2) ** 2);
    _slideDist += moved2;
    if (_slideDist >= _SLIDE_THRESHOLD) {
      _slideDist = 0;
      const openStrip = document.querySelector('.service-media-strip.strip-open');
      openStrip && openStrip._nextSlide && openStrip._nextSlide();
    }
    updateAngle();
  }

  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  cursor.style.transform = `translate(-50%, -50%) rotate(${currentAngle}deg)`;

  document.documentElement.style.setProperty('--mx', cursorX + 'px');
  document.documentElement.style.setProperty('--my', cursorY + 'px');

  const dotEl = document.getElementById('cursor-dot');
  if (dotEl) {
    if (cursor.classList.contains('middle-active')) {
      const rad = currentAngle * Math.PI / 180;
      dotEl.style.left = (cursorX - Math.cos(rad) * 10) + 'px';
      dotEl.style.top  = (cursorY - Math.sin(rad) * 10) + 'px';
      dotEl.style.display = 'block';
    } else {
      dotEl.style.display = 'none';
    }
  }

  servicePreview.style.left = (cursorX + 25) + 'px';
  servicePreview.style.top  = (cursorY + 25) + 'px';

  const stripLabel = document.getElementById('strip-cursor-label');
  if (stripLabel) {
    stripLabel.style.left = (cursorX + 25) + 'px';
    stripLabel.style.top  = (cursorY + 52) + 'px';
  }

  const sliderOpen    = document.body.classList.contains('slider-open');
  const dropdownOpen  = document.getElementById('servicesDropdown').classList.contains('open');
  const rows          = document.querySelectorAll('.service-row');
  let insideRow       = null;
  let insideDropdown  = false;

  if (dropdownOpen) {
    const dd  = document.getElementById('servicesDropdown');
    const ddr = dd.getBoundingClientRect();
    if (cursorX >= ddr.left && cursorX <= ddr.right && cursorY >= ddr.top && cursorY <= ddr.bottom) {
      insideDropdown = true;
    }
  }

  if (!sliderOpen && !insideDropdown) {
    rows.forEach(row => {
      const r = row.getBoundingClientRect();
      if (cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom) {
        insideRow = row;
      }
      const strip = row.nextElementSibling;
      if (strip && strip.classList.contains('service-media-strip') && strip.classList.contains('strip-open')) {
        const sr = strip.getBoundingClientRect();
        if (cursorX >= sr.left && cursorX <= sr.right && cursorY >= sr.top && cursorY <= sr.bottom) {
          insideRow = row;
        }
      }
    });
  }

  rows.forEach(row => {
    if (row === insideRow) return;
    if (row.classList.contains('is-hovered')) {
      row.classList.remove('is-hovered');
      row.classList.add('was-hovered');
      const r = row;
      setTimeout(() => r.classList.remove('was-hovered'), 480);
    }
  });

  if (insideRow !== lastInsideRow) {
    if (lastInsideRow) {
      const oldStrip = lastInsideRow.nextElementSibling;
      if (oldStrip && oldStrip.classList.contains('service-media-strip')) {
        oldStrip.classList.remove('strip-open');
        oldStrip._grid && oldStrip._grid.classList.remove('strip-enter');
        lastInsideRow.classList.remove('strip-is-open');
      }
    }

    lastInsideRow = insideRow;

    if (insideRow) {
      insideRow.classList.remove('was-hovered');
      insideRow.classList.add('is-hovered');
      cursor.classList.add('on-service');
      cursor.classList.add('hovering');

      const newStrip = insideRow.nextElementSibling;
      if (newStrip && newStrip.classList.contains('service-media-strip')) {
        document.querySelectorAll('.service-media-strip.strip-open').forEach(s => {
          if (s !== newStrip) {
            s.classList.remove('strip-open');
            s._grid && s._grid.classList.remove('strip-enter');
            const pr = s.previousElementSibling;
            if (pr) pr.classList.remove('strip-is-open');
          }
        });
        newStrip.classList.add('strip-open');
        insideRow.classList.add('strip-is-open');
        void newStrip._grid.offsetWidth;
        newStrip._grid.classList.add('strip-enter');
        newStrip._resetSlide && newStrip._resetSlide();
      }
    } else {
      document.querySelectorAll('.service-media-strip.strip-open').forEach(s => {
        s.classList.remove('strip-open');
        s._grid && s._grid.classList.remove('strip-enter');
        const pr = s.previousElementSibling;
        if (pr) pr.classList.remove('strip-is-open');
      });
      cursor.classList.remove('hovering');
      cursor.classList.remove('on-service');
    }
  }

  requestAnimationFrame(masterLoop);
}

function startDrag(clientY, isMiddle) {
  dragScrolling = true;
  isMiddleDrag = isMiddle;
  dragStartY = clientY;
  dragStartScroll = window.scrollY;
  velocityHistory = [];
}

function stopDrag() {
  if (!dragScrolling) return;
  dragScrolling = false;
  const recent = velocityHistory.slice(-6);
  const avgVelocity = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const momentum = isMiddleDrag ? avgVelocity * 18 : avgVelocity * 28;
  const duration = isMiddleDrag ? 1.8 : 2.8;
  const target   = window.scrollY + momentum;
  lenis.scrollTo(target, {
    duration,
    easing: isMiddleDrag ? (t) => 1 - Math.pow(1 - t, 5) : (t) => 1 - Math.pow(1 - t, 9)
  });
}

if (!isTouch) {
document.addEventListener('mousedown', (e) => {
  const isInteractable = e.target.closest('a, button, input, textarea, select, [onclick]');
  if (e.button === 0 && !isInteractable) {
    lastMouseY = e.clientY;
    lastMouseTime = performance.now();
    startDrag(e.clientY, false);
  }
  if (e.button === 1) {
    e.preventDefault();
    cursor.classList.add('middle-active');
    lastMouseY = e.clientY;
    lastMouseTime = performance.now();
    startDrag(e.clientY, true);
  }
});

document.addEventListener('mousemove', (e) => {
  if (!dragScrolling) return;
  const now = performance.now();
  const dt  = now - lastMouseTime;
  if (dt > 0 && dt < 100) {
    const v = (lastMouseY - e.clientY) / dt;
    velocityHistory.push(v);
    if (velocityHistory.length > 10) velocityHistory.shift();
  }
  lastMouseY = e.clientY;
  lastMouseTime = now;
  const dy = dragStartY - e.clientY;
  lenis.scrollTo(dragStartScroll + dy, { immediate: true });
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) stopDrag();
  if (e.button === 1) { stopDrag(); cursor.classList.remove('middle-active'); }
});
}

if (!isTouch) masterLoop();

if (isTouch) {
  document.getElementById('cursor').style.display = 'none';
  document.body.classList.add('is-touch');
  (function fitHero() {
    const el = document.querySelector('.hero-name');
    if (!el) return;
    const margin = 37.8 * (1280 / window.screen.width);
    el.style.fontSize = '200px';
    const measure = () => {
      const w = el.offsetWidth;
      if (!w) return;
      el.style.fontSize = Math.floor((1280 - margin * 2) / w * 200) + 'px';
    };
    document.fonts ? document.fonts.ready.then(measure) : window.addEventListener('load', measure);
    window.addEventListener('orientationchange', () => setTimeout(() => {
      el.style.fontSize = '200px';
      setTimeout(measure, 80);
    }, 100));
  })();
}

document.querySelectorAll('.ht-nav a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    lenis.scrollTo(target, {
      duration: 1.8,
      easing: t => t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2,
    });
  });
});

function placeInitialCursor() {
  const heroEl = document.querySelector('.hero-name');
  if (!heroEl) return;
  const r = heroEl.getBoundingClientRect();
  cursorX      = r.right - (r.width * 0.1);
  cursorY      = r.top + (r.height * 0.2);
  currentAngle = -43;
  cursor.style.display = 'block';
}
if (!isTouch) setTimeout(placeInitialCursor, 100);

function pickWanderTarget() {
  const serviceRows  = Array.from(document.querySelectorAll('.service-row'));
  const visibleRows  = serviceRows.filter(r => {
    const rect = r.getBoundingClientRect();
    return rect.top > -30 && rect.bottom < window.innerHeight + 30;
  });
  const hitRow = visibleRows.length > 0 && Math.random() < 0.68;
  if (hitRow) {
    const row  = visibleRows[Math.floor(Math.random() * visibleRows.length)];
    const rect = row.getBoundingClientRect();
    wanderTargetX = rect.left + rect.width  * (0.06 + Math.random() * 0.52);
    wanderTargetY = rect.top  + rect.height * (0.18 + Math.random() * 0.64);
    _wanderOnRow  = true;
    return;
  }
  _wanderOnRow  = false;
  const margin  = 120;
  wanderTargetX = margin + Math.random() * (window.innerWidth  - margin * 2);
  wanderTargetY = margin + Math.random() * (window.innerHeight - margin * 2);
}

if (!isTouch) {
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (!mouseActive) { mouseActive = true; hasCaughtUp = false; cursor.style.display = 'block'; }
  isIdle        = false;
  wanderMoving  = false;
  if (wanderPauseTimer) { clearTimeout(wanderPauseTimer); wanderPauseTimer = null; }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    isIdle = true;
    cursor.style.display = 'block';
    pickWanderTarget();
    wanderMoving = true;
  }, 5000);
});

interactables.forEach(el => {
  const isServiceRow = el.classList.contains('service-row');
  const textElement  = isServiceRow ? el.querySelector('.service-row-name') : null;

  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hovering');
    if (isServiceRow) { cursor.classList.add('on-service'); lastInsideRow = el; }
  });

  if (isServiceRow) {
    el.addEventListener('mousemove', () => { textElement.style.transform = 'none'; });
  }

  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
    if (isServiceRow) {
      cursor.classList.remove('on-service');
      textElement.style.transform = 'translate(0, 0)';
      lastInsideRow = null;
    }
  });
});
}

const headerBlack = document.getElementById('header-black');
const headerWhite = document.getElementById('header-white');

function updateNav() {
  const scrollY    = window.scrollY;
  const vh         = window.innerHeight;
  const barH       = headerBlack.offsetHeight;
  const maxTravel  = vh - barH;
  const progress   = Math.min(Math.max(scrollY / vh, 0), 1);
  const travel     = -(progress * maxTravel);
  const tf         = `translateY(${travel}px)`;
  headerBlack.style.transform = tf;
  headerWhite.style.transform = tf;

  const barTopVP  = vh - barH + travel;
  const services  = document.getElementById('services');
  const contact   = document.getElementById('contact');
  const darkRanges = [
    [services.offsetTop, services.offsetTop + services.offsetHeight],
    [contact.offsetTop,  contact.offsetTop  + contact.offsetHeight]
  ];

  let visStart = barH;
  let visEnd   = 0;

  for (const [secTop, secBot] of darkRanges) {
    const secTopVP   = secTop - scrollY;
    const secBotVP   = secBot - scrollY;
    const overlapTop = Math.max(secTopVP, barTopVP);
    const overlapBot = Math.min(secBotVP, barTopVP + barH);
    if (overlapBot > overlapTop) {
      const revealStart = Math.max(0, Math.round(overlapTop - barTopVP));
      const revealEnd   = Math.min(barH, Math.round(overlapBot - barTopVP));
      visStart = Math.min(visStart, revealStart);
      visEnd   = Math.max(visEnd,   revealEnd);
    }
  }

  headerWhite.style.clipPath = `inset(${visStart}px 0 ${Math.max(barH - visEnd, 0)}px 0)`;
  headerBlack.style.alignItems = 'flex-start';
  headerWhite.style.alignItems = 'flex-start';

  const navEl   = headerBlack.querySelector('.ht-nav');
  const brandEl = headerBlack.querySelector('.ht-brand');
  if (navEl && brandEl) {
    const offset = navEl.offsetHeight - brandEl.offsetHeight;
    const shift  = offset * (1 - progress);
    document.querySelectorAll('.ht-brand, .ht-tagline').forEach(el => {
      el.style.transform = `translateY(${shift}px)`;
    });
  }

  const sTop = services.offsetTop - scrollY;
  const sBot = sTop + services.offsetHeight;
  if (sBot < 0 || sTop > vh) {
    servicePreview.classList.remove('active');
  }

  const location = document.querySelector('#header-black .ht-location');
  if (location) {
    location.style.opacity = scrollY > vh * 0.5 ? '0' : '0.35';
  }
}

updateNav();
lenis.on('scroll', updateNav);

document.getElementById('servicesBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  e.currentTarget.classList.toggle('open');
  document.getElementById('servicesDropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
  document.getElementById('servicesBtn').classList.remove('open');
  document.getElementById('servicesDropdown').classList.remove('open');
});

function renderRightPanel(d, idx) {
  const rc      = document.getElementById('sliderRightContent');
  rc.innerHTML  = '';
  const concept = d.concepts[idx];

  const hero    = document.createElement('div');
  hero.className = 'sl-hero-wrap';
  const heroImg  = document.createElement('img');
  heroImg.src    = concept.images[0];
  heroImg.className = 'sl-hero-img';
  hero.appendChild(heroImg);
  setTimeout(() => heroImg.classList.add('img-in'), 80);
  rc.appendChild(hero);

  const proj = document.createElement('div');
  proj.className = 'sl-project-block';
  proj.innerHTML = `
    <div class="sl-project-actions">
      <button class="sl-project-action-btn">READ MORE HERE</button>
      <button class="sl-project-action-btn">${concept.name.toUpperCase()} ↗</button>
    </div>
    <div class="sl-project-name">${concept.name}</div>
    <div class="sl-project-desc">${concept.desc}</div>
  `;
  rc.appendChild(proj);

  const moreEl      = document.createElement('div');
  moreEl.className  = 'sl-more';
  moreEl.innerHTML  = `<div class="sl-more-label">MORE</div><div class="sl-more-arrow">↓</div>`;
  rc.appendChild(moreEl);

  const imgGrid     = document.createElement('div');
  imgGrid.className = 'sl-img-grid';
  concept.images.slice(1).forEach((src, i) => {
    const wrap      = document.createElement('div');
    wrap.className  = 'sl-img-grid-item';
    const img       = document.createElement('img');
    img.src         = src;
    img.className   = 'sl-grid-img';
    wrap.appendChild(img);
    setTimeout(() => img.classList.add('img-in'), 200 + i * 100);
    imgGrid.appendChild(wrap);
  });
  rc.appendChild(imgGrid);

  document.querySelectorAll('.sl-list-item').forEach((el, i) => {
    const active = i === idx;
    el.classList.toggle('active', active);
    el.querySelector('.sl-list-name').style.opacity = active ? '1' : '0.4';
  });

  if (rightSmoother) rightSmoother.reset();
  rightSmoother = createSmoother(document.getElementById('sliderRight'));
}

window.openSlider = (type) => {
  const d = PROJECTS[type];
  document.getElementById('sliderNum').textContent      = d.num + '.';
  document.getElementById('sliderHeadline').textContent = d.headline;
  document.getElementById('sliderBody').textContent     = d.body;
  document.getElementById('sliderBody2').textContent    = d.body2;
  document.getElementById('sliderCta').textContent      = d.cta;
  document.getElementById('sliderYear').textContent     = d.year;
  document.getElementById('sliderLeft').style.background = d.color;

  const list  = document.getElementById('sliderList');
  list.innerHTML = '';
  d.concepts.forEach((concept, i) => {
    const item      = document.createElement('div');
    item.className  = 'sl-list-item';
    item.innerHTML  = `<span class="sl-list-name" style="opacity:${i === 0 ? 1 : 0.4}">${concept.name}</span><span class="sl-list-num">${i + 1}</span>`;
    item.addEventListener('click', () => renderRightPanel(d, i));
    list.appendChild(item);
  });

  renderRightPanel(d, 0);

  if (leftSmoother) leftSmoother.reset();
  leftSmoother = createSmoother(document.getElementById('sliderLeft'));

  document.getElementById('slider-overlay').classList.add('open');
  document.body.classList.add('slider-open');
};

function createSmoother(el) {
  let target = 0, current = 0, rafId = null;
  function tick() {
    current += (target - current) * 0.09;
    el.scrollTop = current;
    if (Math.abs(target - current) > 0.3) {
      rafId = requestAnimationFrame(tick);
    } else {
      current = target; el.scrollTop = current; rafId = null;
    }
  }
  return {
    scroll(delta) {
      target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target + delta));
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    reset()   { target = 0; current = 0; el.scrollTop = 0; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
    destroy() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  };
}

const sliderPanelEl = document.getElementById('sliderPanel');
sliderPanelEl.addEventListener('mousemove', (e) => { sliderCursorX = e.clientX; });
sliderPanelEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const boundary = document.getElementById('sliderLeft').getBoundingClientRect().right;
  if (sliderCursorX < boundary) { leftSmoother  && leftSmoother.scroll(e.deltaY);  }
  else                          { rightSmoother && rightSmoother.scroll(e.deltaY); }
}, { passive: false });

window.closeSlider = () => {
  document.getElementById('slider-overlay').classList.remove('open');
  document.body.classList.remove('slider-open');
  if (leftSmoother)  { leftSmoother.destroy();  leftSmoother  = null; }
  if (rightSmoother) { rightSmoother.destroy(); rightSmoother = null; }
};

document.getElementById('sliderCta').addEventListener('click', () => {
  closeSlider();
  setTimeout(() => { document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }); }, 400);
});

document.getElementById('sliderBlur').addEventListener('click', closeSlider);

document.querySelectorAll('.service-row-name').forEach(nameEl => {
  const text    = nameEl.textContent;
  nameEl.innerHTML = '';
  text.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'service-char';
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    span.style.setProperty('--ci', i);
    span.style.transitionDelay = `${i * 38}ms`;
    nameEl.appendChild(span);
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) setTimeout(() => entry.target.classList.add('visible'), i * 80);
  });
}, { threshold: 0.15 });

(function initMobMenu() {
  const hamBtn = document.getElementById('mob-ham');
  const mobMenu = document.getElementById('mob-menu');
  const mobClose = document.getElementById('mob-close');
  if (!hamBtn || !mobMenu) return;

  let menuOpen = false;

  gsap.set(mobMenu, { x: '100%', filter: 'blur(0px)' });
  gsap.set(hamBtn, { x: 0 });
  if (mobClose) gsap.set(mobClose, { opacity: 0, y: 0 });

  const navLinks = mobMenu.querySelectorAll('.mob-nav-link');
  const socials  = mobMenu.querySelectorAll('.mob-social-link');
  const loc      = mobMenu.querySelector('.mob-loc');
  const brand    = mobMenu.querySelector('.mob-brand-name');
  const tag      = mobMenu.querySelector('.mob-brand-tag');

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    mobMenu.classList.add('mob-menu--open');
    document.body.classList.add('menu-open');
    lenis.stop();

    const travelDist = -(window.innerWidth + hamBtn.offsetWidth + 32);

    gsap.fromTo(mobMenu,
      { x: '100%', filter: 'blur(18px)' },
      { x: '0%', filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }
    );

    gsap.to(hamBtn, { x: travelDist, duration: 0.75, ease: 'expo.out' });

    // Fade + slide in the close button after the panel is open.
    if (mobClose) {
      gsap.fromTo(mobClose,
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.45 }
      );
    }

    gsap.fromTo([brand, tag],
      { x: 48, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08, delay: 0.15 }
    );

    gsap.fromTo(
      document.querySelectorAll('.mob-nav-text'),
      { y: '110%' },
      {
        y: '0%',
        duration: 0.65,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.22
      }
    );

    gsap.fromTo([...socials, loc],
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.06, delay: 0.45 }
    );
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;

    // Spin signal + fade-out close button.
    if (mobClose) {
      gsap.to(mobClose, { rotation: 360, duration: 0.45, ease: 'power2.inOut' });
      gsap.to(mobClose, { opacity: 0, duration: 0.25, ease: 'power2.in' });
    }

    // Push the panel back to the right (and bring the ham button back).
    gsap.to(hamBtn, { x: 0, duration: 0.6, ease: 'expo.out', delay: 0.2 });
    gsap.to(mobMenu, {
      x: '100%',
      duration: 0.6,
      ease: 'expo.out',
      delay: 0.2,
      onComplete: () => {
        mobMenu.classList.remove('mob-menu--open');
        document.body.classList.remove('menu-open');
        if (mobClose) gsap.set(mobClose, { rotation: 0, opacity: 0, y: 0 });
        lenis.start();
      }
    });
  }

  function toggleMenu(e) {
    if (e && e.type === 'touchend') e.preventDefault();
    menuOpen ? closeMenu() : openMenu();
  }

  hamBtn.addEventListener('click', toggleMenu);
  hamBtn.addEventListener('touchend', toggleMenu, { passive: false });
  mobClose && mobClose.addEventListener('click', closeMenu);

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const href = link.getAttribute('href');
      const target = document.querySelector(href);

      // 1. Cut animation on clicked link text
      const clickedText = link.querySelector('.mob-nav-text');
      gsap.to(clickedText, {
        y: '-110%',
        duration: 0.38,
        ease: 'power3.in'
      });

      // 2. Other links fade + slide down simultaneously
      navLinks.forEach(other => {
        if (other !== link) {
          const otherText = other.querySelector('.mob-nav-text');
          gsap.to(otherText, {
            y: '40%',
            opacity: 0,
            duration: 0.28,
            ease: 'power2.in'
          });
        }
      });

      setTimeout(() => {
        closeMenu();
      }, 380);

      setTimeout(() => {
        if (target) {
          lenis.scrollTo(target, {
            duration: 1.8,
            easing: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2
          });
        }
      }, 1250);

      setTimeout(() => {
        navLinks.forEach(l => {
          const txt = l.querySelector('.mob-nav-text');
          gsap.set(txt, { y: '110%', opacity: 1 });
        });
      }, 1400);
    });
  });
})();

if (isTouch) {
  let activeTapRow = null;
  document.querySelectorAll('.service-row').forEach(row => {
    const href = (row.getAttribute('onclick') || '').replace(/.*'([^']+)'.*/, '$1');
    const strip = row.nextElementSibling && row.nextElementSibling.classList.contains('service-media-strip')
      ? row.nextElementSibling
      : null;
    row.removeAttribute('onclick');
    row.addEventListener('click', () => {
      if (!row.classList.contains('is-hovered')) {
        if (activeTapRow && activeTapRow !== row) {
          const prevStrip = activeTapRow.nextElementSibling;
          activeTapRow.classList.remove('is-hovered');
          activeTapRow.classList.add('was-hovered');
          if (prevStrip && prevStrip.classList.contains('service-media-strip')) {
            prevStrip.classList.remove('strip-open');
            if (prevStrip._grid) prevStrip._grid.classList.remove('strip-enter');
          }
          const prev = activeTapRow;
          setTimeout(() => prev.classList.remove('was-hovered'), 480);
        }
        activeTapRow = row;
        row.classList.remove('was-hovered');
        row.classList.add('is-hovered');
        if (strip) {
          document.querySelectorAll('.service-media-strip.strip-open').forEach(s => {
            if (s !== strip) {
              s.classList.remove('strip-open');
              if (s._grid) s._grid.classList.remove('strip-enter');
            }
          });
          strip.classList.add('strip-open');
          if (strip._grid) {
            void strip._grid.offsetWidth;
            strip._grid.classList.add('strip-enter');
          }
          if (isTouch) {
            setTimeout(() => {
              lenis.scrollTo(row, { 
                duration: 1.2,
                offset: -100,
                easing: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2
              });
            }, 800);
          }
        }
      } else {
        if (href) window.location.href = href;
      }
    });
  });
  document.addEventListener('click', e => {
    if (activeTapRow && !e.target.closest('.service-row') && !e.target.closest('.service-media-strip')) {
      const prevStrip = activeTapRow.nextElementSibling;
      activeTapRow.classList.remove('is-hovered');
      activeTapRow.classList.add('was-hovered');
      if (prevStrip && prevStrip.classList.contains('service-media-strip')) {
        prevStrip.classList.remove('strip-open');
        if (prevStrip._grid) prevStrip._grid.classList.remove('strip-enter');
      }
      const prev = activeTapRow;
      setTimeout(() => prev.classList.remove('was-hovered'), 480);
      activeTapRow = null;
    }
  });

  lenis.on('scroll', () => {
    if (activeTapRow) {
      const prevStrip = activeTapRow.nextElementSibling;
      activeTapRow.classList.remove('is-hovered');
      activeTapRow.classList.add('was-hovered');
      if (prevStrip && prevStrip.classList.contains('service-media-strip')) {
        prevStrip.classList.remove('strip-open');
        if (prevStrip._grid) prevStrip._grid.classList.remove('strip-enter');
      }
      const prev = activeTapRow;
      setTimeout(() => prev.classList.remove('was-hovered'), 480);
      activeTapRow = null;
    }
  });
}

document.addEventListener('wheel',   (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) e.preventDefault();
});

document.querySelectorAll('.reveal, .reveal-up, .reveal-fade, .reveal-left, .service-row, .work-card, .services-about').forEach(el => observer.observe(el));

function wrapWords(text, baseDelay) {
  return text.split(' ').map((word, i) =>
    `<span class="strip-word"><span class="strip-word-inner" style="animation-delay:${baseDelay + i * 60}ms">${word}</span></span>`
  ).join(' ');
}

Object.entries(PROJECTS).forEach(([key, project]) => {
  const row = document.querySelector(`.service-row[data-service="${key}"]`);
  if (!row) return;

  const strip       = document.createElement('div');
  strip.className   = 'service-media-strip';

  const imgUrls = project.concepts.map(c => c.images[0]);
  const names   = project.concepts.map(c => c.name);
  const total   = imgUrls.length;

  const grid    = document.createElement('div');
  grid.className = 'strip-grid';

  const imgSlot      = document.createElement('div');
  imgSlot.className  = 'strip-img-slot';
  const imgs = imgUrls.map(url => {
    const img     = document.createElement('img');
    img.className = 'strip-cycle-img';
    img.src       = url;
    imgSlot.appendChild(img);
    return img;
  });

  const info    = document.createElement('div');
  info.className = 'strip-info';
  const idxEl   = document.createElement('div'); idxEl.className  = 'strip-info-idx';
  const nameEl  = document.createElement('div'); nameEl.className = 'strip-info-name';
  const catEl   = document.createElement('div'); catEl.className  = 'strip-info-cat';
  info.appendChild(idxEl);
  info.appendChild(nameEl);
  info.appendChild(catEl);
  catEl.textContent = project.strip.cat;

  const desc1       = document.createElement('div');
  desc1.className   = 'strip-desc';
  desc1.innerHTML   = `<div class="strip-desc-label">About</div><div class="strip-desc-text">${wrapWords(project.strip.about, 280)}</div>`;

  const desc2       = document.createElement('div');
  desc2.className   = 'strip-desc';
  desc2.innerHTML   = `<div class="strip-desc-label">Detail</div><div class="strip-desc-text">${wrapWords(project.strip.detail, 360)}</div>`;

  grid.appendChild(imgSlot);
  grid.appendChild(info);
  grid.appendChild(desc1);
  grid.appendChild(desc2);
  strip.appendChild(grid);
  row.after(strip);

  let currentIdx = 0;

  function showSlide(idx, animate) {
    imgs.forEach((img, i) => img.classList.toggle('img-active', i === idx));
    idxEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    if (animate) {
      nameEl.classList.remove('name-in');
      nameEl.classList.add('name-fade');
      setTimeout(() => {
        nameEl.textContent = names[idx];
        nameEl.classList.remove('name-fade');
        nameEl.classList.add('name-in');
      }, 240);
    } else {
      nameEl.textContent = names[idx];
      nameEl.classList.add('name-in');
    }
  }

  strip._grid      = grid;
  strip._imgs      = imgs;
  strip._nextSlide = () => { currentIdx = (currentIdx + 1) % total; showSlide(currentIdx, true); };
  strip._resetSlide = () => { currentIdx = 0; showSlide(0, false); };
});


/* ═══════════════════════════════════════════════════════════
   CONTACT — GSAP
   Runs after DOM ready (script at bottom of body)
═══════════════════════════════════════════════════════════ */
(function contactSection() {
  if (typeof gsap === 'undefined') return;

  /* ── Custom ease ── */
  CustomEase.create('snap', 'M0,0 C0.87,0 0.13,1 1,1');

  /* ── Drum constants — match CSS --drum-h: 40px ── */
  const DRUM_H  = 40;
  const BUDGETS = ['$1','$10','$100','$500','$1,000','$5,000','$10,000','$25,000+'];

  /* ══════════════════════════════════════════════
     TAB TOGGLE
  ══════════════════════════════════════════════ */
  const tabs       = document.querySelectorAll('.ct-tab');
  const panels     = document.querySelectorAll('.ct-panel');
  let   curPanel   = document.getElementById('ct-panel-contact');
  let   switching  = false;

  /* Init — active panel visible, others hidden */
  panels.forEach(p => {
    if (p === curPanel) {
      p.classList.remove('ct-panel--hidden');
      gsap.set(p, { clipPath: 'inset(0 0 0% 0)', autoAlpha: 1 });
    } else {
      p.classList.add('ct-panel--hidden');
      gsap.set(p, { clipPath: 'inset(0 0 100% 0)', autoAlpha: 0 });
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (switching) return;
      const targetId = 'ct-panel-' + tab.dataset.panel;
      const nextPanel = document.getElementById(targetId);
      if (!nextPanel || nextPanel === curPanel) return;
      switching = true;

      /* update tab styles */
      tabs.forEach(t => t.classList.remove('ct-tab--active'));
      tab.classList.add('ct-tab--active');

      const leaving = curPanel;
      curPanel = nextPanel;

      /* collapse leaving */
      gsap.to(leaving, {
        clipPath: 'inset(0 0 100% 0)',
        autoAlpha: 0,
        duration: 0.45,
        ease: 'snap',
        onComplete: () => leaving.classList.add('ct-panel--hidden'),
      });

      /* expand incoming */
      nextPanel.classList.remove('ct-panel--hidden');
      gsap.fromTo(nextPanel,
        { clipPath: 'inset(0 0 100% 0)', autoAlpha: 0 },
        {
          clipPath: 'inset(0 0 0% 0)',
          autoAlpha: 1,
          duration: 0.55,
          ease: 'snap',
          delay: 0.08,
          onComplete: () => { switching = false; },
        }
      );
    });
  });

  /* ══════════════════════════════════════════════
     FIELD WRAPS — underline sweep + dolly zoom
  ══════════════════════════════════════════════ */
  const fieldWraps = Array.from(document.querySelectorAll('.ct-field-wrap'));

  function getBar(wrap) { return wrap.querySelector('.ct-underline-bar'); }

  function sweepIn(wrap) {
    gsap.to(getBar(wrap), { scaleX: 1, duration: 0.5, ease: 'power3.out', transformOrigin: 'left center' });
  }
  function sweepOut(wrap) {
    gsap.to(getBar(wrap), { scaleX: 0, duration: 0.38, ease: 'power3.in', transformOrigin: 'right center' });
  }

  function dollyFocus(active) {
    fieldWraps.forEach(w => {
      if (w === active) {
        gsap.to(w, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out' });
      } else {
        gsap.to(w, { scale: 0.96, opacity: 0.25, filter: 'blur(2px)', duration: 0.18, ease: 'power1.in' });
      }
    });
  }
  function dollyReset() {
    /* blur away instantly, then ease scale/opacity back */
    fieldWraps.forEach(w => {
      gsap.to(w, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out' });
    });
  }
  function dollyNext(currentWrap) {
    const idx  = fieldWraps.indexOf(currentWrap);
    const next = fieldWraps[idx + 1];
    if (!next) { dollyReset(); return; }
    const nextEl = next.querySelector('.ct-field, .ct-budget-drum');
    if (nextEl) nextEl.focus();
  }

  /* bind inputs */
  document.querySelectorAll('.ct-field').forEach(field => {
    const wrap = field.closest('.ct-field-wrap');
    field.addEventListener('focus', () => { dollyFocus(wrap); sweepIn(wrap); });
    field.addEventListener('blur',  () => { dollyReset();    sweepOut(wrap); });
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter' && field.tagName !== 'TEXTAREA') {
        e.preventDefault();
        field.blur();
        dollyNext(wrap);
      }
    });
  });

  /* bind budget drum */
  const drumEl = document.getElementById('budgetDrum');
  if (drumEl) {
    const drumWrap = drumEl.closest('.ct-field-wrap');
    drumEl.addEventListener('focus', () => { dollyFocus(drumWrap); sweepIn(drumWrap); });
    drumEl.addEventListener('blur',  () => { dollyReset();         sweepOut(drumWrap); });
    drumEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); drumEl.blur(); dollyNext(drumWrap); }
    });
  }

  /* SEND hover */
  const sendBtn = document.getElementById('ctSend');
  if (sendBtn) {
    const bar = sendBtn.querySelector('.ct-send-bar');
    sendBtn.addEventListener('mouseenter', () =>
      gsap.fromTo(bar, { scaleX: 0, transformOrigin: 'left center' },
                       { scaleX: 1, duration: 0.48, ease: 'power3.out' }));
    sendBtn.addEventListener('mouseleave', () =>
      gsap.to(bar, { scaleX: 0, transformOrigin: 'right center', duration: 0.38, ease: 'power3.in' }));
  }

  /* ══════════════════════════════════════════════
     BUDGET DRUM ROLLER
  ══════════════════════════════════════════════ */
  (function initDrum() {
    const track    = document.getElementById('budgetTrack');
    const valInput = document.getElementById('budgetVal');
    const drumWrap = document.getElementById('budgetDrum');
    if (!track || !valInput || !drumWrap) return;

    let activeIdx  = 4;   /* default: $1,000 */
    let trackY     = 0;
    let velocity   = 0;
    let isDragging = false;
    let dragStartClientY = 0;
    let dragStartTrackY  = 0;
    let prevClientY = 0;
    let prevTime    = 0;
    let momentumRaf = null;
    let snapTween   = null;

    /* Build items */
    BUDGETS.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'ct-budget-item' + (i === activeIdx ? ' ct-budget-item--active' : '');
      el.textContent = v;
      track.appendChild(el);
    });

    const minY = () => -(BUDGETS.length - 1) * DRUM_H;
    const clampIdx = i => Math.max(0, Math.min(BUDGETS.length - 1, i));

    /* Resistance: heavier between $100/$500/$1,000 */
    function resistance(rawDy) {
      const nearIdx = clampIdx(Math.round(-trackY / DRUM_H));
      if (nearIdx >= 2 && nearIdx <= 4) return 0.5;
      return 1;
    }

    function applyY(y, animate) {
      trackY = Math.max(minY(), Math.min(0, y));
      if (animate) {
        gsap.set(track, { y: trackY + DRUM_H });
      } else {
        gsap.set(track, { y: trackY + DRUM_H });
      }
      const near = clampIdx(Math.round(-trackY / DRUM_H));
      updateActive(near);
    }

    function updateActive(idx) {
      activeIdx = idx;
      const items = track.querySelectorAll('.ct-budget-item');
      items.forEach((el, i) => el.classList.toggle('ct-budget-item--active', i === idx));
      valInput.value = BUDGETS[idx];
      /* denser scanlines + glow for $25,000+ */
      drumWrap.classList.toggle('ct-budget-drum--last-active', idx === BUDGETS.length - 1);
    }

    function snapTo(idx, fromVelocity) {
      idx = clampIdx(idx);
      const targetY = -idx * DRUM_H;
      if (snapTween) snapTween.kill();
      /* gravity deceleration — farther = longer duration */
      const dist = Math.abs(targetY - trackY);
      const dur  = Math.min(0.9, 0.35 + dist / 800);
      snapTween = gsap.to(track, {
        y: targetY + DRUM_H,
        duration: dur,
        ease: 'power4.out',
        onUpdate: () => {
          trackY = gsap.getProperty(track, 'y') - DRUM_H;
          updateActive(clampIdx(Math.round(-trackY / DRUM_H)));
        },
        onComplete: () => {
          trackY = targetY;
          updateActive(idx);
        },
      });
    }

    function stopMomentum() {
      if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = null; }
    }

    function startMomentum() {
      stopMomentum();
      function tick() {
        if (Math.abs(velocity) < 1.2) {
          snapTo(clampIdx(Math.round(-trackY / DRUM_H)));
          return;
        }
        velocity *= 0.86;
        applyY(trackY + velocity);
        momentumRaf = requestAnimationFrame(tick);
      }
      momentumRaf = requestAnimationFrame(tick);
    }

    /* Drag */
    drumWrap.addEventListener('mousedown', e => {
      e.preventDefault();
      isDragging = true;
      dragStartClientY = e.clientY;
      dragStartTrackY  = trackY;
      prevClientY = e.clientY;
      prevTime    = performance.now();
      velocity    = 0;
      stopMomentum();
      if (snapTween) snapTween.kill();
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dy  = e.clientY - prevClientY;
      const now = performance.now();
      const dt  = Math.max(now - prevTime, 1);
      velocity  = (dy / dt) * 14 * resistance(dy);
      prevClientY = e.clientY;
      prevTime    = now;
      const raw = dragStartTrackY + (e.clientY - dragStartClientY) * resistance(dy);
      applyY(raw);
    });
    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      startMomentum();
    });

    /* Wheel */
    drumWrap.addEventListener('wheel', e => {
      e.preventDefault();
      stopMomentum();
      if (snapTween) snapTween.kill();
      const dir = e.deltaY > 0 ? -1 : 1;
      velocity = dir * 14 * resistance(dir);
      startMomentum();
    }, { passive: false });

    /* Keyboard */
    drumWrap.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); snapTo(activeIdx + 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); snapTo(activeIdx - 1); }
    });

    /* Touch */
    let touchStartY = 0;
    let touchStartTrackY = 0;
    drumWrap.addEventListener('touchstart', e => {
      touchStartY      = e.touches[0].clientY;
      touchStartTrackY = trackY;
      prevClientY = touchStartY;
      prevTime    = performance.now();
      velocity    = 0;
      stopMomentum();
      if (snapTween) snapTween.kill();
    }, { passive: true });
    drumWrap.addEventListener('touchmove', e => {
      e.preventDefault();
      const dy  = e.touches[0].clientY - prevClientY;
      const now = performance.now();
      velocity  = (dy / Math.max(now - prevTime, 1)) * 14 * resistance(dy);
      prevClientY = e.touches[0].clientY;
      prevTime    = now;
      applyY(touchStartTrackY + (e.touches[0].clientY - touchStartY) * resistance(dy));
    }, { passive: false });
    drumWrap.addEventListener('touchend', () => startMomentum(), { passive: true });

    /* Init position */
    applyY(-activeIdx * DRUM_H);
  })();

  /* ══════════════════════════════════════════════
     FORM SUBMIT — EmailJS ready, dummy now
  ══════════════════════════════════════════════ */
  document.getElementById('contactForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const payload = {
      fname:        this.elements.fname?.value?.trim()        ?? '',
      lname:        this.elements.lname?.value?.trim()        ?? '',
      email:        this.elements.email?.value?.trim()        ?? '',
      project_type: this.elements.project_type?.value?.trim() ?? '',
      budget:       this.elements.budget?.value               ?? '',
      message:      this.elements.message?.value?.trim()      ?? '',
    };
    /* emailjs.send('SERVICE_ID', 'TEMPLATE_ID', payload, 'PUBLIC_KEY'); */
    console.log('[ailua] form payload:', payload);
    const label = document.querySelector('.ct-send-label');
    if (label) {
      label.textContent = 'SENT ✓';
      setTimeout(() => { label.textContent = 'SEND'; }, 2800);
    }
  });

})();

(function ailua_motion() {
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  const isT = window.matchMedia('(hover:none)').matches || ('ontouchstart' in window);

  const preloaderEl = document.getElementById('preloader');
  const plBrand     = document.getElementById('pl-brand');
  const plTag       = document.getElementById('pl-tag');
  const heroName    = document.querySelector('.hero-name');

  gsap.set(heroName, { opacity: 0 });

  function enterHero() {
    if (!heroName) return;
    gsap.fromTo(heroName,
      { y: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)' },
      { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power4.out' }
    );
  }

  if (preloaderEl && plBrand) {
    const ptl = gsap.timeline();
    ptl
      .fromTo(plBrand, { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.12 })
      .fromTo(plTag, { opacity: 0 },
        { opacity: 0.35, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .to({}, { duration: 0.72 })
      .to([plBrand, plTag], { y: -28, opacity: 0, duration: 0.42, ease: 'power3.in', stagger: 0.04 })
      .to(preloaderEl, {
        y: '-100%',
        duration: 0.82,
        ease: 'power4.inOut',
        onComplete: () => { preloaderEl.style.display = 'none'; }
      }, '-=0.05')
      .call(enterHero, [], '-=0.52');
  } else {
    enterHero();
  }

  if (typeof ScrollTrigger === 'undefined') return;

  function shouldSplitEl(el) {
    if (!el) return false;
    if (el.dataset && el.dataset.rkSplitDone === 'true') return false;
    // Don't destroy nested markup (icons/spans/etc) unless explicitly forced.
    if (el.children && el.children.length > 0) return false;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 0;
  }

  function splitWords(el) {
    const raw = el.textContent.trim();
    const words = raw.split(/\s+/);
    el.innerHTML = words.map(w =>
      '<span class="sw"><span class="swi">' + w + '</span></span>'
    ).join(' ');
    el.dataset.rkSplitDone = 'true';
    return Array.from(el.querySelectorAll('.swi'));
  }

  function initRaaviTextReveals(root = document) {
    const els = Array.from(root.querySelectorAll('.rk-split, [data-rk-split="words"]'));
    els.forEach((el) => {
      if (!shouldSplitEl(el)) return;

      const inners = splitWords(el);
      gsap.set(inners, { y: '115%' });

      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(inners, {
          y: '0%',
          duration: 0.75,
          ease: 'power3.out',
          stagger: Math.min(0.06, 0.015 + inners.length * 0.0008),
        }),
      });
    });
  }

  // Global “Raavi-like” word-reveals for tagged elements.
  initRaaviTextReveals();

  const workSection  = document.getElementById('work');
  const workCards    = document.querySelectorAll('.work-card');
  const workLabelEl  = document.querySelector('.work-label');

  if (workLabelEl) {
    workLabelEl.classList.remove('reveal-up');
    const wlInners = splitWords(workLabelEl);
    gsap.set(wlInners, { y: '115%' });
    ScrollTrigger.create({
      trigger: workLabelEl,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(wlInners, {
        y: '0%', duration: 0.65, ease: 'power3.out', stagger: 0.06
      })
    });
  }

  if (workCards.length) {
    gsap.set(workCards, { opacity: 0, y: 56 });
    ScrollTrigger.create({
      trigger: workSection || '#work',
      start: 'top 78%',
      once: true,
      onEnter: () => gsap.to(workCards, {
        opacity: 1, y: 0, duration: 0.88, ease: 'power3.out', stagger: 0.09
      })
    });
  }

  if (!isT && workCards.length) {
    workCards.forEach(card => {
      const bg   = card.querySelector('.work-card-bg');
      const name = card.querySelector('.work-card-name');
      const type = card.querySelector('.work-card-type');

      const ov = document.createElement('div');
      ov.className = 'wc-overlay';
      card.prepend(ov);

      const arr = document.createElement('span');
      arr.className = 'wc-arrow';
      arr.textContent = '↗';
      card.appendChild(arr);

      card.addEventListener('mouseenter', () => {
        gsap.to(bg,   { scale: 1.06, duration: 0.78, ease: 'power3.out' });
        gsap.to(ov,   { opacity: 1, duration: 0.42, ease: 'power2.out' });
        gsap.to(name, { y: -5, duration: 0.45, ease: 'power3.out' });
        gsap.to(type, { opacity: 0.75, y: -3, duration: 0.42, ease: 'power3.out', delay: 0.03 });
        gsap.to(arr,  { opacity: 1, x: 0, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.04 });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(bg,   { scale: 1, duration: 0.78, ease: 'power3.out' });
        gsap.to(ov,   { opacity: 0, duration: 0.42, ease: 'power2.out' });
        gsap.to(name, { y: 0, duration: 0.45, ease: 'power3.out' });
        gsap.to(type, { opacity: 0.4, y: 0, duration: 0.42, ease: 'power3.out' });
        gsap.to(arr,  { opacity: 0, x: -6, y: 6, duration: 0.32, ease: 'power2.in' });
      });
    });
  }

  if (isT && workCards.length) {
    workCards.forEach(card => {
      card.addEventListener('touchstart', () => {
        gsap.to(card, { scale: 0.975, duration: 0.15, ease: 'power2.out' });
      }, { passive: true });
      card.addEventListener('touchend', () => {
        gsap.to(card, { scale: 1, duration: 0.38, ease: 'power3.out' });
      }, { passive: true });
    });
  }

  const aboutSection = document.querySelector('.services-about');
  if (aboutSection) {
    const aboutLabel = aboutSection.querySelector('.services-about-label');
    const aboutBody  = aboutSection.querySelector('.services-about-body');

    if (aboutLabel) {
      aboutLabel.classList.remove('reveal-fade', 'reveal-d1');
      gsap.set(aboutLabel, { opacity: 0, x: isT ? 0 : -18, y: isT ? 18 : 0 });
      ScrollTrigger.create({
        trigger: aboutLabel,
        start: 'top 84%',
        once: true,
        onEnter: () => gsap.to(aboutLabel, {
          opacity: 1, x: 0, y: 0, duration: 0.78, ease: 'power3.out'
        })
      });
    }

    if (aboutBody) {
      aboutBody.classList.remove('reveal-up', 'reveal-d2');
      const bodyInners = splitWords(aboutBody);
      gsap.set(bodyInners, { y: '115%' });
      ScrollTrigger.create({
        trigger: aboutBody,
        start: 'top 82%',
        once: true,
        onEnter: () => gsap.to(bodyInners, {
          y: '0%', duration: 0.78, ease: 'power3.out', stagger: 0.016
        })
      });
    }
  }

  const servicesTitle = document.querySelector('.services-trigger');
  if (servicesTitle) {
    gsap.set(servicesTitle, { opacity: 0, y: 20 });
    ScrollTrigger.create({
      trigger: servicesTitle,
      start: 'top 86%',
      once: true,
      onEnter: () => gsap.to(servicesTitle, {
        opacity: 1, y: 0, duration: 0.62, ease: 'power3.out'
      })
    });
  }

  const ctToggleEl = document.querySelector('.ct-toggle');
  if (ctToggleEl) {
    gsap.set(ctToggleEl, { opacity: 0, y: -14 });
    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 78%',
      once: true,
      onEnter: () => gsap.to(ctToggleEl, {
        opacity: 1, y: 0, duration: 0.62, ease: 'power3.out'
      })
    });
  }

  const ctFieldWraps = document.querySelectorAll('.ct-field-wrap');
  if (ctFieldWraps.length) {
    gsap.set(ctFieldWraps, { opacity: 0, y: 22 });
    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 68%',
      once: true,
      onEnter: () => gsap.to(ctFieldWraps, {
        opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.055
      })
    });
  }

  const ctSendEl = document.querySelector('.ct-row--submit');
  if (ctSendEl) {
    gsap.set(ctSendEl, { opacity: 0 });
    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 55%',
      once: true,
      onEnter: () => gsap.to(ctSendEl, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    });
  }

  const infoTabBtn = document.querySelector('[data-panel="info"]');
  if (infoTabBtn) {
    let infoRevealed = false;
    infoTabBtn.addEventListener('click', () => {
      if (infoRevealed) return;
      infoRevealed = true;
      const infoVals   = document.querySelectorAll('.ct-info-val');
      const infoLabels = document.querySelectorAll('.ct-info-label');
      gsap.set(infoVals,   { clipPath: 'inset(0 0 100% 0)', opacity: 0 });
      gsap.set(infoLabels, { opacity: 0, y: 10 });
      gsap.to(infoVals, {
        clipPath: 'inset(0 0 0% 0)', opacity: 1,
        duration: 0.78, ease: 'power4.out', stagger: 0.1, delay: 0.38
      });
      gsap.to(infoLabels, {
        opacity: 0.3, y: 0,
        duration: 0.62, ease: 'power3.out', stagger: 0.08, delay: 0.28
      });
    });
  }

  if (!isT) {
    document.querySelectorAll('.ht-layer .ht-nav a').forEach(link => {
      link.addEventListener('mouseenter', () =>
        gsap.to(link, { x: 3, duration: 0.26, ease: 'power2.out' }));
      link.addEventListener('mouseleave', () =>
        gsap.to(link, { x: 0, duration: 0.26, ease: 'power2.out' }));
    });

    document.querySelectorAll('.ht-layer .ht-social a').forEach(link => {
      link.addEventListener('mouseenter', () =>
        gsap.to(link, { x: 4, duration: 0.26, ease: 'power2.out' }));
      link.addEventListener('mouseleave', () =>
        gsap.to(link, { x: 0, duration: 0.26, ease: 'power2.out' }));
    });

    const sBtnEl = document.getElementById('servicesBtn');
    if (sBtnEl) {
      sBtnEl.addEventListener('mouseenter', () =>
        gsap.to(sBtnEl, { scale: 1.018, duration: 0.28, ease: 'power2.out' }));
      sBtnEl.addEventListener('mouseleave', () =>
        gsap.to(sBtnEl, { scale: 1, duration: 0.28, ease: 'power2.out' }));
    }

    document.querySelectorAll('.sl-list-item').forEach(item => {
      item.addEventListener('mouseenter', () =>
        gsap.to(item, { x: 5, duration: 0.25, ease: 'power2.out' }));
      item.addEventListener('mouseleave', () =>
        gsap.to(item, { x: 0, duration: 0.25, ease: 'power2.out' }));
    });

    document.querySelectorAll('.sl-project-action-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () =>
        gsap.to(btn, { y: -2, duration: 0.25, ease: 'power2.out' }));
      btn.addEventListener('mouseleave', () =>
        gsap.to(btn, { y: 0, duration: 0.25, ease: 'power2.out' }));
    });

    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('mouseenter', () =>
        gsap.to(item, { x: 4, duration: 0.22, ease: 'power2.out' }));
      item.addEventListener('mouseleave', () =>
        gsap.to(item, { x: 0, duration: 0.22, ease: 'power2.out' }));
    });
  }

  if (!isT && heroName) {
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8,
      onUpdate: (self) => {
        gsap.set(heroName, { y: self.progress * -65 });
      }
    });
  }

  const observerForReveal = new MutationObserver(() => {});

  const openSliderOrig = window.openSlider;
  if (typeof openSliderOrig === 'function') {
    window.openSlider = function(type) {
      openSliderOrig(type);
      if (!isT) {
        setTimeout(() => {
          document.querySelectorAll('.sl-list-item').forEach(item => {
            item.addEventListener('mouseenter', () =>
              gsap.to(item, { x: 5, duration: 0.25, ease: 'power2.out' }));
            item.addEventListener('mouseleave', () =>
              gsap.to(item, { x: 0, duration: 0.25, ease: 'power2.out' }));
          });
        }, 80);
      }

      // Slider content updates dynamically; re-init word reveals inside it.
      setTimeout(() => {
        const left = document.getElementById('sliderLeftContent');
        if (left) initRaaviTextReveals(left);
      }, 0);
    };
  }

})();
