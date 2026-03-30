export class Notifications {
  constructor() {
    this._container = document.getElementById('notifications-container');
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'notifications-container';
      document.body.appendChild(this._container);
    }
  }

  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this._container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }
}
