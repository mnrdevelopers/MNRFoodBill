// PWA Installation and Update Management
class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    this.serviceWorkerRegistration = null;
    
    this.init();
  }
  
  async init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered:', this.serviceWorkerRegistration);
        
        // Check for updates every hour
        setInterval(() => this.checkForUpdates(), 3600000);
        
        // Listen for controller change (update installed)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('New Service Worker controlling the page');
          this.showUpdateReadyNotification();
        });
        
        // Listen for waiting service worker
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          const newWorker = this.serviceWorkerRegistration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateReadyNotification();
            }
          });
        });
        
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
    
    // Check if app is already installed
    window.addEventListener('appinstalled', () => {
      console.log('App installed successfully');
      this.hideInstallButton();
      this.deferredPrompt = null;
    });
  }
  
  showInstallButton() {
    let installBtn = document.getElementById('pwaInstallBtn');
    
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwaInstallBtn';
      installBtn.className = 'fixed bottom-4 right-4 bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center space-x-2 hover:from-red-600 hover:to-orange-600 transition-all duration-300 animate-bounce';
      installBtn.innerHTML = `
        <i class="fas fa-download"></i>
        <span>Install App</span>
      `;
      
      installBtn.addEventListener('click', () => this.promptInstall());
      document.body.appendChild(installBtn);
    }
    
    installBtn.classList.remove('hidden');
  }
  
  hideInstallButton() {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
  }
  
  async promptInstall() {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    this.deferredPrompt = null;
    this.hideInstallButton();
  }
  
  async checkForUpdates() {
    if (this.serviceWorkerRegistration) {
      try {
        await this.serviceWorkerRegistration.update();
        console.log('Checked for updates');
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }
  
  showUpdateReadyNotification() {
    if (!this.isStandalone) return;
    
    const updateNotification = document.createElement('div');
    updateNotification.id = 'updateNotification';
    updateNotification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-4';
    updateNotification.innerHTML = `
      <i class="fas fa-sync-alt animate-spin"></i>
      <div>
        <p class="font-bold">Update Available</p>
        <p class="text-sm">New version is ready!</p>
      </div>
      <button id="refreshAppBtn" class="bg-white text-blue-500 px-4 py-1 rounded font-bold hover:bg-gray-100">
        Refresh
      </button>
    `;
    
    document.body.appendChild(updateNotification);
    
    document.getElementById('refreshAppBtn').addEventListener('click', () => {
      this.refreshApp();
    });
    
    // Auto-refresh after 30 seconds if user doesn't click
    setTimeout(() => {
      if (document.getElementById('updateNotification')) {
        this.refreshApp();
      }
    }, 30000);
  }
  
  refreshApp() {
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.waiting) {
      // Send message to waiting service worker to skip waiting
      this.serviceWorkerRegistration.waiting.postMessage('skipWaiting');
    }
    
    // Reload the page
    window.location.reload();
  }
  
  isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }
}

// Initialize PWA Manager
let pwaManager;

document.addEventListener('DOMContentLoaded', () => {
  pwaManager = new PWAInstallManager();
});

// Export for global access
window.pwaManager = pwaManager;
