import React from 'react';

interface PageScrollProps {
  children: React.ReactNode;
}

/**
 * 统一的分页滚动容器。
 *
 * 整个 App 现在是一个「定高 shell」（h-[100dvh] + overflow-hidden），
 * 页面级滚动必须发生在 main 内部的这一层容器里，否则：
 *   - 聊天输入框会被长内容挤到屏幕外，需要手动滑到底才能找到；
 *   - 手机底部 tab bar 会遮住最后一屏内容。
 *
 * 内置底部留白 = 手机 tab bar 高度 + iOS 安全区 + 呼吸间距；
 * 桌面端 --tabbar-h 为 0，自动退化为普通间距。
 */
export const PageScroll: React.FC<PageScrollProps> = ({ children }) => (
  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+2rem)]">
    {children}
  </div>
);

export default PageScroll;
