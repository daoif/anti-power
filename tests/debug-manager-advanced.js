const { chromium } = require('playwright');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log('[INFO] Fetching WebSocket URL...');

  let wsUrl;
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const info = await response.json();
    wsUrl = info.webSocketDebuggerUrl;
  } catch (err) {
    console.error('[ERROR] Failed to fetch WebSocket URL:', err?.message || err);
    process.exit(1);
  }

  if (!wsUrl) {
    console.error('[ERROR] No WebSocket URL found. Is Antigravity running with --remote-debugging-port=9222?');
    process.exit(1);
  }

  console.log('[INFO] WebSocket URL:', wsUrl);

  const browser = await chromium.connectOverCDP(wsUrl);
  const contexts = browser.contexts();
  const allPages = [];
  const candidates = [];
  let managerPage = null;

  for (const context of contexts) {
    const pages = context.pages();
    for (const page of pages) {
      const title = await page.title().catch(() => '');
      const url = page.url();
      allPages.push({ page, title, url });
    }
  }

  console.log('[INFO] Available pages:');
  allPages.forEach((info, index) => {
    const label = info.title ? info.title : '(no title)';
    console.log(`  [${index}] ${label} - ${info.url}`);
  });

  for (const info of allPages) {
    if (!info.url.includes('workbench-jetski-agent.html') && !info.title.includes('Manager')) {
      continue;
    }

    const metrics = await info.page
      .evaluate(() => {
        const contentCount = document.querySelectorAll('.leading-relaxed.select-text').length;
        const hasManagerPanelScript = !!document.querySelector('script[src*="manager-panel/manager-panel.js"]');
        const hasManagerPanelCss = !!document.querySelector('link[href*="manager-panel/manager-panel.css"]');
        return { contentCount, hasManagerPanelScript, hasManagerPanelCss };
      })
      .catch(() => ({ contentCount: 0, hasManagerPanelScript: false, hasManagerPanelCss: false }));

    let score = 0;
    if (info.title.includes('Manager')) score += 6;
    if (info.url.includes('workbench-jetski-agent.html')) score += 4;
    if (metrics.contentCount > 0) score += Math.min(metrics.contentCount, 5);
    if (metrics.hasManagerPanelScript) score += 2;
    if (metrics.hasManagerPanelCss) score += 1;

    candidates.push({ ...info, ...metrics, score });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    managerPage = candidates[0].page;
    console.log('[INFO] Selected Manager candidate:', candidates[0].title || '(no title)');
    console.log('[INFO] URL:', candidates[0].url);
    console.log('[INFO] Score:', candidates[0].score, 'Content:', candidates[0].contentCount);
  }

  if (!managerPage) {
    console.error('[ERROR] Manager page not found. Make sure the Manager window is open.');
    await browser.close();
    process.exit(1);
  }

  const consoleLogs = [];
  const pageErrors = [];

  managerPage.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      consoleLogs.push({ type, text });
    }
  });

  managerPage.on('pageerror', (error) => {
    pageErrors.push({ message: error.message });
  });

  console.log('[INFO] Collecting snapshot...');

  const snapshot = await managerPage.evaluate(async () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || null;

    const hasTrustedTypes = typeof window.trustedTypes !== 'undefined';
    let policies = [];
    if (hasTrustedTypes && window.trustedTypes.getPolicyNames) {
      try {
        policies = window.trustedTypes.getPolicyNames();
      } catch {
        policies = [];
      }
    }

    const scripts = Array.from(document.scripts).map((s) => s.src || '[inline]');
    const scriptModules = Array.from(document.querySelectorAll('script[type="module"]')).map((s) => s.src || '[inline]');
    const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href || '[inline]');
    const libScripts = scripts.filter((s) => s.includes('katex') || s.includes('mermaid'));
    const libStyles = stylesheetLinks.filter((s) => s.includes('katex') || s.includes('mermaid'));
    const libScriptDetails = Array.from(document.querySelectorAll('script[src*="katex"], script[src*="mermaid"]')).map((s) => ({
      src: s.src,
      type: s.type || '',
      async: s.async,
      defer: s.defer,
    }));
    const libStyleDetails = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="katex"], link[rel="stylesheet"][href*="mermaid"]')).map((l) => ({
      href: l.href,
      media: l.media || '',
    }));

    const resourceEntries = performance.getEntriesByType('resource');
    const resources = resourceEntries.map((entry) => entry.name);
    const managerResources = resources.filter((name) => name.includes('manager-panel'));
    const libResources = resources.filter((name) => name.includes('katex') || name.includes('mermaid'));
    const libResourceDetails = resourceEntries
      .filter((entry) => entry.name.includes('katex') || entry.name.includes('mermaid'))
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      }));

    const importFlags = {
      hasManagerPanel: managerResources.some((name) => name.includes('manager-panel.js')),
      hasScan: managerResources.some((name) => name.includes('scan.js')),
      hasConstants: managerResources.some((name) => name.includes('constants.js')),
      hasCopy: managerResources.some((name) => name.includes('copy.js')),
      hasMath: managerResources.some((name) => name.includes('math.js')),
      hasMermaid: managerResources.some((name) => name.includes('mermaid.js')),
      hasUtils: managerResources.some((name) => name.includes('utils.js')),
      hasConfig: managerResources.some((name) => name.includes('config.json')),
      hasCss: managerResources.some((name) => name.includes('manager-panel.css')),
    };

    const copyButtons = document.querySelectorAll('.manager-copy-button').length;
    const copyBtnAny = document.querySelectorAll('.manager-copy-btn').length;
    const copyBound = document.querySelectorAll('[data-manager-copy-bound="1"]').length;

    const feedbackCount = document.querySelectorAll('[data-tooltip-id^="up-"], [data-tooltip-id^="down-"]').length;

    const contentNodes = Array.from(document.querySelectorAll('.leading-relaxed.select-text'));
    const mermaidBlocks = Array.from(document.querySelectorAll('pre, code, .code-block')).filter((el) => {
      const text = (el.textContent || '').trim();
      if (!text) return false;
      return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph)/m.test(text);
    });
    const hasMathHint = contentNodes.some((node) => /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/.test(node.textContent || ''));
    const mermaidRendered = document.querySelectorAll('[data-manager-mermaid-rendered="1"]').length;
    const mathRendered = document.querySelectorAll('[data-manager-math-rendered="1"]').length;
    const katexNodes = document.querySelectorAll('.katex, .katex-display, mjx-container').length;
    const contentStats = contentNodes.slice(0, 6).map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        textLen: (el.textContent || '').length,
        innerTextLen: (el.innerText || '').length,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        hasCopyBound: el.getAttribute('data-manager-copy-bound') === '1',
        hasCopyButton: !!el.querySelector('.manager-copy-button'),
        preview: (el.textContent || '').trim().slice(0, 120),
      };
    });

    const visibleContentCount = contentNodes.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }).length;

    const fontSizeVar = document.documentElement?.style?.getPropertyValue('--manager-panel-font-size') || '';

    const libs = {
      hasKatex: !!window.katex,
      katexVersion: window.katex?.version || null,
      hasMermaid: !!window.mermaid,
      mermaidVersion: window.mermaid?.version || window.mermaid?.default?.version || null,
      hasRenderMathInElement: typeof window.renderMathInElement === 'function',
      typeofKatexVar: typeof katex,
      typeofMermaidVar: typeof mermaid,
      selfEqualsWindow: typeof self !== 'undefined' ? self === window : null,
    };
    const amdInfo = {
      hasDefine: typeof window.define === 'function',
      hasRequire: typeof window.require === 'function',
      hasAmd: !!window.define?.amd,
    };
    const commonJsInfo = {
      hasWindowModule: typeof window.module !== 'undefined',
      hasWindowExports: typeof window.exports !== 'undefined',
      moduleExportsType: typeof window.module?.exports,
      typeofModule: typeof module,
      typeofExports: typeof exports,
      typeofRequire: typeof require,
    };

    const scrollInfo = {
      doc: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
      },
    };

    const overflowCandidates = Array.from(document.querySelectorAll('[id^="dmanager-mermaid-"], .manager-mermaid-container'))
      .slice(0, 8)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id || null,
          className: typeof el.className === 'string' ? el.className : el.className?.baseVal || '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        };
      });

    const mermaidSourceSamples = mermaidBlocks.slice(0, 2).map((block) => {
      const lines = Array.from(block.querySelectorAll('.line-content')).map((line) => line.textContent || '');
      return {
        textPreview: (block.textContent || '').trim().slice(0, 200),
        linePreview: lines.join('\n').trim().slice(0, 200),
      };
    });

    const mermaidBlockInfo = mermaidBlocks.slice(0, 4).map((block) => {
      const contentAncestor = block.closest('.leading-relaxed.select-text');
      const sectionAncestor = block.closest('[data-section-index]');
      return {
        hasContentAncestor: !!contentAncestor,
        contentClass: contentAncestor ? (typeof contentAncestor.className === 'string' ? contentAncestor.className : contentAncestor.className?.baseVal || '') : null,
        hasSectionAncestor: !!sectionAncestor,
        sectionIndex: sectionAncestor?.getAttribute('data-section-index') || null,
      };
    });

    const mathHintRe = /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/;
    const mathNodesWithHint = Array.from(document.querySelectorAll('*'))
      .filter((node) => node.childNodes && node.childNodes.length > 0)
      .filter((node) => mathHintRe.test(node.textContent || ''))
      .slice(0, 4)
      .map((node) => ({
        tag: node.tagName,
        className: typeof node.className === 'string' ? node.className : node.className?.baseVal || '',
        hasContentAncestor: !!node.closest?.('.leading-relaxed.select-text'),
        hasSectionAncestor: !!node.closest?.('[data-section-index]'),
      }));

    let mermaidParseResults = [];
    if (window.mermaid?.parse) {
      for (const block of mermaidBlocks.slice(0, 2)) {
        const lines = Array.from(block.querySelectorAll('.line-content')).map((line) => line.textContent || '');
        const source = lines.length > 0 ? lines.join('\n') : block.textContent || '';
        try {
          await window.mermaid.parse(source);
          mermaidParseResults.push({ ok: true });
        } catch (err) {
          mermaidParseResults.push({ ok: false, error: String(err?.message || err) });
        }
      }
    }

    let manualMermaid = null;
    try {
      const mod = await import('./manager-panel/mermaid.js');
      const block = mermaidBlocks[0] || null;
      if (!block || typeof mod.renderMermaid !== 'function') {
        manualMermaid = { ok: false, reason: 'no-mermaid-block-or-function' };
      } else {
        await mod.renderMermaid(block);
        manualMermaid = {
          ok: true,
          rendered: block.getAttribute('data-manager-mermaid-rendered') || null,
          containerExists: !!block.parentElement?.querySelector?.('.manager-mermaid-container'),
        };
      }
    } catch (err) {
      manualMermaid = { ok: false, error: String(err?.message || err) };
    }

    let mermaidRenderProbe = null;
    if (window.mermaid?.render && mermaidBlocks[0]) {
      const lines = Array.from(mermaidBlocks[0].querySelectorAll('.line-content')).map((line) => line.textContent || '');
      const source = lines.length > 0 ? lines.join('\n') : mermaidBlocks[0].textContent || '';
      const temp = document.createElement('div');
      document.body.appendChild(temp);
      try {
        const result = await window.mermaid.render('ap-debug-mermaid', source, temp);
        mermaidRenderProbe = {
          ok: true,
          svgLength: result?.svg?.length || 0,
          hasBindFunctions: typeof result?.bindFunctions === 'function',
        };
      } catch (err) {
        mermaidRenderProbe = { ok: false, error: String(err?.message || err) };
      }
      temp.remove();
      const tempNode = document.getElementById('dap-debug-mermaid');
      if (tempNode) tempNode.remove();
    }

    let manualMath = null;
    try {
      const mod = await import('./manager-panel/math.js');
      const content = contentNodes.find((node) => mathHintRe.test(node.textContent || '')) || null;
      if (!content || typeof mod.renderMath !== 'function') {
        manualMath = { ok: false, reason: 'no-math-content-or-function' };
      } else {
        await mod.renderMath(content);
        manualMath = {
          ok: true,
          rendered: content.getAttribute('data-manager-math-rendered') || null,
          hasKatex: !!window.katex,
          katexScriptCount: document.querySelectorAll('script[src*="katex.min.js"]').length,
        };
      }
    } catch (err) {
      manualMath = { ok: false, error: String(err?.message || err) };
    }

    let katexLoadProbe = null;
    try {
      const utils = await import('./manager-panel/utils.js');
      const constants = await import('./manager-panel/constants.js');
      if (typeof utils.loadScript !== 'function') {
        katexLoadProbe = { ok: false, reason: 'no-loadScript' };
      } else {
        await utils.loadScript(constants.KATEX_JS_URL);
        katexLoadProbe = {
          ok: true,
          hasKatex: !!window.katex,
          scriptCount: document.querySelectorAll('script[src*="katex.min.js"]').length,
        };
      }
    } catch (err) {
      katexLoadProbe = { ok: false, error: String(err?.message || err) };
    }

    let configCheck = null;
    try {
      const configUrl = new URL('manager-panel/config.json', location.href).href;
      const res = await fetch(configUrl, { cache: 'no-store' });
      const text = await res.text();
      configCheck = {
        url: configUrl,
        ok: res.ok,
        status: res.status,
        preview: text.slice(0, 200),
      };
    } catch (err) {
      configCheck = { ok: false, error: String(err?.message || err) };
    }

    return {
      location: location.href,
      readyState: document.readyState,
      csp,
      trustedTypes: {
        supported: hasTrustedTypes,
        hasCreatePolicy: !!window.trustedTypes?.createPolicy,
        hasGetPolicy: !!window.trustedTypes?.getPolicy,
        hasGetPolicyNames: !!window.trustedTypes?.getPolicyNames,
        policies,
      },
      cspHasCdn: csp ? csp.includes('cdn.jsdelivr.net') : false,
      scripts: scripts.filter((s) => s.includes('jetski') || s.includes('manager-panel')),
      libScripts,
      libScriptDetails,
      scriptModules: scriptModules.filter((s) => s.includes('jetski') || s.includes('manager-panel')),
      stylesheetLinks: stylesheetLinks.filter((s) => s.includes('manager-panel')),
      libStyles,
      libStyleDetails,
      managerResources,
      libResources,
      libResourceDetails,
      importFlags,
      copyButtons,
      copyBtnAny,
      copyBound,
      feedbackCount,
      contentCount: contentNodes.length,
      visibleContentCount,
      hasMathHint,
      mermaidBlockCount: mermaidBlocks.length,
      mermaidRendered,
      mathRendered,
      katexNodes,
      libs,
      amdInfo,
      commonJsInfo,
      scrollInfo,
      overflowCandidates,
      mermaidSourceSamples,
      mermaidBlockInfo,
      mathNodesWithHint,
      mermaidParseResults,
      manualMermaid,
      mermaidRenderProbe,
      manualMath,
      katexLoadProbe,
      contentStats,
      fontSizeVar,
      configCheck,
    };
  });

  console.log('[INFO] Snapshot:');
  console.log(JSON.stringify(snapshot, null, 2));

  await sleep(1500);
  const postLoad = await managerPage.evaluate(() => ({
    hasKatex: !!window.katex,
    katexVersion: window.katex?.version || null,
    hasMermaid: !!window.mermaid,
    mermaidVersion: window.mermaid?.version || window.mermaid?.default?.version || null,
  }));
  console.log('[INFO] Post-load libs:', JSON.stringify(postLoad, null, 2));

  console.log('[INFO] Triggering mutation to test observer...');
  await managerPage.evaluate(() => {
    const marker = document.createElement('div');
    marker.setAttribute('data-ap-debug', '1');
    marker.style.display = 'none';
    document.body.appendChild(marker);
    marker.remove();
  });

  await sleep(1000);

  const afterMutation = await managerPage.evaluate(() => ({
    copyButtons: document.querySelectorAll('.manager-copy-button').length,
    copyBtnAny: document.querySelectorAll('.manager-copy-btn').length,
    copyBound: document.querySelectorAll('[data-manager-copy-bound="1"]').length,
  }));

  console.log('[INFO] After mutation stats:');
  console.log(JSON.stringify(afterMutation, null, 2));

  if (consoleLogs.length || pageErrors.length) {
    console.log('[INFO] Console warnings/errors:');
    console.log(JSON.stringify(consoleLogs, null, 2));
    console.log('[INFO] Page errors:');
    console.log(JSON.stringify(pageErrors, null, 2));
  } else {
    console.log('[INFO] No console warnings/errors captured during this run.');
  }

  await browser.close();
})().catch((err) => {
  console.error('[ERROR] Unhandled error:', err?.message || err);
  process.exit(1);
});
