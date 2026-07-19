export type NativeInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export type NativeListen = <T>(
  event: string,
  handler: (event: { payload: T }) => void,
) => Promise<() => void>;

export interface NativeAudioApi {
  invoke: NativeInvoke;
  listen: NativeListen;
}

export type NativeAudioApiLoader = () => Promise<NativeAudioApi | null>;

export async function loadNativeAudioApi(): Promise<NativeAudioApi | null> {
  try {
    const core = await import('@tauri-apps/api/core');
    const event = await import('@tauri-apps/api/event');
    return {
      invoke: core.invoke as NativeInvoke,
      listen: event.listen as NativeListen,
    };
  } catch {
    return null;
  }
}
