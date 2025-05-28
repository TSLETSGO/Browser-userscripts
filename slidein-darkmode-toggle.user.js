// ==UserScript==
// @name        Slide-In Dark Mode Toggle Button
// @namespace   https://github.com/TSLETSGO/Browser-userscripts
// @match       *://*/*
// @grant       none
// @version     1.7
// @author      TSLETSGO
// @run-at      document-body
// @downloadURL https://github.com/TSLETSGO/YOUR_REPO_NAME/raw/master/slidein-darkmode-toggle.user.js
// @updateURL https://github.com/TSLETSGO/Browser-userscripts/raw/master/slidein-darkmode-toggle.user.js
// ==/UserScript==

// Persistent preference
let isDarkMode = localStorage.getItem('darkmode-toggle') === 'true';

// -- Original logic preserved
const observerConfig = { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] };
const isLight = elem => {
  let m = getComputedStyle(elem, null).getPropertyValue('background-color')?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return true;
  let [r, g, b, a] = [m[1], m[2], m[3], m[4]].map(Number);
  if (isNaN(a)) a = 1;
  r = ((1 - a) * 255) + (a * r);
  g = ((1 - a) * 255) + (a * g);
  b = ((1 - a) * 255) + (a * b);
  return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)) > 127.5;
};
let invertedMap = [];
const checkBgImage = (bg) => bg && bg.split(',').some(bg => bg.includes('url('));
const checkBgTag = new Set(['DIV', 'HEADER', 'FOOTER', 'NAV', 'SECTION', 'MAIN']);
const mustRevertTags = new Set(['IMG', 'IMAGE', 'CANVAS', 'VIDEO', 'IFRAME']);
const fixInvert = el => {
  const tag = el.tagName?.toUpperCase?.();
  if (!tag || tag === 'BODY' || tag === 'SLOT' || !(el instanceof Element) || !el.isConnected) return;
  if (mustRevertTags.has(tag) || (checkBgTag.has(tag) && !isLight(el)) ||
      checkBgImage(el.style?.backgroundImage) ||
      checkBgImage(getComputedStyle(el, null)['background-image'])) {
    invertedMap = invertedMap.filter(ref => !Object.is(el, ref.deref?.()));
    if (invertedMap.some(ref => ref.deref()?.contains?.(el))) {
      el.style.filter = null;
    } else {
      invertedMap.push(new WeakRef(el));
      el.style.filter = isDarkMode ? 'invert(1) contrast(1.15) saturate(1.05)' : null;
    }
  }
};
const trackedShadowElems = new WeakSet();
let modified = new Set();
let chain = Promise.resolve();
const selector = [...checkBgTag, ...mustRevertTags].map(t => t.toLowerCase()).join(',');
const observer = new MutationObserver((records) => {
  if (modified.size === 0) {
    chain = chain.then(
      () => {
        const elems = modified;
        modified = new Set();
        for (let elem of elems.values()) {
          fixInvert(elem);
          if (!elem.tagName?.includes?.('-') || !elem.shadowRoot || trackedShadowElems.has(elem)) continue;
          trackedShadowElems.add(elem);
        }
      },
      () => console.error
    );
  }
  for (const {target, addedNodes} of records) {
    modified.add(target);
    for (const elem of addedNodes) modified.add(elem);
    for (const elem of target.querySelectorAll(selector)) modified.add(elem);
  }
});

function applyDarkMode(enable) {
  document.documentElement.style.filter = enable
    ? 'invert(0.92) brightness(0.9) contrast(1.1)'
    : '';
  if (enable) {
    Array.from(document.querySelectorAll('body *')).forEach(fixInvert);
    observer.observe(document.body, observerConfig);
  } else {
    observer.disconnect();
    invertedMap.forEach(ref => {
      const style = ref.deref()?.style;
      if (style) style.filter = null;
    });
    invertedMap = [];
  }
}

// --- Expanding line + "ON/OFF", flush right ---
function createExpandingToggleButton() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '2em',
    right: '0',
    zIndex: 999999,
    width: '78px', // Enough for button + line + hover leeway
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',  // button is left of line, both are right-aligned
    pointerEvents: 'auto',
    background: 'transparent',
  });

  // The vertical line, always at the right edge
  const line = document.createElement('div');
  Object.assign(line.style, {
    width: '5px',
    height: '28px',
    background: isDarkMode ? '#1e90ff' : '#191919',
    borderRadius: '0 4px 4px 0',
    marginRight: '0',       // flush with window edge
    marginLeft: '0',
    transition: 'background 0.2s',
    pointerEvents: 'auto',
    cursor: 'pointer',
    boxShadow: '0 0 6px rgba(0,0,0,0.12)',
    order: '2', // ensure it is after the button in container
  });

  // The button -- square, rounded corners, ON/OFF
  const button = document.createElement('button');
  button.innerHTML = isDarkMode ? "ON" : "OFF";
  styleButton(button, isDarkMode);
  Object.assign(button.style, {
    width: '38px',
    height: '32px',
    fontWeight: 'bold',
    fontFamily: "sans-serif",
    fontSize: '15px',
    border: 'none',
    borderRadius: '0.6em',
    opacity: '0',
    marginRight: '6px', // space to left
    marginLeft: '0',
    transform: 'translateX(20px) scale(0.7)', // start hidden, behind the line
    transition: 'opacity 0.20s, transform 0.22s, background 0.18s, color 0.18s, border-radius 0.2s',
    pointerEvents: 'auto',
    outline: 'none',
    userSelect: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textShadow: isDarkMode
      ? '0 1px 2px #222a, 0 0 0 #fff' : '0 1px 1px #000a',
    order: '1',
  });
  button.title = isDarkMode ? 'Dark mode ON. Click to turn OFF.' : 'Dark mode OFF. Click to turn ON.';

  // Show/hide helpers
  function showButton() {
    button.style.opacity = '1';
    button.style.transform = 'translateX(0) scale(1)';
    line.style.background = isDarkMode ? '#1e90ff' : '#0070fb';
  }
  function hideButton() {
    button.style.opacity = '0';
    button.style.transform = 'translateX(20px) scale(0.7)';
    line.style.background = isDarkMode ? '#1e90ff' : '#191919';
  }

  // Hover area is the whole container
  container.addEventListener('mouseenter', showButton);
  container.addEventListener('mouseleave', hideButton);

  // Focus/blur for keyboard accessibility
  button.addEventListener('focus', showButton);
  button.addEventListener('blur', hideButton);

  // Propagate pointer events for inner elements:
  container.style.pointerEvents = 'auto';
  line.style.pointerEvents = 'auto';
  button.style.pointerEvents = 'auto';

  // Clicking the line opens the button and focuses it
  line.addEventListener('click', () => {
    showButton();
    button.focus();
  });

  // Toggle logic
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkmode-toggle', isDarkMode);
    applyDarkMode(isDarkMode);
    styleButton(button, isDarkMode);
    button.innerHTML = isDarkMode ? "ON" : "OFF";
    button.title = isDarkMode ? 'Dark mode ON. Click to turn OFF.' : 'Dark mode OFF. Click to turn ON.';
    // Change line color for visibility
    line.style.background = isDarkMode ? '#1e90ff' : '#191919';
    setTimeout(() => button.blur(), 350);
  });

  container.appendChild(button); // button left
  container.appendChild(line);   // line right (edge-flush)
  document.body.appendChild(container);

  // Start hidden
  hideButton();
}

// Small function for coloring the button according to state
function styleButton(button, on) {
  if (on) {
    button.style.background = "#1e90ff";
    button.style.color = "#fff";
    button.style.boxShadow = "0 4px 16px 0 #1e90ff44";
    button.style.textShadow = '0 1px 2px #222a, 0 0 0 #fff';
  } else {
    button.style.background = "#555";
    button.style.color = "#f0f0f0";
    button.style.boxShadow = "0 2px 8px rgba(0,0,0,0.13)";
    button.style.textShadow = '0 1px 1px #000a';
  }
}

function initialize() {
  applyDarkMode(isDarkMode);
  createExpandingToggleButton();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
