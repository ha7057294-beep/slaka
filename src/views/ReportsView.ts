import {
  getProductionReport,
  getPairRanking,
  getSettings,
} from '../db/indexedDB';
import {
  getRolling6MonthsPeriod,
  getFirstHalfPeriod,
  getSecondHalfPeriod,
  getCurrentYearPeriod,
  getPreviousComparisonPeriod,
  formatDateArabic,
  getTodayDate,
} from '../utils/dateUtils';
import { ProductionReport, PairRankingItem } from '../types';
import { icons } from '../utils/icons';
import { showPairRankingDetailModal } from '../components/Modal';
import { showToast } from '../components/Toast';

type PeriodMode = 'rolling6' | 'firstHalf' | 'secondHalf' | 'fullYear' | 'custom';
type SortField =
  | 'reachedSaleCount'
  | 'survivalRate'
  | 'bornSquabsCount'
  | 'fertilityRate'
  | 'hatchRate'
  | 'actualRevenue';

interface ReportsState {
  periodMode: PeriodMode;
  fromDate: string;
  toDate: string;
  compareWithPrevious: boolean;
  activeSortField: SortField;
  sortAscending: boolean;
  showOver20DaysRate: boolean;
}

let currentState: ReportsState = {
  periodMode: 'rolling6',
  ...getRolling6MonthsPeriod(),
  compareWithPrevious: false,
  activeSortField: 'reachedSaleCount',
  sortAscending: false,
  showOver20DaysRate: false,
};

export async function renderReportsView(
  container: HTMLElement,
  navigate: (view: any, param?: any) => void
): Promise<void> {
  container.innerHTML = `
    <div class="p-4 flex items-center justify-center min-h-[300px]">
      <div class="text-center text-gray-500">
        <div class="inline-block animate-spin text-3xl mb-2 text-emerald-600">${icons.refresh || '⏳'}</div>
        <div>جارٍ تجميع بيانات وسجلات الإنتاج والتحليل المالي...</div>
      </div>
    </div>
  `;

  await loadAndRender(container, navigate);
}

async function loadAndRender(
  container: HTMLElement,
  navigate: (view: any, param?: any) => void
): Promise<void> {
  const { fromDate, toDate, compareWithPrevious } = currentState;

  // 1. تقرير الفترة الحالية
  const report = await getProductionReport(fromDate, toDate);
  const pairRanking = await getPairRanking(fromDate, toDate);

  // 2. تقرير فترة المقارنة (إن كانت مفعلة)
  let prevReport: ProductionReport | null = null;
  if (compareWithPrevious) {
    const prevPeriod = getPreviousComparisonPeriod(fromDate, toDate);
    prevReport = await getProductionReport(prevPeriod.fromDate, prevPeriod.toDate);
  }

  // 3. ترتيب الأزواج حسب العمود المحدد
  const sortedRankedPairs = [...pairRanking.rankedPairs].sort((a, b) => {
    const field = currentState.activeSortField;
    const valA = a[field] ?? -1;
    const valB = b[field] ?? -1;
    if (valA === valB) {
      return b.bornSquabsCount - a.bornSquabsCount;
    }
    return currentState.sortAscending ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
  });

  renderHTML(container, report, prevReport, sortedRankedPairs, pairRanking.insufficientDataPairs, navigate);
}

function renderHTML(
  container: HTMLElement,
  report: ProductionReport,
  prevReport: ProductionReport | null,
  rankedPairs: PairRankingItem[],
  insufficientDataPairs: PairRankingItem[],
  navigate: (view: any, param?: any) => void
): void {
  const fin = report.financials;
  const prevFin = prevReport?.financials;

  const html = `
    <div class="space-y-6 pb-12 print:p-0 print:space-y-4">
      <!-- رأس الصفحة وأزرار الإجراءات -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4 print:border-b-2">
        <div>
          <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            ${icons.stats || ''} لوحة التقارير وترتيب الأزواج
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            جميع المؤشرات تُحسب ديناميكياً من سجل الأحداث والتواريخ الفعلية حصراً، بدون أرقام تقديرية.
          </p>
        </div>

        <div class="flex items-center gap-2 print:hidden">
          <button type="button" class="btn btn-outline text-xs py-2 px-3 flex items-center gap-1.5" id="btn-export-csv">
            ${icons.download || ''} تصدير CSV
          </button>
          <button type="button" class="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5" id="btn-print">
            ${icons.printer || ''} طباعة / PDF
          </button>
        </div>
      </div>

      <!-- محدد الفترة الزمنية -->
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        <div class="text-xs font-bold text-gray-700 mb-2.5">اختر نطاق الفترة المحاسبية:</div>
        <div class="flex flex-wrap gap-2 mb-3">
          <button type="button" class="btn text-xs py-1.5 px-3 rounded-xl ${currentState.periodMode === 'rolling6' ? 'btn-primary' : 'btn-outline'}" data-mode="rolling6">
            6 أشهر متدحرجة
          </button>
          <button type="button" class="btn text-xs py-1.5 px-3 rounded-xl ${currentState.periodMode === 'firstHalf' ? 'btn-primary' : 'btn-outline'}" data-mode="firstHalf">
            النصف الأول (يناير - يونيو)
          </button>
          <button type="button" class="btn text-xs py-1.5 px-3 rounded-xl ${currentState.periodMode === 'secondHalf' ? 'btn-primary' : 'btn-outline'}" data-mode="secondHalf">
            النصف الثاني (يوليو - ديسمبر)
          </button>
          <button type="button" class="btn text-xs py-1.5 px-3 rounded-xl ${currentState.periodMode === 'fullYear' ? 'btn-primary' : 'btn-outline'}" data-mode="fullYear">
            السنة الحالية كاملة
          </button>
          <button type="button" class="btn text-xs py-1.5 px-3 rounded-xl ${currentState.periodMode === 'custom' ? 'btn-primary' : 'btn-outline'}" data-mode="custom">
            فترة مخصصة
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-500 whitespace-nowrap">من تاريخ:</label>
            <input type="date" id="input-from-date" class="form-input text-xs py-1.5" value="${currentState.fromDate}" ${currentState.periodMode !== 'custom' ? 'disabled' : ''} />
            <label class="text-xs text-gray-500 whitespace-nowrap">إلى:</label>
            <input type="date" id="input-to-date" class="form-input text-xs py-1.5" value="${currentState.toDate}" ${currentState.periodMode !== 'custom' ? 'disabled' : ''} />
            ${
              currentState.periodMode === 'custom'
                ? `<button type="button" class="btn btn-primary text-xs py-1.5 px-3" id="btn-apply-custom">تطبيق</button>`
                : ''
            }
          </div>

          <div class="flex items-center sm:justify-end">
            <label class="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input type="checkbox" id="check-compare-prev" class="w-4 h-4 accent-emerald-600 rounded" ${currentState.compareWithPrevious ? 'checked' : ''} />
              مقارنة بالفترة السابقة المشابهة (${formatDateArabic(getPreviousComparisonPeriod(currentState.fromDate, currentState.toDate).fromDate)} إلى ${formatDateArabic(getPreviousComparisonPeriod(currentState.fromDate, currentState.toDate).toDate)})
            </label>
          </div>
        </div>
      </div>

      <!-- لافتة ملخص الفترة المطبوعة -->
      <div class="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
        <div>
          <span class="font-bold">نطاق التقرير الفعلي:</span> من ${formatDateArabic(currentState.fromDate)} إلى ${formatDateArabic(currentState.toDate)}
        </div>
        ${
          prevReport
            ? `<div class="text-xs text-emerald-700 font-semibold">مقارن مع: ${formatDateArabic(prevReport.fromDate)} إلى ${formatDateArabic(prevReport.toDate)}</div>`
            : ''
        }
      </div>

      <!-- 1. نسب الأداء ومؤشرات الإنتاج الأساسية -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            ${icons.egg || ''} معدلات الأداء والإنتاجية
          </h2>
          <button type="button" class="text-xs font-semibold text-emerald-700 hover:underline print:hidden" id="btn-toggle-over20">
            ${currentState.showOver20DaysRate ? 'إخفاء معدل ما بعد 20 يوماً' : 'عرض معدل بقاء ما بعد 20 يوماً'}
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- نسبة التخصيب -->
          <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div class="text-xs font-semibold text-gray-500">نسبة التخصيب للبيض</div>
            <div class="text-2xl font-bold mt-1 ${report.fertilityRate !== null && report.fertilityRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
              ${report.fertilityRate !== null ? report.fertilityRate + '%' : '<span class="text-sm font-normal text-gray-400">بيانات غير كافية</span>'}
            </div>
            ${renderComparisonDelta(report.fertilityRate, prevReport?.fertilityRate, '%')}
            <div class="text-[11px] text-gray-400 mt-2 leading-tight">
              ${report.fertilityRateFormula}
            </div>
            <div class="text-[11px] text-gray-600 mt-1 font-medium">
              المخصب: ${report.fertileEggs} • الرايق: ${report.infertileEggs}
            </div>
          </div>

          <!-- نسبة الفقس -->
          <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div class="text-xs font-semibold text-gray-500">نسبة الفقس للبيض المستحق</div>
            <div class="text-2xl font-bold mt-1 ${report.hatchRate !== null && report.hatchRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
              ${report.hatchRate !== null ? report.hatchRate + '%' : '<span class="text-sm font-normal text-gray-400">بيانات غير كافية</span>'}
            </div>
            ${renderComparisonDelta(report.hatchRate, prevReport?.hatchRate, '%')}
            <div class="text-[11px] text-gray-400 mt-2 leading-tight">
              ${report.hatchRateFormula}
            </div>
            <div class="text-[11px] text-gray-600 mt-1 font-medium">
              البيض الفاقس فعلياً: ${report.hatchedEggs} بيضة
            </div>
          </div>

          <!-- نسبة النفوق ونسبة البقاء -->
          <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div class="text-xs font-semibold text-gray-500">نسبة بقاء الزغاليل الحية</div>
            <div class="text-2xl font-bold mt-1 ${report.survivalRate !== null && report.survivalRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
              ${report.survivalRate !== null ? report.survivalRate + '%' : '<span class="text-sm font-normal text-gray-400">بيانات غير كافية</span>'}
            </div>
            ${renderComparisonDelta(report.survivalRate, prevReport?.survivalRate, '%')}
            <div class="text-[11px] text-gray-400 mt-2 leading-tight">
              نسبة النفوق: ${report.mortalityRate !== null ? report.mortalityRate + '%' : 'غير متاح'} (${report.deceasedSquabs} نافق من أصل ${report.bornSquabs} ناتج)
            </div>
            <div class="text-[11px] text-gray-600 mt-1 font-medium">
              المولودة بالكامل: ${report.bornSquabs} زغلول
            </div>
          </div>

          <!-- نسبة الوصول للبيع -->
          <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
            <div class="text-xs font-semibold text-gray-500">نسبة الوصول لعمر البيع (30+ يوم)</div>
            <div class="text-2xl font-bold mt-1 ${report.saleReadinessRate !== null && report.saleReadinessRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
              ${report.saleReadinessRate !== null ? report.saleReadinessRate + '%' : '<span class="text-sm font-normal text-gray-400">بيانات غير كافية</span>'}
            </div>
            ${renderComparisonDelta(report.saleReadinessRate, prevReport?.saleReadinessRate, '%')}
            <div class="text-[11px] text-gray-400 mt-2 leading-tight">
              ${report.saleReadinessRateFormula}
            </div>
            <div class="text-[11px] text-gray-600 mt-1 font-medium">
              المباعة بالفترة: ${report.soldSquabs} زغلول
            </div>
          </div>
        </div>

        ${
          currentState.showOver20DaysRate
            ? `
            <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <span class="font-bold text-blue-900">نسبة البقاء لما فوق عمر 20 يوماً (الفطام):</span>
                <span class="text-sm font-bold text-blue-800 mr-2">${report.survivalOver20DaysRate !== null ? report.survivalOver20DaysRate + '%' : 'بيانات غير كافية'}</span>
                <span class="text-blue-600 block sm:inline mt-0.5 sm:mt-0 sm:mr-3">(${report.survivalOver20DaysFormula})</span>
              </div>
            </div>
            `
            : ''
        }
      </div>

      <!-- تفصيل أعداد البيض والزغاليل في الفترة -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- البيض في الفترة -->
        <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            ${icons.egg || ''} تفصيل سجلات البيض الموضوع في الفترة (${report.laidEggs} بيضة)
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المخصب</span>
              <span class="text-base font-bold text-emerald-700">${report.fertileEggs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">الرايق (غير مخصب)</span>
              <span class="text-base font-bold text-amber-700">${report.infertileEggs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">الفاقس</span>
              <span class="text-base font-bold text-blue-700">${report.hatchedEggs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المكسور</span>
              <span class="text-base font-bold text-rose-700">${report.brokenEggs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المفقود</span>
              <span class="text-base font-bold text-gray-700">${report.lostEggs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">بانتظار الفحص</span>
              <span class="text-base font-bold text-purple-700">${report.pendingCheckEggs}</span>
            </div>
          </div>
        </div>

        <!-- الزغاليل في الفترة -->
        <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            ${icons.squab || ''} تفصيل الزغاليل والمبيعات في الفترة
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المولودة بالفترة</span>
              <span class="text-base font-bold text-gray-800">${report.bornSquabs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">الحية حالياً</span>
              <span class="text-base font-bold text-emerald-700">${report.currentlyAliveSquabs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">النافقة</span>
              <span class="text-base font-bold text-rose-700">${report.deceasedSquabs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المنقولة للتجميع</span>
              <span class="text-base font-bold text-blue-700">${report.transferredSquabs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">المباعة بالفترة</span>
              <span class="text-base font-bold text-emerald-800">${report.soldSquabs}</span>
            </div>
            <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span class="text-gray-500 block">متوسط سعر البيع</span>
              <span class="text-base font-bold text-emerald-800">${fin.averageSquabSalePrice !== null ? fin.averageSquabSalePrice + ' ج.م' : 'غير متاح'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. النتائج والتحليلات المالية للفترة -->
      <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          ${icons.finance || ''} النتائج والتحليلات المالية للفترة
        </h2>

        <!-- كروت الإجماليات المالية -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div class="text-xs font-semibold text-emerald-700">إجمالي الإيرادات الفعلية</div>
            <div class="text-2xl font-bold text-emerald-900 mt-1">
              ${fin.totalRevenue.toLocaleString('ar-EG')} <span class="text-sm font-normal">ج.م</span>
            </div>
            ${renderComparisonDelta(fin.totalRevenue, prevFin?.totalRevenue, ' ج.م')}
            <div class="text-[11px] text-emerald-700 mt-1">
              زغاليل: ${fin.squabSalesRevenue} • بالغ: ${fin.adultSalesRevenue} • أخرى: ${fin.otherRevenue}
            </div>
          </div>

          <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <div class="text-xs font-semibold text-rose-700">المصروفات غير التأسيسية</div>
            <div class="text-2xl font-bold text-rose-900 mt-1">
              ${fin.totalNonEstablishmentExpenses.toLocaleString('ar-EG')} <span class="text-sm font-normal">ج.م</span>
            </div>
            ${renderComparisonDelta(fin.totalNonEstablishmentExpenses, prevFin?.totalNonEstablishmentExpenses, ' ج.م')}
            <div class="text-[11px] text-rose-600 mt-1">
              (التشغيلية + تكاليف الإنتاج + العمليات المخصصة)
            </div>
          </div>

          <div class="p-4 ${fin.netOperatingProfit >= 0 ? 'bg-emerald-100 border-emerald-300' : 'bg-rose-100 border-rose-300'} border rounded-2xl">
            <div class="text-xs font-semibold ${fin.netOperatingProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}">صافي الربح التشغيلي للفترة</div>
            <div class="text-2xl font-bold ${fin.netOperatingProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'} mt-1">
              ${fin.netOperatingProfit.toLocaleString('ar-EG')} <span class="text-sm font-normal">ج.م</span>
            </div>
            ${renderComparisonDelta(fin.netOperatingProfit, prevFin?.netOperatingProfit, ' ج.م')}
            <div class="text-[11px] ${fin.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'} mt-1">
              الصافي بعد التأسيس: ${fin.netProfitAfterEstablishment.toLocaleString('ar-EG')} ج.م
            </div>
          </div>
        </div>

        <!-- جدول التبويب المحاسبي المنضبط للمصروفات -->
        <div class="border border-gray-200 rounded-xl overflow-hidden text-xs">
          <div class="bg-gray-50 p-2.5 font-bold text-gray-700 border-b border-gray-200">
            تفصيل التبويب المحاسبي المنضبط (دون خلط التأسيس بالتشغيل):
          </div>
          <div class="divide-y divide-gray-100">
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-gray-600">مصروفات تشغيلية (إيجار، كهرباء، عمالة، نقل...)</span>
              <span class="font-bold text-gray-800">${fin.operationalExpenses.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-gray-600">تكلفة إنتاج (شراء أعلاف، فيتامينات وأدوية...)</span>
              <span class="font-bold text-gray-800">${fin.productionCostExpenses.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-gray-600">عملية مخصصة (تطهير دوري، صيانة عاجلة...)</span>
              <span class="font-bold text-gray-800">${fin.specificOperationExpenses.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="p-2.5 flex items-center justify-between bg-amber-50/50">
              <span class="text-amber-900 font-semibold">مصروفات تأسيسية (بناء سلاكات، شراء أمهات أزواج...) — منفصلة دفترياً</span>
              <span class="font-bold text-amber-900">${fin.establishmentExpenses.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="p-2.5 flex items-center justify-between bg-blue-50/50">
              <span class="text-blue-900 font-semibold">تكلفة العلف التحليلية المستهلكة فعلياً في الفترة</span>
              <span class="font-bold text-blue-900">${fin.consumedFeedCost.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. ترتيب أفضل الأزواج في الفترة -->
      <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
              ${icons.pair || ''} أفضل الأزواج إنتاجية في الفترة
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              الأزواج المؤهلة (التي أتمت دورتين كاملتين على الأقل بالفترة). اضغط على أي عمود لإعادة الترتيب.
            </p>
          </div>

          <div class="flex items-center gap-2 text-xs print:hidden">
            <span class="text-gray-500">الترتيب حسب:</span>
            <select id="select-sort-field" class="form-select text-xs py-1 px-2.5 rounded-lg border-gray-300">
              <option value="reachedSaleCount" ${currentState.activeSortField === 'reachedSaleCount' ? 'selected' : ''}>الزغاليل الواصلة للبيع</option>
              <option value="survivalRate" ${currentState.activeSortField === 'survivalRate' ? 'selected' : ''}>نسبة البقاء</option>
              <option value="bornSquabsCount" ${currentState.activeSortField === 'bornSquabsCount' ? 'selected' : ''}>الزغاليل الناتجة</option>
              <option value="fertilityRate" ${currentState.activeSortField === 'fertilityRate' ? 'selected' : ''}>نسبة التخصيب</option>
              <option value="hatchRate" ${currentState.activeSortField === 'hatchRate' ? 'selected' : ''}>نسبة الفقس</option>
              <option value="actualRevenue" ${currentState.activeSortField === 'actualRevenue' ? 'selected' : ''}>الإيراد الفعلي</option>
            </select>
          </div>
        </div>

        <!-- دليل المؤشر اللوني -->
        <div class="flex flex-wrap items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs mb-4">
          <span class="font-bold text-gray-700">دليل المؤشر اللوني:</span>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            أخضر (ممتاز): جميع المعدلات ≥ 80%
          </span>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
            أصفر (متوسط): المعدلات ≥ 60%
          </span>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold border border-rose-300">
            أحمر (متابعة): أي معدل &lt; 60%
          </span>
        </div>

        ${
          rankedPairs.length === 0
            ? `
            <div class="p-8 text-center bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-sm">
              لا توجد أزواج أتمت دورتين مكتملتين على الأقل في هذه الفترة الزمنية.
            </div>
            `
            : `
            <div class="overflow-x-auto border border-gray-200 rounded-xl">
              <table class="w-full text-right text-xs">
                <thead class="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th class="p-3 font-bold">#</th>
                    <th class="p-3 font-bold">الزوج والسلاكة</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="completedCyclesCount">الدورات المكتملة</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="fertilityRate">التخصيب %</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="hatchRate">الفقس %</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="bornSquabsCount">الزغاليل</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="survivalRate">البقاء %</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100 text-emerald-800" data-col="reachedSaleCount">الواصل للبيع</th>
                    <th class="p-3 font-bold cursor-pointer hover:bg-gray-100" data-col="actualRevenue">الإيراد الفعلي</th>
                    <th class="p-3 font-bold text-center">التقييم</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${rankedPairs.slice(0, 10).map((item, idx) => renderPairRow(item, idx + 1)).join('')}
                </tbody>
              </table>
            </div>
            `
        }

        <!-- أزواج بدون بيانات كافية (< دورتان مكتملتان في الفترة) -->
        ${
          insufficientDataPairs.length > 0
            ? `
            <div class="mt-6 pt-4 border-t border-gray-200">
              <h3 class="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span>⚠️</span> أزواج تحتاج مزيد من الدورات للترتيب الرئيسي (${insufficientDataPairs.length} زوج - أقل من دورتين مكتملتين)
              </h3>
              <p class="text-xs text-gray-500 mb-3">
                تُعرض هذه الأزواج بأرقامها المسجلة الفعلية دون ترتيب تنافسي لعدم اكتمال الحد الأدنى من الدورات (دورتان).
              </p>

              <div class="overflow-x-auto border border-gray-200 rounded-xl">
                <table class="w-full text-right text-xs">
                  <thead class="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th class="p-2.5 font-bold">الزوج</th>
                      <th class="p-2.5 font-bold">السلاكة</th>
                      <th class="p-2.5 font-bold">الدورات المكتملة</th>
                      <th class="p-2.5 font-bold">البيض المخصب</th>
                      <th class="p-2.5 font-bold">الزغاليل الناتجة</th>
                      <th class="p-2.5 font-bold">الواصل للبيع</th>
                      <th class="p-2.5 font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    ${insufficientDataPairs.map((item) => `
                      <tr class="hover:bg-gray-50 cursor-pointer pair-row" data-pair-id="${item.pairId}">
                        <td class="p-2.5 font-bold text-gray-800">${item.pairName}</td>
                        <td class="p-2.5 text-gray-600">${item.coopNumber ? 'سلاكة ' + item.coopNumber : '—'}</td>
                        <td class="p-2.5 font-semibold text-gray-700">${item.completedCyclesCount} دورة</td>
                        <td class="p-2.5 text-gray-700">${item.fertileEggsCount}</td>
                        <td class="p-2.5 text-gray-700">${item.bornSquabsCount}</td>
                        <td class="p-2.5 font-bold text-emerald-700">${item.reachedSaleCount}</td>
                        <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600 font-semibold border border-gray-200">بيانات غير كافية</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            `
            : ''
        }
      </div>
    </div>
  `;

  container.innerHTML = html;
  bindEvents(container, report, rankedPairs, insufficientDataPairs, navigate);
}

function renderPairRow(item: PairRankingItem, rank: number): string {
  const badgeClass =
    item.colorIndicator === 'green'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : item.colorIndicator === 'yellow'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : item.colorIndicator === 'red'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : 'bg-gray-100 text-gray-600 border-gray-200';

  return `
    <tr class="hover:bg-gray-50 cursor-pointer transition pair-row" data-pair-id="${item.pairId}">
      <td class="p-3 font-bold text-gray-500">${rank}</td>
      <td class="p-3 font-bold text-gray-800">
        <div>${item.pairName}</div>
        <div class="text-[10px] text-gray-400 font-normal">${item.coopNumber ? 'سلاكة ' + item.coopNumber : 'بدون سلاكة'}</div>
      </td>
      <td class="p-3 text-gray-700 font-semibold">${item.completedCyclesCount}</td>
      <td class="p-3 font-bold ${item.fertilityRate !== null && item.fertilityRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
        ${item.fertilityRate !== null ? item.fertilityRate + '%' : 'غير متاح'}
      </td>
      <td class="p-3 font-bold ${item.hatchRate !== null && item.hatchRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
        ${item.hatchRate !== null ? item.hatchRate + '%' : 'غير متاح'}
      </td>
      <td class="p-3 text-gray-800 font-bold">${item.bornSquabsCount}</td>
      <td class="p-3 font-bold ${item.survivalRate !== null && item.survivalRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
        ${item.survivalRate !== null ? item.survivalRate + '%' : 'غير متاح'}
      </td>
      <td class="p-3 font-extrabold text-emerald-700 text-sm">${item.reachedSaleCount}</td>
      <td class="p-3 font-bold text-emerald-800">${item.actualRevenue.toLocaleString('ar-EG')} ج.م</td>
      <td class="p-3 text-center">
        <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeClass}">
          ${item.colorIndicatorLabel.split(' ')[0]}
        </span>
      </td>
    </tr>
  `;
}

function renderComparisonDelta(current: number | null, previous: number | null | undefined, unit: string = ''): string {
  if (current === null || previous === null || previous === undefined) {
    return '';
  }
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) {
    return `<div class="text-[11px] text-gray-400 font-semibold mt-0.5">مماثل للفترة السابقة (0${unit})</div>`;
  }
  const isPositive = delta > 0;
  return `
    <div class="text-[11px] ${isPositive ? 'text-emerald-600' : 'text-rose-600'} font-bold mt-0.5 flex items-center gap-1">
      <span>${isPositive ? '▲ +' : '▼ '}${delta}${unit}</span>
      <span class="text-gray-400 font-normal">مقارنة بالفترة السابقة (${previous}${unit})</span>
    </div>
  `;
}

function bindEvents(
  container: HTMLElement,
  report: ProductionReport,
  rankedPairs: PairRankingItem[],
  insufficientDataPairs: PairRankingItem[],
  navigate: (view: any, param?: any) => void
): void {
  // أزرار نمط الفترة
  container.querySelectorAll('button[data-mode]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const mode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as PeriodMode;
      currentState.periodMode = mode;
      if (mode === 'rolling6') {
        const p = getRolling6MonthsPeriod();
        currentState.fromDate = p.fromDate;
        currentState.toDate = p.toDate;
      } else if (mode === 'firstHalf') {
        const p = getFirstHalfPeriod();
        currentState.fromDate = p.fromDate;
        currentState.toDate = p.toDate;
      } else if (mode === 'secondHalf') {
        const p = getSecondHalfPeriod();
        currentState.fromDate = p.fromDate;
        currentState.toDate = p.toDate;
      } else if (mode === 'fullYear') {
        const p = getCurrentYearPeriod();
        currentState.fromDate = p.fromDate;
        currentState.toDate = p.toDate;
      }
      loadAndRender(container, navigate);
    });
  });

  // تطبيق الفترة المخصصة
  container.querySelector('#btn-apply-custom')?.addEventListener('click', () => {
    const from = (container.querySelector('#input-from-date') as HTMLInputElement)?.value;
    const to = (container.querySelector('#input-to-date') as HTMLInputElement)?.value;
    if (!from || !to) {
      showToast('يرجى تحديد تاريخ البداية والنهاية', 'error');
      return;
    }
    if (from > to) {
      showToast('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
      return;
    }
    currentState.fromDate = from;
    currentState.toDate = to;
    loadAndRender(container, navigate);
  });

  // خيار المقارنة
  container.querySelector('#check-compare-prev')?.addEventListener('change', (e) => {
    currentState.compareWithPrevious = (e.target as HTMLInputElement).checked;
    loadAndRender(container, navigate);
  });

  // تبديل عرض نسبة ما بعد 20 يوم
  container.querySelector('#btn-toggle-over20')?.addEventListener('click', () => {
    currentState.showOver20DaysRate = !currentState.showOver20DaysRate;
    loadAndRender(container, navigate);
  });

  // تغيير حقل الترتيب من القائمة
  container.querySelector('#select-sort-field')?.addEventListener('change', (e) => {
    currentState.activeSortField = (e.target as HTMLSelectElement).value as SortField;
    loadAndRender(container, navigate);
  });

  // النقر على رؤوس أعمدة جدول الترتيب
  container.querySelectorAll('th[data-col]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col') as SortField;
      if (col) {
        if (currentState.activeSortField === col) {
          currentState.sortAscending = !currentState.sortAscending;
        } else {
          currentState.activeSortField = col;
          currentState.sortAscending = false;
        }
        loadAndRender(container, navigate);
      }
    });
  });

  // النقر على صف الزوج لفتح تفاصيل تقييمه
  const allPairItems = [...rankedPairs, ...insufficientDataPairs];
  container.querySelectorAll('.pair-row').forEach((row) => {
    row.addEventListener('click', () => {
      const pId = row.getAttribute('data-pair-id');
      const item = allPairItems.find((p) => p.pairId === pId);
      if (item) {
        showPairRankingDetailModal(item, currentState.fromDate, currentState.toDate, navigate);
      }
    });
  });

  // زر تصدير CSV
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    exportReportToCSV(report, rankedPairs);
  });

  // زر الطباعة
  container.querySelector('#btn-print')?.addEventListener('click', () => {
    window.print();
  });
}

/**
 * تصدير تقرير الإنتاج والأداء وترتيب الأزواج إلى ملف CSV مع إضافة UTF-8 BOM
 * ليفتح في برنامج Excel باللغة العربية دون أي مشاكل بالترميز
 */
function exportReportToCSV(report: ProductionReport, rankedPairs: PairRankingItem[]): void {
  const fin = report.financials;

  const rows: string[][] = [];

  rows.push(['تقرير الإنتاج والأداء الشامل - مزرعة الحمام']);
  rows.push(['الفترة المحاسبية من', report.fromDate, 'إلى', report.toDate]);
  rows.push([]);

  // مؤشرات الإنتاج
  rows.push(['--- معدلات الأداء والإنتاجية ---']);
  rows.push(['المؤشر', 'القيمة', 'القاعدة الحسابية']);
  rows.push(['نسبة التخصيب', report.fertilityRate !== null ? `${report.fertilityRate}%` : 'بيانات غير كافية', report.fertilityRateFormula]);
  rows.push(['نسبة الفقس', report.hatchRate !== null ? `${report.hatchRate}%` : 'بيانات غير كافية', report.hatchRateFormula]);
  rows.push(['نسبة النفوق', report.mortalityRate !== null ? `${report.mortalityRate}%` : 'بيانات غير كافية', report.mortalityRateFormula]);
  rows.push(['نسبة البقاء', report.survivalRate !== null ? `${report.survivalRate}%` : 'بيانات غير كافية', report.survivalRateFormula]);
  rows.push(['نسبة البقاء لما فوق 20 يوماً', report.survivalOver20DaysRate !== null ? `${report.survivalOver20DaysRate}%` : 'بيانات غير كافية', report.survivalOver20DaysFormula]);
  rows.push(['نسبة الوصول للبيع (30+ يوم)', report.saleReadinessRate !== null ? `${report.saleReadinessRate}%` : 'بيانات غير كافية', report.saleReadinessRateFormula]);
  rows.push([]);

  // سجلات البيض والزغاليل
  rows.push(['--- تفصيل البيض والزغاليل بالفترة ---']);
  rows.push(['البيض الموضوع', String(report.laidEggs)]);
  rows.push(['البيض المخصب', String(report.fertileEggs)]);
  rows.push(['البيض الرايق', String(report.infertileEggs)]);
  rows.push(['البيض الفاقس', String(report.hatchedEggs)]);
  rows.push(['البيض المكسور', String(report.brokenEggs)]);
  rows.push(['البيض المفقود', String(report.lostEggs)]);
  rows.push(['الزغاليل المولودة', String(report.bornSquabs)]);
  rows.push(['الزغاليل النافقة', String(report.deceasedSquabs)]);
  rows.push(['الزغاليل المنقولة للتجميع', String(report.transferredSquabs)]);
  rows.push(['الزغاليل المباعة', String(report.soldSquabs)]);
  rows.push([]);

  // المالية
  rows.push(['--- التحليل المالي للفترة (ج.م) ---']);
  rows.push(['إجمالي الإيرادات', String(fin.totalRevenue)]);
  rows.push(['مبيعات الزغاليل', String(fin.squabSalesRevenue)]);
  rows.push(['مبيعات الحمام البالغ', String(fin.adultSalesRevenue)]);
  rows.push(['إيرادات أخرى', String(fin.otherRevenue)]);
  rows.push(['متوسط سعر بيع الزغلول', fin.averageSquabSalePrice !== null ? String(fin.averageSquabSalePrice) : 'غير متاح']);
  rows.push(['المصروفات التشغيلية', String(fin.operationalExpenses)]);
  rows.push(['تكلفة الإنتاج', String(fin.productionCostExpenses)]);
  rows.push(['العمليات المخصصة', String(fin.specificOperationExpenses)]);
  rows.push(['المصروفات التأسيسية', String(fin.establishmentExpenses)]);
  rows.push(['تكلفة العلف التحليلية المستهلكة', String(fin.consumedFeedCost)]);
  rows.push(['صافي الربح التشغيلي', String(fin.netOperatingProfit)]);
  rows.push(['صافي الربح بعد التأسيس', String(fin.netProfitAfterEstablishment)]);
  rows.push([]);

  // ترتيب الأزواج
  rows.push(['--- ترتيب أفضل الأزواج في الفترة ---']);
  rows.push([
    'الترتيب',
    'اسم الزوج',
    'السلاكة',
    'الدورات المكتملة',
    'التخصيب %',
    'الفقس %',
    'الزغاليل المولودة',
    'نسبة البقاء %',
    'الواصل للبيع',
    'الإيراد الفعلي (ج.م)',
    'المؤشر اللوني',
  ]);

  rankedPairs.forEach((p, idx) => {
    rows.push([
      String(idx + 1),
      p.pairName,
      p.coopNumber ? `سلاكة ${p.coopNumber}` : '—',
      String(p.completedCyclesCount),
      p.fertilityRate !== null ? `${p.fertilityRate}%` : 'غير متاح',
      p.hatchRate !== null ? `${p.hatchRate}%` : 'غير متاح',
      String(p.bornSquabsCount),
      p.survivalRate !== null ? `${p.survivalRate}%` : 'غير متاح',
      String(p.reachedSaleCount),
      String(p.actualRevenue),
      p.colorIndicatorLabel,
    ]);
  });

  const csvContent =
    '\uFEFF' +
    rows
      .map((r) =>
        r
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `PigeonFarm_Report_${report.fromDate}_to_${report.toDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('تم تصدير ملف CSV بنجاح', 'success');
}
