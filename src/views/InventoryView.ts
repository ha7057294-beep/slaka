import {
  FeedType,
  StockMovement,
  FeedRateConfig,
  DailyFeedConsumption,
  FarmSettings,
} from '../types';
import {
  getFeedTypes,
  getStockMovements,
  getAllFeedStocks,
  getFeedConsumptionForPeriod,
  getSettings,
  setPrimaryFeedType,
  toggleFeedTypeActive,
  getFeedTypeStock,
} from '../db/indexedDB';
import {
  showAddFeedTypeModal,
  showRecordFeedPurchaseModal,
  showStockManualAdjustmentModal,
  showAddFeedRateConfigModal,
} from '../components/Modal';
import {
  getTodayDate,
  formatDateArabic,
  getFirstDayOfMonth,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import { showToast } from '../components/Toast';

export async function renderInventoryView(container: HTMLElement) {
  let activeTab: 'stock' | 'consumption' = 'stock';
  let fromDate = getFirstDayOfMonth();
  let toDate = getTodayDate();
  let selectedFeedTypeFilter: string = 'all';

  async function loadAndRender() {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        جاري تحميل بيانات المخزون والعلف...
      </div>
    `;

    const [feedTypes, allFeedStocks, movements, settings] = await Promise.all([
      getFeedTypes(),
      getAllFeedStocks(),
      getStockMovements(),
      getSettings(),
    ]);

    const activeFeedTypes = feedTypes.filter((f) => f.active);
    const primaryFeedId = settings.primaryFeedTypeId;

    // Filter movements
    const filteredMovements = movements.filter((m) => {
      if (selectedFeedTypeFilter !== 'all' && m.feedTypeId !== selectedFeedTypeFilter) return false;
      return true;
    });

    // Consumption data for period
    const consumptionReport = await getFeedConsumptionForPeriod(fromDate, toDate);

    // Render View Shell
    container.innerHTML = `
      <div class="view-header" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="page-title" style="margin:0;display:flex;align-items:center;gap:8px;">
              ${icons.grain}
              <span>المخزون وإدارة العلف</span>
            </h1>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.9rem;">
              إدارة أرصدة الأعلاف، حركات الشراء والتعديل، ومتابعة الاستهلاك الفعلي الدقيق.
            </p>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline" id="btn-add-feed-type">
              ${icons.plus}
              <span>نوع علف جديد</span>
            </button>
            <button class="btn btn-primary" id="btn-record-purchase">
              ${icons.receipt}
              <span>شراء وتوريد علف</span>
            </button>
          </div>
        </div>

        <!-- Sub-tabs -->
        <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-subtle);margin-top:16px;padding-bottom:2px;">
          <button class="btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-ghost'}" id="tab-stock" style="border-radius:var(--radius-md) var(--radius-md) 0 0;">
            ${icons.grain}
            <span>المخزون وحركات العلف (${allFeedStocks.length})</span>
          </button>
          <button class="btn ${activeTab === 'consumption' ? 'btn-primary' : 'btn-ghost'}" id="tab-consumption" style="border-radius:var(--radius-md) var(--radius-md) 0 0;">
            ${icons.chart}
            <span>استهلاك العلف الفعلي</span>
          </button>
        </div>
      </div>

      <div id="tab-content-area"></div>
    `;

    // Wire main actions
    container.querySelector('#btn-add-feed-type')?.addEventListener('click', () => {
      showAddFeedTypeModal(undefined, loadAndRender);
    });
    container.querySelector('#btn-record-purchase')?.addEventListener('click', () => {
      showRecordFeedPurchaseModal(undefined, loadAndRender);
    });

    container.querySelector('#tab-stock')?.addEventListener('click', () => {
      activeTab = 'stock';
      loadAndRender();
    });
    container.querySelector('#tab-consumption')?.addEventListener('click', () => {
      activeTab = 'consumption';
      loadAndRender();
    });

    const contentArea = container.querySelector('#tab-content-area') as HTMLElement;

    if (activeTab === 'stock') {
      renderStockTab(contentArea, feedTypes, allFeedStocks, filteredMovements, primaryFeedId);
    } else {
      renderConsumptionTab(contentArea, consumptionReport);
    }
  }

  function renderStockTab(
    area: HTMLElement,
    feedTypes: FeedType[],
    allFeedStocks: Awaited<ReturnType<typeof getAllFeedStocks>>,
    filteredMovements: StockMovement[],
    primaryFeedId?: string
  ) {
    const totalAvailable = Math.round(
      allFeedStocks.reduce((sum, s) => sum + Math.max(0, s.stock.currentStockKg), 0) * 10
    ) / 10;
    const lowStockCount = allFeedStocks.filter((s) => s.stock.isLowStock).length;

    area.innerHTML = `
      <!-- Top Metrics -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:20px;">
        <div class="card" style="padding:14px;border-right:4px solid var(--primary);">
          <div style="font-size:0.84rem;color:var(--text-muted);">إجمالي المخزون المتاح</div>
          <div style="font-size:1.6rem;font-weight:bold;color:var(--primary);margin-top:4px;">
            ${totalAvailable} <span style="font-size:1rem;font-weight:normal;">كجم</span>
          </div>
        </div>

        <div class="card" style="padding:14px;border-right:4px solid ${lowStockCount > 0 ? 'var(--danger)' : 'var(--success)'};">
          <div style="font-size:0.84rem;color:var(--text-muted);">حالة التنبيه بالانخفاض</div>
          <div style="font-size:1.6rem;font-weight:bold;color:${lowStockCount > 0 ? 'var(--danger)' : 'var(--success)'};margin-top:4px;">
            ${lowStockCount > 0 ? `${lowStockCount} نوع منخفض` : 'الكميات آمنة'}
          </div>
        </div>

        <div class="card" style="padding:14px;border-right:4px solid var(--info);">
          <div style="font-size:0.84rem;color:var(--text-muted);">العلف الأساسي للخصم الآلي</div>
          <div style="font-size:1.1rem;font-weight:bold;color:var(--text-main);margin-top:6px;">
            ${
              feedTypes.find((f) => f.id === primaryFeedId)?.name ||
              '<span style="color:var(--text-muted);font-weight:normal;">غير محدد</span>'
            }
          </div>
        </div>
      </div>

      <!-- Feed Types Cards -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="font-size:1.1rem;font-weight:bold;margin:0;">أنواع الأعلاف والأرصدة</h2>
        <button class="btn btn-outline btn-sm" id="btn-manual-adjust-top">
          ${icons.tune}
          <span>تسجيل جرد / تعديل يدوي</span>
        </button>
      </div>

      ${
        allFeedStocks.length === 0
          ? `
        <div class="card" style="padding:32px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🌾</div>
          <h3 style="margin:0 0 8px;">لا توجد أنواع علف مسجلة حتى الآن</h3>
          <p style="color:var(--text-muted);font-size:0.9rem;margin:0 0 16px;">
            أضف أنواع الأعلاف التي تستخدمها لتتبع كميات المخزون وتكلفة الاستهلاك ومتوسط سعر الشراء.
          </p>
          <button class="btn btn-primary" id="btn-add-first-feed">
            ${icons.plus}
            <span>إضافة نوع علف الآن</span>
          </button>
        </div>
      `
          : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:14px;margin-bottom:28px;">
          ${allFeedStocks
            .map((item) => {
              const ft = item.feedType;
              const isPrimary = ft.id === primaryFeedId;
              const stockKg = Math.round(item.stock.currentStockKg * 10) / 10;
              const isLow = item.stock.isLowStock;
              const avgPriceStr =
                item.stock.weightedAveragePrice !== null
                  ? `${item.stock.weightedAveragePrice} ج.م/كجم`
                  : 'لا مشتريات بعد';

              return `
              <div class="card" style="padding:16px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;border:${isLow ? '1px solid var(--danger)' : '1px solid var(--border-subtle)'};">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div>
                      <div style="font-size:1.1rem;font-weight:bold;display:flex;align-items:center;gap:6px;">
                        <span>${ft.name}</span>
                        ${isPrimary ? '<span class="badge badge-primary" style="font-size:0.75rem;">الأساسي للخصم</span>' : ''}
                      </div>
                      ${ft.notes ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">${ft.notes}</div>` : ''}
                    </div>

                    ${
                      isLow
                        ? `<span class="badge badge-danger" style="display:flex;align-items:center;gap:4px;">
                            ${icons.alert}
                            <span>منخفض!</span>
                          </span>`
                        : `<span class="badge badge-success">متوفر</span>`
                    }
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;background-color:var(--surface-subtle);padding:10px;border-radius:var(--radius-md);">
                    <div>
                      <div style="font-size:0.78rem;color:var(--text-muted);">الرصيد الفعلي الحالي</div>
                      <div style="font-size:1.3rem;font-weight:bold;color:${isLow ? 'var(--danger)' : 'var(--text-main)'};">
                        ${stockKg} <span style="font-size:0.85rem;font-weight:normal;">كجم</span>
                      </div>
                    </div>
                    <div>
                      <div style="font-size:0.78rem;color:var(--text-muted);">حد التنبيه</div>
                      <div style="font-size:1.1rem;font-weight:bold;">
                        ${ft.alertThresholdKg} <span style="font-size:0.85rem;font-weight:normal;">كجم</span>
                      </div>
                    </div>
                  </div>

                  <div style="margin-top:10px;font-size:0.84rem;color:var(--text-muted);display:flex;justify-content:space-between;">
                    <span>متوسط سعر الشراء المرجح:</span>
                    <strong style="color:var(--text-main);">${avgPriceStr}</strong>
                  </div>
                  <div style="font-size:0.84rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:4px;">
                    <span>إجمالي المشتريات المسجلة:</span>
                    <span>${Math.round(item.stock.totalPurchasedKg * 10) / 10} كجم (${item.stock.totalPurchaseCost} ج.م)</span>
                  </div>
                </div>

                <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:10px;">
                  <button class="btn btn-outline btn-sm btn-feed-buy" data-feed-id="${ft.id}" style="flex:1;">
                    ${icons.plus}
                    <span>شراء</span>
                  </button>
                  <button class="btn btn-outline btn-sm btn-feed-adjust" data-feed-id="${ft.id}">
                    ${icons.tune}
                    <span>تعديل رصيد</span>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-feed-edit" data-feed-id="${ft.id}">
                    ${icons.edit}
                  </button>
                  ${
                    !isPrimary
                      ? `
                    <button class="btn btn-ghost btn-sm btn-feed-set-primary" data-feed-id="${ft.id}" title="تعيين كعلف أساسي لخصم الاستهلاك التلقائي">
                      ★ الأساسي
                    </button>
                  `
                      : ''
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }

      <!-- Stock Movements History -->
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0;font-size:1.05rem;">سجل حركات المخزون (شراء / استهلاك / تسوية)</h3>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">
              كل حركة شراء، تعديل جرد، أو استهلاك موثقة بتاريخها وكميتها وسببها.
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.85rem;color:var(--text-muted);">تصفية بالنوع:</label>
            <select id="select-movement-feed-filter" class="form-select" style="width:auto;padding:4px 8px;font-size:0.86rem;">
              <option value="all" ${selectedFeedTypeFilter === 'all' ? 'selected' : ''}>جميع الأعلاف</option>
              ${feedTypes
                .map(
                  (f) =>
                    `<option value="${f.id}" ${selectedFeedTypeFilter === f.id ? 'selected' : ''}>${f.name}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        ${
          filteredMovements.length === 0
            ? `
          <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.9rem;">
            لا توجد حركات مخزون مسجلة حتى الآن.
          </div>
        `
            : `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:0.88rem;">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع العلف</th>
                  <th>نوع الحركة</th>
                  <th>الكمية</th>
                  <th>سعر الكيلو / التكلفة</th>
                  <th>البيان / المورد / السبب</th>
                </tr>
              </thead>
              <tbody>
                ${filteredMovements
                  .slice(0, 50)
                  .map((m) => {
                    const ft = feedTypes.find((f) => f.id === m.feedTypeId);
                    const isPositive = m.quantity > 0;
                    const typeLabels: Record<string, string> = {
                      purchase: 'شراء وتوريد',
                      consumption: 'استهلاك قطيع',
                      manual_adjustment: 'تعديل جرد يدوي',
                    };

                    let badgeClass = 'badge-secondary';
                    if (m.type === 'purchase') badgeClass = 'badge-success';
                    else if (m.type === 'consumption') badgeClass = 'badge-primary';
                    else if (m.type === 'manual_adjustment') badgeClass = 'badge-warning';

                    return `
                    <tr>
                      <td style="white-space:nowrap;">${formatDateArabic(m.date)}</td>
                      <td style="font-weight:bold;">${ft?.name || 'غير معروف'}</td>
                      <td>
                        <span class="badge ${badgeClass}">${typeLabels[m.type] || m.type}</span>
                      </td>
                      <td style="font-weight:bold;direction:ltr;text-align:right;color:${isPositive ? 'var(--success)' : 'var(--danger)'};">
                        ${isPositive ? '+' : ''}${m.quantity} كجم
                      </td>
                      <td>
                        ${
                          m.unitPrice !== undefined
                            ? `${m.unitPrice} ج.م (${m.totalCost} ج.م)`
                            : '-'
                        }
                      </td>
                      <td style="color:var(--text-muted);">
                        ${m.supplier ? `<strong>المورد:</strong> ${m.supplier} - ` : ''}
                        ${m.reason || '-'}
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    // Wire listeners inside stock tab
    area.querySelector('#btn-add-first-feed')?.addEventListener('click', () => {
      showAddFeedTypeModal(undefined, loadAndRender);
    });
    area.querySelector('#btn-manual-adjust-top')?.addEventListener('click', () => {
      showStockManualAdjustmentModal(undefined, loadAndRender);
    });

    area.querySelector('#select-movement-feed-filter')?.addEventListener('change', (e) => {
      selectedFeedTypeFilter = (e.target as HTMLSelectElement).value;
      loadAndRender();
    });

    area.querySelectorAll('.btn-feed-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.feedId;
        showRecordFeedPurchaseModal(id, loadAndRender);
      });
    });

    area.querySelectorAll('.btn-feed-adjust').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.feedId;
        showStockManualAdjustmentModal(id, loadAndRender);
      });
    });

    area.querySelectorAll('.btn-feed-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.feedId;
        const ft = feedTypes.find((f) => f.id === id);
        if (ft) showAddFeedTypeModal(ft, loadAndRender);
      });
    });

    area.querySelectorAll('.btn-feed-set-primary').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.feedId;
        if (!id) return;
        try {
          await setPrimaryFeedType(id, 'اختيار نوع العلف الأساسي لخصم الاستهلاك');
          showToast('تم تعيين نوع العلف الأساسي بنجاح', 'success');
          loadAndRender();
        } catch (err: unknown) {
          showToast('فشل التعيين: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
      });
    });
  }

  function renderConsumptionTab(
    area: HTMLElement,
    report: Awaited<ReturnType<typeof getFeedConsumptionForPeriod>>
  ) {
    const hasMissingRates = report.missingRatesDates.length > 0;

    area.innerHTML = `
      <!-- Date Range Controls -->
      <div class="card" style="padding:14px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:bold;font-size:0.9rem;">الفترة الزمنية:</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:0.84rem;color:var(--text-muted);">من:</label>
              <input type="date" id="input-feed-from" class="form-input" style="width:auto;padding:4px 8px;font-size:0.86rem;" value="${fromDate}" />
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:0.84rem;color:var(--text-muted);">إلى:</label>
              <input type="date" id="input-feed-to" class="form-input" style="width:auto;padding:4px 8px;font-size:0.86rem;" value="${toDate}" />
            </div>
            <button class="btn btn-outline btn-sm" id="btn-apply-period">
              ${icons.filter}
              <span>تطبيق</span>
            </button>
          </div>

          <button class="btn btn-outline btn-sm" id="btn-add-feed-rate">
            ${icons.settings}
            <span>إضافة معدل استهلاك يومي</span>
          </button>
        </div>
      </div>

      ${
        hasMissingRates
          ? `
        <div class="card" style="background-color:var(--warning-bg);color:var(--warning);border:1px solid var(--warning);padding:14px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <strong>تنبيه دقة الحساب:</strong> توجد أيام في هذه الفترة (${report.missingRatesDates.length} يوم) لم يُسجل لها معدل استهلاك علف سارٍ، فتم احتساب استهلاكها بصفر لمنع أي أرقام تقديرية عشوائية.
            </div>
            <button class="btn btn-sm btn-primary" id="btn-configure-rates-now">
              ${icons.settings}
              <span>ضبط معدل الاستهلاك الآن</span>
            </button>
          </div>
        </div>
      `
          : ''
      }

      <!-- Consumption Breakdown Metrics -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:12px;margin-bottom:20px;">
        <div class="card" style="padding:16px;border-right:4px solid var(--primary);">
          <div style="font-size:0.84rem;color:var(--text-muted);">إجمالي العلف المستهلك</div>
          <div style="font-size:1.6rem;font-weight:bold;color:var(--primary);margin-top:4px;">
            ${report.totalKg} <span style="font-size:1rem;font-weight:normal;">كجم</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            متوسط يومي: <strong>${report.dailyAverageKg} كجم/يوم</strong>
          </div>
        </div>

        <div class="card" style="padding:16px;border-right:4px solid var(--accent);">
          <div style="font-size:0.84rem;color:var(--text-muted);">تكلفة العلف المستهلك (تحليلي)</div>
          <div style="font-size:1.6rem;font-weight:bold;color:var(--text-main);margin-top:4px;">
            ${report.totalCost !== null ? `${report.totalCost} ج.م` : 'غير محدد السعر'}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">
            محسوب بمتوسط سعر الشراء المرجح
          </div>
        </div>

        <div class="card" style="padding:16px;border-right:4px solid var(--info);">
          <div style="font-size:0.84rem;color:var(--text-muted);">استهلاك الأمهات البالغة</div>
          <div style="font-size:1.4rem;font-weight:bold;margin-top:4px;">
            ${report.totalAdultKg} <span style="font-size:0.9rem;font-weight:normal;">كجم</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            ${report.totalKg > 0 ? Math.round((report.totalAdultKg / report.totalKg) * 100) : 0}% من الإجمالي
          </div>
        </div>

        <div class="card" style="padding:16px;border-right:4px solid var(--success);">
          <div style="font-size:0.84rem;color:var(--text-muted);">استهلاك الزغاليل (إنتاج + تجميع)</div>
          <div style="font-size:1.4rem;font-weight:bold;margin-top:4px;">
            ${Math.round((report.totalProdSquabsKg + report.totalCollSquabsKg) * 100) / 100} <span style="font-size:0.9rem;font-weight:normal;">كجم</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            إنتاج: ${report.totalProdSquabsKg} كجم | تجميع: ${report.totalCollSquabsKg} كجم
          </div>
        </div>
      </div>

      <!-- Daily Details Table -->
      <div class="card" style="padding:16px;">
        <h3 style="margin:0 0 12px;font-size:1.05rem;">تفاصيل الاستهلاك اليومي الدقيق</h3>
        ${
          report.dailyRecords.length === 0
            ? `
          <div style="padding:24px;text-align:center;color:var(--text-muted);">
            لا توجد أيام مسجلة في هذا النطاق الزمني.
          </div>
        `
            : `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:0.88rem;">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>أفراد الحمام البالغ</th>
                  <th>زغاليل الإنتاج</th>
                  <th>زغاليل التجميع</th>
                  <th>إجمالي اليوم (كجم)</th>
                  <th>التكلفة اليومية</th>
                  <th>حالة المعدل</th>
                </tr>
              </thead>
              <tbody>
                ${report.dailyRecords
                  .slice()
                  .reverse()
                  .map((d: DailyFeedConsumption) => {
                    return `
                    <tr>
                      <td style="font-weight:bold;white-space:nowrap;">${formatDateArabic(d.date)}</td>
                      <td>${d.adultBirdsCount} فرد (${Math.round(d.adultGramsTotal / 10) / 100} كجم)</td>
                      <td>${d.prodSquabsCount} زغلول (${Math.round(d.prodSquabsGramsTotal / 10) / 100} كجم)</td>
                      <td>${d.collSquabsCount} زغلول (${Math.round(d.collSquabsGramsTotal / 10) / 100} كجم)</td>
                      <td style="font-weight:bold;color:var(--primary);">${d.totalKg} كجم</td>
                      <td>${d.cost !== null ? `${d.cost} ج.م` : '-'}</td>
                      <td>
                        ${
                          d.hasConfiguredRates
                            ? '<span class="badge badge-success">معدل سارٍ</span>'
                            : '<span class="badge badge-warning">بدون معدل (0)</span>'
                        }
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    // Listeners in consumption tab
    area.querySelector('#btn-apply-period')?.addEventListener('click', () => {
      const fromInput = area.querySelector('#input-feed-from') as HTMLInputElement;
      const toInput = area.querySelector('#input-feed-to') as HTMLInputElement;
      if (fromInput?.value) fromDate = fromInput.value;
      if (toInput?.value) toDate = toInput.value;
      loadAndRender();
    });

    area.querySelector('#btn-add-feed-rate')?.addEventListener('click', () => {
      showAddFeedRateConfigModal(loadAndRender);
    });
    area.querySelector('#btn-configure-rates-now')?.addEventListener('click', () => {
      showAddFeedRateConfigModal(loadAndRender);
    });
  }

  await loadAndRender();
}
