import type { Page } from '@playwright/test';

export interface FakeMicrophoneDevice {
  deviceId: string;
  label: string;
}

interface FakeMicrophoneOptions {
  denyFirstRequest?: boolean;
  devices?: FakeMicrophoneDevice[];
}

interface FakeMicrophoneControl {
  disconnect(): void;
  requestCount(): number;
  setDevices(devices: FakeMicrophoneDevice[]): void;
}

const DEFAULT_DEVICES: FakeMicrophoneDevice[] = [
  { deviceId: 'preferred-mic', label: 'Preferred microphone' },
  { deviceId: 'fallback-mic', label: 'Fallback microphone' },
];

export async function installFakeMicrophone(
  page: Page,
  options: FakeMicrophoneOptions = {},
) {
  await page.addInitScript(({ denyFirstRequest, initialDevices }) => {
    class FakeTrack extends EventTarget {
      getSettings() {
        return {
          channelCount: 1,
          deviceId: initialDevices[0]?.deviceId ?? '',
          sampleRate: 44_100,
        };
      }

      stop() {}
    }

    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      onstatechange: (() => void) | null = null;
      readonly sampleRate = 44_100;
      state: AudioContextState = 'running';

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }

      createAnalyser() {
        return {
          disconnect() {},
          fftSize: 2048,
          getFloatTimeDomainData(buffer: Float32Array) {
            buffer.fill(0);
          },
          smoothingTimeConstant: 0,
        };
      }

      createMediaStreamSource() {
        return {
          connect() {},
          disconnect() {},
        };
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
    }

    const deviceEvents = new EventTarget();
    let activeTrack: FakeTrack | null = null;
    let devices = initialDevices;
    let denyNext = denyFirstRequest;
    let requests = 0;

    const control: FakeMicrophoneControl = {
      disconnect() {
        activeTrack?.dispatchEvent(new Event('ended'));
      },
      requestCount() {
        return requests;
      },
      setDevices(nextDevices) {
        devices = nextDevices;
        deviceEvents.dispatchEvent(new Event('devicechange'));
      },
    };

    const mediaDevices = {
      addEventListener: deviceEvents.addEventListener.bind(deviceEvents),
      async enumerateDevices() {
        return devices.map((device) => ({
          deviceId: device.deviceId,
          groupId: 'test-group',
          kind: 'audioinput',
          label: device.label,
          toJSON: () => ({ ...device, kind: 'audioinput' }),
        }));
      },
      async getUserMedia() {
        requests += 1;
        if (denyNext) {
          denyNext = false;
          throw new DOMException('Permission denied by test', 'NotAllowedError');
        }
        activeTrack = new FakeTrack();
        return {
          getAudioTracks: () => activeTrack ? [activeTrack] : [],
          getTracks: () => activeTrack ? [activeTrack] : [],
        };
      },
      removeEventListener: deviceEvents.removeEventListener.bind(deviceEvents),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, '__tunerFakeMicrophone', {
      configurable: true,
      value: control,
    });
  }, {
    denyFirstRequest: options.denyFirstRequest ?? false,
    initialDevices: options.devices ?? DEFAULT_DEVICES,
  });
}

export function disconnectFakeMicrophone(page: Page) {
  return page.evaluate(() => {
    (window as typeof window & {
      __tunerFakeMicrophone: FakeMicrophoneControl;
    }).__tunerFakeMicrophone.disconnect();
  });
}

export function fakeMicrophoneRequestCount(page: Page) {
  return page.evaluate(() => (
    window as typeof window & {
      __tunerFakeMicrophone: FakeMicrophoneControl;
    }
  ).__tunerFakeMicrophone.requestCount());
}

export function setFakeMicrophoneDevices(
  page: Page,
  devices: FakeMicrophoneDevice[],
) {
  return page.evaluate((nextDevices) => {
    (window as typeof window & {
      __tunerFakeMicrophone: FakeMicrophoneControl;
    }).__tunerFakeMicrophone.setDevices(nextDevices);
  }, devices);
}
