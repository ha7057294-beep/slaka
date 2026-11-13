// نموذج بيانات نظام إدارة مزرعة الحمام (المراحل 1 و 2 و 3)

export type CoopType = 'production' | 'collection'; // إنتاج أو تجميع

export interface Coop {
  id: string;
  number: string; // رقم أو رمز السلاكة (مثال: "1" أو "أ-12")
  type: CoopType; // نوع السلاكة (إنتاج / تجميع)
  active: boolean; // نشطة أو متوقفة (الإيقاف بدل الحذف)
  notes?: string; // ملاحظات اختيارية
  isDemo?: boolean; // علامة لتمييز البيانات التجريبية
  createdAt: string; // تاريخ الإنشاء
}

export type PairStatus = 'active' | 'inactive'; // نشط أو متوقف

export interface PairBirdCountRecord {
  date: string; // تاريخ السريان YYYY-MM-DD
  birdCount: number; // عدد الطيور في الزوج (مثال: 2، أو 1 عند نفوق أحدهما، أو استبدال)
  reason: string; // سبب التغيير (نفوق/بيع/استبدال أحد الطيرين...)
}

export interface Pair {
  id: string;
  name: string; // اسم أو رمز الزوج
  breed?: string; // نوع الحمام (بلدي، فرنساوي...)
  coopId: string | null; // السلاكة التابع لها (أو فارغة إذا لم يعين)
  maleInfo: string; // بيانات الذكر (رقم الدبلة، اللون، المواصفات...)
  femaleInfo: string; // بيانات الأنثى (رقم الدبلة، اللون، المواصفات...)
  pairedDate: string; // تاريخ التكوين (YYYY-MM-DD)
  status: PairStatus; // نشط أو متوقف
  currentBirdCount?: number; // العدد الفعلي الحالي للطيور (افتراضياً 2)
  birdCountHistory?: PairBirdCountRecord[]; // سجل تواريخ وأسباب تغيير عدد الطيور
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
}

export type CycleStatus = 'active' | 'completed' | 'abandoned';

export interface Cycle {
  id: string;
  pairId: string;
  coopId: string;
  cycleNumber: number; // رقم العش/الدورة للزوج (1، 2، 3...)
  startDate: string; // تاريخ بداية العش (YYYY-MM-DD)
  endDate?: string; // تاريخ انتهاء العش (YYYY-MM-DD)
  status: CycleStatus;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
}

export type EggStatus = 'pending' | 'fertile' | 'infertile' | 'broken' | 'lost' | 'hatched';

export interface Egg {
  id: string;
  cycleId: string;
  pairId: string;
  coopId: string;
  eggNumber: 1 | 2; // البيضة الأولى أو الثانية
  laidDate: string; // تاريخ الوضع (YYYY-MM-DD)
  status: EggStatus; // حالة البيضة
  checkDate?: string; // تاريخ فحص التخصيب
  brokenDate?: string; // تاريخ الكسر أو الفقدان
  brokenReason?: string; // سبب الكسر أو الفقدان
  hatchDate?: string; // تاريخ الفقس الفعلي
  isDemo?: boolean;
  createdAt: string;
}

// الحالات المحددة للزغلول: حي في الإنتاج، منقول إلى التجميع، مباع، نافق
export type SquabStatus = 'alive_production' | 'transferred_collection' | 'sold' | 'deceased';

export interface SquabWeightRecord {
  id: string;
  date: string; // تاريخ الوزن YYYY-MM-DD
  weightGrams: number; // الوزن بالجرام
  note?: string; // ملاحظة اختيارية
}

// سجل الزغلول الفردي (المرحلة الثانية والثالثة)
export interface Squab {
  id: string; // رقم تعريفي فريد
  codeNumber: string; // رقم تعريفي مميز ومختصر (مثل "زغلول #1")
  eggId: string; // البيضة التي فقس منها
  pairId: string; // الزوج الأصلي (ثابت لا يتغير)
  originCoopId: string; // السلاكة الأصلية (ثابت لا يتغير)
  currentLocationId: string; // مكان التواجد الحالي (سلاكة الإنتاج أو سلاكة التجميع)
  cycleId: string; // الدورة / العش
  hatchDate: string; // تاريخ الفقس (YYYY-MM-DD) - العمر يُحسب دائماً منه فقط
  status: SquabStatus; // الحالة
  weights: SquabWeightRecord[]; // سجل الأوزان المسجلة مع تواريخها
  illnessOrInjury?: string; // المرض أو الإصابة إن وُجدت
  notes?: string; // ملاحظات عامة
  
  // بيانات النقل إلى التجميع (المرحلة الثالثة)
  batchId?: string; // الدفعة المرتبط بها في سلاكة التجميع
  transferDate?: string; // تاريخ النقل (YYYY-MM-DD)
  ageAtTransfer?: number; // العمر بالأيام عند النقل
  targetSaleDate?: string; // موعد البيع المستهدف (= تاريخ الفقس + 30 يوماً)
  postponedUntil?: string; // تاريخ تأجيل البيع إن وُجد (YYYY-MM-DD)
  postponeReason?: string; // سبب تأجيل البيع (مثال: الوزن)

  // بيانات النفوق
  deathDate?: string; // تاريخ النفوق إن وجد (YYYY-MM-DD)
  deathReason?: string; // سبب النفوق إن وجد
  deathAgeDays?: number; // العمر بالأيام وقت النفوق (محسوب تلقائياً)
  isDemo?: boolean;
  createdAt: string;
}

// دفعة التجميع (المرحلة الثالثة)
export type BatchStatus = 'rearing' | 'ready_for_sale' | 'fully_sold' | 'closed';

export interface Batch {
  id: string;
  batchNumber: string; // رقم تلقائي (مثل: "دفعة #1")
  collectionCoopId: string; // سلاكة التجميع التي توجد بها الدفعة
  transferDate: string; // تاريخ نقل الدفعة (YYYY-MM-DD)
  status: BatchStatus; // قيد التربية / جاهزة للبيع / مباعة بالكامل / مغلقة
  note?: string; // ملاحظات الدفعة
  isDemo?: boolean;
  createdAt: string;
}

// عملية البيع (المرحلة الثالثة)
export interface Sale {
  id: string;
  date: string; // تاريخ البيع (YYYY-MM-DD)
  totalAmount: number; // المبلغ الإجمالي الفعلي المسجل
  buyer?: string; // اسم المشتري (اختياري)
  note?: string; // ملاحظات البيع
  isDemo?: boolean;
  createdAt: string;
}

// بند البيع لكل زغلول فردي
export interface SaleItem {
  id: string;
  saleId: string;
  squabId: string;
  price: number; // سعر بيع الزغلول الفردي
  isDemo?: boolean;
}

// -------------------------------------------------------------
// المخزون والعلف (المرحلة الرابعة)
// -------------------------------------------------------------
export interface FeedType {
  id: string;
  name: string; // اسم نوع العلف (مثال: علف تسمين 21%، خلطة كلفة حمام)
  unit: string; // وحدة القياس (الافتراضي: كجم)
  alertThresholdKg: number; // حد التنبيه عند الانخفاض (كجم)
  active: boolean; // نشط أو متوقف
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
}

export type StockMovementType = 'purchase' | 'consumption' | 'manual_adjustment';

export interface StockMovement {
  id: string;
  feedTypeId: string;
  date: string; // YYYY-MM-DD
  quantity: number; // بالـ كجم (+ للشراء أو التعديل الموجب، - للاستهلاك أو التعديل السالب)
  type: StockMovementType;
  reason: string; // سبب الحركة
  unitPrice?: number; // سعر شراء الكيلو (عند الشراء)
  totalCost?: number; // إجمالي التكلفة عند الشراء (quantity * unitPrice)
  supplier?: string; // المورد (اختياري)
  expenseId?: string; // معرف المصروف المرتبط المنشأ تلقائياً عند الشراء
  dailyConsumptionDate?: string; // تاريخ يوم الاستهلاك الآلي لمنع التكرار
  isDemo?: boolean;
  createdAt: string;
}

// معدلات استهلاك العلف اليومية مع تاريخ سريان (المرحلة الرابعة)
export interface FeedRateConfig {
  id: string;
  effectiveFromDate: string; // YYYY-MM-DD (ساري من تاريخ كي لا يتغير الماضي)
  adultGrams: number; // معدل الحمام البالغ بالجرام / طائر / يوم
  prodSquabGrams: number; // معدل زغلول في سلاكة إنتاج بالجرام / زغلول / يوم
  collSquabGrams: number; // معدل زغلول في سلاكة تجميع بالجرام / زغلول / يوم
  note?: string;
  createdAt: string;
}

// سجل الاستهلاك اليومي للعلف لكل تاريخ (يُحدث ولا يُضاف لمنع التكرار)
export interface DailyFeedConsumption {
  date: string; // YYYY-MM-DD (مفتاح فريد لليوم)
  feedTypeId: string;
  adultBirdsCount: number;
  prodSquabsCount: number;
  collSquabsCount: number;
  adultGramsTotal: number;
  prodSquabsGramsTotal: number;
  collSquabsGramsTotal: number;
  totalKg: number;
  cost: number; // التكلفة بناءً على متوسط سعر الشراء المرجح
  hasConfiguredRates: boolean; // هل توجد معدلات مسجلة لهذا التاريخ
  updatedAt: string;
}

// -------------------------------------------------------------
// المصروفات والإيرادات (المرحلة الرابعة)
// -------------------------------------------------------------
export type ExpenseCategory =
  | 'feed' // علف وحبوب
  | 'feed_purchase' // شراء علف
  | 'pigeon_purchase' // شراء حمام
  | 'medication' // أدوية وعلاج
  | 'equipment' // معدات ومستلزمات
  | 'utilities' // كهرباء ومياه ومرافق
  | 'breeding_supplies' // مستلزمات تربية
  | 'maintenance' // صيانة وتطهير ونظافة
  | 'operational' // تشغيلية
  | 'other'; // أخرى

export type AccountingType =
  | 'establishment' // تأسيس (أصول وبنية أساسية)
  | 'operational' // تشغيلي (فواتير، مستهلكات)
  | 'production_cost' // تكلفة إنتاج (علف، علاج، تطعيمات)
  | 'specific_operation'; // مرتبط بعملية معينة (سلاكة/دفعة/زوج محدد)

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // القيمة بالجنيه
  category: ExpenseCategory;
  accountingType: AccountingType; // النوع المحاسبي من الأربعة دون خلط
  description: string;
  payee?: string; // الجهة المستفيدة / المدفوع له
  note?: string;
  coopId?: string; // ربط اختياري بسلاكة
  pairId?: string; // ربط اختياري بزوج
  batchId?: string; // ربط اختياري بدفعة
  feedPurchaseId?: string; // ربط بحركة الشراء بالمخزون
  feedPurchaseStockMovementId?: string; // اسم بديل للربط
  active: boolean; // نشط أو موقوف (الإيقاف بدل الحذف)
  isDemo?: boolean;
  createdAt: string;
}

export type ManualRevenueCategory = 'adult_sale' | 'other' | 'other_revenue';

export interface ManualRevenue {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // القيمة بالجنيه
  category: ManualRevenueCategory;
  description: string;
  buyer?: string; // المشتري (اختياري)
  note?: string;
  active: boolean; // نشط أو موقوف
  isDemo?: boolean;
  createdAt: string;
}

// نتائج التحليل المالي لفترة محددة
export interface FinancialResults {
  fromDate: string;
  toDate: string;
  
  // الإيرادات الفعلية
  squabSalesRevenue: number;
  adultSalesRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  
  // المصروفات مقسمة بالنوع المحاسبي
  establishmentExpenses: number;
  operationalExpenses: number;
  productionCostExpenses: number;
  specificOperationExpenses: number;
  totalExpenses: number;
  totalNonEstablishmentExpenses: number; // غير التأسيسية
  
  // النتائج وصافي الأرباح
  netOperatingProfit: number; // صافي التشغيل = الإيرادات - المصروفات غير التأسيسية
  netProfitAfterEstablishment: number; // الصافي بعد التأسيس = الإيرادات - إجمالي المصروفات
  
  // مؤشرات تحليلية
  consumedFeedCost: number; // تكلفة العلف المستهلك (مؤشر تحليلي فقط)
  soldSquabsCount: number;
  averageSquabSalePrice: number | null; // متوسط سعر البيع الفعلي للزغلول أو null إذا لم توجد مبيعات
}

export type EntityType =
  | 'coop'
  | 'pair'
  | 'cycle'
  | 'egg'
  | 'squab'
  | 'batch'
  | 'sale'
  | 'feed_type'
  | 'stock_movement'
  | 'feed_rate'
  | 'expense'
  | 'revenue'
  | 'settings';

export interface FarmEvent {
  id: string;
  entityType: EntityType;
  entityId: string;
  type: string; // نوع الحدث
  date: string; // تاريخ ووقت الحدث بدقة (ISO)
  oldValue?: string | null; // القيمة السابقة عند التصحيح
  newValue?: string | null; // القيمة الجديدة
  note?: string; // سبب التعديل أو ملاحظة الحدث
}

export interface AlertPreferences {
  fertilityCheck: boolean; // فحص تخصيب
  hatchExpected: boolean; // فقس متوقع
  eggLayingExpected: boolean; // وضع بيض متوقع
  readyForTransfer: boolean; // زغاليل جاهزة للنقل (20 يوم)
  batchReadyForSale: boolean; // دفعات جاهزة للمتابعة والبيع (30 يوم)
  lowFeedStock: boolean; // انخفاض المخزون
}

export interface PairRankingThresholds {
  greenMinRate: number; // النسبة الدنيا للأخضر (افتراضياً 80%)
  yellowMinRate: number; // النسبة الدنيا للأصفر (افتراضياً 60%)
}

export interface FarmSettings {
  id: 'global_settings';
  incubationDays: number; // مدة الحضن المتوقعة بالأيام (افتراضي 18)
  fertilityCheckDays: number; // مدة فحص التخصيب بالأيام (افتراضي 7)
  weaningAgeDays: number; // عمر الجاهزية للنقل / الفطام بالأيام (افتراضي 20)
  targetSaleAgeDays: number; // عمر البيع المستهدف بالأيام (افتراضي 30)
  primaryFeedTypeId?: string; // نوع العلف الأساسي للاستهلاك التلقائي
  alertPreferences?: AlertPreferences;
  pairRankingThresholds?: PairRankingThresholds;
  lastBackupDate?: string; // تاريخ آخر تصدير للنسخة الاحتياطية YYYY-MM-DD
  backupReminderDays?: number; // تذكير بالنسخ كل كم يوم (افتراضي 7، أو 0 للإيقاف)
  updatedAt: string;
}

// إحصائيات حية محسوبة دائمًا من السجلات الفعلية (غير مخزنة)
export interface FarmStats {
  totalCoops: number;
  activeCoops: number;
  inactiveCoops: number;
  occupiedCoops: number; // مشغولة (بها أزواج أو بيض أو زغاليل حية)
  emptyCoops: number; // فارغة (نشطة وبلا طيور)
  productionCoops: number;
  collectionCoops: number;
  
  totalPairs: number;
  activePairs: number;
  inactivePairs: number;
  totalLivingBirds: number; // إجمالي الحمام الموجود (أمهات بالغة + زغاليل حية)
  
  // إحصائيات البيض الحالي
  currentIncubatingEggs: number; // البيض النشط (قيد الفحص أو مخصب)
  pendingCheckEggs: number; // بانتظار فحص التخصيب
  overdueCheckEggs: number; // حان موعد فحصها
  fertileEggs: number; // بيض مخصب ينتظر الفقس
  infertileEggs: number; // رايقة
  brokenEggs: number; // مكسورة
  lostEggs: number; // مفقودة
  hatchedEggs: number; // بيض فقس
  eggsHatchingIn3Days: number; // بيض متوقع فقسه خلال 3 أيام
  totalHistoricalEggs: number; // إجمالي كل البيض المسجل تاريخياً

  // إحصائيات الزغاليل (المراحل 2 و 3)
  totalHistoricalSquabs: number; // إجمالي الزغاليل التي فقست
  liveSquabsProduction: number; // الزغاليل الحية في الإنتاج
  liveSquabsCollection: number; // الزغاليل الحية في سلاكات التجميع
  readyForTransferSquabs: number; // الزغاليل الجاهزة للنقل (عمر 20 يوم فأكثر في الإنتاج)
  readyForSaleSquabs: number; // الزغاليل التي بلغت عمر البيع (عمر 30 يوم فأكثر وحية)
  soldSquabs: number; // إجمالي الزغاليل المباعة
  deceasedSquabs: number; // الزغاليل النافقة
  
  // المبيعات والمالية (المرحلتين 3 و 4)
  totalSalesRevenue: number; // إجمالي مبيعات الزغاليل الفعلية
  totalSalesCount: number; // عدد عمليات بيع الزغاليل
  totalRevenuesAmount: number; // إجمالي كل الإيرادات الفعلية (زغاليل + بالغ + أخرى)
  totalExpensesAmount: number; // إجمالي كل المصروفات المسجلة
  netOperatingProfit: number; // صافي الربح التشغيلي
  netProfitAfterEstablishment: number; // صافي الربح بعد التأسيس
  
  // المخزون والعلف (المرحلة الرابعة)
  totalAvailableFeedKg: number; // كمية العلف المتوفرة الإجمالية بالكيلو
  lowStockFeedTypesCount: number; // عدد أنواع العلف التي انخفضت عن حد الأمان
  averageDailyFeedConsumptionKg: number; // متوسط الاستهلاك اليومي الفعلي للعلف بالكيلو
}

// إحصائيات الزوج المستخرجة لحظياً
export interface PairStats {
  totalEggs: number;
  fertileEggs: number;
  infertileEggs: number;
  brokenEggs: number;
  lostEggs: number;
  hatchedEggs: number;
  totalSquabs: number;
  deceasedSquabs: number;
  liveSquabs: number;
  transferredSquabs: number; // زغاليله المنقولة للتجميع
  soldSquabs: number; // زغاليله المباعة
  salesRevenue: number; // قيمة مبيعات زغاليله الفعلية المسجلة
}

// مهام وتنبيهات اليوم
export type TaskType =
  | 'fertility_check'
  | 'hatch_expected'
  | 'egg_laying_expected'
  | 'ready_for_transfer'
  | 'ready_for_sale'
  | 'low_feed_stock'
  | 'backup_reminder';

export interface TodayTask {
  id: string;
  type: TaskType;
  title: string;
  subtitle: string;
  coopId?: string;
  coopNumber?: string;
  batchId?: string;
  pairId?: string;
  pairName?: string;
  eggId?: string;
  squabId?: string;
  feedTypeId?: string;
  isUrgent: boolean;
  snoozedUntil?: string;
}

// إجراءات مهام اليوم (إتمام أو تذكير لاحقاً)
export interface TaskActionRecord {
  id: string; // taskId
  status: 'completed' | 'snoozed';
  snoozedUntil?: string; // YYYY-MM-DD
  completedAt?: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// تقارير الإنتاج والأداء (المرحلة الخامسة)
// -------------------------------------------------------------
export interface ProductionReport {
  fromDate: string;
  toDate: string;
  
  // مؤشرات البيض في الفترة
  laidEggs: number;
  fertileEggs: number;
  infertileEggs: number;
  brokenEggs: number;
  lostEggs: number;
  hatchedEggs: number;
  pendingCheckEggs: number;
  
  // مؤشرات الزغاليل في الفترة
  bornSquabs: number;
  deceasedSquabs: number;
  transferredSquabs: number;
  soldSquabs: number;
  currentlyAliveSquabs: number;
  
  // نسب الأداء المحسوبة وفق القواعد الصارمة (أو null عند عدم كفاية البيانات)
  fertilityRate: number | null; // المخصب ÷ (المخصب + الرايق)
  fertilityRateFormula: string;
  
  hatchRate: number | null; // الفاقس ÷ المخصب الذي مضى موعد فقسه أو فقس فعلا
  hatchRateFormula: string;
  
  mortalityRate: number | null; // الزغاليل النافقة ÷ المولودة في الفترة
  mortalityRateFormula: string;
  
  survivalRate: number | null; // 100% - نسبة النفوق
  survivalRateFormula: string;
  
  survivalOver20DaysRate: number | null; // نسبة الزغاليل التي تعدت 20 يوماً
  survivalOver20DaysFormula: string;
  
  saleReadinessRate: number | null; // (المباعة + الواصلة لعمر البيع) ÷ المولودة التي تجاوزت 30 يوماً
  saleReadinessRateFormula: string;
  
  // المؤشرات المالية للفترة
  financials: FinancialResults;
}

// -------------------------------------------------------------
// ترتيب أفضل الأزواج (المرحلة الخامسة)
// -------------------------------------------------------------
export type PairColorIndicator = 'green' | 'yellow' | 'red' | 'incomplete';

export interface PairRankingItem {
  pairId: string;
  pairName: string;
  coopId: string | null;
  coopNumber?: string;
  status: PairStatus;
  
  // إحصائيات الفترة
  cyclesCount: number; // عدد الدورات في الفترة
  completedCyclesCount: number; // عدد الدورات المكتملة
  fertileEggsCount: number; // عدد البيض المخصب
  infertileEggsCount: number; // عدد البيض الرايق
  hatchCount: number; // عدد البيض الفاقس
  bornSquabsCount: number; // الزغاليل الناتجة
  deceasedSquabsCount: number; // الزغاليل النافقة
  mortalityRate: number | null; // نسبة النفوق
  survivalRate: number | null; // نسبة البقاء (100 - النفوق)
  reachedSaleCount: number; // الزغاليل التي وصلت للبيع (المباعة + الحية >= 30 يوم)
  actualRevenue: number; // الإيراد الفعلي المسجل من بيع زغاليله
  
  // نسب للتقييم اللوني
  fertilityRate: number | null;
  hatchRate: number | null;
  
  // مؤشر التقييم اللوني
  colorIndicator: PairColorIndicator;
  colorIndicatorLabel: string;
  colorIndicatorReason: string;
  
  // هل البيانات كافية للترتيب الرئيسي؟ (دورتان مكتملتان على الأقل في الفترة)
  hasSufficientData: boolean;
  insufficientDataReason?: string;
}

// -------------------------------------------------------------
// النسخ الاحتياطي والاستعادة (المرحلة السادسة)
// -------------------------------------------------------------
export interface PigeonFarmBackup {
  appName: string;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  recordCounts: {
    coops: number;
    pairs: number;
    cycles: number;
    eggs: number;
    squabs: number;
    batches: number;
    sales: number;
    sale_items: number;
    feed_types: number;
    stock_movements: number;
    feed_rate_configs: number;
    daily_feed_consumptions: number;
    expenses: number;
    manual_revenues: number;
    task_actions: number;
    settings: number;
    events: number;
    [key: string]: number;
  };
  data: {
    coops: Coop[];
    pairs: Pair[];
    cycles: Cycle[];
    eggs: Egg[];
    squabs: Squab[];
    batches: Batch[];
    sales: Sale[];
    sale_items: SaleItem[];
    feed_types: FeedType[];
    stock_movements: StockMovement[];
    feed_rate_configs: FeedRateConfig[];
    daily_feed_consumptions: DailyFeedConsumption[];
    expenses: Expense[];
    manual_revenues: ManualRevenue[];
    task_actions: TaskActionRecord[];
    settings: FarmSettings[];
    events: FarmEvent[];
  };
}

// -------------------------------------------------------------
// فحص سلامة وتناسق البيانات (المرحلة السادسة)
// -------------------------------------------------------------
export type DataIntegritySeverity = 'critical' | 'warning';

export type DataIntegrityCategory =
  | 'orphan_squab'
  | 'unhatched_squab'
  | 'hatched_egg_no_squab'
  | 'conflicting_location_or_status'
  | 'double_sale_or_dead_sold'
  | 'chronology_violation'
  | 'batch_mismatch'
  | 'negative_stock';

export interface DataIntegrityIssue {
  id: string;
  category: DataIntegrityCategory;
  severity: DataIntegritySeverity;
  title: string;
  description: string;
  entityType: EntityType;
  entityId: string;
  coopId?: string;
  pairId?: string;
  squabId?: string;
  eggId?: string;
  batchId?: string;
  feedTypeId?: string;
  suggestedAction: string;
}

export interface DataIntegrityReport {
  checkedAt: string;
  totalIssuesCount: number;
  criticalCount: number;
  warningCount: number;
  issues: DataIntegrityIssue[];
}

// -------------------------------------------------------------
// التراجع عن آخر العمليات (المرحلة السادسة)
// -------------------------------------------------------------
export type UndoableActionType =
  | 'egg_laid'
  | 'egg_checked'
  | 'egg_broken'
  | 'hatch'
  | 'squab_transferred'
  | 'squab_deceased'
  | 'squab_sold';

export interface UndoableAction {
  id: string;
  actionType: UndoableActionType;
  timestamp: string; // ISO
  description: string;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, any>;
}

