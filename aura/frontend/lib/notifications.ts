import { toast } from 'sonner';

function canShowToast() {
  if (typeof window === 'undefined') return true;

  try {
    const raw = window.localStorage.getItem('aura-notification-preferences');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { push?: boolean };
    return parsed.push !== false;
  } catch {
    return true;
  }
}

export function notifySuccess(title: string, description?: string) {
  if (!canShowToast()) return;
  toast.success(title, { description });
}

export function notifyError(title: string, description?: string) {
  if (!canShowToast()) return;
  toast.error(title, { description });
}

export function notifyInfo(title: string, description?: string) {
  if (!canShowToast()) return;
  toast(title, { description });
}

export function notifyWarning(title: string, description?: string) {
  if (!canShowToast()) return;
  toast.warning(title, { description });
}
