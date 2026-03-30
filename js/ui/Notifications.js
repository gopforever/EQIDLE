export class Notifications {
  constructor() {
    this.container = document.getElementById('notifications-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notifications-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto-remove after 3000ms with slide-out animation
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 400);
    }, 3000);

    return toast;
  }

  info(message) { return this.show(message, 'info'); }
  success(message) { return this.show(message, 'success'); }
  loot(message) { return this.show(message, 'loot'); }
  levelup(message) { return this.show(message, 'levelup'); }
  death(message) { return this.show(message, 'death'); }
  warning(message) { return this.show(message, 'warning'); }
}
