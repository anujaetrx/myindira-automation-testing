import { _android as android, type AndroidDevice, type BrowserContext } from '@playwright/test';
import { androidConfig } from '@config/android.config';
import { Logger } from '@utils/logger/Logger';
import { AdbClient } from './AdbClient';
import { prepareChrome } from './ChromeSetup';

export interface AndroidSession {
  device: AndroidDevice;
  serial: string;
  adb: AdbClient;
}

const log = Logger.for('AndroidDevices');

/**
 * Connects Playwright to a real device or emulator over ADB.
 * Selection: ANDROID_SERIAL if set; otherwise the only attached device; otherwise an explicit error.
 */
export const AndroidDevices = {
  async connect(): Promise<AndroidSession> {
    const adb = new AdbClient();
    const ready = await adb.readyDevices();

    if (ready.length === 0) {
      const all = await adb.devices();
      const hint = all.length
        ? `Found but not ready: ${all.map((d) => `${d.serial} (${d.state})`).join(', ')}. ` +
          `"unauthorized" = accept the USB-debugging prompt on the phone; "offline" = reconnect the cable.`
        : 'No devices attached. Start an emulator (npm run android:emulator) or connect a phone with USB debugging on.';
      throw new Error(`No Android device available. ${hint}`);
    }
    if (!androidConfig.serial && ready.length > 1) {
      throw new Error(`Several devices attached (${ready.map((d) => d.serial).join(', ')}). Set ANDROID_SERIAL to choose one.`);
    }

    const devices = await android.devices();
    const device = androidConfig.serial
      ? devices.find((d) => d.serial() === androidConfig.serial)
      : devices[0];
    if (!device) {
      throw new Error(`Playwright could not attach to ${androidConfig.serial ?? 'the device'}. Attached: ${devices.map((d) => d.serial()).join(', ')}`);
    }

    log.info(`Connected to ${device.model()} (${device.serial()})`);
    const session: AndroidSession = { device, serial: device.serial(), adb };
    await prepareChrome(session);
    return session;
  },

  /** Launches Chrome under Playwright's control. Closing the returned context releases Chrome again. */
  launchChrome(
    session: AndroidSession,
    options: Parameters<AndroidDevice['launchBrowser']>[0] = {},
  ): Promise<BrowserContext> {
    return session.device.launchBrowser({ pkg: androidConfig.chromePackage, ...options });
  },
};
