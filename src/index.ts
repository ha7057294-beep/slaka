import { openDB, requestStoragePersistence } from './db/indexedDB';
import { icons } from './utils/icons';
import { renderDashboardView } from './views/DashboardView';
import { renderCoopsView } from './views/CoopsView';
import { renderCoopDetailView } from './views/CoopDetailView';
import { renderPairsView } from './views/PairsView';
import { renderPairDetailView } from './views/PairDetailView';
import { renderEggsView } from './views/EggsView';
import { renderSquabDetailView } from './views/SquabDetailView';
import { renderBatchDetailView } from './views/BatchDetailView';
import { renderSettingsView } from './views/SettingsView';
import { renderInventoryView } from './views/InventoryView';
import { renderFinancesView } from './views/FinancesView';
import { renderReportsView } from './views/ReportsView';
import { showToast } from './components/Toast';
import { showQuickSearchModal, showPWAInstallGuideModal } from './components/Modal';

// Service Worker Registration for PWA & Update Detection
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered:', reg.scope);

        // Check if there's an update waiting
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                const updateBanner = document.getElementById('pwa-update-banner');
                if (updateBanner) updateBanner.style.display = 'block';
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
  });
}

// Capture BeforeInstallPromptEvent for in-app PWA install button
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  (window as any).deferredPWAInstallPrompt = e;

  const headerInstallBtn = document.getElementById('header-install-btn');
  if (headerInstallBtn) {
    headerInstallBtn.style.display = 'inline-flex';
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  (window as any).deferredPWAInstallPrompt = null;
  const headerInstallBtn = document.getElementById('header-install-btn');
  if (headerInstallBtn) {
    headerInstallBtn.style.display = 'none';
  }
  showToast('تم تثبيت تطبيق مزرعة الحمام بنجاح!', 'success');
});

// Main App Router and State
type ViewName =
  | 'dashboard'
  | 'coops'
  | 'coop_detail'
  | 'pairs'
  | 'pair_detail'
  | 'eggs'
  | 'squab_detail'
  | 'batch_detail'
  | 'inventory'
  | 'finances'
  | 'reports'
  | 'settings';

interface NavigationState {
  view: ViewName;
  params: Record<string, string>;
}

let currentState: NavigationState = {
  view: 'dashboard',
  params: {},
};

async function navigate(view: string, params: Record<string, string> = {}) {
  currentState = {
    view: view as ViewName,
    params,
  };

  updateNavSelection();
  renderCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavSelection() {
  const navButtons = document.querySelectorAll('.bottom-nav .nav-item');
  navButtons.forEach((btn) => {
    const target = (btn as HTMLElement).dataset.target;
    if (
      target === currentState.view ||
      (target === 'coops' &&
        (currentState.view === 'coop_detail' ||
          currentState.view === 'squab_detail' ||
          currentState.view === 'batch_detail' ||
          currentState.view === 'pairs' ||
          currentState.view === 'pair_detail'))
    ) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function renderCurrentView() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:60px 20px;color:var(--text-secondary);gap:8px;">
      <span style="font-weight:700;">جاري التحميل...</span>
    </div>
  `;

  try {
    switch (currentState.view) {
      case 'dashboard':
        await renderDashboardView(mainContent, navigate);
        break;
      case 'coops':
        await renderCoopsView(mainContent, navigate);
        break;
      case 'coop_detail':
        await renderCoopDetailView(mainContent, currentState.params.coopId || '', navigate);
        break;
      case 'pairs':
        await renderPairsView(mainContent, navigate);
        break;
      case 'pair_detail':
        await renderPairDetailView(mainContent, currentState.params.pairId || '', navigate);
        break;
      case 'eggs':
        await renderEggsView(mainContent, navigate);
        break;
      case 'squab_detail':
        await renderSquabDetailView(mainContent, currentState.params.squabId || '', navigate);
        break;
      case 'batch_detail':
        await renderBatchDetailView(mainContent, currentState.params.batchId || '', navigate);
        break;
      case 'inventory':
        await renderInventoryView(mainContent);
        break;
      case 'finances':
        await renderFinancesView(mainContent);
        break;
      case 'reports':
        await renderReportsView(mainContent, navigate);
        break;
      case 'settings':
        await renderSettingsView(mainContent, navigate);
        break;
      default:
        await renderDashboardView(mainContent, navigate);
        break;
    }
  } catch (err: unknown) {
    console.error('Error rendering view:', err);
    mainContent.innerHTML = `
      <div class="card" style="border-color:var(--danger-border);background-color:var(--danger-bg);color:var(--danger);padding:20px;">
        <h3 style="font-weight:800;margin-bottom:8px;">حدث خطأ أثناء عرض الصفحة</h3>
        <p style="font-size:0.9rem;">${err instanceof Error ? err.message : String(err)}</p>
        <button class="btn btn-primary btn-sm" id="btn-reload-view" style="margin-top:12px;">إعادة المحاولة</button>
      </div>
    `;
    mainContent.querySelector('#btn-reload-view')?.addEventListener('click', () => {
      renderCurrentView();
    });
  }
}

// App Initialization
async function initApp() {
  const root = document.getElementById('app');
  if (!root) return;

  // Request Storage Persistence
  requestStoragePersistence().then((persisted) => {
    if (persisted) {
      console.log('IndexedDB storage persistence granted by browser.');
    }
  });

  // Build Shell
  root.innerHTML = `
    <!-- PWA Update Available Banner -->
    <div id="pwa-update-banner" style="display:none;background-color:#059669;color:#FFFFFF;padding:8px 14px;font-size:0.85rem;text-align:center;font-weight:700;">
      <span>يوجد إصدار محدّث متوفر للتطبيق!</span>
      <button id="btn-reload-pwa" style="margin-right:10px;background-color:#FFFFFF;color:#065F46;border:none;border-radius:6px;padding:3px 10px;font-weight:800;font-size:0.8rem;cursor:pointer;">
        تحديث الآن
      </button>
    </div>

    <!-- Offline status notification (shown automatically when offline) -->
    <div id="offline-banner" style="display:none;background-color:#92400E;color:#FFFFFF;padding:6px 12px;font-size:0.8rem;text-align:center;font-weight:700;">
      أنت تعمل بدون اتصال بالإنترنت • جميع البيانات تُحفظ محلياً في جهازك (IndexedDB)
    </div>

    <!-- App Header -->
    <header class="app-header">
      <div class="header-brand" id="brand-click" style="cursor:pointer;">
        <div class="header-icon">
          ${icons.pigeon}
        </div>
        <div class="header-title-wrap">
          <h1>مزرعة الحمام</h1>
          <p>إدارة السلاكات والأزواج والبيض</p>
        </div>
      </div>

      <div class="header-actions">
        <!-- Global Quick Search button -->
        <button class="btn btn-outline btn-icon-only" id="header-search-btn" title="بحث سريع (سلاكة، زوج، زغلول، دفعة)">
          ${icons.search}
        </button>

        <!-- PWA install button in header -->
        <button class="btn btn-primary btn-sm" id="header-install-btn" style="font-size:0.82rem;padding:6px 10px;min-height:36px;display:inline-flex;">
          ${icons.download} تثبيت
        </button>

        <!-- Settings shortcut button -->
        <button class="btn btn-outline btn-icon-only" id="header-settings-btn" title="الإعدادات">
          ${icons.settings}
        </button>
      </div>
    </header>

    <!-- Main Dynamic Content Container -->
    <main id="main-content" class="main-content"></main>

    <!-- Bottom Navigation Bar (Mobile First) -->
    <nav class="bottom-nav">
      <button class="nav-item active" data-target="dashboard">
        ${icons.home}
        <span>الرئيسية</span>
      </button>

      <button class="nav-item" data-target="coops">
        ${icons.coop}
        <span>السلاكات</span>
      </button>

      <button class="nav-item" data-target="inventory">
        ${icons.grain}
        <span>المخزون</span>
      </button>

      <button class="nav-item" data-target="finances">
        ${icons.wallet}
        <span>المالية</span>
      </button>

      <button class="nav-item" data-target="reports">
        ${icons.stats || '📊'}
        <span>التقارير</span>
      </button>

      <button class="nav-item" data-target="settings">
        ${icons.settings}
        <span>الإعدادات</span>
      </button>
    </nav>
  `;

  // Reload PWA button handler
  document.getElementById('btn-reload-pwa')?.addEventListener('click', () => {
    window.location.reload();
  });

  // Offline status listener
  const offlineBanner = document.getElementById('offline-banner');
  const updateOnlineStatus = () => {
    if (offlineBanner) {
      offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
    }
  };
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Navigation handlers
  document.querySelectorAll('.bottom-nav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.target;
      if (target) navigate(target);
    });
  });

  document.getElementById('brand-click')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('header-settings-btn')?.addEventListener('click', () => navigate('settings'));
  document.getElementById('header-search-btn')?.addEventListener('click', () => showQuickSearchModal(navigate));

  // Header install action
  document.getElementById('header-install-btn')?.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          showToast('تم قبول التثبيت!', 'success');
        }
        deferredPrompt = null;
      });
    } else {
      // Show PWA manual installation guide modal for iOS / Android / Desktop
      showPWAInstallGuideModal();
    }
  });

  // Render initial view
  renderCurrentView();
}

document.addEventListener('DOMContentLoaded', initApp);
