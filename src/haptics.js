import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// .catch so it silently does nothing where haptics aren't available
export const tap = () =>
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
export const success = () =>
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
export const warn = () =>
  Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
