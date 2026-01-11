// PWA Installation Manager for MNRFoodBill
class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    this.serviceWorkerRegistration = null;
    this.updateAvailable = false;
    
    this.init();
  }
  
  async init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const swUrl = '/MNRFoodBill/sw.js';
        this.serviceWorkerRegistration = await navigator.serviceWorker.register(swUrl);
        console.log('Service Worker registered at scope:', this.serviceWorkerRegistration.scope);
        
        // Check for updates every 2 hours
        setInterval(() => this.checkForUpdates(), 7200000);
        
        // Listen for updates
        this.setupUpdateListeners();
        
        // Initial update check
        setTimeout(() => this.checkForUpdates(), 5000);
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
    
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });
    
    // App installed event
    window.addEventListener('appinstalled', () => {
      console.log('App installed successfully');
      this.hideInstallButton();
      this.deferredPrompt = null;
      this.showNotification('App installed successfully!', 'success');
    });
    
    // Check if already installed
    this.checkIfInstalled();
    
    // Setup offline/online detection
    this.setupNetworkDetection();
  }
  
  setupUpdateListeners() {
    // Listen for waiting service worker
    if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.addEventListener('updatefound', () => {
        const newWorker = this.serviceWorkerRegistration.installing;
        console.log('New Service Worker found:', newWorker.state);
        
        newWorker.addEventListener('statechange', () => {
          console.log('New Service Worker state:', newWorker.state);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.updateAvailable = true;
            this.showUpdateNotification();
          }
        });
      });
    }
    
    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Controller changed, reloading for update...');
      if (this.updateAvailable) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }
  
  showInstallButton() {
    // Don't show if already installed
    if (this.isStandalone || window.navigator.standalone) {
      return;
    }
    
    let installBtn = document.getElementById('pwaInstallBtn');
    
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwaInstallBtn';
      installBtn.className = 'fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center space-x-3 hover:from-red-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 animate-pulse';
      installBtn.innerHTML = `
        <i class="fas fa-download text-lg"></i>
        <span class="font-bold">Install App</span>
      `;
      
      installBtn.addEventListener('click', () => this.promptInstall());
      document.body.appendChild(installBtn);
    }
    
    installBtn.classList.remove('hidden');
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
      this.hideInstallButton();
    }, 30000);
  }
  
  hideInstallButton() {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
  }
  
  async promptInstall() {
    if (!this.deferredPrompt) {
      this.showNotification('Install feature not available on this device', 'info');
      return;
    }
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    console.log(`User response to install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
      this.showNotification('Installing app...', 'success');
    }
    
    this.deferredPrompt = null;
    this.hideInstallButton();
  }
  
  async checkForUpdates() {
    if (this.serviceWorkerRegistration) {
      try {
        console.log('Checking for updates...');
        await this.serviceWorkerRegistration.update();
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }
  
  showUpdateNotification() {
    // Only show if app is installed
    if (!this.isStandalone && !window.navigator.standalone) {
      return;
    }
    
    // Remove existing notification
    const existing = document.getElementById('updateNotification');
    if (existing) existing.remove();
    
    const updateNotification = document.createElement('div');
    updateNotification.id = 'updateNotification';
    updateNotification.className = 'fixed top-6 right-6 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 animate-slideIn';
    updateNotification.innerHTML = `
      <div class="flex items-center space-x-4">
        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
          <i class="fas fa-sync-alt animate-spin"></i>
        </div>
        <div>
          <p class="font-bold">Update Available!</p>
          <p class="text-sm opacity-90">New version is ready to install</p>
        </div>
        <button id="refreshAppBtn" class="ml-4 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition">
          Update Now
        </button>
      </div>
    `;
    
    document.body.appendChild(updateNotification);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      .animate-slideIn {
        animation: slideIn 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
    
    document.getElementById('refreshAppBtn').addEventListener('click', () => {
      this.refreshApp();
    });
    
    // Auto-refresh after 1 minute if user doesn't click
    setTimeout(() => {
      if (document.getElementById('updateNotification')) {
        this.refreshApp();
      }
    }, 60000);
  }
  
  refreshApp() {
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.waiting) {
      // Send message to waiting service worker
      this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    this.showNotification('Updating app...', 'info');
    
    // Reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
  
  checkIfInstalled() {
    // Check various installation indicators
    const isInstalled = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');
    
    if (isInstalled) {
      console.log('App is already installed');
    }
  }
  
  setupNetworkDetection() {
    // Offline indicator
    window.addEventListener('offline', () => {
      this.showOfflineIndicator();
    });
    
    window.addEventListener('online', () => {
      this.hideOfflineIndicator();
      this.showNotification('Back online', 'success');
    });
    
    // Initial check
    if (!navigator.onLine) {
      this.showOfflineIndicator();
    }
  }
  
  showOfflineIndicator() {
    let indicator = document.getElementById('offlineIndicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offlineIndicator';
      indicator.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-3 z-50 shadow-md';
      indicator.innerHTML = `
        <i class="fas fa-wifi-slash mr-2"></i>
        You are currently offline. Some features may be limited.
      `;
      document.body.appendChild(indicator);
    }
    
    indicator.classList.remove('hidden');
  }
  
  hideOfflineIndicator() {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }
  
  showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.pwa-notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `pwa-notification fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-50 text-white ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 
      type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    notification.innerHTML = `
      <div class="flex items-center space-x-3">
        <i class="fas ${
          type === 'success' ? 'fa-check-circle' : 
          type === 'error' ? 'fa-exclamation-circle' : 
          type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
        }"></i>
        <span class="font-medium">${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on HTTPS or localhost
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    window.pwaManager = new PWAInstallManager();
  } else {
    console.log('PWA features require HTTPS or localhost');
  }
});
