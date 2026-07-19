export interface FullscreenPort {
  toggle(): Promise<void>;
}

export const browserFullscreenPort: FullscreenPort = {
  async toggle() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  },
};
