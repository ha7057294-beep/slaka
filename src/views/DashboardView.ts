import {
  calculateFarmStats,
  getEggs,
  getPairs,
  getCoops,
  getAllEvents,
  getSettings,
  getTodayTasks,
  completeTask,
  getLastUndoableAction,
  clearLastUndoableAction,
  exportBackupData,
} from '../db/indexedDB';
import { getEggSchedule, formatDateTimeArabic } from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showLayEggModal,
  showAddCoopModal,
  showRecordFeedPurchaseModal,
  showSnoozeTaskModal,
  showAlertPreferencesModal,
  showUndoModal,
  showQuickSearchModal,
} from '../components/Modal';
import { showToast } from '../components/Toast';

export async function renderDashboardView(
  container: HTMLElement,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [stats, eggs, pairs, coops, events, settings, todayTasks, lastUndoable] = await Promise.all([
    calculateFarmStats(),
    getEggs(),
    getPairs(),
    getCoops(),
    getAllEvents(6),
    getSettings(),
    getTodayTasks(),
    getLastUndoableAction(),
  ]);

  // Check if undo action is within 15 minutes
  const isUndoValid = lastUndoable && (Date.now() - new Date(lastUndoable.timestamp).getTime()) <= 15 * 60 * 1000;

  container.innerHTML = `
    <!-- Top Undo Notification Banner (If an action occurred within 15 minutes) -->
    ${
      isUndoValid && lastUndoable
        ? `
      <div class="card" style="margin-bottom:12px;background:var(--primary-gradient);color:#FFFFFF;border:1px solid #0E6B5C;box-shadow:var(--shadow-card);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background-color:rgba(255,255,255,0.18);color:#FFFFFF;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${icons.undo || '↺'}
            </div>
            <div>
              <div style="font-weight:800;font-size:0.95rem;color:#FFFFFF;">عملية حديثة قابلة للتراجع:</div>
              <div style="font-size:0.82rem;color:rgba(255,255,255,0.85);">${lastUndoable.description}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-sm" id="btn-undo-action" style="background-color:var(--btn-primary-bg);color:#FFFFFF;font-weight:800;padding:6px 14px;border:none;">
              ${icons.undo || ''} تراجع الآن
            </button>
            <button class="btn btn-sm btn-outline text-xs" id="btn-dismiss-undo" style="border-color:rgba(255,255,255,0.35);color:#FFFFFF;padding:6px 10px;">
              إخفاء
            </button>
          </div>
        </div>
      </div>
    `
        : ''
    }

    <!-- Quick Global Search Bar Trigger -->
    <div class="card" id="btn-trigger-search" style="padding:10px 14px;cursor:pointer;background-color:#FFFFFF;border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-secondary);">
        <span style="color:var(--primary);display:flex;align-items:center;">${icons.search}</span>
        <span style="font-size:0.9rem;font-weight:600;">بحث سريع برقم السلاكة، اسم الزوج، كود الزغلول، أو الدفعة...</span>
      </div>
      <span class="badge" style="background-color:var(--surface-muted);color:var(--text-secondary);font-size:0.75rem;">بحث</span>
    </div>

    <!-- Top Navigation Buttons to Main Sections -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:8px;">
      <button class="btn btn-secondary" id="nav-to-coops" style="flex-direction:column;gap:4px;padding:10px 4px;">
        <span style="display:flex;align-items:center;">${icons.coop}</span>
        <span style="font-weight:700;font-size:0.9rem;">السلاكات</span>
        <span class="badge badge-primary">${stats.activeCoops} نشطة</span>
      </button>

      <button class="btn btn-secondary" id="nav-to-eggs" style="flex-direction:column;gap:4px;padding:10px 4px;">
        <span style="display:flex;align-items:center;">${icons.egg}</span>
        <span style="font-weight:700;font-size:0.9rem;">البيض</span>
        <span class="badge badge-warning">${stats.currentIncubatingEggs} بالحضن</span>
      </button>

      <button class="btn btn-secondary" id="nav-to-inventory" style="flex-direction:column;gap:4px;padding:10px 4px;">
        <span style="display:flex;align-items:center;">${icons.grain}</span>
        <span style="font-weight:700;font-size:0.9rem;">المخزون والعلف</span>
        <span class="badge ${stats.lowStockFeedTypesCount ? 'badge-danger' : 'badge-success'}">
          ${stats.totalAvailableFeedKg ?? 0} كجم
        </span>
      </button>

      <button class="btn btn-secondary" id="nav-to-finances" style="flex-direction:column;gap:4px;padding:10px 4px;">
        <span style="display:flex;align-items:center;">${icons.wallet}</span>
        <span style="font-weight:700;font-size:0.9rem;">المالية والمصروفات</span>
        <span class="badge ${(stats.netOperatingProfit ?? 0) >= 0 ? 'badge-success' : 'badge-danger'}">
          ${stats.netOperatingProfit ?? 0} ج.م
        </span>
      </button>

      <button class="btn btn-primary" id="nav-to-reports" style="flex-direction:column;gap:4px;padding:10px 4px;background-color:var(--primary);">
        <span style="display:flex;align-items:center;">${icons.stats || '📊'}</span>
        <span style="font-weight:700;font-size:0.9rem;">التقارير وترتيب الأزواج</span>
        <span class="badge" style="background-color:rgba(0,0,0,0.18);color:#FFFFFF;font-size:0.7rem;">تحليلات شاملة</span>
      </button>
    </div>

    <!-- Quick Action Bar -->
    <div class="card" style="padding:14px;background:var(--primary-gradient);color:#FFFFFF;border:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:6px;">
          ${icons.pigeon}
          تسجيل سريع للإنتاج والعمليات
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button class="btn btn-lg" id="btn-quick-egg" style="background-color:#FFFFFF;color:var(--text-main);font-weight:800;">
          ${icons.plus}
          تسجيل وضع بيض
        </button>
        <button class="btn btn-outline btn-lg" id="btn-quick-purchase" style="border-color:rgba(255,255,255,0.5);color:#FFFFFF;font-weight:800;">
          ${icons.grain}
          شراء وتوريد علف
        </button>
      </div>
    </div>

    <!-- قسم مهام اليوم (المرحلة الخامسة: مع أزرار تم وتذكير لاحقاً وأنواع التنبيهات) -->
    <div class="card" style="border-color:${todayTasks.length > 0 ? 'var(--alert-card-border)' : 'var(--border-subtle)'};background-color:${todayTasks.length > 0 ? 'var(--alert-card-bg)' : 'var(--surface)'};">
      <div class="card-header" style="border-color:${todayTasks.length > 0 ? 'var(--alert-card-border)' : 'var(--border-subtle)'};">
        <div class="card-title" style="color:${todayTasks.length > 0 ? 'var(--alert-card-text)' : 'var(--text-main)'};">
          <span style="color:var(--alert-icon);display:flex;align-items:center;">${icons.tasks}</span>
          مهام وتنبيهات اليوم (${todayTasks.length})
        </div>
        <button type="button" class="btn btn-sm btn-outline text-xs" id="btn-alert-prefs" style="padding:4px 8px;">
          ${icons.settings || ''} أنواع التنبيهات
        </button>
      </div>

      ${
        todayTasks.length === 0
          ? `
        <div class="empty-state" style="padding:20px 14px;">
          <div class="empty-icon" style="color:var(--primary);">${icons.check}</div>
          <div class="empty-title" style="font-size:0.98rem;">لا توجد مهام أو تنبيهات معلقة اليوم</div>
          <div class="empty-desc" style="font-size:0.82rem;">المخزون آمن، ولا يوجد بيض متأخر عن الفحص أو الفقس، ولا زغاليل مؤهلة للنقل أو البيع حالياً.</div>
        </div>
      `
          : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${todayTasks
            .map((task) => {
              let badgeColor = 'var(--badge-squab-text)';
              let badgeBg = 'var(--badge-squab-bg)';
              let badgeLabel = 'مهمة';
              let iconSvg = icons.calendar;

              if (task.type === 'fertility_check') {
                badgeColor = 'var(--badge-egg-text)';
                badgeBg = 'var(--badge-egg-bg)';
                badgeLabel = 'فحص تخصيب';
                iconSvg = icons.egg;
              } else if (task.type === 'hatch_expected') {
                badgeColor = 'var(--badge-active-text)';
                badgeBg = 'var(--badge-active-bg)';
                badgeLabel = 'موعد فقس';
                iconSvg = icons.squab;
              } else if (task.type === 'egg_laying_expected') {
                badgeColor = 'var(--badge-egg-text)';
                badgeBg = 'var(--badge-egg-bg)';
                badgeLabel = 'وضع بيض متوقع';
                iconSvg = icons.egg;
              } else if (task.type === 'ready_for_transfer') {
                badgeColor = 'var(--badge-transfer-text)';
                badgeBg = 'var(--badge-transfer-bg)';
                badgeLabel = 'جاهز للنقل (20 يوم)';
                iconSvg = icons.truck;
              } else if (task.type === 'ready_for_sale') {
                badgeColor = 'var(--sale-val)';
                badgeBg = 'var(--sale-icon-bg)';
                badgeLabel = 'جاهز للبيع (30+ يوم)';
                iconSvg = icons.cash;
              } else if (task.type === 'low_feed_stock') {
                badgeColor = 'var(--expense-val)';
                badgeBg = 'var(--expense-icon-bg)';
                badgeLabel = 'مخزون منخفض!';
                iconSvg = icons.grain;
              } else if (task.type === 'backup_reminder') {
                badgeColor = 'var(--primary)';
                badgeBg = 'var(--primary-light)';
                badgeLabel = 'نسخ احتياطي';
                iconSvg = icons.database || icons.shieldCheck || icons.calendar;
              }

              return `
              <div class="task-card-item" data-task-id="${task.id}" data-task-type="${task.type}" data-coop-id="${task.coopId || ''}" data-batch-id="${task.batchId || ''}" data-pair-id="${task.pairId || ''}" style="background-color:#FFFFFF;border:1px solid ${task.isUrgent ? 'var(--alert-card-border)' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:8px;transition:all 0.15s ease;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                  <div class="task-click-target" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;">
                    <div style="width:36px;height:36px;border-radius:var(--radius-md);background-color:${badgeBg};color:${badgeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                      ${iconSvg}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;">
                      <div style="font-weight:700;font-size:0.9rem;color:var(--text-main);">
                        ${task.title}
                      </div>
                      <div style="font-size:0.75rem;color:var(--text-secondary);">
                        ${task.subtitle}
                      </div>
                    </div>
                  </div>

                  <span class="badge" style="background-color:${badgeBg};color:${badgeColor};font-size:0.7rem;flex-shrink:0;">
                    ${badgeLabel}
                  </span>
                </div>

                <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;padding-top:6px;border-top:1px dashed #E5E7EB;">
                  <button type="button" class="btn btn-sm btn-outline text-xs btn-snooze-task" data-task-id="${task.id}" style="padding:3px 8px;font-size:0.75rem;">
                    ⏰ تذكير لاحقاً
                  </button>
                  <button type="button" class="btn btn-sm text-xs btn-complete-task" data-task-id="${task.id}" style="padding:3px 10px;font-size:0.75rem;background-color:#059669;color:#FFFFFF;border:none;">
                    ✓ تم
                  </button>
                  <button type="button" class="btn btn-sm btn-outline text-xs task-click-target" style="padding:3px 8px;font-size:0.75rem;">
                    ${task.type === 'low_feed_stock' ? 'المخزون' : task.batchId ? 'الدفعة' : task.pairId ? 'الزوج' : 'السلاكة'} ←
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    </div>

    <!-- Live Calculated Stats Cards (المرحلة الخامسة: محسوبة من البيانات الفعلية) -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
      <h2 style="font-size:1.05rem;font-weight:800;color:var(--text-main);">إحصائيات المزرعة الحالية</h2>
      <button type="button" class="btn btn-sm btn-outline text-xs" id="btn-quick-reports" style="padding:4px 8px;">
        ${icons.stats || ''} تقارير تفصيلية
      </button>
    </div>

    <div class="stats-grid">
      <!-- 1. Coops Stat (المرحلة الخامسة: الإجمالي، المشغولة، الفارغة، المتوقفة) -->
      <div class="stat-box" style="cursor:pointer;" id="stat-card-coops">
        <div class="stat-header">
          <span>السلاكات</span>
          <div class="stat-icon" style="background-color:var(--primary-light);color:var(--primary);">${icons.coop}</div>
        </div>
        <div class="stat-num">${stats.totalCoops}</div>
        <div class="stat-desc">
          مشغولة: <strong>${stats.occupiedCoops}</strong> • فارغة: <strong>${stats.emptyCoops}</strong> • متوقفة: ${stats.inactiveCoops}
        </div>
      </div>

      <!-- 2. Pairs & Total Living Birds Stat (المرحلة الخامسة: الأزواج النشطة، وإجمالي الحمام الموجود) -->
      <div class="stat-box" style="cursor:pointer;" id="stat-card-pairs">
        <div class="stat-header">
          <span>الأزواج النشطة</span>
          <div class="stat-icon" style="background-color:var(--badge-squab-bg);color:var(--badge-squab-text);">${icons.pair}</div>
        </div>
        <div class="stat-num">${stats.activePairs}</div>
        <div class="stat-desc">
          إجمالي الحمام الموجود بالمزرعة: <strong style="color:var(--primary);">${stats.totalLivingBirds} طائر</strong> (يشمل الأمهات والزغاليل)
        </div>
      </div>

      <!-- 3. Incubating Eggs & 3-Days Hatch Stat (المرحلة الخامسة: البيض الموجود حالياً، والمتوقع فقسه خلال 3 أيام) -->
      <div class="stat-box" style="cursor:pointer;" id="stat-card-eggs">
        <div class="stat-header">
          <span>البيض بالحضانة</span>
          <div class="stat-icon" style="background-color:var(--badge-egg-bg);color:var(--badge-egg-text);">${icons.egg}</div>
        </div>
        <div class="stat-num">${stats.currentIncubatingEggs}</div>
        <div class="stat-desc">
          متوقع فقسه خلال 3 أيام: <strong style="color:var(--badge-egg-text);">${stats.eggsHatchingIn3Days} بيضة</strong>
        </div>
      </div>

      <!-- 4. Squabs Breakdown Stat (المرحلة الخامسة: الحية في الإنتاج، الحية في التجميع، والواصلة للبيع) -->
      <div class="stat-box">
        <div class="stat-header">
          <span>الزغاليل الحية</span>
          <div class="stat-icon" style="background-color:var(--sale-icon-bg);color:var(--sale-val);">${icons.squab}</div>
        </div>
        <div class="stat-num" style="color:var(--sale-val);">${stats.liveSquabsProduction + stats.liveSquabsCollection}</div>
        <div class="stat-desc">
          في الإنتاج: <strong>${stats.liveSquabsProduction}</strong> • في التجميع: <strong>${stats.liveSquabsCollection}</strong> • بعمر البيع: <strong style="color:var(--sale-val);">${stats.readyForSaleSquabs}</strong>
        </div>
      </div>

      <!-- 5. Feed Stock Stat (المرحلة الخامسة: الرصيد الكلي المتوفر، ومتوسط الاستهلاك اليومي) -->
      <div class="stat-box" style="cursor:pointer;" id="stat-card-feed">
        <div class="stat-header">
          <span>مخزون واستهلاك العلف</span>
          <div class="stat-icon" style="background-color:var(--badge-egg-bg);color:var(--warning-status);">${icons.grain}</div>
        </div>
        <div class="stat-num" style="color:${stats.lowStockFeedTypesCount ? 'var(--danger)' : 'var(--text-main)'};">
          ${stats.totalAvailableFeedKg ?? 0} <span style="font-size:0.85rem;font-weight:normal;">كجم متاح</span>
        </div>
        <div class="stat-desc">
          متوسط الاستهلاك اليومي: <strong>${stats.averageDailyFeedConsumptionKg ?? 0} كجم</strong>
        </div>
      </div>

      <!-- 6. Finances Stat (المرحلة الخامسة: إجمالي الإيرادات والمصروفات وصافي التشغيل مع زر للتقارير) -->
      <div class="stat-box" style="cursor:pointer;" id="stat-card-profit">
        <div class="stat-header">
          <span>صافي الربح التشغيلي</span>
          <div class="stat-icon" style="background-color:var(--sale-icon-bg);color:var(--sale-val);">${icons.wallet}</div>
        </div>
        <div class="stat-num" style="color:${(stats.netOperatingProfit ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'};">
          ${stats.netOperatingProfit ?? 0} ج.م
        </div>
        <div class="stat-desc">
          إيرادات: ${stats.totalRevenuesAmount ?? 0} • مصروفات: ${stats.totalExpensesAmount ?? 0} (تراكمية)
        </div>
      </div>
    </div>

    <!-- Recent Event Log Stream (سجل آخر الأحداث) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.history}
          آخر أحداث المزرعة (سجل الأحداث)
        </div>
        <button class="btn btn-sm btn-outline" id="btn-open-settings">
          ${icons.settings} الإعدادات
        </button>
      </div>

      ${
        events.length === 0
          ? `
        <div class="empty-state" style="padding:24px;">
          <div class="empty-icon">${icons.history}</div>
          <div class="empty-title">لا توجد أحداث مسجلة بعد</div>
          <div class="empty-desc">التطبيق فارغ وجاهز. عند إضافة أول سلاكة أو زوج ستظهر جميع الأحداث هنا.</div>
          <button class="btn btn-primary btn-sm" id="btn-first-coop">إضافة أول سلاكة</button>
        </div>
      `
          : `
        <div class="timeline" style="margin-top:6px;">
          ${events
            .map(
              (evt) => `
            <div class="timeline-item">
              <div class="timeline-dot" style="width:32px;height:32px;">${icons.check}</div>
              <div class="timeline-content" style="padding:10px 12px;">
                <span class="timeline-time">${formatDateTimeArabic(evt.date)}</span>
                <span class="timeline-text" style="font-size:0.88rem;">${evt.note || evt.type}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
      }
    </div>
  `;

  // Attach navigation events
  container.querySelector('#nav-to-coops')?.addEventListener('click', () => navigate('coops'));
  container.querySelector('#nav-to-eggs')?.addEventListener('click', () => navigate('eggs'));
  container.querySelector('#nav-to-inventory')?.addEventListener('click', () => navigate('inventory'));
  container.querySelector('#nav-to-finances')?.addEventListener('click', () => navigate('finances'));
  container.querySelector('#nav-to-reports')?.addEventListener('click', () => navigate('reports'));
  container.querySelector('#btn-quick-reports')?.addEventListener('click', () => navigate('reports'));

  container.querySelector('#stat-card-coops')?.addEventListener('click', () => navigate('coops'));
  container.querySelector('#stat-card-pairs')?.addEventListener('click', () => navigate('coops'));
  container.querySelector('#stat-card-eggs')?.addEventListener('click', () => navigate('eggs'));
  container.querySelector('#stat-card-feed')?.addEventListener('click', () => navigate('inventory'));
  container.querySelector('#stat-card-profit')?.addEventListener('click', () => navigate('finances'));

  // زر تخصيص أنواع التنبيهات
  container.querySelector('#btn-alert-prefs')?.addEventListener('click', () => {
    showAlertPreferencesModal(() => renderDashboardView(container, navigate));
  });

  // مهام اليوم: زر "تم"
  container.querySelectorAll('.btn-complete-task').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = (btn as HTMLElement).dataset.taskId;
      if (taskId) {
        try {
          await completeTask(taskId);
          showToast('تم تعليم المهمة كمنفذة بنجاح', 'success');
          renderDashboardView(container, navigate);
        } catch (err) {
          showToast('فشل تسجيل إتمام المهمة', 'error');
        }
      }
    });
  });

  // مهام اليوم: زر "تذكير لاحقاً"
  container.querySelectorAll('.btn-snooze-task').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = (btn as HTMLElement).dataset.taskId;
      const task = todayTasks.find((t) => t.id === taskId);
      if (task) {
        showSnoozeTaskModal(task, () => renderDashboardView(container, navigate));
      }
    });
  });

  // Task click -> Navigate directly to associated screen
  container.querySelectorAll('.task-click-target').forEach((target) => {
    target.addEventListener('click', () => {
      const parent = target.closest('.task-card-item') as HTMLElement;
      if (!parent) return;

      const taskType = parent.dataset.taskType;
      const batchId = parent.dataset.batchId;
      const coopId = parent.dataset.coopId;
      const pairId = parent.dataset.pairId;

      if (taskType === 'low_feed_stock') {
        navigate('inventory');
      } else if (taskType === 'backup_reminder') {
        navigate('settings');
      } else if (batchId) {
        navigate('batch_detail', { batchId });
      } else if (pairId) {
        navigate('pair_detail', { pairId });
      } else if (coopId) {
        navigate('coop_detail', { coopId });
      }
    });
  });

  // Global search trigger
  container.querySelector('#btn-trigger-search')?.addEventListener('click', () => {
    showQuickSearchModal(navigate);
  });

  // Undo button click
  container.querySelector('#btn-undo-action')?.addEventListener('click', () => {
    if (lastUndoable) {
      showUndoModal(lastUndoable, () => {
        renderDashboardView(container, navigate);
      });
    }
  });

  // Dismiss undo bar
  container.querySelector('#btn-dismiss-undo')?.addEventListener('click', async () => {
    await clearLastUndoableAction();
    renderDashboardView(container, navigate);
  });

  container.querySelector('#btn-quick-egg')?.addEventListener('click', () => {
    showLayEggModal(null, null, () => renderDashboardView(container, navigate));
  });

  container.querySelector('#btn-quick-purchase')?.addEventListener('click', () => {
    showRecordFeedPurchaseModal(undefined, () => renderDashboardView(container, navigate));
  });

  container.querySelector('#btn-first-coop')?.addEventListener('click', () => {
    showAddCoopModal(() => renderDashboardView(container, navigate));
  });

  container.querySelector('#btn-open-settings')?.addEventListener('click', () => {
    navigate('settings');
  });
}
