/**
 * Desktop/laptop gate for developer-only tools (e.g. walk simulation).
 * Hidden on phones/tablets so real runners never see it.
 */
export function isDesktopLaptop(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return false
  }

  // Prefer pointer/hover capability over width — laptop trackpads qualify.
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const canHover = window.matchMedia('(hover: hover)').matches
  return finePointer && canHover
}
