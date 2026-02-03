/**
 * English and Chinese locale selection
 */

import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const savedLocale = localStorage.getItem('anti-power-locale');
// Use Chinese for zh locales and English otherwise
const systemLocale = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';

/**
 * Use Vue I18n's Composition API for runtime language switching
 */
const i18n = createI18n({
  legacy: false,
  locale: savedLocale || systemLocale,
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export default i18n;
