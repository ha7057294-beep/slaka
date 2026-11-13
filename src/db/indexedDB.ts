import {
  Coop,
  CoopType,
  Pair,
  Cycle,
  Egg,
  EggStatus,
  Squab,
  SquabStatus,
  SquabWeightRecord,
  Batch,
  BatchStatus,
  Sale,
  SaleItem,
  FeedType,
  StockMovement,
  StockMovementType,
  FeedRateConfig,
  DailyFeedConsumption,
  Expense,
  ExpenseCategory,
  AccountingType,
  ManualRevenue,
  ManualRevenueCategory,
  FinancialResults,
  PairBirdCountRecord,
  FarmEvent,
  FarmSettings,
  FarmStats,
  PairStats,
  TodayTask,
  TaskActionRecord,
  AlertPreferences,
  PairRankingThresholds,
  ProductionReport,
  PairRankingItem,
  PairColorIndicator,
  EntityType,
  PigeonFarmBackup,
  DataIntegrityReport,
  DataIntegrityIssue,
  UndoableAction,
  UndoableActionType,
} from '../types';
import { getTodayDate, getSquabAge, getEggSchedule, addDays, daysDifference, getEffectiveSaleDate } from '../utils/dateUtils';

const DB_NAME = 'PigeonFarmDB';
const DB_VERSION = 4; // الترقية للمرحلة الخامسة (لوحة التحكم، التقارير، وترتيب أفضل الأزواج)

let dbInstance: IDBDatabase | null = null;

/**
 * فتح وتهيئة وتحديث قاعدة بيانات IndexedDB
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('فشل فتح قاعدة بيانات IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;

      // 1. جدول السلاكات (Coops)
      if (!db.objectStoreNames.contains('coops')) {
        const coopsStore = db.createObjectStore('coops', { keyPath: 'id' });
        coopsStore.createIndex('number', 'number', { unique: false });
        coopsStore.createIndex('active', 'active', { unique: false });
        coopsStore.createIndex('type', 'type', { unique: false });
      }

      // 2. جدول الأزواج (Pairs)
      if (!db.objectStoreNames.contains('pairs')) {
        const pairsStore = db.createObjectStore('pairs', { keyPath: 'id' });
        pairsStore.createIndex('coopId', 'coopId', { unique: false });
        pairsStore.createIndex('status', 'status', { unique: false });
        pairsStore.createIndex('name', 'name', { unique: false });
      }

      // 3. جدول دورات الإنتاج / العشوش (Cycles)
      if (!db.objectStoreNames.contains('cycles')) {
        const cyclesStore = db.createObjectStore('cycles', { keyPath: 'id' });
        cyclesStore.createIndex('pairId', 'pairId', { unique: false });
        cyclesStore.createIndex('coopId', 'coopId', { unique: false });
        cyclesStore.createIndex('status', 'status', { unique: false });
      }

      // 4. جدول البيض (Eggs) - كل بيضة بسجل مستقل
      if (!db.objectStoreNames.contains('eggs')) {
        const eggsStore = db.createObjectStore('eggs', { keyPath: 'id' });
        eggsStore.createIndex('cycleId', 'cycleId', { unique: false });
        eggsStore.createIndex('pairId', 'pairId', { unique: false });
        eggsStore.createIndex('coopId', 'coopId', { unique: false });
        eggsStore.createIndex('status', 'status', { unique: false });
        eggsStore.createIndex('laidDate', 'laidDate', { unique: false });
      }

      // 5. جدول الزغاليل (Squabs) - كل زغلول بسجل مستقل
      let squabsStore: IDBObjectStore;
      if (!db.objectStoreNames.contains('squabs')) {
        squabsStore = db.createObjectStore('squabs', { keyPath: 'id' });
        squabsStore.createIndex('eggId', 'eggId', { unique: false });
        squabsStore.createIndex('pairId', 'pairId', { unique: false });
        squabsStore.createIndex('originCoopId', 'originCoopId', { unique: false });
        squabsStore.createIndex('currentLocationId', 'currentLocationId', { unique: false });
        squabsStore.createIndex('cycleId', 'cycleId', { unique: false });
        squabsStore.createIndex('batchId', 'batchId', { unique: false });
        squabsStore.createIndex('status', 'status', { unique: false });
      } else if (tx) {
        squabsStore = tx.objectStore('squabs');
        if (!squabsStore.indexNames.contains('batchId')) {
          squabsStore.createIndex('batchId', 'batchId', { unique: false });
        }
        if (!squabsStore.indexNames.contains('currentLocationId')) {
          squabsStore.createIndex('currentLocationId', 'currentLocationId', { unique: false });
        }
      }

      // 6. جدول دفعات التجميع (Batches) - المرحلة الثالثة
      if (!db.objectStoreNames.contains('batches')) {
        const batchesStore = db.createObjectStore('batches', { keyPath: 'id' });
        batchesStore.createIndex('collectionCoopId', 'collectionCoopId', { unique: false });
        batchesStore.createIndex('status', 'status', { unique: false });
        batchesStore.createIndex('transferDate', 'transferDate', { unique: false });
      }

      // 7. جدول المبيعات (Sales) - المرحلة الثالثة
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('date', 'date', { unique: false });
      }

      // 8. جدول بنود المبيعات للزغاليل الفردية (SaleItems) - المرحلة الثالثة
      if (!db.objectStoreNames.contains('sale_items')) {
        const saleItemsStore = db.createObjectStore('sale_items', { keyPath: 'id' });
        saleItemsStore.createIndex('saleId', 'saleId', { unique: false });
        saleItemsStore.createIndex('squabId', 'squabId', { unique: false });
      }

      // 9. سجل الأحداث (Events) - لا يُحذف أبداً ويسجل التاريخ والسبب
      if (!db.objectStoreNames.contains('events')) {
        const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
        eventsStore.createIndex('entityType', 'entityType', { unique: false });
        eventsStore.createIndex('entityId', 'entityId', { unique: false });
        eventsStore.createIndex('date', 'date', { unique: false });
        eventsStore.createIndex('type', 'type', { unique: false });
      }

      // 10. جدول الإعدادات (Settings)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // 11. جدول أنواع العلف (FeedTypes) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('feed_types')) {
        const feedTypesStore = db.createObjectStore('feed_types', { keyPath: 'id' });
        feedTypesStore.createIndex('name', 'name', { unique: false });
        feedTypesStore.createIndex('active', 'active', { unique: false });
      }

      // 12. جدول حركات المخزون (StockMovements) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('stock_movements')) {
        const stockMovementsStore = db.createObjectStore('stock_movements', { keyPath: 'id' });
        stockMovementsStore.createIndex('feedTypeId', 'feedTypeId', { unique: false });
        stockMovementsStore.createIndex('date', 'date', { unique: false });
        stockMovementsStore.createIndex('type', 'type', { unique: false });
        stockMovementsStore.createIndex('expenseId', 'expenseId', { unique: false });
        stockMovementsStore.createIndex('dailyConsumptionDate', 'dailyConsumptionDate', { unique: false });
      }

      // 13. جدول معدلات استهلاك العلف اليومية (FeedRateConfigs) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('feed_rate_configs')) {
        const feedRatesStore = db.createObjectStore('feed_rate_configs', { keyPath: 'id' });
        feedRatesStore.createIndex('effectiveFromDate', 'effectiveFromDate', { unique: false });
      }

      // 14. جدول سجل الاستهلاك اليومي للعلف (DailyFeedConsumptions) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('daily_feed_consumptions')) {
        const dailyConsumptionsStore = db.createObjectStore('daily_feed_consumptions', { keyPath: 'date' });
        dailyConsumptionsStore.createIndex('feedTypeId', 'feedTypeId', { unique: false });
      }

      // 15. جدول المصروفات (Expenses) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('expenses')) {
        const expensesStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expensesStore.createIndex('date', 'date', { unique: false });
        expensesStore.createIndex('category', 'category', { unique: false });
        expensesStore.createIndex('accountingType', 'accountingType', { unique: false });
        expensesStore.createIndex('active', 'active', { unique: false });
        expensesStore.createIndex('coopId', 'coopId', { unique: false });
        expensesStore.createIndex('pairId', 'pairId', { unique: false });
        expensesStore.createIndex('batchId', 'batchId', { unique: false });
      }

      // 16. جدول الإيرادات الأخرى ومبيعات الحمام البالغ (ManualRevenues) - المرحلة الرابعة
      if (!db.objectStoreNames.contains('manual_revenues')) {
        const revenuesStore = db.createObjectStore('manual_revenues', { keyPath: 'id' });
        revenuesStore.createIndex('date', 'date', { unique: false });
        revenuesStore.createIndex('category', 'category', { unique: false });
        revenuesStore.createIndex('active', 'active', { unique: false });
      }

      // 17. جدول إجراءات مهام اليوم (إتمام أو تذكير لاحقاً) - المرحلة الخامسة
      if (!db.objectStoreNames.contains('task_actions')) {
        const taskActionsStore = db.createObjectStore('task_actions', { keyPath: 'id' });
        taskActionsStore.createIndex('status', 'status', { unique: false });
        taskActionsStore.createIndex('snoozedUntil', 'snoozedUntil', { unique: false });
      }
    };
  });
}

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// -------------------------------------------------------------
// سجل الأحداث (Event Log) - قاعدة 5 و 6: لا يُحذف أبداً ويوثق التغيير
// -------------------------------------------------------------
export async function logEvent(
  entityType: EntityType,
  entityId: string,
  type: string,
  note?: string,
  oldValue?: string | null,
  newValue?: string | null
): Promise<FarmEvent> {
  const db = await openDB();
  const event: FarmEvent = {
    id: generateId('evt'),
    entityType,
    entityId,
    type,
    date: new Date().toISOString(),
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    note: note || undefined,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const req = store.add(event);
    req.onsuccess = () => resolve(event);
    req.onerror = () => reject(req.error);
  });
}

export async function getEventsForEntity(entityId: string): Promise<FarmEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const index = store.index('entityId');
    const req = index.getAll(entityId);
    req.onsuccess = () => {
      const events = (req.result || []) as FarmEvent[];
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(events);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllEvents(limit = 50): Promise<FarmEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const req = store.getAll();
    req.onsuccess = () => {
      const events = (req.result || []) as FarmEvent[];
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(events.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// الإعدادات (Settings)
// -------------------------------------------------------------
const DEFAULT_SETTINGS: FarmSettings = {
  id: 'global_settings',
  incubationDays: 18,
  fertilityCheckDays: 7,
  weaningAgeDays: 20,
  targetSaleAgeDays: 30,
  backupReminderDays: 7,
  updatedAt: new Date().toISOString(),
};

export async function getSettings(): Promise<FarmSettings> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('global_settings');
    req.onsuccess = () => {
      if (req.result) {
        const res = req.result as FarmSettings;
        if (!res.weaningAgeDays) res.weaningAgeDays = 20;
        if (!res.targetSaleAgeDays) res.targetSaleAgeDays = 30;
        if (res.backupReminderDays === undefined) res.backupReminderDays = 7;
        resolve(res);
      } else {
        const writeTx = db.transaction('settings', 'readwrite');
        writeTx.objectStore('settings').put(DEFAULT_SETTINGS);
        resolve(DEFAULT_SETTINGS);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateSettings(
  incubationDays: number,
  fertilityCheckDays: number,
  weaningAgeDaysOrReason?: number | string,
  targetSaleAgeDaysOrReason?: number | string,
  backupReminderDaysOrReason?: number | string,
  reasonParam?: string
): Promise<FarmSettings> {
  let weaningAgeDays = 20;
  let targetSaleAgeDays = 30;
  let backupReminderDays = 7;
  let reason = reasonParam;

  if (typeof weaningAgeDaysOrReason === 'string') {
    reason = weaningAgeDaysOrReason;
  } else if (typeof weaningAgeDaysOrReason === 'number') {
    weaningAgeDays = weaningAgeDaysOrReason;
    if (typeof targetSaleAgeDaysOrReason === 'string') {
      reason = targetSaleAgeDaysOrReason;
    } else if (typeof targetSaleAgeDaysOrReason === 'number') {
      targetSaleAgeDays = targetSaleAgeDaysOrReason;
      if (typeof backupReminderDaysOrReason === 'string') {
        reason = backupReminderDaysOrReason;
      } else if (typeof backupReminderDaysOrReason === 'number') {
        backupReminderDays = backupReminderDaysOrReason;
      }
    }
  }

  const oldSettings = await getSettings();
  const db = await openDB();
  const newSettings: FarmSettings = {
    ...oldSettings,
    id: 'global_settings',
    incubationDays: Math.max(1, incubationDays),
    fertilityCheckDays: Math.max(1, fertilityCheckDays),
    weaningAgeDays: Math.max(1, weaningAgeDays),
    targetSaleAgeDays: Math.max(1, targetSaleAgeDays),
    backupReminderDays: Math.max(0, backupReminderDays),
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put(newSettings);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    'global_settings',
    'settings_updated',
    reason || 'تحديث إعدادات مدة الحضن وفحص التخصيب وأعمار النقل والبيع وتذكير النسخ',
    `حضن:${oldSettings.incubationDays}،فحص:${oldSettings.fertilityCheckDays}،نقل:${oldSettings.weaningAgeDays || 20}،بيع:${oldSettings.targetSaleAgeDays || 30}،تذكير:${oldSettings.backupReminderDays ?? 7}`,
    `حضن:${newSettings.incubationDays}،فحص:${newSettings.fertilityCheckDays}،نقل:${newSettings.weaningAgeDays}،بيع:${newSettings.targetSaleAgeDays}،تذكير:${newSettings.backupReminderDays}`
  );

  return newSettings;
}

// -------------------------------------------------------------
// إدارة السلاكات (Coops)
// -------------------------------------------------------------
export async function getCoops(): Promise<Coop[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('coops', 'readonly');
    const store = tx.objectStore('coops');
    const req = store.getAll();
    req.onsuccess = () => {
      const coops = (req.result || []) as Coop[];
      coops.sort((a, b) => a.number.localeCompare(b.number, 'ar', { numeric: true }));
      resolve(coops);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCoop(id: string): Promise<Coop | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('coops', 'readonly');
    const store = tx.objectStore('coops');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Coop) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addCoop(
  numberOrData: string | { number: string; type: CoopType; notes?: string },
  typeArg?: CoopType,
  notesArg?: string
): Promise<Coop> {
  const number = typeof numberOrData === 'object' ? numberOrData.number : numberOrData;
  const type = typeof numberOrData === 'object' ? numberOrData.type : (typeArg || 'production');
  const notes = typeof numberOrData === 'object' ? numberOrData.notes : notesArg;

  const cleanNumber = String(number || '').trim();
  if (!cleanNumber) throw new Error('يرجى إدخال رقم أو رمز السلاكة');

  const existingCoops = await getCoops();
  const duplicate = existingCoops.find((c) => c.number.toLowerCase() === cleanNumber.toLowerCase());
  if (duplicate) {
    throw new Error(`سلاكة رقم "${cleanNumber}" موجودة مسبقاً`);
  }

  const db = await openDB();
  const coop: Coop = {
    id: generateId('coop'),
    number: cleanNumber,
    type,
    active: true,
    notes: notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('coops', 'readwrite');
    const store = tx.objectStore('coops');
    const req = store.add(coop);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'coop',
    coop.id,
    'coop_created',
    `إضافة سلاكة جديدة رقم ${coop.number} من نوع ${coop.type === 'production' ? 'إنتاج' : 'تجميع'}`,
    null,
    JSON.stringify(coop)
  );

  return coop;
}

export async function updateCoop(
  id: string,
  updates: { number?: string; type?: CoopType; notes?: string },
  reason?: string
): Promise<Coop> {
  const coop = await getCoop(id);
  if (!coop) throw new Error('السلاكة غير موجودة');

  const oldCoop = { ...coop };

  if (updates.number !== undefined) {
    const cleanNumber = updates.number.trim();
    if (!cleanNumber) throw new Error('رقم السلاكة مطلوب');
    const existing = await getCoops();
    const dup = existing.find((c) => c.id !== id && c.number.toLowerCase() === cleanNumber.toLowerCase());
    if (dup) throw new Error(`سلاكة رقم "${cleanNumber}" موجودة مسبقاً`);
    coop.number = cleanNumber;
  }

  if (updates.type !== undefined) {
    coop.type = updates.type;
  }

  if (updates.notes !== undefined) {
    coop.notes = updates.notes.trim() || undefined;
  }

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('coops', 'readwrite');
    const store = tx.objectStore('coops');
    const req = store.put(coop);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'coop',
    id,
    'coop_updated',
    reason || 'تعديل بيانات السلاكة',
    JSON.stringify(oldCoop),
    JSON.stringify(coop)
  );

  return coop;
}

export async function toggleCoopActive(id: string, activate: boolean, reason?: string): Promise<Coop> {
  const coop = await getCoop(id);
  if (!coop) throw new Error('السلاكة غير موجودة');

  const oldStatus = coop.active;
  coop.active = activate;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('coops', 'readwrite');
    const store = tx.objectStore('coops');
    const req = store.put(coop);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const eventType = activate ? 'coop_activated' : 'coop_deactivated';
  await logEvent(
    'coop',
    id,
    eventType,
    reason || (activate ? 'إعادة تنشيط السلاكة' : 'إيقاف السلاكة مؤقتاً دون حذف بياناتها'),
    oldStatus ? 'active' : 'inactive',
    coop.active ? 'active' : 'inactive'
  );

  return coop;
}

// -------------------------------------------------------------
// إدارة الأزواج (Pairs)
// -------------------------------------------------------------
export async function getPairs(): Promise<Pair[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pairs', 'readonly');
    const store = tx.objectStore('pairs');
    const req = store.getAll();
    req.onsuccess = () => {
      const pairs = (req.result || []) as Pair[];
      pairs.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
      resolve(pairs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPair(id: string): Promise<Pair | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pairs', 'readonly');
    const store = tx.objectStore('pairs');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Pair) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addPair(data: {
  name: string;
  breed?: string;
  coopId: string | null;
  maleInfo: string;
  femaleInfo: string;
  pairedDate: string;
  notes?: string;
}): Promise<Pair> {
  const db = await openDB();
  const pair: Pair = {
    id: generateId('pair'),
    name: data.name.trim(),
    breed: data.breed?.trim() || undefined,
    coopId: data.coopId || null,
    maleInfo: data.maleInfo.trim(),
    femaleInfo: data.femaleInfo.trim(),
    pairedDate: data.pairedDate || getTodayDate(),
    status: 'active',
    notes: data.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pairs', 'readwrite');
    const store = tx.objectStore('pairs');
    const req = store.add(pair);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'pair',
    pair.id,
    'pair_created',
    `إضافة زوج جديد "${pair.name}" وتسكينه بالسلاكة`,
    null,
    JSON.stringify(pair)
  );

  return pair;
}

export async function updatePair(
  id: string,
  updates: Partial<Omit<Pair, 'id' | 'createdAt'>>,
  reason?: string
): Promise<Pair> {
  const pair = await getPair(id);
  if (!pair) throw new Error('الزوج غير موجود');

  const oldPair = { ...pair };
  const updatedPair: Pair = { ...pair, ...updates };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pairs', 'readwrite');
    const store = tx.objectStore('pairs');
    const req = store.put(updatedPair);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'pair',
    id,
    'pair_updated',
    reason || 'تعديل بيانات الزوج',
    JSON.stringify(oldPair),
    JSON.stringify(updatedPair)
  );

  return updatedPair;
}

export async function togglePairActive(id: string, activate: boolean, reason?: string): Promise<Pair> {
  const pair = await getPair(id);
  if (!pair) throw new Error('الزوج غير موجود');

  const oldStatus = pair.status;
  pair.status = activate ? 'active' : 'inactive';

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pairs', 'readwrite');
    const store = tx.objectStore('pairs');
    const req = store.put(pair);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const eventType = activate ? 'pair_activated' : 'pair_deactivated';
  await logEvent(
    'pair',
    id,
    eventType,
    reason || (activate ? 'إعادة تنشيط الزوج' : 'إيقاف الزوج مؤقتاً'),
    oldStatus,
    pair.status
  );

  return pair;
}

// -------------------------------------------------------------
// إدارة دورات الإنتاج / العشوش (Cycles)
// -------------------------------------------------------------
export async function getCycles(): Promise<Cycle[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cycles', 'readonly');
    const store = tx.objectStore('cycles');
    const req = store.getAll();
    req.onsuccess = () => {
      const cycles = (req.result || []) as Cycle[];
      cycles.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      resolve(cycles);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCyclesForPair(pairId: string): Promise<Cycle[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cycles', 'readonly');
    const store = tx.objectStore('cycles');
    const index = store.index('pairId');
    const req = index.getAll(pairId);
    req.onsuccess = () => {
      const cycles = (req.result || []) as Cycle[];
      cycles.sort((a, b) => b.cycleNumber - a.cycleNumber);
      resolve(cycles);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveCycleForPair(pairId: string): Promise<Cycle | null> {
  const cycles = await getCyclesForPair(pairId);
  return cycles.find((c) => c.status === 'active') || null;
}

export async function createOrGetCycle(pairId: string, coopId: string, startDate?: string): Promise<Cycle> {
  const activeCycle = await getActiveCycleForPair(pairId);
  if (activeCycle) {
    const eggs = await getEggsByCycle(activeCycle.id);
    const hasUnfinishedEggs = eggs.some((e) => e.status === 'pending' || e.status === 'fertile');
    if (eggs.length > 0 && !hasUnfinishedEggs) {
      activeCycle.status = 'completed';
      activeCycle.endDate = startDate || getTodayDate();
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('cycles', 'readwrite');
        const store = tx.objectStore('cycles');
        const req = store.put(activeCycle);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      return activeCycle;
    }
  }

  const allCycles = await getCyclesForPair(pairId);
  const maxNumber = allCycles.reduce((max, c) => Math.max(max, c.cycleNumber), 0);
  const nextCycleNumber = maxNumber + 1;

  const db = await openDB();
  const newCycle: Cycle = {
    id: generateId('cycle'),
    pairId,
    coopId,
    cycleNumber: nextCycleNumber,
    startDate: startDate || getTodayDate(),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cycles', 'readwrite');
    const store = tx.objectStore('cycles');
    const req = store.add(newCycle);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'cycle',
    newCycle.id,
    'cycle_start',
    `بدء دورة إنتاج جديدة (عش رقم ${nextCycleNumber}) للزوج`,
    null,
    JSON.stringify({ cycleNumber: nextCycleNumber, startDate: newCycle.startDate })
  );

  return newCycle;
}

// -------------------------------------------------------------
// إدارة البيض (Eggs)
// -------------------------------------------------------------
export async function getEggs(): Promise<Egg[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('eggs', 'readonly');
    const store = tx.objectStore('eggs');
    const req = store.getAll();
    req.onsuccess = () => {
      const eggs = (req.result || []) as Egg[];
      eggs.sort((a, b) => new Date(b.laidDate).getTime() - new Date(a.laidDate).getTime());
      resolve(eggs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getEgg(id: string): Promise<Egg | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('eggs', 'readonly');
    const store = tx.objectStore('eggs');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Egg) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getEggsByCoop(coopId: string): Promise<Egg[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('eggs', 'readonly');
    const store = tx.objectStore('eggs');
    const index = store.index('coopId');
    const req = index.getAll(coopId);
    req.onsuccess = () => {
      const eggs = (req.result || []) as Egg[];
      eggs.sort((a, b) => new Date(b.laidDate).getTime() - new Date(a.laidDate).getTime());
      resolve(eggs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getEggsByPair(pairId: string): Promise<Egg[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('eggs', 'readonly');
    const store = tx.objectStore('eggs');
    const index = store.index('pairId');
    const req = index.getAll(pairId);
    req.onsuccess = () => {
      const eggs = (req.result || []) as Egg[];
      eggs.sort((a, b) => new Date(b.laidDate).getTime() - new Date(a.laidDate).getTime());
      resolve(eggs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getEggsByCycle(cycleId: string): Promise<Egg[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('eggs', 'readonly');
    const store = tx.objectStore('eggs');
    const index = store.index('cycleId');
    const req = index.getAll(cycleId);
    req.onsuccess = () => {
      const eggs = (req.result || []) as Egg[];
      eggs.sort((a, b) => a.eggNumber - b.eggNumber);
      resolve(eggs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function layEggs(data: {
  pairId: string;
  coopId: string;
  cycleId?: string;
  egg1Date: string;
  egg2Date?: string | null;
  note?: string;
}): Promise<Egg[]> {
  const db = await openDB();
  let cycleId = data.cycleId;

  if (!cycleId) {
    const cycle = await createOrGetCycle(data.pairId, data.coopId, data.egg1Date);
    cycleId = cycle.id;
  }

  const existingEggs = await getEggsByCycle(cycleId);
  const createdEggs: Egg[] = [];

  const egg1Number = (existingEggs.length === 0 ? 1 : existingEggs.length + 1) as 1 | 2;
  const egg1: Egg = {
    id: generateId('egg'),
    cycleId,
    pairId: data.pairId,
    coopId: data.coopId,
    eggNumber: egg1Number,
    laidDate: data.egg1Date,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('eggs', 'readwrite');
    const store = tx.objectStore('eggs');
    const req = store.add(egg1);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'egg',
    egg1.id,
    'lay_egg',
    data.note || `وضع البيضة رقم ${egg1.eggNumber} بتاريخ ${egg1.laidDate}`,
    null,
    JSON.stringify({ eggNumber: egg1.eggNumber, laidDate: egg1.laidDate, status: egg1.status })
  );
  createdEggs.push(egg1);

  if (data.egg2Date && data.egg2Date.trim()) {
    const egg2: Egg = {
      id: generateId('egg'),
      cycleId,
      pairId: data.pairId,
      coopId: data.coopId,
      eggNumber: 2,
      laidDate: data.egg2Date.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('eggs', 'readwrite');
      const store = tx.objectStore('eggs');
      const req = store.add(egg2);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'egg',
      egg2.id,
      'lay_egg',
      `وضع البيضة رقم 2 بتاريخ ${egg2.laidDate}`,
      null,
      JSON.stringify({ eggNumber: 2, laidDate: egg2.laidDate, status: egg2.status })
    );
    createdEggs.push(egg2);
  }

  if (createdEggs.length > 0) {
    setLastUndoableAction({
      id: `undo_${Date.now()}`,
      actionType: 'egg_laid',
      timestamp: new Date().toISOString(),
      description: `وضع بيض (${createdEggs.length} بيضة)`,
      entityType: 'egg',
      entityId: createdEggs[0].id,
      details: { eggIds: createdEggs.map((e) => e.id) },
    });
  }

  return createdEggs;
}

export async function checkEggFertility(
  eggId: string,
  isFertile: boolean,
  checkDate?: string,
  note?: string
): Promise<Egg> {
  const egg = await getEgg(eggId);
  if (!egg) throw new Error('البيضة غير موجودة');

  if (egg.status === 'broken' || egg.status === 'lost') {
    throw new Error('لا يمكن فحص بيضة مكسورة أو مفقودة');
  }

  if (egg.status === 'hatched') {
    throw new Error('البيضة فقست بالفعل');
  }

  const oldStatus = egg.status;
  const newStatus: EggStatus = isFertile ? 'fertile' : 'infertile';
  const effectiveCheckDate = checkDate || getTodayDate();

  egg.status = newStatus;
  egg.checkDate = effectiveCheckDate;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('eggs', 'readwrite');
    const store = tx.objectStore('eggs');
    const req = store.put(egg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const resultArabic = isFertile ? 'مخصبة (تحتوي على جنين)' : 'رايقة (غير مخصبة)';
  await logEvent(
    'egg',
    eggId,
    'egg_check',
    note || `فحص التخصيب للبيضة رقم ${egg.eggNumber}: ${resultArabic}`,
    oldStatus,
    newStatus
  );

  setLastUndoableAction({
    id: `undo_${Date.now()}`,
    actionType: 'egg_checked',
    timestamp: new Date().toISOString(),
    description: `فحص تخصيب البيضة رقم ${egg.eggNumber} (${resultArabic})`,
    entityType: 'egg',
    entityId: eggId,
    details: { previousStatus: oldStatus },
  });

  return egg;
}

export async function markEggBrokenOrLost(
  eggId: string,
  newStatus: 'broken' | 'lost',
  date?: string,
  reason?: string
): Promise<Egg> {
  const egg = await getEgg(eggId);
  if (!egg) throw new Error('البيضة غير موجودة');

  const oldStatus = egg.status;
  const effectiveDate = date || getTodayDate();

  egg.status = newStatus;
  egg.brokenDate = effectiveDate;
  egg.brokenReason = reason?.trim() || undefined;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('eggs', 'readwrite');
    const store = tx.objectStore('eggs');
    const req = store.put(egg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const actionArabic = newStatus === 'broken' ? 'كسر بيضة' : 'فقدان بيضة';
  await logEvent(
    'egg',
    eggId,
    newStatus === 'broken' ? 'egg_broken' : 'egg_lost',
    reason ? `${actionArabic} - السبب: ${reason}` : actionArabic,
    oldStatus,
    newStatus
  );

  setLastUndoableAction({
    id: `undo_${Date.now()}`,
    actionType: 'egg_broken',
    timestamp: new Date().toISOString(),
    description: `تسجيل ${newStatus === 'broken' ? 'كسر' : 'فقد'} البيضة رقم ${egg.eggNumber}`,
    entityType: 'egg',
    entityId: eggId,
    details: { previousStatus: oldStatus },
  });

  return egg;
}

// -------------------------------------------------------------
// إدارة الزغاليل والفقس والنفوق (Squabs & Hatching)
// -------------------------------------------------------------

export async function getSquabs(): Promise<Squab[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('squabs', 'readonly');
    const store = tx.objectStore('squabs');
    const req = store.getAll();
    req.onsuccess = () => {
      const squabs = (req.result || []) as Squab[];
      squabs.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
      resolve(squabs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSquab(id: string): Promise<Squab | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('squabs', 'readonly');
    const store = tx.objectStore('squabs');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Squab) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getSquabsByOriginCoop(coopId: string): Promise<Squab[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('squabs', 'readonly');
    const store = tx.objectStore('squabs');
    const index = store.index('originCoopId');
    const req = index.getAll(coopId);
    req.onsuccess = () => {
      const squabs = (req.result || []) as Squab[];
      squabs.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
      resolve(squabs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSquabsByCoop(coopId: string): Promise<Squab[]> {
  const allSquabs = await getSquabs();
  // يشمل الزغاليل الموجودة حالياً في السلاكة أو نشأت منها
  return allSquabs.filter((s) => s.currentLocationId === coopId || s.originCoopId === coopId);
}

export async function getSquabsByCurrentLocation(coopId: string): Promise<Squab[]> {
  const allSquabs = await getSquabs();
  return allSquabs.filter((s) => s.currentLocationId === coopId);
}

export async function getSquabsByBatch(batchId: string): Promise<Squab[]> {
  const allSquabs = await getSquabs();
  return allSquabs
    .filter((s) => s.batchId === batchId)
    .sort((a, b) => new Date(a.hatchDate).getTime() - new Date(b.hatchDate).getTime());
}

export async function getSquabsByPair(pairId: string): Promise<Squab[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('squabs', 'readonly');
    const store = tx.objectStore('squabs');
    const index = store.index('pairId');
    const req = index.getAll(pairId);
    req.onsuccess = () => {
      const squabs = (req.result || []) as Squab[];
      squabs.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
      resolve(squabs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSquabsByCycle(cycleId: string): Promise<Squab[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('squabs', 'readonly');
    const store = tx.objectStore('squabs');
    const index = store.index('cycleId');
    const req = index.getAll(cycleId);
    req.onsuccess = () => {
      const squabs = (req.result || []) as Squab[];
      squabs.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
      resolve(squabs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function recordEggHatch(
  eggId: string,
  hatchDate?: string,
  note?: string
): Promise<{ egg: Egg; squab: Squab }> {
  const egg = await getEgg(eggId);
  if (!egg) throw new Error('البيضة غير موجودة');

  if (egg.status === 'hatched') {
    throw new Error('لا يمكن تسجيل الفقس مرتين لنفس البيضة، هذه البيضة مسجلة كفاقسة بالفعل');
  }

  if (egg.status === 'broken' || egg.status === 'lost') {
    throw new Error('لا يمكن تسجيل فقس بيضة مكسورة أو مفقودة');
  }

  if (egg.status === 'infertile') {
    throw new Error('لا يمكن تسجيل فقس بيضة رايقة (غير مخصبة)');
  }

  const effectiveHatchDate = hatchDate && hatchDate.trim() ? hatchDate.trim() : getTodayDate();
  const oldStatus = egg.status;

  egg.status = 'hatched';
  egg.hatchDate = effectiveHatchDate;

  const db = await openDB();

  // تحديث البيضة
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('eggs', 'readwrite');
    const store = tx.objectStore('eggs');
    const req = store.put(egg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'egg',
    egg.id,
    'egg_hatched',
    note || `فقس البيضة رقم ${egg.eggNumber} بنجاح بتاريخ ${effectiveHatchDate}`,
    oldStatus,
    'hatched'
  );

  // إنشاء الزغلول المستقل
  const allSquabs = await getSquabs();
  const squabNumber = allSquabs.length + 1;
  const squabCode = `زغلول #${squabNumber}`;

  const squab: Squab = {
    id: generateId('sqb'),
    codeNumber: squabCode,
    eggId: egg.id,
    pairId: egg.pairId,
    originCoopId: egg.coopId,
    currentLocationId: egg.coopId,
    cycleId: egg.cycleId,
    hatchDate: effectiveHatchDate,
    targetSaleDate: addDays(effectiveHatchDate, 30),
    status: 'alive_production',
    weights: [],
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('squabs', 'readwrite');
    const store = tx.objectStore('squabs');
    const req = store.add(squab);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'squab',
    squab.id,
    'squab_created',
    `فقس وخروج ${squab.codeNumber} من البيضة رقم ${egg.eggNumber} بتاريخ ${effectiveHatchDate} (حي في الإنتاج)`,
    null,
    JSON.stringify({ codeNumber: squab.codeNumber, hatchDate: squab.hatchDate, status: squab.status })
  );

  setLastUndoableAction({
    id: `undo_${Date.now()}`,
    actionType: 'hatch',
    timestamp: new Date().toISOString(),
    description: `فقس البيضة وخروج ${squab.codeNumber}`,
    entityType: 'egg',
    entityId: egg.id,
    details: { squabId: squab.id },
  });

  return { egg, squab };
}

export async function recordSquabDeath(
  squabId: string,
  deathDate?: string,
  deathReason?: string
): Promise<Squab> {
  const squab = await getSquab(squabId);
  if (!squab) throw new Error('الزغلول غير موجود');

  if (squab.status === 'deceased') {
    throw new Error('هذا الزغلول مسجل كنافق بالفعل');
  }

  const oldStatus = squab.status;
  const effectiveDeathDate = deathDate && deathDate.trim() ? deathDate.trim() : getTodayDate();
  const deathAge = getSquabAge(squab.hatchDate, effectiveDeathDate);

  squab.status = 'deceased';
  squab.deathDate = effectiveDeathDate;
  squab.deathReason = deathReason?.trim() || undefined;
  squab.deathAgeDays = deathAge;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('squabs', 'readwrite');
    const store = tx.objectStore('squabs');
    const req = store.put(squab);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'squab',
    squab.id,
    'squab_death',
    deathReason
      ? `تسجيل نفوق ${squab.codeNumber} بعمر ${deathAge} يوم - السبب: ${deathReason}`
      : `تسجيل نفوق ${squab.codeNumber} بعمر ${deathAge} يوم`,
    oldStatus,
    'deceased'
  );

  // إذا كان الزغلول ضمن دفعة، نوثق ذلك أيضاً على الدفعة
  if (squab.batchId) {
    await logEvent(
      'batch',
      squab.batchId,
      'batch_squab_death',
      `تسجيل نفوق ${squab.codeNumber} داخل الدفعة بعمر ${deathAge} يوم`
    );
  }

  setLastUndoableAction({
    id: `undo_${Date.now()}`,
    actionType: 'squab_deceased',
    timestamp: new Date().toISOString(),
    description: `تسجيل نفوق الزغلول ${squab.codeNumber}`,
    entityType: 'squab',
    entityId: squabId,
    details: { previousStatus: oldStatus },
  });

  return squab;
}

export async function addSquabWeight(
  squabId: string,
  weightGrams: number,
  date?: string,
  note?: string
): Promise<Squab> {
  const squab = await getSquab(squabId);
  if (!squab) throw new Error('الزغلول غير موجود');

  const effectiveDate = date && date.trim() ? date.trim() : getTodayDate();
  const weightRecord: SquabWeightRecord = {
    id: generateId('wt'),
    date: effectiveDate,
    weightGrams: Math.round(weightGrams),
    note: note?.trim() || undefined,
  };

  if (!Array.isArray(squab.weights)) {
    squab.weights = [];
  }
  squab.weights.push(weightRecord);
  squab.weights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('squabs', 'readwrite');
    const store = tx.objectStore('squabs');
    const req = store.put(squab);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'squab',
    squab.id,
    'squab_weight',
    `تسجيل وزن ${weightGrams} جرام بتاريخ ${effectiveDate}${note ? ' (' + note + ')' : ''}`,
    null,
    `${weightGrams}g`
  );

  return squab;
}

export async function updateSquab(
  squabId: string,
  updates: {
    hatchDate?: string;
    deathDate?: string;
    deathReason?: string;
    illnessOrInjury?: string;
    notes?: string;
    codeNumber?: string;
    targetSaleDate?: string;
    postponedUntil?: string;
    postponeReason?: string;
  },
  reason: string
): Promise<Squab> {
  const squab = await getSquab(squabId);
  if (!squab) throw new Error('الزغلول غير موجود');

  if (!reason || !reason.trim()) {
    throw new Error('يرجى كتابة سبب التصحيح للتوثيق في سجل الأحداث');
  }

  const oldValues = {
    hatchDate: squab.hatchDate,
    deathDate: squab.deathDate,
    deathReason: squab.deathReason,
    illnessOrInjury: squab.illnessOrInjury,
    notes: squab.notes,
    codeNumber: squab.codeNumber,
    deathAgeDays: squab.deathAgeDays,
    targetSaleDate: squab.targetSaleDate,
    postponedUntil: squab.postponedUntil,
    postponeReason: squab.postponeReason,
  };

  if (updates.hatchDate !== undefined && updates.hatchDate.trim()) {
    squab.hatchDate = updates.hatchDate.trim();
    // تحديث موعد البيع المستهدف إن لم يكن مؤجلاً
    if (!squab.postponedUntil) {
      squab.targetSaleDate = addDays(squab.hatchDate, 30);
    }
  }
  if (updates.codeNumber !== undefined && updates.codeNumber.trim()) {
    squab.codeNumber = updates.codeNumber.trim();
  }
  if (updates.deathDate !== undefined) {
    squab.deathDate = updates.deathDate ? updates.deathDate.trim() : undefined;
  }
  if (updates.deathReason !== undefined) {
    squab.deathReason = updates.deathReason ? updates.deathReason.trim() : undefined;
  }
  if (updates.illnessOrInjury !== undefined) {
    squab.illnessOrInjury = updates.illnessOrInjury ? updates.illnessOrInjury.trim() : undefined;
  }
  if (updates.notes !== undefined) {
    squab.notes = updates.notes ? updates.notes.trim() : undefined;
  }
  if (updates.targetSaleDate !== undefined) {
    squab.targetSaleDate = updates.targetSaleDate ? updates.targetSaleDate.trim() : undefined;
  }
  if (updates.postponedUntil !== undefined) {
    squab.postponedUntil = updates.postponedUntil ? updates.postponedUntil.trim() : undefined;
  }
  if (updates.postponeReason !== undefined) {
    squab.postponeReason = updates.postponeReason ? updates.postponeReason.trim() : undefined;
  }

  // إعادة حساب العمر وقت النفوق إن كان نافقاً
  if (squab.status === 'deceased' && squab.deathDate) {
    squab.deathAgeDays = getSquabAge(squab.hatchDate, squab.deathDate);
  }

  // إعادة حساب العمر وقت النقل إن كان منقولاً
  if (squab.transferDate) {
    squab.ageAtTransfer = getSquabAge(squab.hatchDate, squab.transferDate);
  }

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('squabs', 'readwrite');
    const store = tx.objectStore('squabs');
    const req = store.put(squab);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const newValues = {
    hatchDate: squab.hatchDate,
    deathDate: squab.deathDate,
    deathReason: squab.deathReason,
    illnessOrInjury: squab.illnessOrInjury,
    notes: squab.notes,
    codeNumber: squab.codeNumber,
    deathAgeDays: squab.deathAgeDays,
    targetSaleDate: squab.targetSaleDate,
    postponedUntil: squab.postponedUntil,
    postponeReason: squab.postponeReason,
  };

  await logEvent(
    'squab',
    squab.id,
    'squab_corrected',
    reason.trim(),
    JSON.stringify(oldValues),
    JSON.stringify(newValues)
  );

  return squab;
}

// -------------------------------------------------------------
// إدارة دفعات التجميع والنقل (Batches & Transfers) - المرحلة الثالثة
// -------------------------------------------------------------

export async function getBatches(): Promise<Batch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('batches', 'readonly');
    const store = tx.objectStore('batches');
    const req = store.getAll();
    req.onsuccess = () => {
      const batches = (req.result || []) as Batch[];
      batches.sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime());
      resolve(batches);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getBatch(id: string): Promise<Batch | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('batches', 'readonly');
    const store = tx.objectStore('batches');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Batch) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getBatchesByCoop(collectionCoopId: string): Promise<Batch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('batches', 'readonly');
    const store = tx.objectStore('batches');
    const index = store.index('collectionCoopId');
    const req = index.getAll(collectionCoopId);
    req.onsuccess = () => {
      const batches = (req.result || []) as Batch[];
      batches.sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime());
      resolve(batches);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * نقل زغاليل إلى سلاكة التجميع وإنشاء دفعة جديدة برقم تلقائي:
 * - نفس السجل ونفس الهوية تنتقل من مكان إلى مكان (لا يُنشأ زغلول جديد)
 * - عمر الزغلول يستمر حسابه من تاريخ الفقس فقط
 * - يرتبط الزغلول بالدفعة وبالسلاكة الجديدة ويبقى ارتباطه الأصلي بالزوج والسلاكة الأولى محفوظاً
 * - يُسجل الحدث في سجل كل زغلول والدفعة وسلاكة الإنتاج وسلاكة التجميع
 */
export async function transferSquabsToCollection(data: {
  squabIds: string[];
  collectionCoopId: string;
  transferDate?: string;
  note?: string;
}): Promise<{ batch: Batch; transferredSquabs: Squab[] }> {
  if (!data.squabIds || data.squabIds.length === 0) {
    throw new Error('يرجى تحديد زغلول واحد على الأقل للنقل');
  }

  const targetCoop = await getCoop(data.collectionCoopId);
  if (!targetCoop) throw new Error('سلاكة التجميع الهدف غير موجودة');
  if (targetCoop.type !== 'collection') {
    throw new Error('السلاكة المحددة ليست من نوع سلاكات التجميع');
  }

  const effectiveTransferDate = data.transferDate && data.transferDate.trim()
    ? data.transferDate.trim()
    : getTodayDate();

  const allBatches = await getBatches();
  const nextBatchNumber = `دفعة #${allBatches.length + 1}`;

  const batch: Batch = {
    id: generateId('batch'),
    batchNumber: nextBatchNumber,
    collectionCoopId: data.collectionCoopId,
    transferDate: effectiveTransferDate,
    status: 'rearing',
    note: data.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();

  // 1. إنشاء الدفعة الجديدة
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('batches', 'readwrite');
    const store = tx.objectStore('batches');
    const req = store.add(batch);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'batch',
    batch.id,
    'batch_created',
    `إنشاء ${batch.batchNumber} في سلاكة التجميع ${targetCoop.number} بعدد ${data.squabIds.length} زغلول بتاريخ ${effectiveTransferDate}`
  );

  // 2. تحديث سجلات الزغاليل المختارة (نفس السجل بدون إنشاء جديد)
  const transferredSquabs: Squab[] = [];
  const originCoopIds = new Set<string>();

  for (const squabId of data.squabIds) {
    const squab = await getSquab(squabId);
    if (!squab) continue;

    if (squab.status === 'deceased') {
      throw new Error(`الزغلول ${squab.codeNumber} مسجل كنافق ولا يمكن نقله`);
    }
    if (squab.status === 'sold') {
      throw new Error(`الزغلول ${squab.codeNumber} مباع بالفعل ولا يمكن نقله`);
    }

    const previousLocation = squab.currentLocationId || squab.originCoopId;
    originCoopIds.add(squab.originCoopId);

    squab.currentLocationId = data.collectionCoopId;
    squab.batchId = batch.id;
    squab.transferDate = effectiveTransferDate;
    squab.status = 'transferred_collection';
    squab.ageAtTransfer = getSquabAge(squab.hatchDate, effectiveTransferDate);
    if (!squab.targetSaleDate) {
      squab.targetSaleDate = addDays(squab.hatchDate, 30);
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('squabs', 'readwrite');
      const store = tx.objectStore('squabs');
      const req = store.put(squab);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'squab',
      squab.id,
      'squab_transferred',
      `نقل ${squab.codeNumber} بعمر ${squab.ageAtTransfer} يوم إلى سلاكة التجميع ${targetCoop.number} ضمن ${batch.batchNumber}`,
      previousLocation,
      data.collectionCoopId
    );

    transferredSquabs.push(squab);
  }

  // 3. توثيق الحدث في سلاكات الإنتاج وسلاكة التجميع
  for (const originCoopId of originCoopIds) {
    const countFromThis = transferredSquabs.filter((s) => s.originCoopId === originCoopId).length;
    await logEvent(
      'coop',
      originCoopId,
      'squabs_transferred_out',
      `نقل ${countFromThis} زغلول من السلاكة إلى سلاكة التجميع ${targetCoop.number} ضمن ${batch.batchNumber}`
    );
  }

  await logEvent(
    'coop',
    data.collectionCoopId,
    'squabs_transferred_in',
    `استقبال ${transferredSquabs.length} زغلول جديد في ${batch.batchNumber}`
  );

  if (transferredSquabs.length > 0) {
    setLastUndoableAction({
      id: `undo_${Date.now()}`,
      actionType: 'squab_transferred',
      timestamp: new Date().toISOString(),
      description: `نقل ${transferredSquabs.length} زغلول لسلاكة التجميع (${targetCoop.number})`,
      entityType: 'squab',
      entityId: transferredSquabs[0].id,
      details: { squabIds: transferredSquabs.map((s) => s.id) },
    });
  }

  return { batch, transferredSquabs };
}

/**
 * تأجيل البيع لزغلول أو مجموعة زغاليل أو دفعة كاملة:
 * - لا يغير تاريخ الفقس ولا تاريخ النقل ولا العمر (العمر يستمر صحيحاً)
 * - يسجل تاريخ التأجيل وسببه ويوثقه في سجل الأحداث
 */
export async function postponeSquabsSale(
  squabIds: string[],
  postponedUntil: string,
  reason?: string
): Promise<Squab[]> {
  if (!squabIds || squabIds.length === 0) {
    throw new Error('يرجى تحديد زغلول واحد على الأقل لتأجيل بيعه');
  }
  if (!postponedUntil || !postponedUntil.trim()) {
    throw new Error('يرجى تحديد تاريخ تأجيل البيع');
  }

  const effectiveDate = postponedUntil.trim();
  const cleanReason = reason?.trim() || undefined;
  const updatedSquabs: Squab[] = [];
  const db = await openDB();

  for (const id of squabIds) {
    const squab = await getSquab(id);
    if (!squab) continue;

    const oldTarget = squab.postponedUntil || squab.targetSaleDate;
    squab.postponedUntil = effectiveDate;
    squab.postponeReason = cleanReason;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('squabs', 'readwrite');
      const store = tx.objectStore('squabs');
      const req = store.put(squab);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'squab',
      squab.id,
      'sale_postponed',
      cleanReason
        ? `تأجيل موعد بيع ${squab.codeNumber} إلى ${effectiveDate} - السبب: ${cleanReason}`
        : `تأجيل موعد بيع ${squab.codeNumber} إلى ${effectiveDate}`,
      oldTarget,
      effectiveDate
    );

    if (squab.batchId) {
      await logEvent(
        'batch',
        squab.batchId,
        'batch_sale_postponed',
        `تأجيل بيع ${squab.codeNumber} إلى ${effectiveDate}${cleanReason ? ' (' + cleanReason + ')' : ''}`
      );
    }

    updatedSquabs.push(squab);
  }

  return updatedSquabs;
}

// -------------------------------------------------------------
// إدارة المبيعات (Sales & Selling) - المرحلة الثالثة
// -------------------------------------------------------------

export async function getSales(): Promise<Sale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readonly');
    const store = tx.objectStore('sales');
    const req = store.getAll();
    req.onsuccess = () => {
      const sales = (req.result || []) as Sale[];
      sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(sales);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSale(id: string): Promise<Sale | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readonly');
    const store = tx.objectStore('sales');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Sale) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSaleItems(): Promise<SaleItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sale_items', 'readonly');
    const store = tx.objectStore('sale_items');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as SaleItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sale_items', 'readonly');
    const store = tx.objectStore('sale_items');
    const index = store.index('saleId');
    const req = index.getAll(saleId);
    req.onsuccess = () => resolve((req.result || []) as SaleItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getSaleItemForSquab(squabId: string): Promise<SaleItem | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sale_items', 'readonly');
    const store = tx.objectStore('sale_items');
    const index = store.index('squabId');
    const req = index.getAll(squabId);
    req.onsuccess = () => {
      const items = (req.result || []) as SaleItem[];
      resolve(items.length > 0 ? items[items.length - 1] : null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * تسجيل بيع زغاليل محددة بهوياتها:
 * - اختيار الزغاليل بصورة فردية مع إمكانية أعداد فردية (بدون تقريب لأزواج)
 * - لا يمكن بيع زغلول نافق أو مباع مسبقاً
 * - يُخصم المباع فقط من الحي
 * - ترتبط المبيعات بالزغلول ومنه بالزوج الأصلي والدفعة
 * - لا سعر افتراضي، بل مسجل فعلياً
 * - عند بيع جميع زغاليل الدفعة تصبح الدفعة "مباعة بالكامل"
 */
export async function recordSale(data: {
  items: { squabId: string; price: number }[];
  date?: string;
  buyer?: string;
  note?: string;
}): Promise<{ sale: Sale; saleItems: SaleItem[]; soldSquabs: Squab[] }> {
  if (!data.items || data.items.length === 0) {
    throw new Error('يرجى تحديد زغلول واحد على الأقل للبيع');
  }

  const effectiveSaleDate = data.date && data.date.trim() ? data.date.trim() : getTodayDate();
  const totalAmount = data.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const sale: Sale = {
    id: generateId('sale'),
    date: effectiveSaleDate,
    totalAmount,
    buyer: data.buyer?.trim() || undefined,
    note: data.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();

  // 1. تسجيل عملية البيع
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sales', 'readwrite');
    const store = tx.objectStore('sales');
    const req = store.add(sale);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const saleItems: SaleItem[] = [];
  const soldSquabs: Squab[] = [];
  const affectedBatchIds = new Set<string>();

  // 2. تسجيل بنود البيع وتحديث حالة الزغاليل إلى "مباع"
  for (const item of data.items) {
    const squab = await getSquab(item.squabId);
    if (!squab) throw new Error(`الزغلول المعرف بـ ${item.squabId} غير موجود`);

    if (squab.status === 'sold') {
      throw new Error(`الزغلول ${squab.codeNumber} مباع بالفعل ولا يمكن بيعه مرتين`);
    }
    if (squab.status === 'deceased') {
      throw new Error(`الزغلول ${squab.codeNumber} نافق ولا يمكن بيعه`);
    }

    const saleItem: SaleItem = {
      id: generateId('sitem'),
      saleId: sale.id,
      squabId: squab.id,
      price: Number(item.price) || 0,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sale_items', 'readwrite');
      const store = tx.objectStore('sale_items');
      const req = store.add(saleItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    saleItems.push(saleItem);

    const oldStatus = squab.status;
    squab.status = 'sold';

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('squabs', 'readwrite');
      const store = tx.objectStore('squabs');
      const req = store.put(squab);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'squab',
      squab.id,
      'squab_sold',
      `بيع ${squab.codeNumber} بسعر ${saleItem.price} بتاريخ ${effectiveSaleDate}${sale.buyer ? ' للمشتري: ' + sale.buyer : ''}`,
      oldStatus,
      'sold'
    );

    if (squab.batchId) {
      affectedBatchIds.add(squab.batchId);
    }
    soldSquabs.push(squab);
  }

  // 3. توثيق الحدث الرئيسي للبيع
  await logEvent(
    'sale',
    sale.id,
    'sale_recorded',
    `تسجيل عملية بيع لعدد ${soldSquabs.length} زغلول بمبلغ إجمالي ${sale.totalAmount} ج.م بتاريخ ${effectiveSaleDate}`,
    null,
    JSON.stringify({ totalAmount: sale.totalAmount, count: soldSquabs.length, buyer: sale.buyer })
  );

  // 4. فحص الدفعات المتأثرة لتحديث حالتها إلى "مباعة بالكامل" إن لم يبقَ بها زغاليل حية
  for (const bId of affectedBatchIds) {
    const batchSquabs = await getSquabsByBatch(bId);
    const remainingLive = batchSquabs.filter(
      (s) => s.status === 'alive_production' || s.status === 'transferred_collection'
    );

    const batch = await getBatch(bId);
    if (batch) {
      if (remainingLive.length === 0) {
        batch.status = 'fully_sold';
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('batches', 'readwrite');
          const store = tx.objectStore('batches');
          const req = store.put(batch);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        await logEvent(
          'batch',
          batch.id,
          'batch_fully_sold',
          `اكتمل بيع جميع زغاليل ${batch.batchNumber} وتحولت إلى مباعة بالكامل`
        );
      } else {
        await logEvent(
          'batch',
          batch.id,
          'batch_partial_sale',
          `بيع جزء من زغاليل ${batch.batchNumber} (المتبقي الحي: ${remainingLive.length})`
        );
      }
    }
  }

  setLastUndoableAction({
    id: `undo_${Date.now()}`,
    actionType: 'squab_sold',
    timestamp: new Date().toISOString(),
    description: `بيع ${soldSquabs.length} زغلول بمبلغ ${sale.totalAmount} ج.م`,
    entityType: 'sale',
    entityId: sale.id,
  });

  return { sale, saleItems, soldSquabs };
}

/**
 * 6. تصحيح تاريخ النقل:
 * يوثق القيمة القديمة والجديدة والسبب في سجل الأحداث
 */
export async function correctTransferDate(
  squabIds: string[],
  newTransferDate: string,
  reason: string,
  batchId?: string
): Promise<void> {
  if (!reason || !reason.trim()) {
    throw new Error('يرجى كتابة سبب التصحيح للتوثيق بسجل الأحداث');
  }
  if (!newTransferDate || !newTransferDate.trim()) {
    throw new Error('يرجى إدخال تاريخ النقل الصحيح');
  }

  const effectiveDate = newTransferDate.trim();
  const db = await openDB();

  if (batchId) {
    const batch = await getBatch(batchId);
    if (batch) {
      const oldBatchDate = batch.transferDate;
      batch.transferDate = effectiveDate;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('batches', 'readwrite');
        const store = tx.objectStore('batches');
        const req = store.put(batch);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      await logEvent(
        'batch',
        batch.id,
        'batch_date_corrected',
        `تصحيح تاريخ النقل للدفعة: ${reason.trim()}`,
        oldBatchDate,
        effectiveDate
      );
    }
  }

  for (const id of squabIds) {
    const squab = await getSquab(id);
    if (!squab) continue;

    const oldDate = squab.transferDate;
    squab.transferDate = effectiveDate;
    squab.ageAtTransfer = getSquabAge(squab.hatchDate, effectiveDate);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('squabs', 'readwrite');
      const store = tx.objectStore('squabs');
      const req = store.put(squab);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'squab',
      squab.id,
      'transfer_date_corrected',
      reason.trim(),
      oldDate,
      effectiveDate
    );
  }
}

/**
 * 6. تصحيح أو إلغاء عملية البيع (مع إعادة الزغاليل وإلغاء صفة المباع مع الاحتفاظ بسجل التدقيق)
 */
export async function cancelSale(saleId: string, reason: string): Promise<void> {
  if (!reason || !reason.trim()) {
    throw new Error('يرجى توضيح سبب إلغاء عملية البيع للتوثيق بسجل الأحداث');
  }

  const sale = await getSale(saleId);
  if (!sale) throw new Error('عملية البيع غير موجودة');

  const saleItems = await getSaleItems(saleId);
  const db = await openDB();

  for (const item of saleItems) {
    const squab = await getSquab(item.squabId);
    if (!squab) continue;

    // استعادة حالة الزغلول كحي في التجميع (أو الإنتاج إن لم تكن له دفعة)
    const newStatus: SquabStatus = squab.batchId ? 'transferred_collection' : 'alive_production';
    squab.status = newStatus;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('squabs', 'readwrite');
      const store = tx.objectStore('squabs');
      const req = store.put(squab);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await logEvent(
      'squab',
      squab.id,
      'sale_cancelled_squab_restored',
      `إلغاء البيع واستعادة الزغلول كحي - السبب: ${reason.trim()}`,
      'sold',
      newStatus
    );

    // إن كانت هناك دفعة مرتبطة وكان وضعها "مباعة بالكامل"، نعيدها لـ "قيد التربية"
    if (squab.batchId) {
      const batch = await getBatch(squab.batchId);
      if (batch && batch.status === 'fully_sold') {
        batch.status = 'rearing';
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('batches', 'readwrite');
          const store = tx.objectStore('batches');
          const req = store.put(batch);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        await logEvent(
          'batch',
          batch.id,
          'batch_reopened',
          `إعادة فتح الدفعة بعد إلغاء بيع زغلول - السبب: ${reason.trim()}`
        );
      }
    }
  }

  // حذف بنود البيع وسجل البيع مع توثيق ذلك في سجل الأحداث
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sales', 'readwrite');
    const store = tx.objectStore('sales');
    const req = store.delete(saleId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'sale',
    saleId,
    'sale_cancelled',
    `إلغاء عملية بيع بقيمة ${sale.totalAmount} ج.م - السبب: ${reason.trim()}`,
    JSON.stringify(sale),
    null
  );
}

// -------------------------------------------------------------
// الحسابات والإحصائيات الحية (Live Dynamic Stats)
// -------------------------------------------------------------

export async function calculateFarmStats(): Promise<FarmStats> {
  const [coops, pairs, eggs, squabs, sales, settings, manualRevenues, expenses, allFeedStocks] = await Promise.all([
    getCoops(),
    getPairs(),
    getEggs(),
    getSquabs(),
    getSales(),
    getSettings(),
    getManualRevenues({ activeOnly: true }),
    getExpenses({ activeOnly: true }),
    getAllFeedStocks(),
  ]);

  // إحصائيات السلاكات
  const totalCoops = coops.length;
  const activeCoops = coops.filter((c) => c.active).length;
  const inactiveCoops = coops.filter((c) => !c.active).length;
  const productionCoops = coops.filter((c) => c.type === 'production').length;
  const collectionCoops = coops.filter((c) => c.type === 'collection').length;

  // تحديد السلاكات المشغولة والفارغة بدقة من السجلات الحية
  const occupiedCoopIds = new Set<string>();
  for (const pair of pairs) {
    if (pair.status === 'active' && pair.coopId) {
      occupiedCoopIds.add(pair.coopId);
    }
  }
  for (const egg of eggs) {
    if ((egg.status === 'pending' || egg.status === 'fertile') && egg.coopId) {
      occupiedCoopIds.add(egg.coopId);
    }
  }
  for (const squab of squabs) {
    if (squab.status === 'alive_production' && squab.originCoopId) {
      occupiedCoopIds.add(squab.originCoopId);
    } else if (squab.status === 'transferred_collection' && squab.currentLocationId) {
      occupiedCoopIds.add(squab.currentLocationId);
    }
  }

  const occupiedCoops = coops.filter((c) => c.active && occupiedCoopIds.has(c.id)).length;
  const emptyCoops = coops.filter((c) => c.active && !occupiedCoopIds.has(c.id)).length;

  // إحصائيات الأزواج
  const totalPairs = pairs.length;
  const activePairs = pairs.filter((p) => p.status === 'active').length;
  const inactivePairs = pairs.filter((p) => p.status === 'inactive').length;

  // إحصائيات البيض
  const totalHistoricalEggs = eggs.length;
  const currentIncubatingEggs = eggs.filter(
    (e) => e.status === 'pending' || e.status === 'fertile'
  ).length;

  const pendingCheckEggs = eggs.filter((e) => e.status === 'pending').length;
  const fertileEggs = eggs.filter((e) => e.status === 'fertile').length;
  const infertileEggs = eggs.filter((e) => e.status === 'infertile').length;
  const brokenEggs = eggs.filter((e) => e.status === 'broken').length;
  const lostEggs = eggs.filter((e) => e.status === 'lost').length;
  const hatchedEggs = eggs.filter((e) => e.status === 'hatched').length;

  let overdueCheckEggs = 0;
  for (const egg of eggs) {
    if (egg.status === 'pending') {
      const schedule = getEggSchedule(egg, settings);
      if (schedule.daysUntilCheck <= 0) {
        overdueCheckEggs++;
      }
    }
  }

  const eggsHatchingIn3Days = eggs.filter((e) => {
    if (e.status !== 'fertile') return false;
    const schedule = getEggSchedule(e, settings);
    return schedule.daysUntilHatch <= 3 && schedule.daysUntilHatch >= 0;
  }).length;

  // إحصائيات الزغاليل والمبيعات (المراحل 2 و 3)
  const totalHistoricalSquabs = squabs.length;
  const liveSquabsProduction = squabs.filter((s) => s.status === 'alive_production').length;
  const liveSquabsCollection = squabs.filter((s) => s.status === 'transferred_collection').length;
  const deceasedSquabs = squabs.filter((s) => s.status === 'deceased').length;
  const soldSquabs = squabs.filter((s) => s.status === 'sold').length;

  // إجمالي الحمام الموجود في المزرعة (أمهات بالغة في الأزواج النشطة + زغاليل حية)
  let totalAdultBirds = 0;
  for (const p of pairs) {
    if (p.status === 'active') {
      totalAdultBirds += (p.currentBirdCount ?? 2);
    }
  }
  const totalLivingBirds = totalAdultBirds + liveSquabsProduction + liveSquabsCollection;

  const weaningAge = settings.weaningAgeDays || 20;
  const readyForTransferSquabs = squabs.filter((s) => {
    if (s.status !== 'alive_production') return false;
    const age = getSquabAge(s.hatchDate);
    return age >= weaningAge;
  }).length;

  const targetSaleAge = settings.targetSaleAgeDays || 30;
  const readyForSaleSquabs = squabs.filter((s) => {
    if (s.status !== 'transferred_collection' && s.status !== 'alive_production') return false;
    const age = getSquabAge(s.hatchDate);
    return age >= targetSaleAge;
  }).length;

  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalSalesCount = sales.length;

  // إحصائيات العلف والمالية (المرحلة الرابعة)
  const totalAvailableFeedKg = Math.round(
    allFeedStocks.reduce((sum, item) => sum + Math.max(0, item.stock.currentStockKg), 0) * 10
  ) / 10;
  const lowStockFeedTypesCount = allFeedStocks.filter((s) => s.stock.isLowStock).length;

  // استهلاك العلف لليوم لحساب المؤشر السريع
  const todayDate = getTodayDate();
  let todayConsumptionKg = 0;
  try {
    const todayCalc = await calculateDayFeedConsumption(todayDate);
    todayConsumptionKg = todayCalc.totalKg;
  } catch {
    todayConsumptionKg = 0;
  }

  // الحسابات المالية الكلية الحية
  const manualRevenueSum = manualRevenues.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalRevenuesAmount = Math.round((totalSalesRevenue + manualRevenueSum) * 100) / 100;

  let totalExpensesAmount = 0;
  let nonEstablishmentExpensesAmount = 0;
  for (const exp of expenses) {
    totalExpensesAmount += exp.amount || 0;
    if (exp.accountingType !== 'establishment') {
      nonEstablishmentExpensesAmount += exp.amount || 0;
    }
  }
  totalExpensesAmount = Math.round(totalExpensesAmount * 100) / 100;
  nonEstablishmentExpensesAmount = Math.round(nonEstablishmentExpensesAmount * 100) / 100;

  const netOperatingProfit = Math.round((totalRevenuesAmount - nonEstablishmentExpensesAmount) * 100) / 100;
  const netProfitAfterEstablishment = Math.round((totalRevenuesAmount - totalExpensesAmount) * 100) / 100;

  return {
    totalCoops,
    activeCoops,
    inactiveCoops,
    occupiedCoops,
    emptyCoops,
    productionCoops,
    collectionCoops,
    totalPairs,
    activePairs,
    inactivePairs,
    totalLivingBirds,
    currentIncubatingEggs,
    pendingCheckEggs,
    overdueCheckEggs,
    fertileEggs,
    infertileEggs,
    brokenEggs,
    lostEggs,
    hatchedEggs,
    eggsHatchingIn3Days,
    totalHistoricalEggs,
    totalHistoricalSquabs,
    liveSquabsProduction,
    liveSquabsCollection,
    readyForTransferSquabs,
    readyForSaleSquabs,
    soldSquabs,
    deceasedSquabs,
    totalSalesRevenue,
    totalSalesCount,
    totalRevenuesAmount,
    totalExpensesAmount,
    netOperatingProfit,
    netProfitAfterEstablishment,
    totalAvailableFeedKg,
    lowStockFeedTypesCount,
    averageDailyFeedConsumptionKg: todayConsumptionKg,
  };
}

export async function calculatePairStats(pairId: string): Promise<PairStats> {
  const [eggs, squabs, allSaleItems] = await Promise.all([
    getEggsByPair(pairId),
    getSquabsByPair(pairId),
    getAllSaleItems(),
  ]);

  const totalEggs = eggs.length;
  const fertileEggs = eggs.filter((e) => e.status === 'fertile' || e.status === 'hatched').length;
  const infertileEggs = eggs.filter((e) => e.status === 'infertile').length;
  const brokenEggs = eggs.filter((e) => e.status === 'broken').length;
  const lostEggs = eggs.filter((e) => e.status === 'lost').length;
  const hatchedEggs = eggs.filter((e) => e.status === 'hatched').length;

  const totalSquabs = squabs.length;
  const deceasedSquabs = squabs.filter((s) => s.status === 'deceased').length;
  const liveSquabs = squabs.filter(
    (s) => s.status === 'alive_production' || s.status === 'transferred_collection'
  ).length;
  const transferredSquabs = squabs.filter(
    (s) => s.status === 'transferred_collection' || s.status === 'sold'
  ).length;
  const soldSquabs = squabs.filter((s) => s.status === 'sold').length;

  // حساب قيمة المبيعات الفعلية المسجلة لزغاليل هذا الزوج
  const pairSquabIds = new Set(squabs.map((s) => s.id));
  const pairSaleItems = allSaleItems.filter((item) => pairSquabIds.has(item.squabId));
  const salesRevenue = pairSaleItems.reduce((sum, item) => sum + (item.price || 0), 0);

  return {
    totalEggs,
    fertileEggs,
    infertileEggs,
    brokenEggs,
    lostEggs,
    hatchedEggs,
    totalSquabs,
    deceasedSquabs,
    liveSquabs,
    transferredSquabs,
    soldSquabs,
    salesRevenue,
  };
}

export async function getTaskActions(): Promise<Record<string, TaskActionRecord>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('task_actions', 'readonly');
    const store = tx.objectStore('task_actions');
    const req = store.getAll();
    req.onsuccess = () => {
      const records = (req.result || []) as TaskActionRecord[];
      const map: Record<string, TaskActionRecord> = {};
      for (const r of records) {
        map[r.id] = r;
      }
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function completeTask(taskId: string): Promise<void> {
  const db = await openDB();
  const record: TaskActionRecord = {
    id: taskId,
    status: 'completed',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('task_actions', 'readwrite');
    const store = tx.objectStore('task_actions');
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    taskId,
    'task_completed',
    `تعليم المهمة ${taskId} كمنفذة يدوياً`,
    null,
    JSON.stringify(record)
  );
}

export async function snoozeTask(taskId: string, snoozedUntilDate: string): Promise<void> {
  const db = await openDB();
  const record: TaskActionRecord = {
    id: taskId,
    status: 'snoozed',
    snoozedUntil: snoozedUntilDate,
    updatedAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('task_actions', 'readwrite');
    const store = tx.objectStore('task_actions');
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    taskId,
    'task_snoozed',
    `تأجيل المهمة ${taskId} حتى تاريخ ${snoozedUntilDate}`,
    null,
    JSON.stringify(record)
  );
}

export async function clearTaskAction(taskId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('task_actions', 'readwrite');
    const store = tx.objectStore('task_actions');
    const req = store.delete(taskId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateAlertPreferences(
  prefs: Partial<AlertPreferences>
): Promise<FarmSettings> {
  const settings = await getSettings();
  const newPrefs: AlertPreferences = {
    fertilityCheck: prefs.fertilityCheck ?? settings.alertPreferences?.fertilityCheck ?? true,
    hatchExpected: prefs.hatchExpected ?? settings.alertPreferences?.hatchExpected ?? true,
    eggLayingExpected: prefs.eggLayingExpected ?? settings.alertPreferences?.eggLayingExpected ?? true,
    readyForTransfer: prefs.readyForTransfer ?? settings.alertPreferences?.readyForTransfer ?? true,
    batchReadyForSale: prefs.batchReadyForSale ?? settings.alertPreferences?.batchReadyForSale ?? true,
    lowFeedStock: prefs.lowFeedStock ?? settings.alertPreferences?.lowFeedStock ?? true,
  };

  const updatedSettings: FarmSettings = {
    ...settings,
    alertPreferences: newPrefs,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put(updatedSettings);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    'global_settings',
    'alert_preferences_updated',
    'تحديث تفضيلات وأنواع تنبيهات مهام اليوم',
    JSON.stringify(settings.alertPreferences || {}),
    JSON.stringify(newPrefs)
  );

  return updatedSettings;
}

export async function updatePairRankingThresholds(
  thresholds: Partial<PairRankingThresholds>
): Promise<FarmSettings> {
  const settings = await getSettings();
  const newThresholds: PairRankingThresholds = {
    greenMinRate: thresholds.greenMinRate ?? settings.pairRankingThresholds?.greenMinRate ?? 80,
    yellowMinRate: thresholds.yellowMinRate ?? settings.pairRankingThresholds?.yellowMinRate ?? 60,
  };

  const updatedSettings: FarmSettings = {
    ...settings,
    pairRankingThresholds: newThresholds,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put(updatedSettings);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    'global_settings',
    'pair_ranking_thresholds_updated',
    'تحديث عتبات المؤشر اللوني لترتيب أفضل الأزواج',
    JSON.stringify(settings.pairRankingThresholds || {}),
    JSON.stringify(newThresholds)
  );

  return updatedSettings;
}

export async function getTodayTasks(): Promise<TodayTask[]> {
  const [eggs, squabs, coops, pairs, cycles, batches, settings, taskActionsMap] = await Promise.all([
    getEggs(),
    getSquabs(),
    getCoops(),
    getPairs(),
    getCycles(),
    getBatches(),
    getSettings(),
    getTaskActions(),
  ]);

  const tasks: TodayTask[] = [];
  const today = getTodayDate();
  const alertPrefs = settings.alertPreferences;

  // 1. مهام فحص التخصيب المستحقة
  if (!alertPrefs || alertPrefs.fertilityCheck !== false) {
    for (const egg of eggs) {
      if (egg.status === 'pending') {
        const schedule = getEggSchedule(egg, settings);
        if (schedule.daysUntilCheck <= 0) {
          const coop = coops.find((c) => c.id === egg.coopId);
          const pair = pairs.find((p) => p.id === egg.pairId);
          tasks.push({
            id: `task_check_${egg.id}`,
            type: 'fertility_check',
            title: `فحص تخصيب مستحق (البيضة ${egg.eggNumber})`,
            subtitle: `سلاكة ${coop ? coop.number : '—'} • ${pair ? pair.name : ''} (${schedule.countdownText})`,
            coopId: egg.coopId,
            coopNumber: coop ? coop.number : '—',
            pairId: egg.pairId,
            pairName: pair ? pair.name : '',
            eggId: egg.id,
            isUrgent: schedule.daysUntilCheck < 0,
          });
        }
      }
    }
  }

  // 2. مهام الفقس المتوقع
  if (!alertPrefs || alertPrefs.hatchExpected !== false) {
    for (const egg of eggs) {
      if (egg.status === 'fertile') {
        const schedule = getEggSchedule(egg, settings);
        if (schedule.daysUntilHatch <= 1) {
          const coop = coops.find((c) => c.id === egg.coopId);
          const pair = pairs.find((p) => p.id === egg.pairId);
          tasks.push({
            id: `task_hatch_${egg.id}`,
            type: 'hatch_expected',
            title:
              schedule.daysUntilHatch <= 0
                ? `موعد فقس حان الآن (البيضة ${egg.eggNumber})`
                : `موعد فقس متوقع قريباً (البيضة ${egg.eggNumber})`,
            subtitle: `سلاكة ${coop ? coop.number : '—'} • ${pair ? pair.name : ''} (${schedule.countdownText})`,
            coopId: egg.coopId,
            coopNumber: coop ? coop.number : '—',
            pairId: egg.pairId,
            pairName: pair ? pair.name : '',
            eggId: egg.id,
            isUrgent: schedule.daysUntilHatch <= 0,
          });
        }
      }
    }
  }

  // 3. مهام وضع بيض متوقع (من تاريخ آخر دورة، إن توفرت بيانات)
  if (!alertPrefs || alertPrefs.eggLayingExpected !== false) {
    for (const pair of pairs) {
      if (pair.status === 'active') {
        const pairCycles = cycles
          .filter((c) => c.pairId === pair.id)
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        const latestCycle = pairCycles[0];
        if (latestCycle) {
          const cycleEggs = eggs.filter((e) => e.cycleId === latestCycle.id);
          const hasActiveEggs = cycleEggs.some((e) => e.status === 'pending' || e.status === 'fertile');
          const daysSinceCycleStart = daysDifference(latestCycle.startDate, today);

          if (!hasActiveEggs && daysSinceCycleStart >= 20) {
            const coop = pair.coopId ? coops.find((c) => c.id === pair.coopId) : null;
            tasks.push({
              id: `task_egg_laying_${pair.id}`,
              type: 'egg_laying_expected',
              title: `وضع بيض متوقع (${pair.name})`,
              subtitle: `سلاكة ${coop ? coop.number : '—'} • مضى ${daysSinceCycleStart} يوماً منذ بداية آخر عش`,
              coopId: pair.coopId || undefined,
              coopNumber: coop ? coop.number : '—',
              pairId: pair.id,
              pairName: pair.name,
              isUrgent: false,
            });
          }
        }
      }
    }
  }

  // 4. زغاليل بلغت عمر 20 يوماً فأكثر (جاهزة للنقل من سلاكات الإنتاج)
  if (!alertPrefs || alertPrefs.readyForTransfer !== false) {
    const weaningAge = settings.weaningAgeDays || 20;
    for (const squab of squabs) {
      if (squab.status === 'alive_production') {
        const age = getSquabAge(squab.hatchDate);
        if (age >= weaningAge) {
          const coop = coops.find((c) => c.id === squab.originCoopId);
          const pair = pairs.find((p) => p.id === squab.pairId);
          tasks.push({
            id: `task_transfer_${squab.id}`,
            type: 'ready_for_transfer',
            title: `زغلول جاهز للنقل (${squab.codeNumber})`,
            subtitle: `عمر ${age} يوم • سلاكة الإنتاج ${coop ? coop.number : '—'} (${pair ? pair.name : ''})`,
            coopId: squab.originCoopId,
            coopNumber: coop ? coop.number : '—',
            pairId: squab.pairId,
            pairName: pair ? pair.name : '',
            squabId: squab.id,
            isUrgent: false,
          });
        }
      }
    }
  }

  // 5. زغاليل / دفعات بلغت عمر 30 يوماً فأكثر (جاهزة للبيع / مراجعة الوزن)
  if (!alertPrefs || alertPrefs.batchReadyForSale !== false) {
    const targetSaleAge = settings.targetSaleAgeDays || 30;
    const saleReadySquabsInCollection = squabs.filter((s) => {
      if (s.status !== 'transferred_collection') return false;
      const age = getSquabAge(s.hatchDate);
      const effectiveSaleDate = getEffectiveSaleDate(s);
      return age >= targetSaleAge || daysDifference(today, effectiveSaleDate) <= 0;
    });

    const batchesWithReadySquabs = new Set<string>();
    for (const s of saleReadySquabsInCollection) {
      if (s.batchId) batchesWithReadySquabs.add(s.batchId);
    }

    for (const batchId of batchesWithReadySquabs) {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch || batch.status === 'fully_sold' || batch.status === 'closed') continue;

      const bSquabs = saleReadySquabsInCollection.filter((s) => s.batchId === batchId);
      const coop = coops.find((c) => c.id === batch.collectionCoopId);

      tasks.push({
        id: `task_sale_batch_${batch.id}`,
        type: 'ready_for_sale',
        title: `${batch.batchNumber}: زغاليل جاهزة للبيع / مراجعة الوزن (${bSquabs.length})`,
        subtitle: `سلاكة تجميع ${coop ? coop.number : '—'} • بلغت عمر 30+ يوم`,
        coopId: batch.collectionCoopId,
        coopNumber: coop ? coop.number : '—',
        batchId: batch.id,
        isUrgent: false,
      });
    }
  }

  // 6. تنبيهات انخفاض مخزون العلف عن حد الأمان
  if (!alertPrefs || alertPrefs.lowFeedStock !== false) {
    try {
      const feedStocks = await getAllFeedStocks();
      for (const { feedType, stock } of feedStocks) {
        if (feedType.active && stock.isLowStock) {
          tasks.push({
            id: `task_low_stock_${feedType.id}`,
            type: 'low_feed_stock',
            title: `تنبيه: انخفاض مخزون ${feedType.name}`,
            subtitle: `الكمية المتوفرة حالياً (${stock.currentStockKg.toFixed(1)} كجم) انخفضت عن حد الأمان (${feedType.alertThresholdKg} كجم)`,
            feedTypeId: feedType.id,
            isUrgent: true,
          });
        }
      }
    } catch (err) {
      console.warn('Error checking feed stock for tasks:', err);
    }
  }

  // 7. تذكير بالنسخ الاحتياطي الدوري (المرحلة السادسة)
  const reminderDays = settings.backupReminderDays ?? 7;
  if (reminderDays > 0) {
    const hasData = coops.length > 0 || pairs.length > 0 || eggs.length > 0 || squabs.length > 0;
    if (hasData) {
      const daysSinceBackup = settings.lastBackupDate ? daysDifference(settings.lastBackupDate, today) : 999;
      if (daysSinceBackup >= reminderDays) {
        tasks.push({
          id: 'task_backup_reminder',
          type: 'backup_reminder',
          title: 'تذكير بالنسخ الاحتياطي الدوري لبيانات المزرعة',
          subtitle: settings.lastBackupDate
            ? `مضى ${daysSinceBackup} يوماً على آخر تصدير احتياطي (المحدد كل ${reminderDays} أيام)`
            : 'لم يتم تصدير أي نسخة احتياطية لبيانات المزرعة حتى الآن',
          isUrgent: daysSinceBackup >= reminderDays * 2,
        });
      }
    }
  }

  // تطبيق تصفية الإجراءات (تجاوز المنفذة، والمؤجلة حتى تاريخها)
  const filteredTasks = tasks.filter((task) => {
    const action = taskActionsMap[task.id];
    if (action) {
      if (action.status === 'completed') return false;
      if (action.status === 'snoozed' && action.snoozedUntil && action.snoozedUntil > today) {
        return false;
      }
    }
    return true;
  });

  // ترتيب المهام حسب الأولوية:
  // 1. العاجلة (مخزون منخفض، فحص/فقس متأخر)
  // 2. فقس متوقع وفحص تخصيب
  // 3. جاهز للنقل (20 يوم)
  // 4. جاهز للبيع (30 يوم)
  // 5. وضع بيض متوقع
  filteredTasks.sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    const typeOrder: Record<string, number> = {
      low_feed_stock: 1,
      hatch_expected: 2,
      fertility_check: 3,
      ready_for_transfer: 4,
      ready_for_sale: 5,
      egg_laying_expected: 6,
    };
    return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
  });

  return filteredTasks;
}

// =============================================================
// المرحلة الرابعة: المخزون والعلف والمصروفات والإيرادات
// =============================================================

// -------------------------------------------------------------
// 1. إدارة نوع العلف الأساسي في الإعدادات
// -------------------------------------------------------------
export async function setPrimaryFeedType(feedTypeId: string | undefined, reason?: string): Promise<FarmSettings> {
  const oldSettings = await getSettings();
  const db = await openDB();
  const newSettings: FarmSettings = {
    ...oldSettings,
    primaryFeedTypeId: feedTypeId || undefined,
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put(newSettings);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'settings',
    'global_settings',
    'primary_feed_type_updated',
    reason || 'تحديث نوع العلف الأساسي للاستهلاك التلقائي',
    oldSettings.primaryFeedTypeId || 'غير محدد',
    feedTypeId || 'غير محدد'
  );

  return newSettings;
}

// -------------------------------------------------------------
// 2. إدارة عدد طيور الزوج وسجل تواريخ التغيير
// -------------------------------------------------------------
export function getPairBirdCountOnDate(pair: Pair, date: string): number {
  if (!pair.pairedDate || date < pair.pairedDate) {
    return 0; // الزوج لم يكن موجوداً قبل تاريخ التكوين
  }
  if (pair.birdCountHistory && pair.birdCountHistory.length > 0) {
    const matching = pair.birdCountHistory
      .filter((h) => h.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (matching.length > 0) {
      return matching[0].birdCount;
    }
  }
  return 2; // الافتراضي طائران للزوج
}

export async function recordPairBirdCountChange(
  pairId: string,
  effectiveDate: string,
  newBirdCount: number,
  reason: string
): Promise<Pair> {
  const pair = await getPair(pairId);
  if (!pair) throw new Error('الزوج غير موجود');
  if (!reason || !reason.trim()) throw new Error('يرجى ذكر سبب تغيير عدد الطيور في الزوج للتوثيق');
  if (newBirdCount < 0) throw new Error('عدد الطيور لا يمكن أن يكون سالباً');

  if (!pair.birdCountHistory) {
    pair.birdCountHistory = [];
  }
  const oldVal = getPairBirdCountOnDate(pair, effectiveDate);
  pair.birdCountHistory.push({
    date: effectiveDate.trim(),
    birdCount: newBirdCount,
    reason: reason.trim(),
  });
  pair.birdCountHistory.sort((a, b) => a.date.localeCompare(b.date));

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pairs', 'readwrite');
    const store = tx.objectStore('pairs');
    const req = store.put(pair);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'pair',
    pair.id,
    'pair_bird_count_changed',
    reason.trim(),
    `${oldVal} طائر`,
    `${newBirdCount} طائر (ساري من ${effectiveDate})`
  );

  return pair;
}

// -------------------------------------------------------------
// 3. إدارة أنواع العلف (Feed Types)
// -------------------------------------------------------------
export async function getFeedTypes(
  filterOrActiveOnly: boolean | { activeOnly?: boolean } = false
): Promise<FeedType[]> {
  const activeOnly =
    typeof filterOrActiveOnly === 'boolean'
      ? filterOrActiveOnly
      : Boolean(filterOrActiveOnly?.activeOnly);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('feed_types', 'readonly');
    const store = tx.objectStore('feed_types');
    const req = store.getAll();
    req.onsuccess = () => {
      let items = (req.result || []) as FeedType[];
      if (activeOnly) {
        items = items.filter((f) => f.active);
      }
      items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getFeedType(id: string): Promise<FeedType | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('feed_types', 'readonly');
    const store = tx.objectStore('feed_types');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as FeedType) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addFeedType(data: {
  name: string;
  unit?: string;
  alertThresholdKg?: number;
  notes?: string;
}): Promise<FeedType> {
  if (!data.name || !data.name.trim()) throw new Error('يرجى إدخال اسم نوع العلف');

  const feedType: FeedType = {
    id: generateId('feed'),
    name: data.name.trim(),
    unit: data.unit?.trim() || 'كجم',
    alertThresholdKg: Math.max(0, Number(data.alertThresholdKg) || 0),
    active: true,
    notes: data.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('feed_types', 'readwrite');
    const store = tx.objectStore('feed_types');
    const req = store.add(feedType);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'feed_type',
    feedType.id,
    'feed_type_created',
    `إضافة نوع علف جديد: ${feedType.name} (حد التنبيه: ${feedType.alertThresholdKg} ${feedType.unit})`,
    null,
    JSON.stringify(feedType)
  );

  return feedType;
}

export async function updateFeedType(
  id: string,
  updates: Partial<Omit<FeedType, 'id' | 'createdAt'>>,
  reason?: string
): Promise<FeedType> {
  const feedType = await getFeedType(id);
  if (!feedType) throw new Error('نوع العلف غير موجود');

  const oldJson = JSON.stringify(feedType);
  if (updates.name !== undefined && updates.name.trim()) feedType.name = updates.name.trim();
  if (updates.unit !== undefined && updates.unit.trim()) feedType.unit = updates.unit.trim();
  if (updates.alertThresholdKg !== undefined) {
    feedType.alertThresholdKg = Math.max(0, Number(updates.alertThresholdKg) || 0);
  }
  if (updates.notes !== undefined) feedType.notes = updates.notes.trim() || undefined;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('feed_types', 'readwrite');
    const store = tx.objectStore('feed_types');
    const req = store.put(feedType);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'feed_type',
    feedType.id,
    'feed_type_updated',
    reason || `تعديل بيانات نوع العلف ${feedType.name}`,
    oldJson,
    JSON.stringify(feedType)
  );

  return feedType;
}

export async function toggleFeedTypeActive(id: string, reason?: string): Promise<FeedType> {
  const feedType = await getFeedType(id);
  if (!feedType) throw new Error('نوع العلف غير موجود');

  const oldStatus = feedType.active ? 'نشط' : 'متوقف';
  feedType.active = !feedType.active;
  const newStatus = feedType.active ? 'نشط' : 'متوقف';

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('feed_types', 'readwrite');
    const store = tx.objectStore('feed_types');
    const req = store.put(feedType);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'feed_type',
    feedType.id,
    feedType.active ? 'feed_type_activated' : 'feed_type_deactivated',
    reason || (feedType.active ? 'تنشيط نوع العلف' : 'إيقاف نوع العلف مؤقتاً'),
    oldStatus,
    newStatus
  );

  return feedType;
}

// -------------------------------------------------------------
// 4. حركات المخزون وحساب الأرصدة (Stock Movements)
// -------------------------------------------------------------
export async function getStockMovements(feedTypeId?: string): Promise<StockMovement[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_movements', 'readonly');
    const store = tx.objectStore('stock_movements');
    const req = store.getAll();
    req.onsuccess = () => {
      let movements = (req.result || []) as StockMovement[];
      if (feedTypeId) {
        movements = movements.filter((m) => m.feedTypeId === feedTypeId);
      }
      movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(movements);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getFeedTypeStock(feedTypeId: string): Promise<{
  currentStockKg: number;
  totalPurchasedKg: number;
  totalPurchaseCost: number;
  weightedAveragePrice: number;
  isLowStock: boolean;
}> {
  const [feedType, movements] = await Promise.all([
    getFeedType(feedTypeId),
    getStockMovements(feedTypeId),
  ]);

  if (!feedType) {
    throw new Error('نوع العلف غير موجود');
  }

  let currentStockKg = 0;
  let totalPurchasedKg = 0;
  let totalPurchaseCost = 0;

  for (const m of movements) {
    currentStockKg += Number(m.quantity) || 0;
    if (m.type === 'purchase' && m.quantity > 0) {
      const q = Number(m.quantity) || 0;
      const cost = Number(m.totalCost) || q * (Number(m.unitPrice) || 0);
      totalPurchasedKg += q;
      totalPurchaseCost += cost;
    }
  }

  const weightedAveragePrice =
    totalPurchasedKg > 0 ? totalPurchaseCost / totalPurchasedKg : 0;
  const isLowStock = currentStockKg <= feedType.alertThresholdKg;

  return {
    currentStockKg: Math.round(currentStockKg * 100) / 100,
    totalPurchasedKg: Math.round(totalPurchasedKg * 100) / 100,
    totalPurchaseCost: Math.round(totalPurchaseCost * 100) / 100,
    weightedAveragePrice: Math.round(weightedAveragePrice * 100) / 100,
    isLowStock,
  };
}

export async function getAllFeedStocks(): Promise<
  {
    feedType: FeedType;
    stock: {
      currentStockKg: number;
      totalPurchasedKg: number;
      totalPurchaseCost: number;
      weightedAveragePrice: number;
      isLowStock: boolean;
    };
  }[]
> {
  const feedTypes = await getFeedTypes();
  const results = [];
  for (const ft of feedTypes) {
    const stock = await getFeedTypeStock(ft.id);
    results.push({ feedType: ft, stock });
  }
  return results;
}

/**
 * شراء علف:
 * - يزيد المخزون (+quantityKg)
 * - يُنشئ تلقائياً مصروفاً مرتبطاً به في قسم المصروفات (لا يدخل المستخدم الشراء مرتين)
 */
export async function recordFeedPurchase(data: {
  feedTypeId: string;
  date?: string;
  quantity?: number;
  quantityKg?: number;
  unitPrice: number;
  supplier?: string;
  reason?: string;
  note?: string;
  accountingType?: AccountingType;
}): Promise<{ movement: StockMovement; expense: Expense }> {
  const qty = Number(data.quantityKg ?? data.quantity ?? 0);
  if (qty <= 0) throw new Error('كمية الشراء يجب أن تكون أكبر من الصفر');
  if (data.unitPrice <= 0) throw new Error('سعر الشراء يجب أن يكون أكبر من الصفر');

  const feedType = await getFeedType(data.feedTypeId);
  if (!feedType) throw new Error('نوع العلف غير موجود');

  const effectiveDate = data.date && data.date.trim() ? data.date.trim() : getTodayDate();
  const totalCost = Math.round(qty * data.unitPrice * 100) / 100;
  const expenseId = generateId('expense');
  const movementId = generateId('stock_mov');

  const movement: StockMovement = {
    id: movementId,
    feedTypeId: data.feedTypeId,
    date: effectiveDate,
    quantity: qty,
    type: 'purchase',
    reason: data.reason?.trim() || `شراء ${qty} كجم من ${feedType.name}`,
    unitPrice: data.unitPrice,
    totalCost,
    supplier: data.supplier?.trim() || undefined,
    expenseId,
    createdAt: new Date().toISOString(),
  };

  const expense: Expense = {
    id: expenseId,
    date: effectiveDate,
    amount: totalCost,
    category: 'feed',
    accountingType: data.accountingType || 'production_cost',
    description: `شراء علف: ${feedType.name} (${qty} كجم × ${data.unitPrice} ج.م)`,
    note: data.note?.trim() || (data.supplier ? `المورد: ${data.supplier}` : undefined),
    feedPurchaseId: movementId,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['stock_movements', 'expenses'], 'readwrite');
    tx.objectStore('stock_movements').add(movement);
    tx.objectStore('expenses').add(expense);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await logEvent(
    'stock_movement',
    movement.id,
    'feed_purchased',
    `شراء علف: ${data.quantityKg} كجم من ${feedType.name} بسعر ${data.unitPrice} ج.م/كجم بإجمالي ${totalCost} ج.م`,
    null,
    JSON.stringify(movement)
  );

  return { movement, expense };
}

/**
 * التعديل اليدوي للمخزون:
 * يتطلب تاريخاً وسبباً إجبارياً ويُسجل ولا يُحذف
 */
export async function recordStockManualAdjustment(data: {
  feedTypeId: string;
  date?: string;
  quantity?: number;
  quantityDeltaKg?: number;
  reason: string;
}): Promise<StockMovement> {
  if (!data.reason || !data.reason.trim()) {
    throw new Error('يرجى كتابة سبب التعديل اليدوي للمخزون بدقة للتوثيق');
  }
  const delta = Number(data.quantityDeltaKg ?? data.quantity ?? 0);
  if (delta === 0) {
    throw new Error('قيمة التعديل لا يمكن أن تكون صفراً');
  }

  const feedType = await getFeedType(data.feedTypeId);
  if (!feedType) throw new Error('نوع العلف غير موجود');

  const effectiveDate = data.date && data.date.trim() ? data.date.trim() : getTodayDate();
  const oldStock = await getFeedTypeStock(data.feedTypeId);

  const movement: StockMovement = {
    id: generateId('stock_mov'),
    feedTypeId: data.feedTypeId,
    date: effectiveDate,
    quantity: delta,
    type: 'manual_adjustment',
    reason: data.reason.trim(),
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('stock_movements', 'readwrite');
    const store = tx.objectStore('stock_movements');
    const req = store.add(movement);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const newStockKg = Math.round((oldStock.currentStockKg + delta) * 100) / 100;

  await logEvent(
    'stock_movement',
    movement.id,
    'stock_manual_adjusted',
    data.reason.trim(),
    `الرصيد السابق: ${oldStock.currentStockKg} كجم`,
    `الرصيد الجديد: ${newStockKg} كجم (تعديل: ${delta > 0 ? '+' : ''}${delta} كجم)`
  );

  return movement;
}

// -------------------------------------------------------------
// 5. إدارة معدلات استهلاك العلف اليومية (Feed Rates Config)
// -------------------------------------------------------------
export async function getFeedRateConfigs(): Promise<FeedRateConfig[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('feed_rate_configs', 'readonly');
    const store = tx.objectStore('feed_rate_configs');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as FeedRateConfig[];
      items.sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getFeedRateConfig(id: string): Promise<FeedRateConfig | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('feed_rate_configs', 'readonly');
    const store = tx.objectStore('feed_rate_configs');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as FeedRateConfig) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addFeedRateConfig(data: {
  effectiveFromDate: string;
  adultGrams: number;
  prodSquabGrams: number;
  collSquabGrams: number;
  note?: string;
}): Promise<FeedRateConfig> {
  if (!data.effectiveFromDate || !data.effectiveFromDate.trim()) {
    throw new Error('يرجى تحديد تاريخ سريان المعدل (ساري من تاريخ)');
  }
  if (data.adultGrams < 0 || data.prodSquabGrams < 0 || data.collSquabGrams < 0) {
    throw new Error('معدلات الاستهلاك لا يمكن أن تكون سالبة');
  }

  const config: FeedRateConfig = {
    id: generateId('rate'),
    effectiveFromDate: data.effectiveFromDate.trim(),
    adultGrams: Number(data.adultGrams) || 0,
    prodSquabGrams: Number(data.prodSquabGrams) || 0,
    collSquabGrams: Number(data.collSquabGrams) || 0,
    note: data.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('feed_rate_configs', 'readwrite');
    const store = tx.objectStore('feed_rate_configs');
    const req = store.add(config);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'feed_rate',
    config.id,
    'feed_rate_added',
    `إضافة معدل استهلاك علف جديد ساري من ${config.effectiveFromDate}: بالغ ${config.adultGrams}جم، إنتاج ${config.prodSquabGrams}جم، تجميع ${config.collSquabGrams}جم`,
    null,
    JSON.stringify(config)
  );

  return config;
}

export async function getEffectiveFeedRateOnDate(date: string): Promise<FeedRateConfig | null> {
  const configs = await getFeedRateConfigs();
  const matching = configs
    .filter((c) => c.effectiveFromDate <= date)
    .sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
  return matching.length > 0 ? matching[0] : null;
}

// -------------------------------------------------------------
// 6. محرك حساب استهلاك العلف اليومي وإعادة الحساب دون تكرار
// -------------------------------------------------------------

/**
 * حساب الاستهلاك ليوم محدد وفق القواعد الصارمة:
 * - الحمام البالغ = عدد الأزواج النشطة في ذلك اليوم × عدد الطيور في الزوج
 * - الزغاليل في الإنتاج = الأحياء في ذلك اليوم من الفقس حتى يوم قبل النقل أو النفوق أو البيع
 * - الزغاليل في التجميع = الأحياء من تاريخ النقل حتى يوم قبل النفوق أو البيع
 * - القاعدة: يُحسب اليوم الذي يبدأ فيه الوجود، ولا يُحسب يوم الخروج
 * - عند النقل ينتقل احتسابه من الإنتاج إلى التجميع من تاريخ النقل بدون تكرار
 */
export async function calculateDayFeedConsumption(
  date: string,
  options?: {
    pairs?: Pair[];
    squabs?: Squab[];
    saleDateMap?: Map<string, string>;
    rateConfigs?: FeedRateConfig[];
    weightedAvgPrice?: number;
    feedTypeId?: string;
  }
): Promise<DailyFeedConsumption> {
  const pairs = options?.pairs || (await getPairs());
  const squabs = options?.squabs || (await getSquabs());
  const settings = await getSettings();
  const feedTypeId = options?.feedTypeId || settings.primaryFeedTypeId || '';

  // خريطة تواريخ بيع الزغاليل
  let saleDateMap = options?.saleDateMap;
  if (!saleDateMap) {
    const sales = await getSales();
    const saleItems = await getAllSaleItems();
    saleDateMap = new Map<string, string>();
    for (const item of saleItems) {
      const s = sales.find((sale) => sale.id === item.saleId);
      if (s) {
        saleDateMap.set(item.squabId, s.date);
      }
    }
  }

  // 1. حساب عدد طيور الحمام البالغ في هذا اليوم
  let adultBirdsCount = 0;
  for (const pair of pairs) {
    if (pair.pairedDate && pair.pairedDate <= date) {
      // الزوج نشط في هذا التاريخ
      if (pair.status === 'active') {
        adultBirdsCount += getPairBirdCountOnDate(pair, date);
      }
    }
  }

  // 2. حساب الزغاليل في الإنتاج وفي التجميع في هذا اليوم
  let prodSquabsCount = 0;
  let collSquabsCount = 0;

  for (const squab of squabs) {
    const saleDate = saleDateMap.get(squab.id);
    const deathDate = squab.deathDate;
    const transferDate = squab.transferDate;

    // الزغلول في الإنتاج:
    // بدأ وجوده من تاريخ الفقس (hatchDate <= date)
    // ولم يخرج بعد بالانتقال (transferDate > date أو لم ينقل)
    // ولم يمت في هذا اليوم أو قبله (deathDate > date أو لم يمت)
    // ولم يبع في هذا اليوم أو قبله (saleDate > date أو لم يبع)
    if (squab.hatchDate <= date) {
      const hasTransferred = transferDate && transferDate <= date;
      const hasDied = deathDate && deathDate <= date;
      const hasBeenSold = saleDate && saleDate <= date;

      if (!hasTransferred && !hasDied && !hasBeenSold) {
        prodSquabsCount++;
      }
    }

    // الزغلول في التجميع:
    // بدأ وجوده في التجميع من تاريخ النقل (transferDate <= date)
    // ولم يمت في هذا اليوم أو قبله (deathDate > date أو لم يمت)
    // ولم يبع في هذا اليوم أو قبله (saleDate > date أو لم يبع)
    if (transferDate && transferDate <= date) {
      const hasDied = deathDate && deathDate <= date;
      const hasBeenSold = saleDate && saleDate <= date;

      if (!hasDied && !hasBeenSold) {
        collSquabsCount++;
      }
    }
  }

  // 3. البحث عن معدل الاستهلاك الساري في هذا اليوم
  let rateConfig: FeedRateConfig | null = null;
  if (options?.rateConfigs) {
    const matching = options.rateConfigs
      .filter((c) => c.effectiveFromDate <= date)
      .sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
    rateConfig = matching.length > 0 ? matching[0] : null;
  } else {
    rateConfig = await getEffectiveFeedRateOnDate(date);
  }

  let adultGramsTotal = 0;
  let prodSquabsGramsTotal = 0;
  let collSquabsGramsTotal = 0;
  let totalKg = 0;
  let cost = 0;
  const hasConfiguredRates = Boolean(rateConfig);

  if (rateConfig) {
    adultGramsTotal = adultBirdsCount * rateConfig.adultGrams;
    prodSquabsGramsTotal = prodSquabsCount * rateConfig.prodSquabGrams;
    collSquabsGramsTotal = collSquabsCount * rateConfig.collSquabGrams;
    totalKg = Math.round(((adultGramsTotal + prodSquabsGramsTotal + collSquabsGramsTotal) / 1000) * 1000) / 1000;

    let avgPrice = options?.weightedAvgPrice;
    if (avgPrice === undefined && feedTypeId) {
      const stock = await getFeedTypeStock(feedTypeId);
      avgPrice = stock.weightedAveragePrice;
    }
    cost = Math.round(totalKg * (avgPrice || 0) * 100) / 100;
  }

  return {
    date,
    feedTypeId,
    adultBirdsCount,
    prodSquabsCount,
    collSquabsCount,
    adultGramsTotal,
    prodSquabsGramsTotal,
    collSquabsGramsTotal,
    totalKg,
    cost,
    hasConfiguredRates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * إعادة حساب وتحديث استهلاك العلف اليومي لكل تاريخ في قاعدة البيانات
 * وتحديث حركة المخزون التلقائية بدون تكرار
 */
export async function reconcileDailyFeedConsumption(
  startDate?: string,
  endDate?: string
): Promise<DailyFeedConsumption[]> {
  const [pairs, squabs, sales, saleItems, rateConfigs, settings] = await Promise.all([
    getPairs(),
    getSquabs(),
    getSales(),
    getAllSaleItems(),
    getFeedRateConfigs(),
    getSettings(),
  ]);

  const saleDateMap = new Map<string, string>();
  for (const item of saleItems) {
    const s = sales.find((sale) => sale.id === item.saleId);
    if (s) saleDateMap.set(item.squabId, s.date);
  }

  const primaryFeedTypeId = settings.primaryFeedTypeId;
  let weightedAvgPrice = 0;
  if (primaryFeedTypeId) {
    const stock = await getFeedTypeStock(primaryFeedTypeId);
    weightedAvgPrice = stock.weightedAveragePrice;
  }

  // تحديد المدى الزمني للاحتساب
  const today = getTodayDate();
  const effectiveEnd = endDate || today;

  let effectiveStart = startDate;
  if (!effectiveStart) {
    let earliest = today;
    for (const p of pairs) {
      if (p.pairedDate && p.pairedDate < earliest) earliest = p.pairedDate;
    }
    for (const s of squabs) {
      if (s.hatchDate && s.hatchDate < earliest) earliest = s.hatchDate;
    }
    effectiveStart = earliest;
  }

  const results: DailyFeedConsumption[] = [];
  const db = await openDB();

  // الحصول على حركات الاستهلاك اليومي الحالية لمنع التكرار
  const existingConsumptionMovements = await getStockMovements(primaryFeedTypeId);
  const movementsByDateMap = new Map<string, StockMovement>();
  for (const m of existingConsumptionMovements) {
    if (m.type === 'consumption' && m.dailyConsumptionDate) {
      movementsByDateMap.set(m.dailyConsumptionDate, m);
    }
  }

  let currentDate = effectiveStart;
  while (currentDate <= effectiveEnd) {
    const dayConsumption = await calculateDayFeedConsumption(currentDate, {
      pairs,
      squabs,
      saleDateMap,
      rateConfigs,
      weightedAvgPrice,
      feedTypeId: primaryFeedTypeId,
    });

    results.push(dayConsumption);

    // تحديث جدول الاستهلاك اليومي (put بالـ date يحدث السجل ولا يضيف مكرراً)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('daily_feed_consumptions', 'readwrite');
      const store = tx.objectStore('daily_feed_consumptions');
      const req = store.put(dayConsumption);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // تحديث حركة المخزون التلقائية إذا كان نوع العلف الأساسي محدداً
    if (primaryFeedTypeId) {
      const existingMovement = movementsByDateMap.get(currentDate);

      if (dayConsumption.hasConfiguredRates && dayConsumption.totalKg > 0) {
        if (existingMovement) {
          // تحديث الحركة القائمة في مكانها
          existingMovement.quantity = -dayConsumption.totalKg;
          existingMovement.totalCost = dayConsumption.cost;
          existingMovement.reason = `استهلاك علف يومي آلي ليوم ${currentDate}`;

          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('stock_movements', 'readwrite');
            const store = tx.objectStore('stock_movements');
            const req = store.put(existingMovement);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        } else {
          // إنشاء حركة استهلاك جديدة لليوم
          const newMovement: StockMovement = {
            id: generateId('stock_mov'),
            feedTypeId: primaryFeedTypeId,
            date: currentDate,
            quantity: -dayConsumption.totalKg,
            type: 'consumption',
            reason: `استهلاك علف يومي آلي ليوم ${currentDate}`,
            totalCost: dayConsumption.cost,
            dailyConsumptionDate: currentDate,
            createdAt: new Date().toISOString(),
          };

          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('stock_movements', 'readwrite');
            const store = tx.objectStore('stock_movements');
            const req = store.add(newMovement);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
          movementsByDateMap.set(currentDate, newMovement);
        }
      } else if (existingMovement && dayConsumption.totalKg === 0) {
        // إذا أصبح الاستهلاك صفراً، تصفير الكمية
        existingMovement.quantity = 0;
        existingMovement.totalCost = 0;
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('stock_movements', 'readwrite');
          const store = tx.objectStore('stock_movements');
          const req = store.put(existingMovement);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return results;
}

export async function getFeedConsumptionForPeriod(
  fromDate: string,
  toDate: string
): Promise<{
  dailyRecords: DailyFeedConsumption[];
  totalAdultKg: number;
  totalProdSquabsKg: number;
  totalCollSquabsKg: number;
  totalKg: number;
  totalCost: number;
  daysCount: number;
  dailyAverageKg: number;
  missingRatesDates: string[];
}> {
  await reconcileDailyFeedConsumption(fromDate, toDate);

  const db = await openDB();
  const allRecords: DailyFeedConsumption[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('daily_feed_consumptions', 'readonly');
    const store = tx.objectStore('daily_feed_consumptions');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as DailyFeedConsumption[]);
    req.onerror = () => reject(req.error);
  });

  const dailyRecords = allRecords
    .filter((r) => r.date >= fromDate && r.date <= toDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  let totalAdultGrams = 0;
  let totalProdGrams = 0;
  let totalCollGrams = 0;
  let totalKg = 0;
  let totalCost = 0;
  const missingRatesDates: string[] = [];

  for (const r of dailyRecords) {
    if (!r.hasConfiguredRates) {
      missingRatesDates.push(r.date);
    }
    totalAdultGrams += r.adultGramsTotal;
    totalProdGrams += r.prodSquabsGramsTotal;
    totalCollGrams += r.collSquabsGramsTotal;
    totalKg += r.totalKg;
    totalCost += r.cost;
  }

  const daysCount = Math.max(1, daysDifference(fromDate, toDate) + 1);
  const dailyAverageKg = Math.round((totalKg / daysCount) * 100) / 100;

  return {
    dailyRecords,
    totalAdultKg: Math.round((totalAdultGrams / 1000) * 100) / 100,
    totalProdSquabsKg: Math.round((totalProdGrams / 1000) * 100) / 100,
    totalCollSquabsKg: Math.round((totalCollGrams / 1000) * 100) / 100,
    totalKg: Math.round(totalKg * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    daysCount,
    dailyAverageKg,
    missingRatesDates,
  };
}

// -------------------------------------------------------------
// 7. إدارة المصروفات (Expenses)
// -------------------------------------------------------------
export async function getExpenses(filter?: {
  activeOnly?: boolean;
  category?: ExpenseCategory;
  accountingType?: AccountingType;
  fromDate?: string;
  toDate?: string;
}): Promise<Expense[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const req = store.getAll();
    req.onsuccess = () => {
      let expenses = (req.result || []) as Expense[];
      if (filter?.activeOnly !== false) {
        expenses = expenses.filter((e) => e.active);
      }
      if (filter?.category) {
        expenses = expenses.filter((e) => e.category === filter.category);
      }
      if (filter?.accountingType) {
        expenses = expenses.filter((e) => e.accountingType === filter.accountingType);
      }
      if (filter?.fromDate) {
        expenses = expenses.filter((e) => e.date >= filter.fromDate!);
      }
      if (filter?.toDate) {
        expenses = expenses.filter((e) => e.date <= filter.toDate!);
      }
      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(expenses);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Expense) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addExpense(data: {
  date?: string;
  amount: number;
  category: ExpenseCategory;
  accountingType: AccountingType;
  description: string;
  payee?: string;
  feedPurchaseId?: string;
  note?: string;
  coopId?: string;
  pairId?: string;
  batchId?: string;
}): Promise<Expense> {
  if (data.amount <= 0) throw new Error('قيمة المصروف يجب أن تكون أكبر من الصفر');
  if (!data.description || !data.description.trim()) throw new Error('يرجى إدخال وصف المصروف');

  const expense: Expense = {
    id: generateId('expense'),
    date: data.date && data.date.trim() ? data.date.trim() : getTodayDate(),
    amount: Math.round(Number(data.amount) * 100) / 100,
    category: data.category,
    accountingType: data.accountingType,
    description: data.description.trim(),
    payee: data.payee?.trim() || undefined,
    feedPurchaseId: data.feedPurchaseId || undefined,
    note: data.note?.trim() || undefined,
    coopId: data.coopId || undefined,
    pairId: data.pairId || undefined,
    batchId: data.batchId || undefined,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const req = store.add(expense);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'expense',
    expense.id,
    'expense_added',
    `تسجيل مصروف بقيمة ${expense.amount} ج.م [${expense.accountingType} / ${expense.category}]: ${expense.description}`,
    null,
    JSON.stringify(expense)
  );

  return expense;
}

export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, 'id' | 'createdAt'>>,
  reason: string
): Promise<Expense> {
  if (!reason || !reason.trim()) throw new Error('يرجى كتابة سبب التعديل للتوثيق بسجل الأحداث');

  const expense = await getExpense(id);
  if (!expense) throw new Error('المصروف غير موجود');

  const oldJson = JSON.stringify(expense);
  if (updates.amount !== undefined) expense.amount = Math.max(0.01, Number(updates.amount));
  if (updates.date !== undefined && updates.date.trim()) expense.date = updates.date.trim();
  if (updates.category !== undefined) expense.category = updates.category;
  if (updates.accountingType !== undefined) expense.accountingType = updates.accountingType;
  if (updates.description !== undefined && updates.description.trim()) expense.description = updates.description.trim();
  if (updates.note !== undefined) expense.note = updates.note.trim() || undefined;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const req = store.put(expense);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'expense',
    expense.id,
    'expense_updated',
    reason.trim(),
    oldJson,
    JSON.stringify(expense)
  );

  return expense;
}

export async function toggleExpenseActive(id: string, active: boolean, reason: string): Promise<Expense> {
  if (!reason || !reason.trim()) throw new Error('يرجى ذكر سبب تعديل حالة المصروف');

  const expense = await getExpense(id);
  if (!expense) throw new Error('المصروف غير موجود');

  const oldStatus = expense.active ? 'نشط' : 'موقوف';
  expense.active = active;
  const newStatus = expense.active ? 'نشط' : 'موقوف';

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const req = store.put(expense);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'expense',
    expense.id,
    expense.active ? 'expense_activated' : 'expense_deactivated',
    reason.trim(),
    oldStatus,
    newStatus
  );

  return expense;
}

// -------------------------------------------------------------
// 8. إدارة الإيرادات الأخرى ومبيعات الحمام البالغ (Manual Revenues)
// -------------------------------------------------------------
export async function getManualRevenues(filter?: {
  fromDate?: string;
  toDate?: string;
  activeOnly?: boolean;
}): Promise<ManualRevenue[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manual_revenues', 'readonly');
    const store = tx.objectStore('manual_revenues');
    const req = store.getAll();
    req.onsuccess = () => {
      let revs = (req.result || []) as ManualRevenue[];
      if (filter?.activeOnly !== false) {
        revs = revs.filter((r) => r.active);
      }
      if (filter?.fromDate) {
        revs = revs.filter((r) => r.date >= filter.fromDate!);
      }
      if (filter?.toDate) {
        revs = revs.filter((r) => r.date <= filter.toDate!);
      }
      revs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(revs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getManualRevenue(id: string): Promise<ManualRevenue | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manual_revenues', 'readonly');
    const store = tx.objectStore('manual_revenues');
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as ManualRevenue) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addManualRevenue(data: {
  date?: string;
  amount: number;
  category: ManualRevenueCategory;
  description: string;
  buyer?: string;
  note?: string;
}): Promise<ManualRevenue> {
  if (data.amount <= 0) throw new Error('قيمة الإيراد يجب أن تكون أكبر من الصفر');
  if (!data.description || !data.description.trim()) throw new Error('يرجى إدخال وصف الإيراد');

  const revenue: ManualRevenue = {
    id: generateId('rev'),
    date: data.date && data.date.trim() ? data.date.trim() : getTodayDate(),
    amount: Math.round(Number(data.amount) * 100) / 100,
    category: data.category,
    description: data.description.trim(),
    buyer: data.buyer?.trim() || undefined,
    note: data.note?.trim() || undefined,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('manual_revenues', 'readwrite');
    const store = tx.objectStore('manual_revenues');
    const req = store.add(revenue);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'revenue',
    revenue.id,
    'revenue_added',
    `تسجيل إيراد بقيمة ${revenue.amount} ج.م [${revenue.category === 'adult_sale' ? 'بيع حمام بالغ' : 'إيراد آخر'}]: ${revenue.description}`,
    null,
    JSON.stringify(revenue)
  );

  return revenue;
}

export async function updateManualRevenue(
  id: string,
  updates: Partial<Omit<ManualRevenue, 'id' | 'createdAt'>>,
  reason: string
): Promise<ManualRevenue> {
  if (!reason || !reason.trim()) throw new Error('يرجى كتابة سبب التعديل للتوثيق');

  const rev = await getManualRevenue(id);
  if (!rev) throw new Error('سجل الإيراد غير موجود');

  const oldJson = JSON.stringify(rev);
  if (updates.amount !== undefined) rev.amount = Math.max(0.01, Number(updates.amount));
  if (updates.date !== undefined && updates.date.trim()) rev.date = updates.date.trim();
  if (updates.category !== undefined) rev.category = updates.category;
  if (updates.description !== undefined && updates.description.trim()) rev.description = updates.description.trim();
  if (updates.buyer !== undefined) rev.buyer = updates.buyer.trim() || undefined;
  if (updates.note !== undefined) rev.note = updates.note.trim() || undefined;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('manual_revenues', 'readwrite');
    const store = tx.objectStore('manual_revenues');
    const req = store.put(rev);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'revenue',
    rev.id,
    'revenue_updated',
    reason.trim(),
    oldJson,
    JSON.stringify(rev)
  );

  return rev;
}

export async function toggleManualRevenueActive(id: string, active: boolean, reason: string): Promise<ManualRevenue> {
  if (!reason || !reason.trim()) throw new Error('يرجى كتابة سبب تعديل حالة الإيراد');

  const rev = await getManualRevenue(id);
  if (!rev) throw new Error('سجل الإيراد غير موجود');

  const oldStatus = rev.active ? 'نشط' : 'موقوف';
  rev.active = active;
  const newStatus = rev.active ? 'نشط' : 'موقوف';

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('manual_revenues', 'readwrite');
    const store = tx.objectStore('manual_revenues');
    const req = store.put(rev);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await logEvent(
    'revenue',
    rev.id,
    rev.active ? 'revenue_activated' : 'revenue_deactivated',
    reason.trim(),
    oldStatus,
    newStatus
  );

  return rev;
}

// -------------------------------------------------------------
// 9. التحليل المالي والنتائج المالية لفترة محددة
// -------------------------------------------------------------
export async function calculateFinancialResults(
  fromDate: string,
  toDate: string
): Promise<FinancialResults> {
  const [sales, allSaleItems, manualRevenues, expenses, feedReport] = await Promise.all([
    getSales(),
    getAllSaleItems(),
    getManualRevenues({ fromDate, toDate, activeOnly: true }),
    getExpenses({ fromDate, toDate, activeOnly: true }),
    getFeedConsumptionForPeriod(fromDate, toDate),
  ]);

  // 1. مبيعات الزغاليل في الفترة
  const periodSales = sales.filter((s) => s.date >= fromDate && s.date <= toDate);
  const squabSalesRevenue = periodSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  // عدد الزغاليل المباعة في هذه المبيعات
  const periodSaleIds = new Set(periodSales.map((s) => s.id));
  const soldSquabsCount = allSaleItems.filter((item) => periodSaleIds.has(item.saleId)).length;

  // 2. مبيعات الحمام البالغ والإيرادات الأخرى
  let adultSalesRevenue = 0;
  let otherRevenue = 0;
  for (const r of manualRevenues) {
    if (r.category === 'adult_sale') {
      adultSalesRevenue += r.amount;
    } else {
      otherRevenue += r.amount;
    }
  }

  const totalRevenue = Math.round((squabSalesRevenue + adultSalesRevenue + otherRevenue) * 100) / 100;

  // 3. المصروفات مقسمة بالنوع المحاسبي دون خلط
  let establishmentExpenses = 0;
  let operationalExpenses = 0;
  let productionCostExpenses = 0;
  let specificOperationExpenses = 0;

  for (const e of expenses) {
    switch (e.accountingType) {
      case 'establishment':
        establishmentExpenses += e.amount;
        break;
      case 'operational':
        operationalExpenses += e.amount;
        break;
      case 'production_cost':
        productionCostExpenses += e.amount;
        break;
      case 'specific_operation':
        specificOperationExpenses += e.amount;
        break;
    }
  }

  const totalNonEstablishmentExpenses =
    Math.round((operationalExpenses + productionCostExpenses + specificOperationExpenses) * 100) / 100;
  const totalExpenses =
    Math.round((establishmentExpenses + totalNonEstablishmentExpenses) * 100) / 100;

  // 4. صافي التشغيل والصافي بعد التأسيس
  const netOperatingProfit = Math.round((totalRevenue - totalNonEstablishmentExpenses) * 100) / 100;
  const netProfitAfterEstablishment = Math.round((totalRevenue - totalExpenses) * 100) / 100;

  // 5. متوسط سعر البيع الفعلي للزغلول
  const averageSquabSalePrice =
    soldSquabsCount > 0 ? Math.round((squabSalesRevenue / soldSquabsCount) * 100) / 100 : null;

  return {
    fromDate,
    toDate,
    squabSalesRevenue: Math.round(squabSalesRevenue * 100) / 100,
    adultSalesRevenue: Math.round(adultSalesRevenue * 100) / 100,
    otherRevenue: Math.round(otherRevenue * 100) / 100,
    totalRevenue,
    establishmentExpenses: Math.round(establishmentExpenses * 100) / 100,
    operationalExpenses: Math.round(operationalExpenses * 100) / 100,
    productionCostExpenses: Math.round(productionCostExpenses * 100) / 100,
    specificOperationExpenses: Math.round(specificOperationExpenses * 100) / 100,
    totalExpenses,
    totalNonEstablishmentExpenses,
    netOperatingProfit,
    netProfitAfterEstablishment,
    consumedFeedCost: feedReport.totalCost,
    soldSquabsCount,
    averageSquabSalePrice,
  };
}

// -------------------------------------------------------------
// 10. تقرير الإنتاج والأداء للفترة المحددة (المرحلة الخامسة)
// -------------------------------------------------------------
export async function getProductionReport(
  fromDate: string,
  toDate: string
): Promise<ProductionReport> {
  const [eggs, squabs, sales, saleItems, settings] = await Promise.all([
    getEggs(),
    getSquabs(),
    getSales(),
    getAllSaleItems(),
    getSettings(),
  ]);

  const incubationDays = settings.incubationDays || 18;
  const today = getTodayDate();
  const evaluationDate = toDate > today ? today : toDate;

  // البيض الموضوع في الفترة
  const laidInPeriod = eggs.filter((e) => e.laidDate >= fromDate && e.laidDate <= toDate);
  const laidEggs = laidInPeriod.length;

  const fertileEggs = laidInPeriod.filter((e) => e.status === 'fertile' || e.status === 'hatched').length;
  const infertileEggs = laidInPeriod.filter((e) => e.status === 'infertile').length;
  const brokenEggs = laidInPeriod.filter((e) => e.status === 'broken').length;
  const lostEggs = laidInPeriod.filter((e) => e.status === 'lost').length;
  const hatchedEggs = laidInPeriod.filter((e) => e.status === 'hatched').length;
  const pendingCheckEggs = laidInPeriod.filter((e) => e.status === 'pending').length;

  // 1. نسبة التخصيب = المخصب ÷ (المخصب + الرايق)
  // البيض بانتظار الفحص والمكسور والمفقود قبل الفحص لا يدخل في المقام
  const fertilityDenominator = fertileEggs + infertileEggs;
  const fertilityRate = fertilityDenominator > 0
    ? Math.round((fertileEggs / fertilityDenominator) * 1000) / 10
    : null;
  const fertilityRateFormula = 'المخصب ÷ (المخصب + الرايق) — يُستبعد البيض بانتظار الفحص والمكسور/المفقود قبل الفحص';

  // 2. نسبة الفقس = الفاقس ÷ المخصب الذي مضى على موعد فقسه المتوقع، أو فقس فعلًا
  // البيض المخصب الذي لم يحن موعده لا يدخل المقام. المكسور والمفقود بعد التخصيب يدخل في المقام.
  let hatchDenominator = 0;
  for (const egg of laidInPeriod) {
    if (egg.status === 'hatched') {
      hatchDenominator++;
    } else if (egg.status === 'fertile') {
      const expectedHatch = addDays(egg.laidDate, incubationDays);
      if (expectedHatch <= evaluationDate) {
        hatchDenominator++;
      }
    } else if ((egg.status === 'broken' || egg.status === 'lost') && egg.checkDate) {
      // مكسور أو مفقود بعد التخصيب ومضى موعد فقسه
      const expectedHatch = addDays(egg.laidDate, incubationDays);
      if (expectedHatch <= evaluationDate) {
        hatchDenominator++;
      }
    }
  }

  const hatchRate = hatchDenominator > 0
    ? Math.round((hatchedEggs / hatchDenominator) * 1000) / 10
    : null;
  const hatchRateFormula = 'الفاقس ÷ المخصب المستحق فقسه — يُستبعد المخصب الذي لم يحن موعده بعد';

  // الزغاليل المولودة في الفترة
  const bornInPeriod = squabs.filter((s) => s.hatchDate >= fromDate && s.hatchDate <= toDate);
  const bornSquabs = bornInPeriod.length;

  // الزغاليل النافقة من بين المولودة في الفترة
  const deceasedSquabs = bornInPeriod.filter((s) => s.status === 'deceased').length;

  // الزغاليل المنقولة للتجميع في الفترة
  const transferredSquabs = squabs.filter(
    (s) => s.transferDate && s.transferDate >= fromDate && s.transferDate <= toDate
  ).length;

  // الزغاليل المباعة في الفترة
  const periodSales = sales.filter((s) => s.date >= fromDate && s.date <= toDate);
  const periodSaleIds = new Set(periodSales.map((s) => s.id));
  const periodSaleItems = saleItems.filter((item) => periodSaleIds.has(item.saleId));
  const soldSquabs = periodSaleItems.length;

  // الزغاليل الحية حالياً من بين المولودة في الفترة
  const currentlyAliveSquabs = bornInPeriod.filter(
    (s) => s.status === 'alive_production' || s.status === 'transferred_collection'
  ).length;

  // 3. نسبة النفوق = الزغاليل النافقة ÷ الزغاليل المولودة في الفترة
  const mortalityRate = bornSquabs > 0
    ? Math.round((deceasedSquabs / bornSquabs) * 1000) / 10
    : null;
  const mortalityRateFormula = 'الزغاليل النافقة ÷ الزغاليل المولودة في الفترة';

  // 4. نسبة البقاء = 100% − نسبة النفوق
  const survivalRate = mortalityRate !== null
    ? Math.round((100 - mortalityRate) * 10) / 10
    : null;
  const survivalRateFormula = '100% − نسبة النفوق';

  // خيار: نسبة الزغاليل التي تعدت 20 يوماً
  const squabsOver20Days = bornInPeriod.filter((s) => {
    const age = getSquabAge(s.hatchDate);
    return age >= 20;
  });
  const aliveOver20Days = squabsOver20Days.filter((s) => {
    return s.status === 'alive_production' || s.status === 'transferred_collection' || s.status === 'sold';
  }).length;
  const survivalOver20DaysRate = squabsOver20Days.length > 0
    ? Math.round((aliveOver20Days / squabsOver20Days.length) * 1000) / 10
    : null;
  const survivalOver20DaysFormula = 'الزغاليل الحية التي بلغت 20 يوماً فأكثر ÷ كل المولودة التي مضى 20 يوماً على فقسها';

  // 5. نسبة الوصول لمرحلة البيع = (المباعة + الواصلة لعمر البيع وهي حية) ÷ المولودة التي تجاوزت 30 يوما من الفقس
  const squabsOver30Days = bornInPeriod.filter((s) => {
    const age = getSquabAge(s.hatchDate);
    return age >= 30;
  });
  const reachedOrSoldOver30 = squabsOver30Days.filter((s) => {
    return s.status === 'sold' || s.status === 'transferred_collection' || s.status === 'alive_production';
  }).length;
  const saleReadinessRate = squabsOver30Days.length > 0
    ? Math.round((reachedOrSoldOver30 / squabsOver30Days.length) * 1000) / 10
    : null;
  const saleReadinessRateFormula = '(المباعة + الواصلة لعمر البيع وهي حية) ÷ المولودة التي تجاوزت 30 يوماً من الفقس';

  // المؤشرات المالية للفترة
  const financials = await calculateFinancialResults(fromDate, toDate);

  return {
    fromDate,
    toDate,
    laidEggs,
    fertileEggs,
    infertileEggs,
    brokenEggs,
    lostEggs,
    hatchedEggs,
    pendingCheckEggs,
    bornSquabs,
    deceasedSquabs,
    transferredSquabs,
    soldSquabs,
    currentlyAliveSquabs,
    fertilityRate,
    fertilityRateFormula,
    hatchRate,
    hatchRateFormula,
    mortalityRate,
    mortalityRateFormula,
    survivalRate,
    survivalRateFormula,
    survivalOver20DaysRate,
    survivalOver20DaysFormula,
    saleReadinessRate,
    saleReadinessRateFormula,
    financials,
  };
}

// -------------------------------------------------------------
// 11. ترتيب أفضل الأزواج وتقييم الأداء (المرحلة الخامسة)
// -------------------------------------------------------------
export async function getPairRanking(
  fromDate: string,
  toDate: string
): Promise<{
  rankedPairs: PairRankingItem[];
  insufficientDataPairs: PairRankingItem[];
}> {
  const [pairs, cycles, eggs, squabs, coops, sales, saleItems, settings] = await Promise.all([
    getPairs(),
    getCycles(),
    getEggs(),
    getSquabs(),
    getCoops(),
    getSales(),
    getAllSaleItems(),
    getSettings(),
  ]);

  const incubationDays = settings.incubationDays || 18;
  const today = getTodayDate();
  const evaluationDate = toDate > today ? today : toDate;

  const greenThreshold = settings.pairRankingThresholds?.greenMinRate ?? 80;
  const yellowThreshold = settings.pairRankingThresholds?.yellowMinRate ?? 60;

  // خريطة مبيعات الزغاليل في الفترة
  const periodSales = sales.filter((s) => s.date >= fromDate && s.date <= toDate);
  const periodSaleIds = new Set(periodSales.map((s) => s.id));
  const squabSalePriceMap = new Map<string, number>();
  for (const item of saleItems) {
    if (periodSaleIds.has(item.saleId)) {
      squabSalePriceMap.set(item.squabId, item.price);
    }
  }

  const allItems: PairRankingItem[] = [];

  for (const pair of pairs) {
    const coop = pair.coopId ? coops.find((c) => c.id === pair.coopId) : null;

    // الدورات للزوج في الفترة
    const pairCycles = cycles.filter(
      (c) => c.pairId === pair.id && c.startDate >= fromDate && c.startDate <= toDate
    );
    const cyclesCount = pairCycles.length;

    // الدورات المكتملة في الفترة
    const completedCycles = pairCycles.filter((c) => {
      if (c.status === 'completed') return true;
      const cEggs = eggs.filter((e) => e.cycleId === c.id);
      if (cEggs.length > 0 && cEggs.every((e) => e.status !== 'pending' && e.status !== 'fertile')) {
        return true;
      }
      return false;
    });
    const completedCyclesCount = completedCycles.length;

    // البيض الموضوع للزوج في الفترة
    const pairEggs = eggs.filter(
      (e) => e.pairId === pair.id && e.laidDate >= fromDate && e.laidDate <= toDate
    );
    const fertileEggsCount = pairEggs.filter((e) => e.status === 'fertile' || e.status === 'hatched').length;
    const infertileEggsCount = pairEggs.filter((e) => e.status === 'infertile').length;
    const hatchCount = pairEggs.filter((e) => e.status === 'hatched').length;

    // نسبة التخصيب للزوج
    const fertDenom = fertileEggsCount + infertileEggsCount;
    const fertilityRate = fertDenom > 0
      ? Math.round((fertileEggsCount / fertDenom) * 1000) / 10
      : null;

    // نسبة الفقس للزوج
    let eligibleFertileHatch = 0;
    for (const egg of pairEggs) {
      if (egg.status === 'hatched') {
        eligibleFertileHatch++;
      } else if (egg.status === 'fertile') {
        const expectedHatch = addDays(egg.laidDate, incubationDays);
        if (expectedHatch <= evaluationDate) eligibleFertileHatch++;
      } else if ((egg.status === 'broken' || egg.status === 'lost') && egg.checkDate) {
        const expectedHatch = addDays(egg.laidDate, incubationDays);
        if (expectedHatch <= evaluationDate) eligibleFertileHatch++;
      }
    }
    const hatchRate = eligibleFertileHatch > 0
      ? Math.round((hatchCount / eligibleFertileHatch) * 1000) / 10
      : null;

    // الزغاليل الناتجة للزوج في الفترة
    const pairSquabs = squabs.filter(
      (s) => s.pairId === pair.id && s.hatchDate >= fromDate && s.hatchDate <= toDate
    );
    const bornSquabsCount = pairSquabs.length;
    const deceasedSquabsCount = pairSquabs.filter((s) => s.status === 'deceased').length;

    const mortalityRate = bornSquabsCount > 0
      ? Math.round((deceasedSquabsCount / bornSquabsCount) * 1000) / 10
      : null;
    const survivalRate = mortalityRate !== null
      ? Math.round((100 - mortalityRate) * 10) / 10
      : null;

    // الزغاليل التي وصلت للبيع (المباعة أو الحية وعمرها 30+ يوم)
    const reachedSaleCount = pairSquabs.filter((s) => {
      if (s.status === 'sold') return true;
      if (s.status === 'transferred_collection' || s.status === 'alive_production') {
        return getSquabAge(s.hatchDate) >= 30;
      }
      return false;
    }).length;

    // الإيراد الفعلي المسجل من بيع زغاليل هذا الزوج في الفترة
    let actualRevenue = 0;
    for (const s of pairSquabs) {
      const price = squabSalePriceMap.get(s.id);
      if (price) actualRevenue += price;
    }

    // المؤشر اللوني
    let colorIndicator: PairColorIndicator = 'incomplete';
    let colorIndicatorLabel = 'غير مكتمل';
    let colorIndicatorReason = 'لا توجد بيانات كافية لحساب المعدلات';

    const ratesToCheck = [fertilityRate, hatchRate, survivalRate].filter((r): r is number => r !== null);
    if (ratesToCheck.length > 0) {
      const minVal = Math.min(...ratesToCheck);
      if (minVal >= greenThreshold) {
        colorIndicator = 'green';
        colorIndicatorLabel = 'ممتاز (أخضر)';
        colorIndicatorReason = `جميع المعدلات المحسوبة أعلى من ${greenThreshold}%`;
      } else if (minVal >= yellowThreshold) {
        colorIndicator = 'yellow';
        colorIndicatorLabel = 'متوسط (أصفر)';
        colorIndicatorReason = `المعدلات تتراوح بين ${yellowThreshold}% و ${greenThreshold}%`;
      } else {
        colorIndicator = 'red';
        colorIndicatorLabel = 'يحتاج لمتابعة (أحمر)';
        colorIndicatorReason = `يوجد معدل أداء أقل من ${yellowThreshold}%`;
      }
    }

    // شرط التأهيل للترتيب الرئيسي: دورتان مكتملتان على الأقل في الفترة
    const hasSufficientData = completedCyclesCount >= 2;
    const insufficientDataReason = hasSufficientData
      ? undefined
      : `الزوج لديه ${completedCyclesCount} دورة مكتملة في الفترة (المطلوب دورتان على الأقل)`;

    allItems.push({
      pairId: pair.id,
      pairName: pair.name,
      coopId: pair.coopId,
      coopNumber: coop ? coop.number : undefined,
      status: pair.status,
      cyclesCount,
      completedCyclesCount,
      fertileEggsCount,
      infertileEggsCount,
      hatchCount,
      bornSquabsCount,
      deceasedSquabsCount,
      mortalityRate,
      survivalRate,
      reachedSaleCount,
      actualRevenue,
      fertilityRate,
      hatchRate,
      colorIndicator,
      colorIndicatorLabel,
      colorIndicatorReason,
      hasSufficientData,
      insufficientDataReason,
    });
  }

  // الترتيب الافتراضي الشفاف للأزواج المؤهلة:
  // (1) عدد الزغاليل التي وصلت للبيع أو بيعت
  // (2) ثم نسبة البقاء
  // (3) ثم عدد الزغاليل الناتجة
  const rankedPairs = allItems
    .filter((item) => item.hasSufficientData)
    .sort((a, b) => {
      if (b.reachedSaleCount !== a.reachedSaleCount) {
        return b.reachedSaleCount - a.reachedSaleCount;
      }
      const aSurv = a.survivalRate ?? -1;
      const bSurv = b.survivalRate ?? -1;
      if (bSurv !== aSurv) {
        return bSurv - aSurv;
      }
      return b.bornSquabsCount - a.bornSquabsCount;
    });

  const insufficientDataPairs = allItems
    .filter((item) => !item.hasSufficientData)
    .sort((a, b) => b.completedCyclesCount - a.completedCyclesCount);

  return { rankedPairs, insufficientDataPairs };
}

// =============================================================
// المرحلة السادسة: النسخ الاحتياطي، الاستعادة، فحص سلامة البيانات، والتراجع
// =============================================================

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

const ALL_STORE_NAMES = [
  'coops',
  'pairs',
  'cycles',
  'eggs',
  'squabs',
  'batches',
  'sales',
  'sale_items',
  'feed_types',
  'stock_movements',
  'feed_rate_configs',
  'daily_feed_consumptions',
  'expenses',
  'manual_revenues',
  'task_actions',
  'settings',
  'events',
];

/**
 * تصدير نسخة احتياطية كاملة
 */
export async function exportBackupData(): Promise<PigeonFarmBackup> {
  const data: any = {};
  const recordCounts: any = {};

  for (const storeName of ALL_STORE_NAMES) {
    const items = await getAllFromStore(storeName);
    data[storeName] = items;
    recordCounts[storeName] = items.length;
  }

  const today = getTodayDate();
  try {
    const settings = await getSettings();
    settings.lastBackupDate = today;
    await putToStore('settings', settings);
  } catch (err) {
    console.warn('Could not update lastBackupDate in settings:', err);
  }

  const totalRecords = Object.values(recordCounts).reduce(
    (acc: number, val: any) => acc + Number(val || 0),
    0
  );

  await logEvent(
    'settings',
    'global_settings',
    'backup_exported',
    `تصدير نسخة احتياطية لكافة بيانات المزرعة (${totalRecords} سجل)`
  );

  return {
    appName: 'إدارة مزرعة الحمام',
    appVersion: '1.0.0',
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    recordCounts,
    data,
  };
}

/**
 * فحص صحة ملف النسخة الاحتياطية قبل الاستعادة
 */
export function validateBackupFile(backup: any): { isValid: boolean; error?: string } {
  if (!backup || typeof backup !== 'object') {
    return { isValid: false, error: 'الملف تالف أو غير صالح كملف JSON.' };
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return { isValid: false, error: 'هيكل البيانات داخل ملف النسخة غير موجود أو غير سليم.' };
  }
  if (typeof backup.schemaVersion !== 'number') {
    return { isValid: false, error: 'رقم إصدار بنية البيانات مفقود في ملف النسخة الاحتياطية.' };
  }
  if (backup.schemaVersion > DB_VERSION + 1) {
    return {
      isValid: false,
      error: `إصدار النسخة (${backup.schemaVersion}) أحدث من الإصدار المدعوم في هذا التطبيق (${DB_VERSION}).`,
    };
  }
  return { isValid: true };
}

/**
 * استعادة نسخة احتياطية مع إنشاء تصدير آمن للبيانات الحالية تلقائياً قبل البدء
 */
export async function restoreBackupData(
  backup: any,
  onSafetyExportCreated?: (safetyBackupJson: string) => void
): Promise<{ restoredCounts: Record<string, number> }> {
  const validation = validateBackupFile(backup);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // 1. إنشاء تصدير أمان للبيانات الحالية أولاً قبل أي تعديل
  try {
    const currentBackup = await exportBackupData();
    const safetyJson = JSON.stringify(currentBackup, null, 2);
    if (onSafetyExportCreated) {
      onSafetyExportCreated(safetyJson);
    }
  } catch (err) {
    console.warn('Could not create safety export before restore:', err);
  }

  // 2. مسح الجداول وتعبئتها بالبيانات المستعادة
  const restoredCounts: Record<string, number> = {};

  for (const storeName of ALL_STORE_NAMES) {
    await clearStore(storeName);
    const items = Array.isArray(backup.data[storeName]) ? backup.data[storeName] : [];
    for (const item of items) {
      await putToStore(storeName, item);
    }
    restoredCounts[storeName] = items.length;
  }

  // 3. التأكد من حفظ تاريخ النسخ في الإعدادات
  const settings = await getSettings();
  settings.lastBackupDate = getTodayDate();
  await putToStore('settings', settings);

  await logEvent(
    'settings',
    'global_settings',
    'backup_restored',
    `استعادة نسخة احتياطية بنجاح بتاريخ ${backup.exportedAt || getTodayDate()}`
  );

  return { restoredCounts };
}

/**
 * مسح كل البيانات بتأكيد صريح
 */
export async function wipeAllData(keepDefaultSettings = true): Promise<void> {
  for (const storeName of ALL_STORE_NAMES) {
    if (storeName === 'settings' && keepDefaultSettings) continue;
    await clearStore(storeName);
  }

  // إعادة تهيئة الإعدادات الافتراضية إذا تم مسحها
  await getSettings();

  await logEvent(
    'settings',
    'global_settings',
    'data_wiped',
    'مسح شامل لكافة بيانات المزرعة بناءً على طلب وتأكيد المستخدم'
  );
}

/**
 * تحميل بيانات تجريبية (مفصولة ومميزة بعلامة isDemo)
 */
export async function loadDemoData(): Promise<void> {
  const today = getTodayDate();
  const date20DaysAgo = addDays(today, -20);
  const date35DaysAgo = addDays(today, -35);

  // 1. سلاكات تجريبية
  const demoCoop1 = await addCoop({
    number: 'سلاكة تجريبية 1',
    type: 'production',
    notes: 'سلاكة إنتاج تجريبية',
  });
  demoCoop1.isDemo = true;
  await putToStore('coops', demoCoop1);

  const demoCoop2 = await addCoop({
    number: 'سلاكة تجريبية 2',
    type: 'production',
    notes: 'سلاكة إنتاج تجريبية',
  });
  demoCoop2.isDemo = true;
  await putToStore('coops', demoCoop2);

  const demoCollCoop = await addCoop({
    number: 'تجميع تجريبي أ',
    type: 'collection',
    notes: 'سلاكة تجميع تجريبية',
  });
  demoCollCoop.isDemo = true;
  await putToStore('coops', demoCollCoop);

  // 2. أزواج تجريبية
  const demoPair1 = await addPair({
    name: 'زوج شقلباظ تجريبي',
    coopId: demoCoop1.id,
    maleInfo: 'شقلباظ دبلة 101',
    femaleInfo: 'شقلباظ دبلة 102',
    pairedDate: date35DaysAgo,
  });
  demoPair1.isDemo = true;
  await putToStore('pairs', demoPair1);

  const demoPair2 = await addPair({
    name: 'زوج زاجل تجريبي',
    coopId: demoCoop2.id,
    maleInfo: 'زاجل دبلة 201',
    femaleInfo: 'زاجل دبلة 202',
    pairedDate: date20DaysAgo,
  });
  demoPair2.isDemo = true;
  await putToStore('pairs', demoPair2);

  // 3. دورة وبيض تجريبي
  const cycle1 = await createOrGetCycle(demoPair1.id, demoCoop1.id, date35DaysAgo);
  cycle1.isDemo = true;
  await putToStore('cycles', cycle1);

  const eggs1 = await layEggs({
    cycleId: cycle1.id,
    pairId: demoPair1.id,
    coopId: demoCoop1.id,
    egg1Date: date35DaysAgo,
    egg2Date: addDays(date35DaysAgo, 2),
  });
  for (const egg of eggs1) {
    egg.isDemo = true;
    await putToStore('eggs', egg);
  }

  // فحص وفقس البيضة الأولى
  await checkEggFertility(eggs1[0].id, true, addDays(date35DaysAgo, 7));
  const hatchResult = await recordEggHatch(eggs1[0].id, addDays(date35DaysAgo, 18));
  hatchResult.squab.isDemo = true;
  await putToStore('squabs', hatchResult.squab);

  // 4. نوع علف تجريبي ومخزون
  const feedType = await addFeedType({
    name: 'علف تسمين تجريبي 21%',
    alertThresholdKg: 25,
    unit: 'كجم',
    notes: 'علف تجريبي',
  });
  feedType.isDemo = true;
  await putToStore('feed_types', feedType);

  const purchaseRes = await recordFeedPurchase({
    feedTypeId: feedType.id,
    date: date35DaysAgo,
    quantityKg: 100,
    unitPrice: 22,
    supplier: 'شركة الأعلاف التجريبية',
  });
  purchaseRes.movement.isDemo = true;
  await putToStore('stock_movements', purchaseRes.movement);
  if (purchaseRes.expense) {
    purchaseRes.expense.isDemo = true;
    await putToStore('expenses', purchaseRes.expense);
  }

  await logEvent(
    'settings',
    'global_settings',
    'demo_data_loaded',
    'تم تحميل مجموعة بيانات تجريبية كاملة ومميزة بعلامة تجريبي'
  );
}

/**
 * حذف كافة البيانات التجريبية دفعة واحدة دون المساس بالبيانات الحقيقية
 */
export async function deleteDemoData(): Promise<{ deletedCount: number }> {
  let count = 0;
  for (const storeName of ALL_STORE_NAMES) {
    if (storeName === 'settings' || storeName === 'events') continue;
    const items = await getAllFromStore<any>(storeName);
    for (const item of items) {
      if (item && item.isDemo === true) {
        await deleteFromStore(storeName, item.id || item.date);
        count++;
      }
    }
  }

  await logEvent(
    'settings',
    'global_settings',
    'demo_data_deleted',
    `حذف كافة البيانات التجريبية بنجاح (${count} سجل تم إزالته)`
  );

  return { deletedCount: count };
}

/**
 * فحص سلامة وتناسق البيانات الشامل
 */
export async function checkDataIntegrity(): Promise<DataIntegrityReport> {
  const [
    coops,
    pairs,
    cycles,
    eggs,
    squabs,
    batches,
    sales,
    saleItems,
    feedTypes,
    stockMovements,
  ] = await Promise.all([
    getCoops(),
    getPairs(),
    getCycles(),
    getEggs(),
    getSquabs(),
    getBatches(),
    getSales(),
    getAllSaleItems(),
    getFeedTypes(),
    getStockMovements(),
  ]);

  const issues: DataIntegrityIssue[] = [];

  const eggMap = new Map(eggs.map((e) => [e.id, e]));
  const pairMap = new Map(pairs.map((p) => [p.id, p]));
  const coopMap = new Map(coops.map((c) => [c.id, c]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));
  const squabMap = new Map(squabs.map((s) => [s.id, s]));
  const saleMap = new Map(sales.map((s) => [s.id, s]));

  // تجميع الزغاليل بحسب البيضة
  const squabsByEggId = new Map<string, Squab[]>();
  for (const sq of squabs) {
    if (!squabsByEggId.has(sq.eggId)) squabsByEggId.set(sq.eggId, []);
    squabsByEggId.get(sq.eggId)!.push(sq);
  }

  // 1) فحص الزغاليل والبيض والأزواج
  for (const sq of squabs) {
    // زغلول بدون بيضة أو بيضة غير موجودة
    const egg = eggMap.get(sq.eggId);
    if (!sq.eggId || !egg) {
      issues.push({
        id: `orphan_egg_${sq.id}`,
        category: 'orphan_squab',
        severity: 'critical',
        title: `زغلول بدون بيضة أصلية (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} ليس له سجل بيضة أصلية مطابقة في قاعدة البيانات.`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        pairId: sq.pairId,
        suggestedAction: 'فتح سجل الزغلول وتصحيح بيانات البيضة أو الزوج',
      });
    } else {
      // زغلول مرتبط ببيضة حالتها ليست فقست
      if (egg.status !== 'hatched') {
        issues.push({
          id: `unhatched_egg_${sq.id}`,
          category: 'unhatched_squab',
          severity: 'critical',
          title: `زغلول مرتبط ببيضة غير مسجلة كفاقسة (${sq.codeNumber})`,
          description: `الزغلول ${sq.codeNumber} مسجل من البيضة رقم ${egg.eggNumber} ولكن حالة البيضة في السجلات هي "${egg.status}" وليست "فقست".`,
          entityType: 'egg',
          entityId: egg.id,
          eggId: egg.id,
          squabId: sq.id,
          coopId: egg.coopId,
          suggestedAction: 'فتح سجل البيضة وتحديث حالتها إلى فقست',
        });
      }

      // تاريخ الفقس يسبق تاريخ وضع البيضة
      if (sq.hatchDate && egg.laidDate && sq.hatchDate < egg.laidDate) {
        issues.push({
          id: `hatch_before_laid_${sq.id}`,
          category: 'chronology_violation',
          severity: 'critical',
          title: `تاريخ الفقس يسبق تاريخ وضع البيضة (${sq.codeNumber})`,
          description: `تاريخ فقس الزغلول (${sq.hatchDate}) يسبق تاريخ وضع البيضة (${egg.laidDate}).`,
          entityType: 'squab',
          entityId: sq.id,
          squabId: sq.id,
          eggId: egg.id,
          suggestedAction: 'فتح سجل الزغلول وتصحيح تاريخ الفقس الفعلي',
        });
      }
    }

    // زغلول بدون زوج أصلي صالح
    if (!sq.pairId || !pairMap.has(sq.pairId)) {
      issues.push({
        id: `orphan_pair_${sq.id}`,
        category: 'orphan_squab',
        severity: 'critical',
        title: `زغلول بدون زوج أصلي (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} غير مرتبط بزوج آباء صالح في المزرعة.`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'فتح الزغلول وتعيين زوج الآباء الصحيح',
      });
    }
  }

  // بيضة فقست بدون زغلول
  for (const egg of eggs) {
    if (egg.status === 'hatched') {
      const associatedSquabs = squabsByEggId.get(egg.id) || [];
      if (associatedSquabs.length === 0) {
        issues.push({
          id: `hatched_no_squab_${egg.id}`,
          category: 'hatched_egg_no_squab',
          severity: 'critical',
          title: `بيضة فقست بدون سجل زغلول (بيضة رقم ${egg.eggNumber})`,
          description: `البيضة رقم ${egg.eggNumber} مسجلة كـ "فقست" بتاريخ ${egg.hatchDate || 'غير محدد'} ولكن لا يوجد سجل زغلول مرتبط بها.`,
          entityType: 'egg',
          entityId: egg.id,
          eggId: egg.id,
          coopId: egg.coopId,
          pairId: egg.pairId,
          suggestedAction: 'تسجيل الزغلول الفاقس من البيضة أو تصحيح حالة البيضة',
        });
      }
    }
  }

  // 2) فحص الزغاليل: التواجد المزدوج، وحالة حي مع نفوق أو بيع
  const squabSaleItemCounts = new Map<string, SaleItem[]>();
  for (const item of saleItems) {
    if (!squabSaleItemCounts.has(item.squabId)) squabSaleItemCounts.set(item.squabId, []);
    squabSaleItemCounts.get(item.squabId)!.push(item);
  }

  for (const sq of squabs) {
    const isLiving = sq.status === 'alive_production' || sq.status === 'transferred_collection';
    const hasDeath = Boolean(sq.deathDate && sq.deathDate.trim());
    const salesForSquab = squabSaleItemCounts.get(sq.id) || [];

    // حالة حي ومسجل له نفوق
    if (isLiving && hasDeath) {
      issues.push({
        id: `alive_with_death_${sq.id}`,
        category: 'conflicting_location_or_status',
        severity: 'critical',
        title: `زغلول حالته "حي" وله تاريخ نفوق مسجل (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} حالته "${sq.status}" ولكن مسجل له نفوق بتاريخ ${sq.deathDate}.`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'فتح سجل الزغلول وتصحيح الحالة أو إزالة تاريخ النفوق',
      });
    }

    // حالة حي ومسجل في بند بيع
    if (isLiving && salesForSquab.length > 0) {
      issues.push({
        id: `alive_with_sale_${sq.id}`,
        category: 'conflicting_location_or_status',
        severity: 'critical',
        title: `زغلول حالته "حي" ومسجل كبند بيع (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} حالته "${sq.status}" ولكن مسجل في عملية بيع منجزة.`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'تحديث حالة الزغلول إلى مباع أو مراجعة عملية البيع',
      });
    }

    // زغلول مباع أكثر من مرة
    if (salesForSquab.length > 1) {
      issues.push({
        id: `double_sale_${sq.id}`,
        category: 'double_sale_or_dead_sold',
        severity: 'critical',
        title: `زغلول مباع أكثر من مرة (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} مسجل في ${salesForSquab.length} عملية بيع مختلفة!`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'مراجعة المبيعات وإلغاء بنود البيع المكررة',
      });
    }

    // زغلول مباع وهو نافق
    if (salesForSquab.length > 0 && hasDeath) {
      issues.push({
        id: `sold_and_dead_${sq.id}`,
        category: 'double_sale_or_dead_sold',
        severity: 'critical',
        title: `زغلول مسجل كمباع وهو نافق (${sq.codeNumber})`,
        description: `الزغلول ${sq.codeNumber} مسجل له نفوق بتاريخ ${sq.deathDate} ومسجل أيضاً في عملية بيع.`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'فتح سجل الزغلول وإلغاء البيع أو تصحيح النفوق',
      });
    }

    // تاريخ النقل يسبق تاريخ الفقس
    if (sq.transferDate && sq.hatchDate && sq.transferDate < sq.hatchDate) {
      issues.push({
        id: `transfer_before_hatch_${sq.id}`,
        category: 'chronology_violation',
        severity: 'critical',
        title: `تاريخ النقل يسبق تاريخ الفقس (${sq.codeNumber})`,
        description: `الزغلول نُقل بتاريخ (${sq.transferDate}) وهو يسبق تاريخ فقسه (${sq.hatchDate}).`,
        entityType: 'squab',
        entityId: sq.id,
        squabId: sq.id,
        suggestedAction: 'تصحيح تاريخ النقل أو تاريخ الفقس',
      });
    }

    // تاريخ البيع يسبق تاريخ النقل أو تاريخ الفقس
    if (salesForSquab.length > 0) {
      for (const item of salesForSquab) {
        const sale = saleMap.get(item.saleId);
        if (sale && sale.date) {
          if (sq.transferDate && sale.date < sq.transferDate) {
            issues.push({
              id: `sale_before_transfer_${sq.id}_${sale.id}`,
              category: 'chronology_violation',
              severity: 'critical',
              title: `تاريخ البيع يسبق تاريخ النقل للتجميع (${sq.codeNumber})`,
              description: `الزغلول بيع بتاريخ (${sale.date}) وهو يسبق تاريخ نقله للتجميع (${sq.transferDate}).`,
              entityType: 'sale',
              entityId: sale.id,
              squabId: sq.id,
              suggestedAction: 'تصحيح تاريخ البيع أو تاريخ النقل',
            });
          }
          if (sq.hatchDate && sale.date < sq.hatchDate) {
            issues.push({
              id: `sale_before_hatch_${sq.id}_${sale.id}`,
              category: 'chronology_violation',
              severity: 'critical',
              title: `تاريخ البيع يسبق تاريخ الفقس (${sq.codeNumber})`,
              description: `الزغلول بيع بتاريخ (${sale.date}) وهو يسبق تاريخ فقسه (${sq.hatchDate}).`,
              entityType: 'sale',
              entityId: sale.id,
              squabId: sq.id,
              suggestedAction: 'تصحيح تاريخ البيع',
            });
          }
        }
      }
    }
  }

  // 3) فحص الدفعات (دفعة بدون زغاليل أو تضارب في الحالة)
  for (const batch of batches) {
    const batchSquabs = squabs.filter((s) => s.batchId === batch.id);
    if (batchSquabs.length === 0) {
      issues.push({
        id: `empty_batch_${batch.id}`,
        category: 'batch_mismatch',
        severity: 'warning',
        title: `دفعة تجميع بدون زغاليل (${batch.batchNumber})`,
        description: `الدفعة ${batch.batchNumber} مسجلة في سلاكة التجميع ولكن لا يوجد أي زغلول مرتبط بها.`,
        entityType: 'batch',
        entityId: batch.id,
        batchId: batch.id,
        coopId: batch.collectionCoopId,
        suggestedAction: 'نقل زغاليل للدفعة أو إغلاقها',
      });
    } else {
      const livingInBatch = batchSquabs.filter((s) => s.status === 'transferred_collection');
      if (batch.status === 'fully_sold' && livingInBatch.length > 0) {
        issues.push({
          id: `fully_sold_with_living_${batch.id}`,
          category: 'batch_mismatch',
          severity: 'warning',
          title: `دفعة مباعة بالكامل وبها زغاليل حية (${batch.batchNumber})`,
          description: `الدفعة ${batch.batchNumber} حالتها "مباعة بالكامل" ولكن لا يزال بها ${livingInBatch.length} زغلول حي.`,
          entityType: 'batch',
          entityId: batch.id,
          batchId: batch.id,
          suggestedAction: 'تحديث حالة الدفعة أو إتمام بيع باقي الزغاليل',
        });
      }
    }
  }

  // 4) فحص المخزون السالب
  for (const feed of feedTypes) {
    const movements = stockMovements
      .filter((m) => m.feedTypeId === feed.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    let minBalance = 0;
    let dippedDate = '';

    for (const m of movements) {
      runningBalance += m.quantity;
      if (runningBalance < -0.0001 && minBalance >= 0) {
        minBalance = runningBalance;
        dippedDate = m.date;
      }
    }

    if (minBalance < -0.0001 || runningBalance < -0.0001) {
      issues.push({
        id: `negative_stock_${feed.id}`,
        category: 'negative_stock',
        severity: 'critical',
        title: `رصيد مخزون سالب لنوع العلف (${feed.name})`,
        description: `حركات المخزون لنوع "${feed.name}" جعلت الرصيد سالباً (${runningBalance.toFixed(2)} كجم)${dippedDate ? ' اعتباراً من تاريخ ' + dippedDate : ''}.`,
        entityType: 'feed_type',
        entityId: feed.id,
        feedTypeId: feed.id,
        suggestedAction: 'إضافة تسوية مخزون يدوية أو تسجيل مشتريات لتغطية العجز',
      });
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    checkedAt: new Date().toISOString(),
    totalIssuesCount: issues.length,
    criticalCount,
    warningCount,
    issues,
  };
}

// -------------------------------------------------------------
// إدارة التراجع عن آخر العمليات (Undo)
// -------------------------------------------------------------
let inMemoryLastUndoableAction: UndoableAction | null = null;

export function setLastUndoableAction(action: UndoableAction): void {
  inMemoryLastUndoableAction = action;
  try {
    sessionStorage.setItem('last_undoable_action', JSON.stringify(action));
  } catch (err) {
    console.warn('Could not store undo action in sessionStorage:', err);
  }
}

export function getLastUndoableAction(): UndoableAction | null {
  if (inMemoryLastUndoableAction) return inMemoryLastUndoableAction;
  try {
    const saved = sessionStorage.getItem('last_undoable_action');
    if (saved) {
      inMemoryLastUndoableAction = JSON.parse(saved);
      return inMemoryLastUndoableAction;
    }
  } catch (err) {
    console.warn('Could not read undo action from sessionStorage:', err);
  }
  return null;
}

export function clearLastUndoableAction(): void {
  inMemoryLastUndoableAction = null;
  try {
    sessionStorage.removeItem('last_undoable_action');
  } catch (err) {
    console.warn('Could not clear undo action from sessionStorage:', err);
  }
}

export async function executeUndo(reason: string): Promise<boolean> {
  const action = getLastUndoableAction();
  if (!action) throw new Error('لا توجد عملية سابقة متاحة للتراجع عنها.');

  const actionTime = new Date(action.timestamp).getTime();
  const now = Date.now();
  if (now - actionTime > 15 * 60 * 1000) {
    clearLastUndoableAction();
    throw new Error('انتهت المهلة المسموح بها للتراجع عن هذه العملية (15 دقيقة).');
  }

  switch (action.actionType) {
    case 'egg_laid': {
      const eggId = action.entityId;
      const egg = await getEgg(eggId);
      if (egg) {
        await deleteFromStore('eggs', eggId);
        await logEvent(
          'egg',
          eggId,
          'undo_egg_laid',
          `تراجع عن تسجيل وضع بيضة (السبب: ${reason})`,
          JSON.stringify(egg),
          null
        );
      }
      break;
    }
    case 'egg_checked': {
      const eggId = action.entityId;
      const egg = await getEgg(eggId);
      if (egg) {
        const prevStatus = egg.status;
        egg.status = 'pending';
        delete egg.checkDate;
        await putToStore('eggs', egg);
        await logEvent(
          'egg',
          eggId,
          'undo_egg_checked',
          `تراجع عن فحص تخصيب البيضة وإعادتها لحالة بانتظار الفحص (السبب: ${reason})`,
          prevStatus,
          'pending'
        );
      }
      break;
    }
    case 'egg_broken': {
      const eggId = action.entityId;
      const egg = await getEgg(eggId);
      if (egg) {
        const prevStatus = egg.status;
        egg.status = action.details?.previousStatus || 'fertile';
        delete egg.brokenDate;
        delete egg.brokenReason;
        await putToStore('eggs', egg);
        await logEvent(
          'egg',
          eggId,
          'undo_egg_broken',
          `تراجع عن تسجيل كسر البيضة وإعادتها لحالة ${egg.status} (السبب: ${reason})`,
          prevStatus,
          egg.status
        );
      }
      break;
    }
    case 'hatch': {
      const eggId = action.entityId;
      const squabId = action.details?.squabId;
      const egg = await getEgg(eggId);
      if (egg) {
        egg.status = 'fertile';
        delete egg.hatchDate;
        await putToStore('eggs', egg);
      }
      if (squabId) {
        await deleteFromStore('squabs', squabId);
      }
      await logEvent(
        'egg',
        eggId,
        'undo_hatch',
        `تراجع عن تسجيل فقس البيضة وحذف سجل الزغلول المنشأ خطأً (السبب: ${reason})`
      );
      break;
    }
    case 'squab_transferred': {
      const squabId = action.entityId;
      const squab = await getSquab(squabId);
      if (squab) {
        squab.status = 'alive_production';
        squab.currentLocationId = squab.originCoopId;
        delete squab.batchId;
        delete squab.transferDate;
        delete squab.ageAtTransfer;
        await putToStore('squabs', squab);
        await logEvent(
          'squab',
          squabId,
          'undo_transfer',
          `تراجع عن نقل الزغلول وإعادته لسلاكة الإنتاج الأصلية (السبب: ${reason})`
        );
      }
      break;
    }
    case 'squab_deceased': {
      const squabId = action.entityId;
      const squab = await getSquab(squabId);
      if (squab) {
        const prevLivingStatus = action.details?.previousStatus || 'alive_production';
        squab.status = prevLivingStatus;
        delete squab.deathDate;
        delete squab.deathReason;
        delete squab.deathAgeDays;
        await putToStore('squabs', squab);
        await logEvent(
          'squab',
          squabId,
          'undo_squab_death',
          `تراجع عن تسجيل نفوق الزغلول وإعادته لقائمة الأحياء (السبب: ${reason})`
        );
      }
      break;
    }
    case 'squab_sold': {
      const saleId = action.entityId;
      await cancelSale(saleId, `تراجع عن عملية البيع: ${reason}`);
      break;
    }
  }

  clearLastUndoableAction();
  return true;
}

// -------------------------------------------------------------
// البحث السريع برقم السلاكة أو اسم الزوج أو كود الزغلول أو الدفعة
// -------------------------------------------------------------
export interface SearchResult {
  id: string;
  type: 'coop' | 'pair' | 'squab' | 'batch';
  title: string;
  subtitle: string;
  targetView: string;
  params: Record<string, string>;
}

export async function searchFarm(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [coops, pairs, squabs, batches] = await Promise.all([
    getCoops(),
    getPairs(),
    getSquabs(),
    getBatches(),
  ]);

  const results: SearchResult[] = [];

  for (const coop of coops) {
    if (
      coop.number.toLowerCase().includes(q) ||
      (coop.notes && coop.notes.toLowerCase().includes(q))
    ) {
      results.push({
        id: coop.id,
        type: 'coop',
        title: `سلاكة رقم ${coop.number}`,
        subtitle: coop.type === 'production' ? 'سلاكة إنتاج' : 'سلاكة تجميع',
        targetView: 'coop_detail',
        params: { coopId: coop.id },
      });
    }
  }

  for (const pair of pairs) {
    if (
      pair.name.toLowerCase().includes(q) ||
      (pair.breed && pair.breed.toLowerCase().includes(q)) ||
      pair.maleInfo.toLowerCase().includes(q) ||
      pair.femaleInfo.toLowerCase().includes(q)
    ) {
      const parentCoop = pair.coopId ? coops.find((c) => c.id === pair.coopId) : null;
      results.push({
        id: pair.id,
        type: 'pair',
        title: `الزوج: ${pair.name}${pair.breed ? ` (${pair.breed})` : ''}`,
        subtitle: parentCoop ? `سلاكة رقم ${parentCoop.number} • ${pair.status === 'active' ? 'نشط' : 'سابق'}` : (pair.status === 'active' ? 'نشط' : 'متوقف'),
        targetView: parentCoop ? 'coop_detail' : 'pair_detail',
        params: parentCoop ? { coopId: parentCoop.id } : { pairId: pair.id },
      });
    }
  }

  for (const squab of squabs) {
    if (squab.codeNumber.toLowerCase().includes(q)) {
      results.push({
        id: squab.id,
        type: 'squab',
        title: squab.codeNumber,
        subtitle: `عمر الزغلول: ${getSquabAge(squab.hatchDate)} يوم • تاريخ الفقس: ${squab.hatchDate}`,
        targetView: 'squab_detail',
        params: { squabId: squab.id },
      });
    }
  }

  for (const batch of batches) {
    if (batch.batchNumber.toLowerCase().includes(q)) {
      results.push({
        id: batch.id,
        type: 'batch',
        title: batch.batchNumber,
        subtitle: `تاريخ النقل: ${batch.transferDate} • الحالة: ${batch.status}`,
        targetView: 'batch_detail',
        params: { batchId: batch.id },
      });
    }
  }

  return results.slice(0, 15);
}

// -------------------------------------------------------------
// فحص وطلب التخزين الدائم (navigator.storage.persist)
// -------------------------------------------------------------
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}


