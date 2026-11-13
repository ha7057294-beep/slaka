import { Egg, FarmSettings, Squab } from '../types';

/**
 * إرجاع تاريخ اليوم بصيغة YYYY-MM-DD المحلية
 */
export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * إرجاع أول يوم في الشهر الحالي بصيغة YYYY-MM-DD
 */
export function getFirstDayOfMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * إضافة عدد محدد من الأيام إلى تاريخ YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * حساب الفرق بالأيام بين تاريخين (toDate - fromDate)
 */
export function daysDifference(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1).getTime();
  const date2 = new Date(y2, m2 - 1, d2).getTime();
  const diffTime = date2 - date1;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/**
 * تنسيق التاريخ للعربية بصيغة واضحة ومقروءة
 */
export function formatDateArabic(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  const monthName = ARABIC_MONTHS[month - 1] || parts[1];
  return `${day} ${monthName} ${year}`;
}

/**
 * تنسيق التاريخ والوقت للأحداث (ISO string)
 */
export function formatDateTimeArabic(isoStr: string): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    const datePart = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${datePart} ${hours}:${minutes} ${ampm}`;
  } catch {
    return isoStr;
  }
}

/**
 * حساب عمر الزغلول بالأيام من تاريخ الفقس فقط
 * إذا كان الزغلول نافقاً، يتم حساب العمر وقت النفوق
 */
export function getSquabAge(hatchDate: string, deathDate?: string): number {
  if (!hatchDate) return 0;
  const targetDate = deathDate && deathDate.trim() ? deathDate.trim() : getTodayDate();
  const age = daysDifference(hatchDate, targetDate);
  return Math.max(0, age);
}

/**
 * تنسيق العمر بالعربية
 */
export function formatAgeArabic(days: number): string {
  if (days === 0) return 'يوم الفقس (عمر 0)';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوماً`;
}

/**
 * حساب موعد البيع المستهدف أو الفعلي للزغلول (المرحلة الثالثة)
 * إن كان هناك تأجيل، يُعتمد تاريخ التأجيل، وإلا 30 يوماً من الفقس
 */
export function getEffectiveSaleDate(squab: Squab): string {
  if (squab.postponedUntil && squab.postponedUntil.trim()) {
    return squab.postponedUntil.trim();
  }
  if (squab.targetSaleDate && squab.targetSaleDate.trim()) {
    return squab.targetSaleDate.trim();
  }
  return addDays(squab.hatchDate, 30);
}

/**
 * التحقق مما إذا كان الزغلول قد بلغ عمر البيع (30 يوماً فأكثر)
 */
export function isSquabReadyForSale(squab: Squab): boolean {
  if (squab.status === 'deceased' || squab.status === 'sold') return false;
  const age = getSquabAge(squab.hatchDate);
  return age >= 30;
}

export interface EggSchedule {
  expectedCheckDate: string;
  expectedHatchDate: string;
  daysSinceLaid: number;
  daysUntilCheck: number;
  isCheckDue: boolean;
  daysUntilHatch: number;
  isHatchDue: boolean;
  isHatchingSoon: boolean; // متوقع فقسه خلال 3 أيام
  statusText: string;
  statusClass: string;
  badgeBg: string;
  badgeText: string;
  countdownText: string;
}

/**
 * حساب مواعيد البيضة وجدول الفحص والفقس المتوقع بناءً على إعدادات المزرعة
 */
export function getEggSchedule(egg: Egg, settings: FarmSettings): EggSchedule {
  const today = getTodayDate();
  const daysSinceLaid = daysDifference(egg.laidDate, today);
  const expectedCheckDate = addDays(egg.laidDate, settings.fertilityCheckDays);
  const expectedHatchDate = addDays(egg.laidDate, settings.incubationDays);
  
  const daysUntilCheck = daysDifference(today, expectedCheckDate);
  const isCheckDue = egg.status === 'pending' && daysUntilCheck <= 0;
  
  const daysUntilHatch = daysDifference(today, expectedHatchDate);
  const isHatchDue = egg.status === 'fertile' && daysUntilHatch <= 0;
  const isHatchingSoon = egg.status === 'fertile' && daysUntilHatch <= 3;

  let statusText = 'قيد الحضن';
  let statusClass = 'text-amber-800 bg-amber-50 border-amber-200';
  let badgeBg = '#FEF3C7';
  let badgeText = '#92400E';
  let countdownText = '';

  switch (egg.status) {
    case 'pending':
      statusText = 'بانتظار الفحص';
      badgeBg = 'var(--badge-egg-bg)';
      badgeText = 'var(--badge-egg-text)';
      statusClass = 'text-amber-900 bg-amber-100 border-amber-300';
      if (daysUntilCheck > 0) {
        countdownText = `موعد الفحص بعد ${daysUntilCheck} يوم (${formatDateArabic(expectedCheckDate)})`;
      } else if (daysUntilCheck === 0) {
        countdownText = `موعد فحص التخصيب اليوم!`;
      } else {
        countdownText = `حان موعد الفحص (متأخر ${Math.abs(daysUntilCheck)} يوم)`;
      }
      break;

    case 'fertile':
      statusText = 'مخصبة';
      badgeBg = 'var(--badge-active-bg)';
      badgeText = 'var(--badge-active-text)';
      statusClass = 'text-emerald-900 bg-emerald-100 border-emerald-300';
      if (daysUntilHatch > 0) {
        countdownText = `موعد الفقس المتوقع بعد ${daysUntilHatch} يوم (${formatDateArabic(expectedHatchDate)})`;
      } else if (daysUntilHatch === 0) {
        countdownText = `موعد الفقس المتوقع اليوم!`;
      } else {
        countdownText = `تجاوزت موعد الفقس بـ ${Math.abs(daysUntilHatch)} يوم`;
      }
      break;

    case 'infertile':
      statusText = 'رايقة (غير مخصبة)';
      badgeBg = 'var(--border-subtle)';
      badgeText = 'var(--text-body)';
      statusClass = 'text-gray-700 bg-gray-100 border-gray-300';
      countdownText = egg.checkDate ? `تم الفحص بتاريخ ${formatDateArabic(egg.checkDate)}` : 'تم تأكيد عدم التخصيب';
      break;

    case 'broken':
      statusText = 'مكسورة';
      badgeBg = 'var(--danger-bg)';
      badgeText = 'var(--danger)';
      statusClass = 'text-rose-900 bg-rose-100 border-rose-300';
      countdownText = egg.brokenDate ? `كُسرت بتاريخ ${formatDateArabic(egg.brokenDate)}${egg.brokenReason ? ' (' + egg.brokenReason + ')' : ''}` : 'تم تسجيل كسر البيضة';
      break;

    case 'lost':
      statusText = 'مفقودة';
      badgeBg = 'var(--danger-bg)';
      badgeText = 'var(--danger)';
      statusClass = 'text-rose-900 bg-rose-100 border-rose-300';
      countdownText = egg.brokenDate ? `فُقدت بتاريخ ${formatDateArabic(egg.brokenDate)}${egg.brokenReason ? ' (' + egg.brokenReason + ')' : ''}` : 'تم تسجيل فقد البيضة';
      break;

    case 'hatched':
      statusText = 'فقست ✓';
      badgeBg = 'var(--badge-squab-bg)';
      badgeText = 'var(--badge-squab-text)';
      statusClass = 'text-sky-900 bg-sky-100 border-sky-300';
      countdownText = egg.hatchDate ? `فقست بنجاح بتاريخ ${formatDateArabic(egg.hatchDate)}` : 'فقست بنجاح';
      break;
  }

  return {
    expectedCheckDate,
    expectedHatchDate,
    daysSinceLaid,
    daysUntilCheck,
    isCheckDue,
    daysUntilHatch,
    isHatchDue,
    isHatchingSoon,
    statusText,
    statusClass,
    badgeBg,
    badgeText,
    countdownText,
  };
}

/**
 * إرجاع فترة آخر 6 أشهر متحركة حتى اليوم
 */
export function getRolling6MonthsPeriod(): { fromDate: string; toDate: string } {
  const toDate = getTodayDate();
  const [year, month, day] = toDate.split('-').map(Number);
  const targetDate = new Date(year, month - 1 - 6, day);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const fromDate = `${y}-${m}-${d}`;
  return { fromDate, toDate };
}

/**
 * إرجاع فترة النصف الأول (يناير - يونيو)
 */
export function getFirstHalfPeriod(targetYear?: number): { fromDate: string; toDate: string } {
  const year = targetYear || new Date().getFullYear();
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-06-30`,
  };
}

/**
 * إرجاع فترة النصف الثاني (يوليو - ديسمبر)
 */
export function getSecondHalfPeriod(targetYear?: number): { fromDate: string; toDate: string } {
  const year = targetYear || new Date().getFullYear();
  return {
    fromDate: `${year}-07-01`,
    toDate: `${year}-12-31`,
  };
}

/**
 * إرجاع فترة السنة الكاملة
 */
export function getCurrentYearPeriod(targetYear?: number): { fromDate: string; toDate: string } {
  const year = targetYear || new Date().getFullYear();
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
  };
}

/**
 * حساب الفترة السابقة المقارنة بنفس الطول الزمني
 */
export function getPreviousComparisonPeriod(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
  const diffDays = Math.max(1, daysDifference(fromDate, toDate) + 1);
  const prevToDate = addDays(fromDate, -1);
  const prevFromDate = addDays(prevToDate, -(diffDays - 1));
  return { fromDate: prevFromDate, toDate: prevToDate };
}

