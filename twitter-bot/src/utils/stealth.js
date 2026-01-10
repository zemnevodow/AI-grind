/**
 * Stealth патчи для скрытия автоматизации
 * Применяются через context.addInitScript()
 */

export const stealthScripts = `
// 1. Скрываем navigator.webdriver (агрессивный подход)
// Способ 1: Переопределяем на всех уровнях
const webdriverDescriptor = {
  get: () => undefined,
  set: () => {},
  configurable: true,
  enumerable: false,
};

try {
  Object.defineProperty(navigator, 'webdriver', webdriverDescriptor);
} catch (e) {}

try {
  Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', webdriverDescriptor);
} catch (e) {}

try {
  Object.defineProperty(Navigator.prototype, 'webdriver', webdriverDescriptor);
} catch (e) {}

// Способ 2: Proxy для navigator
const originalNavigator = navigator;
const navigatorProxy = new Proxy(originalNavigator, {
  get: (target, prop) => {
    if (prop === 'webdriver') return undefined;
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
  has: (target, prop) => {
    if (prop === 'webdriver') return false;
    return prop in target;
  },
});

// Пытаемся заменить navigator (не всегда работает)
try {
  Object.defineProperty(window, 'navigator', {
    get: () => navigatorProxy,
    configurable: true,
  });
} catch (e) {}

// Способ 3: Удаляем из цепочки прототипов
try {
  delete Navigator.prototype.webdriver;
} catch (e) {}

// 2. Подменяем navigator.plugins (создаём правильный PluginArray)
const makePluginArray = () => {
  const pluginData = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
  ];

  const pluginArray = Object.create(PluginArray.prototype);

  pluginData.forEach((p, i) => {
    const plugin = Object.create(Plugin.prototype);
    Object.defineProperties(plugin, {
      name: { value: p.name, enumerable: true },
      filename: { value: p.filename, enumerable: true },
      description: { value: p.description, enumerable: true },
      length: { value: p.length, enumerable: true },
    });
    pluginArray[i] = plugin;
  });

  Object.defineProperties(pluginArray, {
    length: { value: pluginData.length, enumerable: true },
    item: { value: (i) => pluginArray[i] || null },
    namedItem: { value: (n) => Array.from(pluginArray).find(p => p.name === n) || null },
    refresh: { value: () => {} },
  });

  return pluginArray;
};

Object.defineProperty(navigator, 'plugins', {
  get: makePluginArray,
  configurable: true,
});

// 3. Подменяем navigator.languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en', 'ru'],
});

// 4. Добавляем window.chrome
if (!window.chrome) {
  window.chrome = {
    runtime: {
      connect: () => {},
      sendMessage: () => {},
      onMessage: { addListener: () => {} },
    },
    loadTimes: () => ({}),
    csi: () => ({}),
  };
}

// 5. Исправляем permissions API
const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
if (originalQuery) {
  window.navigator.permissions.query = (parameters) => {
    if (parameters.name === 'notifications') {
      return Promise.resolve({ state: Notification.permission });
    }
    return originalQuery(parameters);
  };
}

// 6. Скрываем автоматизацию в User-Agent Client Hints
if (navigator.userAgentData) {
  Object.defineProperty(navigator, 'userAgentData', {
    get: () => ({
      brands: [
        { brand: 'Google Chrome', version: '120' },
        { brand: 'Chromium', version: '120' },
        { brand: 'Not_A Brand', version: '24' },
      ],
      mobile: false,
      platform: 'macOS',
      getHighEntropyValues: () => Promise.resolve({
        architecture: 'x86',
        model: '',
        platform: 'macOS',
        platformVersion: '14.0.0',
        uaFullVersion: '120.0.0.0',
      }),
    }),
  });
}

// 7. Подменяем WebGL renderer (скрываем ANGLE)
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
    return 'Intel Inc.';
  }
  if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
    return 'Intel Iris OpenGL Engine';
  }
  return getParameter.call(this, parameter);
};

const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
WebGL2RenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) {
    return 'Intel Inc.';
  }
  if (parameter === 37446) {
    return 'Intel Iris OpenGL Engine';
  }
  return getParameter2.call(this, parameter);
};

// 8. Консистентный canvas fingerprint
const toDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type) {
  if (type === 'image/png' && this.width === 220 && this.height === 30) {
    // Типичный размер для fingerprint canvas
    return toDataURL.call(this, type);
  }
  return toDataURL.call(this, type);
};

// 9. Скрываем headless признаки
Object.defineProperty(navigator, 'hardwareConcurrency', {
  get: () => 8,
});

Object.defineProperty(navigator, 'deviceMemory', {
  get: () => 8,
});

// 10. Исправляем iframe contentWindow
const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
  get: function() {
    const win = originalContentWindow.get.call(this);
    if (win) {
      try {
        win.navigator.webdriver;
      } catch (e) {}
    }
    return win;
  },
});

console.log('[Stealth] Patches applied');
`;

/**
 * Применить stealth патчи к контексту браузера
 */
export async function applyStealth(context) {
  await context.addInitScript(stealthScripts);
}
