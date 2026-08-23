/**
 * Local notification delivery.
 *
 * `showNotification` via the service worker is preferred (it survives the tab
 * being backgrounded), with a constructor fallback. Neither path may hang: the
 * previous version awaited `navigator.serviceWorker.ready`, which never resolves
 * when no service worker is registered, so notifications silently never fired.
 */

const SW_READY_TIMEOUT_MS = 3000;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

export function notificationPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}

/** Resolves the SW registration, or null if none arrives promptly. */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // `ready` never settles without a registration, so it is raced against a timeout.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const baseOptions: NotificationOptions = {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    ...options,
  };

  const registration = await readyRegistration();
  if (registration) {
    try {
      await registration.showNotification(title, baseOptions);
      return true;
    } catch (err) {
      console.warn('Service worker notification failed, falling back:', err);
    }
  }

  // Fallback path — reached when there is no service worker, which previously
  // hung forever instead.
  try {
    new Notification(title, baseOptions);
    return true;
  } catch (err) {
    console.warn('Notification could not be shown:', err);
    return false;
  }
}
