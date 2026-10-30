import { useEffect } from 'react';

/**
 * 弹窗打开时锁定页面背景滚动。
 *
 * 虽然 App shell 已经是 overflow-hidden，但 iOS Safari 在键盘唤起、
 * 以及弹窗内部的橡皮筋回弹场景下仍可能带动 html/body 一起抖动或滚动，
 * 这里统一兜底锁住 documentElement 与 body。
 */
export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevTouchAction = body.style.touchAction;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevOverflow;
      body.style.touchAction = prevTouchAction;
    };
  }, [locked]);
};

export default useBodyScrollLock;
