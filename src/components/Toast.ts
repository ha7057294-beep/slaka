import { icons } from '../utils/icons';

let toastContainer: HTMLElement | null = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3500) {
  ensureContainer();
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success' ? icons.check : type === 'error' ? icons.alert : icons.info;
  toast.innerHTML = `
    <span style="display:flex;align-items:center;flex-shrink:0;">${iconSvg}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}
