export const CDP_PORT = 9222

export const ZHIHU_URLS = {
  HOME: 'https://www.zhihu.com/',
  WRITE: 'https://zhuanlan.zhihu.com/write',
} as const

export const ZHIHU_SELECTORS = {
  title: {
    primary: 'textarea[placeholder*="标题"]',
    fallback: '.WriteIndex-titleInput textarea, textarea',
  },
  body: {
    primary: '.public-DraftEditor-content',
    fallback: '[contenteditable="true"]',
  },
  loginProfile: [
    '[data-testid="AppHeader-profile"]',
    'a[href*="/people/"]',
    '.AppHeader-profileEntry-name',
  ],
} as const
