import {
  Expense,
  ManualRevenue,
  AccountingType,
  FinancialResults,
} from '../types';
import {
  getExpenses,
  getManualRevenues,
  calculateFinancialResults,
  toggleExpenseActive,
  toggleManualRevenueActive,
} from '../db/indexedDB';
import {
  showAddExpenseModal,
  showEditExpenseModal,
  showAddManualRevenueModal,
} from '../components/Modal';
import {
  getTodayDate,
  formatDateArabic,
  getFirstDayOfMonth,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import { showToast } from '../components/Toast';

export async function renderFinancesView(container: HTMLElement) {
  let fromDate = getFirstDayOfMonth();
  let toDate = getTodayDate();
  let activeTab: 'overview' | 'expenses' | 'revenues' = 'overview';
  let accountingTypeFilter: string = 'all';

  async function loadAndRender() {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        جاري تحميل البيانات المالية والمصروفات...
      </div>
    `;

    const [results, expenses, revenues] = await Promise.all([
      calculateFinancialResults(fromDate, toDate),
      getExpenses({ fromDate, toDate }),
      getManualRevenues({ fromDate, toDate }),
    ]);

    const filteredExpenses = expenses.filter((e) => {
      if (accountingTypeFilter !== 'all' && e.accountingType !== accountingTypeFilter) return false;
      return true;
    });

    container.innerHTML = `
      <div class="view-header" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="page-title" style="margin:0;display:flex;align-items:center;gap:8px;">
              ${icons.wallet}
              <span>المالية والمصروفات والإيرادات</span>
            </h1>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.9rem;">
              تحليل مالي دقيق مبني على الأحداث والتواريخ، وتصنيف محاسبي معتمد بدون خلط أو خصم مزدوج.
            </p>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline" id="btn-add-revenue-top">
              ${icons.trendingUp}
              <span>إيراد إضافي (بالغ / أخرى)</span>
            </button>
            <button class="btn btn-primary" id="btn-add-expense-top">
              ${icons.plus}
              <span>تسجيل مصروف جديد</span>
            </button>
          </div>
        </div>

        <!-- Date Range Filter Bar -->
        <div class="card" style="padding:12px 16px;margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:bold;font-size:0.88rem;">فترة الحساب المالي:</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:0.82rem;color:var(--text-muted);">من:</label>
                <input type="date" id="input-fin-from" class="form-input" style="width:auto;padding:4px 8px;font-size:0.86rem;" value="${fromDate}" />
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:0.82rem;color:var(--text-muted);">إلى:</label>
                <input type="date" id="input-fin-to" class="form-input" style="width:auto;padding:4px 8px;font-size:0.86rem;" value="${toDate}" />
              </div>
              <button class="btn btn-outline btn-sm" id="btn-fin-filter">
                ${icons.filter}
                <span>تحديث النتائج</span>
              </button>
            </div>

            <div style="font-size:0.82rem;color:var(--text-muted);">
              الحسابات مبنية على سجل الأحداث والتواريخ فقط
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-subtle);margin-top:14px;padding-bottom:2px;">
          <button class="btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}" id="tab-fin-overview" style="border-radius:var(--radius-md) var(--radius-md) 0 0;">
            ${icons.chart}
            <span>ملخص الأرباح والتحليل</span>
          </button>
          <button class="btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-ghost'}" id="tab-fin-expenses" style="border-radius:var(--radius-md) var(--radius-md) 0 0;">
            ${icons.receipt}
            <span>سجل المصروفات (${expenses.length})</span>
          </button>
          <button class="btn ${activeTab === 'revenues' ? 'btn-primary' : 'btn-ghost'}" id="tab-fin-revenues" style="border-radius:var(--radius-md) var(--radius-md) 0 0;">
            ${icons.trendingUp}
            <span>سجل الإيرادات الإضافية (${revenues.length})</span>
          </button>
        </div>
      </div>

      <div id="fin-tab-content"></div>
    `;

    // Wire global handlers
    container.querySelector('#btn-add-expense-top')?.addEventListener('click', () => {
      showAddExpenseModal(undefined, loadAndRender);
    });
    container.querySelector('#btn-add-revenue-top')?.addEventListener('click', () => {
      showAddManualRevenueModal(loadAndRender);
    });
    container.querySelector('#btn-fin-filter')?.addEventListener('click', () => {
      const fromInput = container.querySelector('#input-fin-from') as HTMLInputElement;
      const toInput = container.querySelector('#input-fin-to') as HTMLInputElement;
      if (fromInput?.value) fromDate = fromInput.value;
      if (toInput?.value) toDate = toInput.value;
      loadAndRender();
    });

    container.querySelector('#tab-fin-overview')?.addEventListener('click', () => {
      activeTab = 'overview';
      loadAndRender();
    });
    container.querySelector('#tab-fin-expenses')?.addEventListener('click', () => {
      activeTab = 'expenses';
      loadAndRender();
    });
    container.querySelector('#tab-fin-revenues')?.addEventListener('click', () => {
      activeTab = 'revenues';
      loadAndRender();
    });

    const contentArea = container.querySelector('#fin-tab-content') as HTMLElement;

    if (activeTab === 'overview') {
      renderOverviewTab(contentArea, results);
    } else if (activeTab === 'expenses') {
      renderExpensesTab(contentArea, filteredExpenses);
    } else {
      renderRevenuesTab(contentArea, revenues);
    }
  }

  function renderOverviewTab(area: HTMLElement, r: FinancialResults) {
    const isOperatingProfitPositive = r.netOperatingProfit >= 0;
    const isNetProfitPositive = r.netProfitAfterEstablishment >= 0;

    area.innerHTML = `
      <!-- Core Profitability Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin-bottom:20px;">
        <!-- Operating Net -->
        <div class="card" style="padding:18px;border-right:6px solid ${isOperatingProfitPositive ? 'var(--success)' : 'var(--danger)'};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:0.88rem;color:var(--text-muted);font-weight:bold;">صافي التشغيل (Operating Net)</div>
              <div style="font-size:1.9rem;font-weight:bold;color:${isOperatingProfitPositive ? 'var(--success)' : 'var(--danger)'};margin-top:6px;">
                ${r.netOperatingProfit} <span style="font-size:1.1rem;font-weight:normal;">ج.م</span>
              </div>
            </div>
            <span class="badge ${isOperatingProfitPositive ? 'badge-success' : 'badge-danger'}">
              ${isOperatingProfitPositive ? 'ربح تشغيلي' : 'عجز تشغيلي'}
            </span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;line-height:1.4;">
            = إجمالي الإيرادات (${r.totalRevenue} ج.م) - المصروفات غير التأسيسية (${r.totalNonEstablishmentExpenses} ج.م).
          </div>
        </div>

        <!-- Net After Establishment -->
        <div class="card" style="padding:18px;border-right:6px solid ${isNetProfitPositive ? 'var(--primary)' : 'var(--danger)'};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:0.88rem;color:var(--text-muted);font-weight:bold;">الصافي بعد التأسيس (Full Net)</div>
              <div style="font-size:1.9rem;font-weight:bold;color:${isNetProfitPositive ? 'var(--primary)' : 'var(--danger)'};margin-top:6px;">
                ${r.netProfitAfterEstablishment} <span style="font-size:1.1rem;font-weight:normal;">ج.م</span>
              </div>
            </div>
            <span class="badge ${isNetProfitPositive ? 'badge-primary' : 'badge-danger'}">
              ${isNetProfitPositive ? 'صافي موجب' : 'صافي سالب'}
            </span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;line-height:1.4;">
            = إجمالي الإيرادات (${r.totalRevenue} ج.م) - إجمالي كل المصروفات بالتأسيس (${r.totalExpenses} ج.م).
          </div>
        </div>

        <!-- Average Squab Sale Price -->
        <div class="card" style="padding:18px;border-right:6px solid var(--accent);">
          <div style="font-size:0.88rem;color:var(--text-muted);font-weight:bold;">متوسط سعر بيع الزغلول الفعلي</div>
          <div style="font-size:1.9rem;font-weight:bold;color:var(--text-main);margin-top:6px;">
            ${r.averageSquabSalePrice !== null ? `${r.averageSquabSalePrice} ج.م` : '<span style="font-size:1.2rem;color:var(--text-muted);">غير متاح</span>'}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;line-height:1.4;">
            ${
              r.soldSquabsCount > 0
                ? `محسوب على ${r.soldSquabsCount} زغلول مباع بقيمة ${r.squabSalesRevenue} ج.م.`
                : 'لا توجد مبيعات زغاليل مسجلة في هذه الفترة.'
            }
          </div>
        </div>
      </div>

      <!-- Analytical Feed Indicator Notice -->
      <div class="card" style="padding:14px 18px;margin-bottom:20px;background-color:var(--surface-subtle);border-right:4px solid var(--info);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-weight:bold;font-size:0.95rem;color:var(--text-main);">
              تكلفة العلف المستهلك في الفترة (مؤشر تحليلي إرشادي):
              <span style="font-size:1.15rem;color:var(--primary);margin-right:6px;">
                ${r.consumedFeedCost !== null ? `${r.consumedFeedCost} ج.م` : 'غير محدد'}
              </span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px;">
              <strong>توضيح محاسبي صارم:</strong> هذا المؤشر تحليلي إرشادي فقط ولا يُخصم من الإيرادات هنا، لأن مشتريات العلف النقدية مسجلة بالفعل ضمن المصروفات لمنع الخصم المزدوج.
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Breakdown Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- Revenues Breakdown -->
        <div class="card" style="padding:18px;">
          <h3 style="margin:0 0 14px;font-size:1.05rem;display:flex;align-items:center;gap:6px;">
            ${icons.trendingUp}
            <span>تفاصيل الإيرادات الفعلية (${r.totalRevenue} ج.م)</span>
          </h3>

          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem;">
            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <span>مبيعات الزغاليل (${r.soldSquabsCount} زغلول):</span>
              <strong>${r.squabSalesRevenue} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <span>مبيعات الحمام البالغ:</span>
              <strong>${r.adultSalesRevenue} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <span>إيرادات أخرى (سماد / خدمات / ريش):</span>
              <strong>${r.otherRevenue} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:10px;border-top:1px solid var(--border-subtle);margin-top:4px;font-weight:bold;font-size:1rem;">
              <span>إجمالي الإيرادات:</span>
              <span style="color:var(--success);">${r.totalRevenue} ج.م</span>
            </div>
          </div>
        </div>

        <!-- Expenses Breakdown by Accounting Type -->
        <div class="card" style="padding:18px;">
          <h3 style="margin:0 0 14px;font-size:1.05rem;display:flex;align-items:center;gap:6px;">
            ${icons.receipt}
            <span>تفاصيل المصروفات بالأنواع المحاسبية (${r.totalExpenses} ج.م)</span>
          </h3>

          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem;">
            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <div>
                <strong>مصروفات تشغيلية (Operational):</strong>
                <div style="font-size:0.76rem;color:var(--text-muted);">كهرباء، مياه، صيانة، نظافة</div>
              </div>
              <strong style="align-self:center;">${r.operationalExpenses} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <div>
                <strong>تكلفة إنتاج (Production Cost):</strong>
                <div style="font-size:0.76rem;color:var(--text-muted);">أعلاف، أدوية، فيتامينات، فرشة</div>
              </div>
              <strong style="align-self:center;">${r.productionCostExpenses} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);">
              <div>
                <strong>مرتبط بعملية محددة (Specific):</strong>
                <div style="font-size:0.76rem;color:var(--text-muted);">شحن، نقل، تطهير خاص</div>
              </div>
              <strong style="align-self:center;">${r.specificOperationExpenses} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:8px 10px;background-color:rgba(180, 83, 9, 0.08);border-radius:var(--radius-md);color:var(--warning);">
              <div>
                <strong>مصروفات تأسيسية (Establishment):</strong>
                <div style="font-size:0.76rem;">سلاكات، معدات رأسمالية، حمام أمهات</div>
              </div>
              <strong style="align-self:center;">${r.establishmentExpenses} ج.م</strong>
            </div>

            <div style="display:flex;justify-content:space-between;padding:10px;border-top:1px solid var(--border-subtle);margin-top:4px;font-weight:bold;font-size:1rem;">
              <span>إجمالي المصروفات:</span>
              <span style="color:var(--danger);">${r.totalExpenses} ج.م</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderExpensesTab(area: HTMLElement, expenses: Expense[]) {
    area.innerHTML = `
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0;font-size:1.05rem;">سجل المصروفات في الفترة</h3>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">
              المصروفات مرتبطة بأنواع محاسبية لضمان فصل التأسيسي عن التشغيلي.
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:0.84rem;color:var(--text-muted);">النوع المحاسبي:</label>
            <select id="select-filter-acc-type" class="form-select" style="width:auto;padding:4px 8px;font-size:0.86rem;">
              <option value="all" ${accountingTypeFilter === 'all' ? 'selected' : ''}>جميع الأنواع</option>
              <option value="operational" ${accountingTypeFilter === 'operational' ? 'selected' : ''}>تشغيلي</option>
              <option value="production_cost" ${accountingTypeFilter === 'production_cost' ? 'selected' : ''}>تكلفة إنتاج</option>
              <option value="establishment" ${accountingTypeFilter === 'establishment' ? 'selected' : ''}>تأسيس</option>
              <option value="specific_operation" ${accountingTypeFilter === 'specific_operation' ? 'selected' : ''}>مرتبط بعملية</option>
            </select>
            <button class="btn btn-primary btn-sm" id="btn-add-exp-inner">
              ${icons.plus}
              <span>إضافة مصروف</span>
            </button>
          </div>
        </div>

        ${
          expenses.length === 0
            ? `
          <div style="padding:28px;text-align:center;color:var(--text-muted);">
            لا توجد مصروفات مسجلة في هذا النطاق الزمني.
          </div>
        `
            : `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:0.88rem;">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>النوع المحاسبي</th>
                  <th>التصنيف</th>
                  <th>البيان / الوصف</th>
                  <th>الجهة المستفيدة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${expenses
                  .map((e) => {
                    const typeLabels: Record<AccountingType, string> = {
                      establishment: 'تأسيس',
                      operational: 'تشغيلي',
                      production_cost: 'تكلفة إنتاج',
                      specific_operation: 'مرتبط بعملية',
                    };
                    const catLabels: Record<string, string> = {
                      feed: 'علف وحبوب',
                      medication: 'أدوية وفيتامينات',
                      equipment: 'معدات',
                      utilities: 'مرافق',
                      maintenance: 'صيانة ونظافة',
                      other: 'أخرى',
                    };

                    let badgeColor = 'badge-primary';
                    if (e.accountingType === 'establishment') badgeColor = 'badge-warning';
                    else if (e.accountingType === 'operational') badgeColor = 'badge-info';
                    else if (e.accountingType === 'production_cost') badgeColor = 'badge-success';

                    return `
                    <tr style="${!e.active ? 'opacity:0.6;background-color:var(--surface-subtle);' : ''}">
                      <td style="white-space:nowrap;">${formatDateArabic(e.date)}</td>
                      <td style="font-weight:bold;color:var(--danger);">${e.amount} ج.م</td>
                      <td>
                        <span class="badge ${badgeColor}">${typeLabels[e.accountingType] || e.accountingType}</span>
                      </td>
                      <td>${catLabels[e.category] || e.category}</td>
                      <td>
                        <strong>${e.description}</strong>
                        ${e.feedPurchaseId ? '<span class="badge badge-secondary" style="font-size:0.7rem;margin-right:4px;">شراء علف تلقائي</span>' : ''}
                        ${e.note ? `<div style="font-size:0.78rem;color:var(--text-muted);">${e.note}</div>` : ''}
                      </td>
                      <td>${e.payee || '-'}</td>
                      <td>
                        <span class="badge ${e.active ? 'badge-success' : 'badge-danger'}">
                          ${e.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td>
                        <div style="display:flex;gap:4px;">
                          <button class="btn btn-ghost btn-sm btn-edit-expense" data-exp-id="${e.id}" title="تعديل">
                            ${icons.edit}
                          </button>
                          <button class="btn btn-ghost btn-sm btn-toggle-expense" data-exp-id="${e.id}" data-active="${e.active}" title="${e.active ? 'إيقاف المصروف' : 'تنشيط المصروف'}">
                            ${e.active ? icons.pause : icons.play}
                          </button>
                        </div>
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

    area.querySelector('#btn-add-exp-inner')?.addEventListener('click', () => {
      showAddExpenseModal(undefined, loadAndRender);
    });

    area.querySelector('#select-filter-acc-type')?.addEventListener('change', (ev) => {
      accountingTypeFilter = (ev.target as HTMLSelectElement).value;
      loadAndRender();
    });

    area.querySelectorAll('.btn-edit-expense').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.expId;
        const exp = expenses.find((e) => e.id === id);
        if (exp) showEditExpenseModal(exp, loadAndRender);
      });
    });

    area.querySelectorAll('.btn-toggle-expense').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.expId;
        const currentActive = (btn as HTMLElement).dataset.active === 'true';
        if (!id) return;

        const reason = window.prompt(
          currentActive
            ? 'يرجى كتابة سبب إيقاف هذا المصروف (للتوثيق بسجل الأحداث):'
            : 'يرجى كتابة سبب إعادة تنشيط هذا المصروف (للتوثيق بسجل الأحداث):'
        );
        if (!reason || !reason.trim()) {
          showToast('تم إلغاء الإجراء لعدم كتابة السبب الإلزامي', 'error');
          return;
        }

        try {
          await toggleExpenseActive(id, !currentActive, reason);
          showToast(currentActive ? 'تم إيقاف المصروف' : 'تم تنشيط المصروف', 'success');
          loadAndRender();
        } catch (err: unknown) {
          showToast('فشل التعديل: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
      });
    });
  }

  function renderRevenuesTab(area: HTMLElement, revenues: ManualRevenue[]) {
    area.innerHTML = `
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0;font-size:1.05rem;">سجل الإيرادات الإضافية</h3>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">
              يشمل مبيعات الحمام البالغ والإيرادات الأخرى (مبيعات الزغاليل مسجلة في شاشة المبيعات).
            </div>
          </div>

          <button class="btn btn-primary btn-sm" id="btn-add-rev-inner">
            ${icons.plus}
            <span>إضافة إيراد</span>
          </button>
        </div>

        ${
          revenues.length === 0
            ? `
          <div style="padding:28px;text-align:center;color:var(--text-muted);">
            لا توجد إيرادات إضافية مسجلة في هذا النطاق الزمني.
          </div>
        `
            : `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%;font-size:0.88rem;">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>التصنيف</th>
                  <th>البيان / الوصف</th>
                  <th>المشتري</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${revenues
                  .map((r) => {
                    const catLabel =
                      r.category === 'adult_sale' ? 'بيع حمام بالغ' : 'إيراد آخر';
                    const badgeClass =
                      r.category === 'adult_sale' ? 'badge-primary' : 'badge-info';

                    return `
                    <tr style="${!r.active ? 'opacity:0.6;background-color:var(--surface-subtle);' : ''}">
                      <td style="white-space:nowrap;">${formatDateArabic(r.date)}</td>
                      <td style="font-weight:bold;color:var(--success);">${r.amount} ج.م</td>
                      <td>
                        <span class="badge ${badgeClass}">${catLabel}</span>
                      </td>
                      <td>
                        <strong>${r.description}</strong>
                        ${r.note ? `<div style="font-size:0.78rem;color:var(--text-muted);">${r.note}</div>` : ''}
                      </td>
                      <td>${r.buyer || '-'}</td>
                      <td>
                        <span class="badge ${r.active ? 'badge-success' : 'badge-danger'}">
                          ${r.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-ghost btn-sm btn-toggle-rev" data-rev-id="${r.id}" data-active="${r.active}" title="${r.active ? 'إيقاف الإيراد' : 'تنشيط الإيراد'}">
                          ${r.active ? icons.pause : icons.play}
                        </button>
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

    area.querySelector('#btn-add-rev-inner')?.addEventListener('click', () => {
      showAddManualRevenueModal(loadAndRender);
    });

    area.querySelectorAll('.btn-toggle-rev').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.revId;
        const currentActive = (btn as HTMLElement).dataset.active === 'true';
        if (!id) return;

        const reason = window.prompt(
          currentActive
            ? 'يرجى كتابة سبب إيقاف هذا الإيراد (للتوثيق بسجل الأحداث):'
            : 'يرجى كتابة سبب إعادة تنشيط هذا الإيراد (للتوثيق بسجل الأحداث):'
        );
        if (!reason || !reason.trim()) {
          showToast('تم إلغاء الإجراء لعدم كتابة السبب الإلزامي', 'error');
          return;
        }

        try {
          await toggleManualRevenueActive(id, !currentActive, reason);
          showToast(currentActive ? 'تم إيقاف الإيراد' : 'تم تنشيط الإيراد', 'success');
          loadAndRender();
        } catch (err: unknown) {
          showToast('فشل التعديل: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
      });
    });
  }

  await loadAndRender();
}
