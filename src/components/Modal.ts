import {
  Coop,
  Pair,
  Egg,
  Squab,
  Batch,
  Sale,
  FarmSettings,
  FeedType,
  FeedRateConfig,
  Expense,
  ManualRevenue,
  ExpenseCategory,
  AccountingType,
  ManualRevenueCategory,
  TodayTask,
  PairRankingItem,
  PairRankingThresholds,
  DataIntegrityReport,
  DataIntegrityIssue,
  PigeonFarmBackup,
  UndoableAction,
  AlertPreferences,
} from '../types';
import {
  addCoop,
  updateCoop,
  toggleCoopActive,
  getCoops,
  getCoop,
  addPair,
  updatePair,
  togglePairActive,
  getPairs,
  logEvent,
  layEggs,
  checkEggFertility,
  markEggBrokenOrLost,
  recordEggHatch,
  recordSquabDeath,
  addSquabWeight,
  updateSquab,
  getSquabs,
  getSquabsByBatch,
  getSquabsByCurrentLocation,
  getBatches,
  getBatch,
  transferSquabsToCollection,
  postponeSquabsSale,
  recordSale,
  cancelSale,
  correctTransferDate,
  getEventsForEntity,
  getSettings,
  updateSettings,
  getFeedTypes,
  getFeedType,
  addFeedType,
  updateFeedType,
  recordFeedPurchase,
  recordStockManualAdjustment,
  getFeedRateConfigs,
  addFeedRateConfig,
  getExpenses,
  addExpense,
  updateExpense,
  toggleExpenseActive,
  addManualRevenue,
  updateManualRevenue,
  toggleManualRevenueActive,
  recordPairBirdCountChange,
  getAllFeedStocks,
  snoozeTask,
  completeTask,
  updateAlertPreferences,
  updatePairRankingThresholds,
  exportBackupData,
  restoreBackupData,
  wipeAllData,
  checkDataIntegrity,
  executeUndo,
  searchFarm,
  validateBackupFile,
} from '../db/indexedDB';
import {
  getTodayDate,
  formatDateArabic,
  formatDateTimeArabic,
  getSquabAge,
  formatAgeArabic,
  addDays,
  getEffectiveSaleDate,
} from '../utils/dateUtils';
import { showToast } from './Toast';
import { icons } from '../utils/icons';

let currentModalOverlay: HTMLElement | null = null;

export function closeModal() {
  if (currentModalOverlay) {
    currentModalOverlay.remove();
    currentModalOverlay = null;
    document.body.style.overflow = '';
  }
}

function createModalBase(title: string, iconHtml?: string): { overlay: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  document.body.style.overflow = 'hidden';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <div class="modal-title">
      ${iconHtml ? `<span style="display:flex;align-items:center;color:var(--primary);">${iconHtml}</span>` : ''}
      <span>${title}</span>
    </div>
    <button class="btn btn-outline btn-icon-only close-modal-btn" aria-label="إغلاق">
      ${icons.close}
    </button>
  `;

  header.querySelector('.close-modal-btn')?.addEventListener('click', closeModal);

  // Close when clicking outside content
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  const body = document.createElement('div');
  body.className = 'modal-body';

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  currentModalOverlay = overlay;

  return { overlay, body, footer };
}

// -----------------------------------------------------------------
// 1. إضافة سلاكة جديدة (Add Coop) - بخطوات متتابعة ودمج بيانات الزوج للسلاكة الإنتاج
// -----------------------------------------------------------------
export async function showAddCoopModal(onSuccess: () => void) {
  const { body, footer } = createModalBase('إضافة سلاكة جديدة', icons.coop);

  // استخراج قائمة السلالات المسجلة سابقاً لتسهيل الاختيار
  const allPairs = await getPairs();
  const knownBreedsSet = new Set<string>(['بلدي', 'فرنساوي']);
  allPairs.forEach((p) => {
    if (p.breed && p.breed.trim()) knownBreedsSet.add(p.breed.trim());
  });
  const breedOptions = Array.from(knownBreedsSet);

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">
        رقم أو رمز السلاكة
        <span class="form-label-required">*</span>
      </label>
      <input type="text" id="coop-number" class="form-input" placeholder="مثال: 101 أو أ-12" autofocus />
      <span class="form-help">رقم أو رمز واضح لتمييز السلاكة في المزرعة.</span>
    </div>

    <div class="form-group">
      <label class="form-label">
        نوع السلاكة
        <span class="form-label-required">*</span>
      </label>
      <select id="coop-type" class="form-select">
        <option value="production" selected>سلاكة إنتاج (لتزاوج وتفريخ وحضانة الأزواج)</option>
        <option value="collection">سلاكة تجميع (للشبابيك والفطام أو التجهيز للبيع)</option>
      </select>
    </div>

    <!-- قسم بيانات الزوج لسلاكة الإنتاج (يظهر فقط عند اختيار إنتاج) -->
    <div id="section-pair-fields" style="background-color:var(--surface-subtle);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
        <div style="font-weight:800;font-size:0.95rem;color:var(--text-main);display:flex;align-items:center;gap:6px;">
          ${icons.pair}
          <span>بيانات الزوج الساكن (اختياري - يمكن إضافته لاحقاً)</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">نوع الحمام (السلالة)</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="pair-breed-input" list="breed-options-list" class="form-input" placeholder="اختر أو اكتب نوعاً مثل: بلدي، فرنساوي..." />
          <datalist id="breed-options-list">
            ${breedOptions.map((b) => `<option value="${b}"></option>`).join('')}
          </datalist>
        </div>
        <span class="form-help">يمكنك اختيار نوع مسجل مسبقاً أو كتابة نوع جديد وسيُحفظ لاختياره لاحقاً.</span>
      </div>

      <div class="form-group">
        <label class="form-label">اسم أو رقم الزوج (اختياري)</label>
        <input type="text" id="pair-name-input" class="form-input" placeholder="افتراضياً: زوج سلاكة [رقم السلاكة]" />
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#1E40AF;font-size:0.84rem;">
            ${icons.male} بيانات الذكر (اختياري)
          </label>
          <input type="text" id="pair-male-input" class="form-input" placeholder="رقم الدبلة، المواصفات..." />
        </div>

        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#9D174D;font-size:0.84rem;">
            ${icons.female} بيانات الأنثى (اختياري)
          </label>
          <input type="text" id="pair-female-input" class="form-input" placeholder="رقم الدبلة، المواصفات..." />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">تاريخ تكوين الزوج (اختياري)</label>
        <input type="date" id="pair-date-input" class="form-input" value="${getTodayDate()}" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات إضافية على السلاكة (اختياري)</label>
      <textarea id="coop-notes" class="form-textarea" placeholder="ملاحظات حول موقع السلاكة، المقاس، أو التهوية..."></textarea>
    </div>
  `;

  const typeSelect = body.querySelector('#coop-type') as HTMLSelectElement;
  const pairSection = body.querySelector('#section-pair-fields') as HTMLElement;

  typeSelect.addEventListener('change', () => {
    if (typeSelect.value === 'production') {
      pairSection.style.display = 'flex';
    } else {
      pairSection.style.display = 'none';
    }
  });

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ السلاكة</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const numInput = document.getElementById('coop-number') as HTMLInputElement;
    const notesInput = document.getElementById('coop-notes') as HTMLTextAreaElement;

    const num = numInput?.value.trim();
    if (!num) {
      showToast('يرجى إدخال رقم أو رمز السلاكة', 'error');
      numInput?.focus();
      return;
    }

    const coopType = typeSelect.value as 'production' | 'collection';

    try {
      const createdCoop = await addCoop(num, coopType, notesInput?.value);

      // إذا كانت سلاكة إنتاج وتم إدخال أي بيان للزوج
      if (coopType === 'production') {
        const breedInput = document.getElementById('pair-breed-input') as HTMLInputElement;
        const nameInput = document.getElementById('pair-name-input') as HTMLInputElement;
        const maleInput = document.getElementById('pair-male-input') as HTMLInputElement;
        const femaleInput = document.getElementById('pair-female-input') as HTMLInputElement;
        const dateInput = document.getElementById('pair-date-input') as HTMLInputElement;

        const breed = breedInput?.value.trim() || undefined;
        let pairName = nameInput?.value.trim();
        const maleInfo = maleInput?.value.trim() || 'ذكر مسكن';
        const femaleInfo = femaleInput?.value.trim() || 'أنثى مسكنة';
        const pairedDate = dateInput?.value || getTodayDate();

        const hasPairData = Boolean(breed || nameInput?.value.trim() || maleInput?.value.trim() || femaleInput?.value.trim());

        if (hasPairData) {
          if (!pairName) {
            pairName = breed ? `زوج ${breed} (سلاكة ${createdCoop.number})` : `زوج سلاكة ${createdCoop.number}`;
          }

          await addPair({
            name: pairName,
            breed,
            coopId: createdCoop.id,
            maleInfo,
            femaleInfo,
            pairedDate,
          });
        }
      }

      showToast('تمت إضافة السلاكة بنجاح وتسجيل الحدث', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل حفظ السلاكة: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 2. تعديل بيانات السلاكة (Edit Coop) مع سبب التعديل
// -----------------------------------------------------------------
export function showEditCoopModal(coop: Coop, onSuccess: () => void) {
  const { body, footer } = createModalBase(`تعديل سلاكة ${coop.number}`, icons.edit);

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">رقم أو رمز السلاكة <span class="form-label-required">*</span></label>
      <input type="text" id="edit-coop-number" class="form-input" value="${coop.number}" />
    </div>

    <div class="form-group">
      <label class="form-label">نوع السلاكة <span class="form-label-required">*</span></label>
      <select id="edit-coop-type" class="form-select">
        <option value="production" ${coop.type === 'production' ? 'selected' : ''}>سلاكة إنتاج</option>
        <option value="collection" ${coop.type === 'collection' ? 'selected' : ''}>سلاكة تجميع</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات</label>
      <textarea id="edit-coop-notes" class="form-textarea">${coop.notes || ''}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التعديل (قاعدة توثيق الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="edit-coop-reason" class="form-input" placeholder="مثال: تصحيح رقم السلاكة، تغيير نوع الاستخدام..." />
      <span class="form-help">يُحفظ السبب والقيم القديمة والجديدة في سجل الأحداث ولا تُمسح.</span>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ التعديلات</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const numInput = document.getElementById('edit-coop-number') as HTMLInputElement;
    const typeSelect = document.getElementById('edit-coop-type') as HTMLSelectElement;
    const notesInput = document.getElementById('edit-coop-notes') as HTMLTextAreaElement;
    const reasonInput = document.getElementById('edit-coop-reason') as HTMLInputElement;

    const num = numInput?.value.trim();
    const reason = reasonInput?.value.trim();

    if (!num) {
      showToast('يرجى إدخال رقم السلاكة', 'error');
      numInput?.focus();
      return;
    }

    if (!reason) {
      showToast('يرجى كتابة سبب التعديل لتوثيق الحدث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await updateCoop(
        coop.id,
        {
          number: num,
          type: typeSelect.value as 'production' | 'collection',
          notes: notesInput.value,
        },
        reason
      );
      showToast('تم حفظ التعديلات وتوثيقها في سجل الأحداث', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التعديل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 3. إيقاف / تنشيط السلاكة (قاعدة 4: لا حذف أبداً)
// -----------------------------------------------------------------
export function showToggleCoopModal(coop: Coop, onSuccess: () => void) {
  const isCurrentlyActive = coop.active;
  const actionTitle = isCurrentlyActive ? 'إيقاف السلاكة' : 'إعادة تفعيل السلاكة';
  const icon = isCurrentlyActive ? icons.pause : icons.play;

  const { body, footer } = createModalBase(actionTitle, icon);

  body.innerHTML = `
    <div style="background-color:${isCurrentlyActive ? 'var(--danger-bg)' : 'var(--success-bg)'};padding:14px;border-radius:var(--radius-md);color:${isCurrentlyActive ? 'var(--danger)' : 'var(--success)'};font-weight:600;font-size:0.95rem;">
      ${
        isCurrentlyActive
          ? `هل أنت متأكد من إيقاف السلاكة رقم (${coop.number})؟ لن يتم حذف أي بيانات أو سجلات تاريخية للبيض أو الأحداث.`
          : `هل تريد إعادة تفعيل السلاكة رقم (${coop.number}) للعمل والإنتاج؟`
      }
    </div>

    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">سبب ${isCurrentlyActive ? 'الإيقاف' : 'إعادة التفعيل'} <span class="form-label-required">*</span></label>
      <input type="text" id="toggle-coop-reason" class="form-input" placeholder="${isCurrentlyActive ? 'مثال: صيانة، تطهير، استراحة...' : 'مثال: انتهاء الصيانة والتطهير...'}" />
      <span class="form-help">يُسجل في سجل الأحداث مع التاريخ والوقت.</span>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn ${isCurrentlyActive ? 'btn-danger' : 'btn-success'} btn-lg" id="btn-confirm">
      ${isCurrentlyActive ? 'تأكيد الإيقاف' : 'تأكيد التفعيل'}
    </button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm')?.addEventListener('click', async () => {
    const reasonInput = document.getElementById('toggle-coop-reason') as HTMLInputElement;
    const reason = reasonInput?.value.trim();

    if (!reason) {
      showToast('يرجى كتابة السبب للتوثيق', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await toggleCoopActive(coop.id, !isCurrentlyActive, reason);
      showToast(`تم ${isCurrentlyActive ? 'إيقاف' : 'تفعيل'} السلاكة وتوثيق الحدث`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('حدث خطأ: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 4. إضافة زوج جديد (Add Pair)
// -----------------------------------------------------------------
export async function showAddPairModal(preselectedCoopId: string | null = null, onSuccess: () => void) {
  const [coops, allPairs] = await Promise.all([getCoops(), getPairs()]);
  const activeCoops = coops.filter((c) => c.active);

  const knownBreedsSet = new Set<string>(['بلدي', 'فرنساوي']);
  allPairs.forEach((p) => {
    if (p.breed && p.breed.trim()) knownBreedsSet.add(p.breed.trim());
  });
  const breedOptions = Array.from(knownBreedsSet);

  const { body, footer } = createModalBase('إضافة زوج حمام جديد', icons.pair);

  let coopOptionsHtml = `<option value="">-- بدون سلاكة حالياً (غير مسكن) --</option>`;
  activeCoops.forEach((c) => {
    const isSelected = preselectedCoopId === c.id;
    coopOptionsHtml += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>سلاكة رقم ${c.number} (${c.type === 'production' ? 'إنتاج' : 'تجميع'})</option>`;
  });

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">نوع الحمام (السلالة)</label>
      <input type="text" id="pair-breed" list="modal-breed-options" class="form-input" placeholder="مثال: بلدي، فرنساوي، كينج، رومي..." />
      <datalist id="modal-breed-options">
        ${breedOptions.map((b) => `<option value="${b}"></option>`).join('')}
      </datalist>
    </div>

    <div class="form-group">
      <label class="form-label">اسم أو رمز الزوج <span class="form-label-required">*</span></label>
      <input type="text" id="pair-name" class="form-input" placeholder="مثال: زوج 101 - زاجل سباق، أو كينج أبيض..." />
    </div>

    <div class="form-group">
      <label class="form-label">السلاكة المخصصة</label>
      <select id="pair-coop" class="form-select">
        ${coopOptionsHtml}
      </select>
    </div>

    <div style="background-color:var(--surface-subtle);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#1E40AF;">
          ${icons.male}
          بيانات الذكر <span class="form-label-required">*</span>
        </label>
        <input type="text" id="male-info" class="form-input" placeholder="رقم الدبلة، اللون، السلالة، سنة الإنتاج..." />
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#9D174D;">
          ${icons.female}
          بيانات الأنثى <span class="form-label-required">*</span>
        </label>
        <input type="text" id="female-info" class="form-input" placeholder="رقم الدبلة، اللون، السلالة، سنة الإنتاج..." />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ التكوين (التزاوج) <span class="form-label-required">*</span></label>
      <input type="date" id="paired-date" class="form-input" value="${getTodayDate()}" />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات إضافية (اختياري)</label>
      <textarea id="pair-notes" class="form-textarea" placeholder="ملاحظات حول سلالة الزوج، المستوى، أو خط الإنتاج..."></textarea>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ الزوج</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const breedInput = document.getElementById('pair-breed') as HTMLInputElement;
    const nameInput = document.getElementById('pair-name') as HTMLInputElement;
    const coopSelect = document.getElementById('pair-coop') as HTMLSelectElement;
    const maleInput = document.getElementById('male-info') as HTMLInputElement;
    const femaleInput = document.getElementById('female-info') as HTMLInputElement;
    const dateInput = document.getElementById('paired-date') as HTMLInputElement;
    const notesInput = document.getElementById('pair-notes') as HTMLTextAreaElement;

    const breed = breedInput?.value.trim() || undefined;
    const name = nameInput?.value.trim();
    const maleInfo = maleInput?.value.trim();
    const femaleInfo = femaleInput?.value.trim();
    const pairedDate = dateInput?.value;

    if (!name) {
      showToast('يرجى إدخال اسم أو رمز الزوج', 'error');
      nameInput?.focus();
      return;
    }
    if (!maleInfo) {
      showToast('يرجى إدخال بيانات الذكر (رقم الدبلة والمواصفات)', 'error');
      maleInput?.focus();
      return;
    }
    if (!femaleInfo) {
      showToast('يرجى إدخال بيانات الأنثى (رقم الدبلة والمواصفات)', 'error');
      femaleInput?.focus();
      return;
    }
    if (!pairedDate) {
      showToast('يرجى تحديد تاريخ التكوين', 'error');
      dateInput?.focus();
      return;
    }

    try {
      await addPair({
        name,
        breed,
        coopId: coopSelect.value || null,
        maleInfo,
        femaleInfo,
        pairedDate,
        notes: notesInput?.value,
      });
      showToast('تمت إضافة الزوج وتوثيقه بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل إضافة الزوج: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 5. تعديل بيانات الزوج (Edit Pair) ونقله لسلاكة أخرى مع السبب
// -----------------------------------------------------------------
export async function showEditPairModal(pair: Pair, onSuccess: () => void) {
  const coops = await getCoops();
  const { body, footer } = createModalBase(`تعديل الزوج ${pair.name}`, icons.edit);

  let coopOptionsHtml = `<option value="" ${!pair.coopId ? 'selected' : ''}>-- بدون سلاكة (غير مسكن) --</option>`;
  coops.forEach((c) => {
    const isSelected = pair.coopId === c.id;
    coopOptionsHtml += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>سلاكة رقم ${c.number} ${!c.active ? '(متوقفة)' : ''}</option>`;
  });

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم أو رمز الزوج <span class="form-label-required">*</span></label>
      <input type="text" id="edit-pair-name" class="form-input" value="${pair.name}" />
    </div>

    <div class="form-group">
      <label class="form-label">نوع الحمام (السلالة)</label>
      <input type="text" id="edit-pair-breed" class="form-input" value="${pair.breed || ''}" placeholder="مثال: بلدي، فرنساوي، كينج، رومي..." />
    </div>

    <div class="form-group">
      <label class="form-label">السلاكة (نقل الزوج لسلاكة أخرى)</label>
      <select id="edit-pair-coop" class="form-select">
        ${coopOptionsHtml}
      </select>
      <span class="form-help">إذا قمت بتغيير السلاكة، فسيتم توثيق حركة النقل بالسجل.</span>
    </div>

    <div style="background-color:var(--surface-subtle);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#1E40AF;">
          ${icons.male}
          بيانات الذكر <span class="form-label-required">*</span>
        </label>
        <input type="text" id="edit-male-info" class="form-input" value="${pair.maleInfo}" />
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#9D174D;">
          ${icons.female}
          بيانات الأنثى <span class="form-label-required">*</span>
        </label>
        <input type="text" id="edit-female-info" class="form-input" value="${pair.femaleInfo}" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ التكوين <span class="form-label-required">*</span></label>
      <input type="date" id="edit-paired-date" class="form-input" value="${pair.pairedDate}" />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات</label>
      <textarea id="edit-pair-notes" class="form-textarea">${pair.notes || ''}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التعديل (قاعدة توثيق الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="edit-pair-reason" class="form-input" placeholder="مثال: نقل الزوج لسلاكة أوسع، تصحيح رقم الدبلة..." />
      <span class="form-help">يُسجل في سجل الأحداث مع القيم السابقة والجديدة والتاريخ والسبب.</span>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ التعديلات</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('edit-pair-name') as HTMLInputElement;
    const breedInput = document.getElementById('edit-pair-breed') as HTMLInputElement;
    const coopSelect = document.getElementById('edit-pair-coop') as HTMLSelectElement;
    const maleInput = document.getElementById('edit-male-info') as HTMLInputElement;
    const femaleInput = document.getElementById('edit-female-info') as HTMLInputElement;
    const dateInput = document.getElementById('edit-paired-date') as HTMLInputElement;
    const notesInput = document.getElementById('edit-pair-notes') as HTMLTextAreaElement;
    const reasonInput = document.getElementById('edit-pair-reason') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const breed = breedInput?.value.trim();
    const maleInfo = maleInput?.value.trim();
    const femaleInfo = femaleInput?.value.trim();
    const pairedDate = dateInput?.value;
    const reason = reasonInput?.value.trim();

    if (!name) {
      showToast('يرجى إدخال اسم الزوج', 'error');
      nameInput?.focus();
      return;
    }
    if (!maleInfo || !femaleInfo) {
      showToast('يرجى إدخال بيانات الذكر والأنثى', 'error');
      return;
    }
    if (!reason) {
      showToast('يرجى كتابة سبب التعديل لتوثيق الحدث بالسجل', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await updatePair(
        pair.id,
        {
          name,
          breed: breed || undefined,
          coopId: coopSelect.value || null,
          maleInfo,
          femaleInfo,
          pairedDate,
          notes: notesInput.value,
        },
        reason
      );
      showToast('تم حفظ التعديلات وتوثيقها في سجل الأحداث', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التعديل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 6. إيقاف / تنشيط الزوج (قاعدة 4: لا حذف أبداً)
// -----------------------------------------------------------------
export function showTogglePairModal(pair: Pair, onSuccess: () => void) {
  const isCurrentlyActive = pair.status === 'active';
  const actionTitle = isCurrentlyActive ? 'إيقاف الزوج' : 'إعادة تنشيط الزوج';
  const icon = isCurrentlyActive ? icons.pause : icons.play;

  const { body, footer } = createModalBase(actionTitle, icon);

  body.innerHTML = `
    <div style="background-color:${isCurrentlyActive ? 'var(--danger-bg)' : 'var(--success-bg)'};padding:14px;border-radius:var(--radius-md);color:${isCurrentlyActive ? 'var(--danger)' : 'var(--success)'};font-weight:600;font-size:0.95rem;">
      ${
        isCurrentlyActive
          ? `هل أنت متأكد من إيقاف الزوج (${pair.name})؟ لن يتم حذف أي سجل من سجلاته أو دوراته السابقة أو بيضه.`
          : `هل تريد إعادة تنشيط الزوج (${pair.name}) للإنتاج؟`
      }
    </div>

    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">سبب ${isCurrentlyActive ? 'الإيقاف' : 'إعادة التنشيط'} <span class="form-label-required">*</span></label>
      <input type="text" id="toggle-pair-reason" class="form-input" placeholder="${isCurrentlyActive ? 'مثال: راحة بعد موسم الإنتاج، فصل للتجهيز...' : 'مثال: عودة الزوج لموسم الإنتاج...'}" />
      <span class="form-help">يُحفظ في سجل الأحداث ولا يُمسح.</span>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn ${isCurrentlyActive ? 'btn-danger' : 'btn-success'} btn-lg" id="btn-confirm">
      ${isCurrentlyActive ? 'تأكيد الإيقاف' : 'تأكيد التنشيط'}
    </button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm')?.addEventListener('click', async () => {
    const reasonInput = document.getElementById('toggle-pair-reason') as HTMLInputElement;
    const reason = reasonInput?.value.trim();

    if (!reason) {
      showToast('يرجى كتابة السبب للتوثيق', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await togglePairActive(pair.id, !isCurrentlyActive, reason);
      showToast(`تم ${isCurrentlyActive ? 'إيقاف' : 'تنشيط'} الزوج وتوثيق الحدث`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('حدث خطأ: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 6-ب. تغيير الزوج في السلاكة (تسكين زوج جديد وحفظ القديم بالسجل)
// -----------------------------------------------------------------
export async function showChangePairModal(coop: Coop, currentPair: Pair, onSuccess: () => void) {
  const existingPairs = await getPairs();
  const breedSet = new Set<string>(['بلدي', 'فرنساوي']);
  existingPairs.forEach((p) => {
    if (p.breed && p.breed.trim()) {
      breedSet.add(p.breed.trim());
    }
  });
  const breedOptions = Array.from(breedSet);

  const { body, footer } = createModalBase(`تغيير الزوج لسلاكة ${coop.number}`, icons.pair);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.88rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px;">
      <div style="font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:6px;">
        <span>ℹ️</span>
        <span>سيتم حفظ الزوج الحالي (${currentPair.name}) كزوج سابق بالسجل التاريخي</span>
      </div>
      <div>
        لن يتم حذف أي بيانات أو دورات أو بيض خاص بالزوج الحالي، وسيبقى متاحاً في التقارير وترتيب الأزواج. سيتم تسكين الزوج الجديد مباشرة في سلاكة ${coop.number}.
      </div>
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label class="form-label">نوع الحمام (السلالة للزوج الجديد)</label>
      <input type="text" id="new-pair-breed" list="change-breed-list" class="form-input" placeholder="اختر أو اكتب نوعاً: بلدي، فرنساوي..." value="${currentPair.breed || ''}" />
      <datalist id="change-breed-list">
        ${breedOptions.map((b) => `<option value="${b}"></option>`).join('')}
      </datalist>
      <span class="form-help">يُحفظ أي نوع جديد لاختياره تلقائياً في المرات القادمة.</span>
    </div>

    <div class="form-group">
      <label class="form-label">اسم أو رقم الزوج الجديد (اختياري)</label>
      <input type="text" id="new-pair-name" class="form-input" placeholder="افتراضياً: زوج [السلالة] (سلاكة ${coop.number})" />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#1E40AF;font-size:0.84rem;">
          ${icons.male} بيانات الذكر (اختياري)
        </label>
        <input type="text" id="new-pair-male" class="form-input" placeholder="رقم الدبلة، المواصفات..." />
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;color:#9D174D;font-size:0.84rem;">
          ${icons.female} بيانات الأنثى (اختياري)
        </label>
        <input type="text" id="new-pair-female" class="form-input" placeholder="رقم الدبلة، المواصفات..." />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ تكوين الزوج الجديد</label>
      <input type="date" id="new-pair-date" class="form-input" value="${getTodayDate()}" />
    </div>

    <div class="form-group">
      <label class="form-label">سبب تغيير الزوج (لتوثيق الحدث) <span class="form-label-required">*</span></label>
      <input type="text" id="change-pair-reason" class="form-input" placeholder="مثال: انخفاض إنتاج الزوج السابق، تجديد الدماء، نفوق أحد الطرفين..." />
      <span class="form-help">يُسجل في سجل الأحداث لتوثيق تاريخ السلاكة والزوجين.</span>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-change">تأكيد تسكين الزوج الجديد</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-change')?.addEventListener('click', async () => {
    const breedInput = document.getElementById('new-pair-breed') as HTMLInputElement;
    const nameInput = document.getElementById('new-pair-name') as HTMLInputElement;
    const maleInput = document.getElementById('new-pair-male') as HTMLInputElement;
    const femaleInput = document.getElementById('new-pair-female') as HTMLInputElement;
    const dateInput = document.getElementById('new-pair-date') as HTMLInputElement;
    const reasonInput = document.getElementById('change-pair-reason') as HTMLInputElement;

    const reason = reasonInput?.value.trim();
    if (!reason) {
      showToast('يرجى كتابة سبب تغيير الزوج لتوثيقه في السجل', 'error');
      reasonInput?.focus();
      return;
    }

    const breed = breedInput?.value.trim() || undefined;
    let newPairName = nameInput?.value.trim();
    if (!newPairName) {
      newPairName = breed ? `زوج ${breed} (سلاكة ${coop.number})` : `زوج سلاكة ${coop.number}`;
    }
    const maleInfo = maleInput?.value.trim() || 'ذكر مسكن';
    const femaleInfo = femaleInput?.value.trim() || 'أنثى مسكنة';
    const pairedDate = dateInput?.value || getTodayDate();

    try {
      // 1. إيقاف الزوج الحالي وتوثيق ذلك
      await togglePairActive(currentPair.id, false, `استبدال الزوج في سلاكة ${coop.number}: ${reason}`);

      // 2. إنشاء وتسكين الزوج الجديد
      const newPair = await addPair({
        name: newPairName,
        breed,
        coopId: coop.id,
        maleInfo,
        femaleInfo,
        pairedDate,
      });

      // 3. توثيق حركة التغيير على مستوى السلاكة
      await logEvent(
        'coop',
        coop.id,
        'pair_changed',
        `تم استبدال الزوج في السلاكة من (${currentPair.name}) إلى الزوج الجديد (${newPair.name}) - السبب: ${reason}`
      );

      showToast(`تم تغيير الزوج بنجاح وتسكين (${newPair.name})`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تغيير الزوج: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 6-ج. سجل الأزواج السابقين لسلاكة معينة
// -----------------------------------------------------------------
export async function showCoopPreviousPairsModal(
  coop: Coop,
  navigate: (view: string, params?: Record<string, any>) => void
) {
  const allPairs = await getPairs();
  const previousPairs = allPairs.filter((p) => p.coopId === coop.id && p.status === 'inactive');

  const { body, footer } = createModalBase(`الأزواج السابقة - سلاكة ${coop.number}`, icons.history);

  if (previousPairs.length === 0) {
    body.innerHTML = `
      <div style="padding:24px 12px;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div style="font-size:2rem;opacity:0.6;">${icons.pair}</div>
        <div style="font-weight:700;font-size:0.95rem;color:var(--text-main);">لا توجد أزواج سابقة مسجلة</div>
        <div style="font-size:0.84rem;">هذه السلاكة لم يتم تغيير أي زوج فيها سابقاً، أو لا تزال بالزوج الأول.</div>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">
        قائمة بالأزواج التي سكنت في سلاكة رقم (${coop.number}) سابقاً. يمكنك الضغط على أي زوج لعرض تفاصيله وسجل إنتاجه التاريخي:
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;">
        ${previousPairs
          .map(
            (p) => `
          <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:800;color:var(--text-main);font-size:0.95rem;">${p.name}</span>
                ${p.breed ? `<span class="badge badge-primary" style="font-size:0.75rem;">${p.breed}</span>` : ''}
              </div>
              <span class="badge badge-muted" style="font-size:0.72rem;">سابق / متوقف</span>
            </div>

            <div style="font-size:0.8rem;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap;">
              <span>تاريخ التكوين: ${formatDateArabic(p.pairedDate)}</span>
              <span><strong>الذكر:</strong> ${p.maleInfo}</span>
              <span><strong>الأنثى:</strong> ${p.femaleInfo}</span>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:4px;">
              <button class="btn btn-sm btn-outline btn-open-history-pair" data-pair-id="${p.id}" style="font-size:0.8rem;padding:4px 10px;">
                عرض صفحة وسجل الزوج ←
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close-modal">إغلاق</button>
  `;

  footer.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
  body.querySelectorAll('.btn-open-history-pair').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = (btn as HTMLElement).dataset.pairId;
      if (pId) {
        closeModal();
        navigate('pair_detail', { pairId: pId });
      }
    });
  });
}

// -----------------------------------------------------------------
// 7. تسجيل وضع البيض (Lay Eggs)
// قاعدة 3: كل بيضة لها سجل مستقل
// البيضة الأولى مطلوبة، والثانية اختيارية
// -----------------------------------------------------------------
export async function showLayEggModal(
  preselectedPairId: string | null = null,
  preselectedCoopId: string | null = null,
  onSuccess: () => void
) {
  const [pairs, coops] = await Promise.all([getPairs(), getCoops()]);
  const activePairs = pairs.filter((p) => p.status === 'active');

  if (activePairs.length === 0) {
    showToast('لا توجد أزواج نشطة حالياً لتسجيل وضع البيض. أضف زوجاً أولاً.', 'error');
    return;
  }

  const { body, footer } = createModalBase('تسجيل وضع البيض', icons.egg);

  let pairOptionsHtml = '';
  activePairs.forEach((p) => {
    const coop = coops.find((c) => c.id === p.coopId);
    const coopText = coop ? ` (سلاكة ${coop.number})` : ' (بدون سلاكة)';
    const isSelected = preselectedPairId === p.id;
    pairOptionsHtml += `<option value="${p.id}" data-coop="${p.coopId || ''}" ${isSelected ? 'selected' : ''}>${p.name}${coopText}</option>`;
  });

  const today = getTodayDate();

  body.innerHTML = `
    <div style="background-color:var(--primary-light);border:1px solid #D0E2D6;padding:12px;border-radius:var(--radius-md);color:var(--primary);font-size:0.86rem;line-height:1.4;">
      <strong>ملاحظة هامة:</strong> يمكن تسجيل بيضة واحدة الآن، والبيضة الثانية اختيارية (يمكن إضافتها لاحقاً عند وضعها). يتم إنشاء سجل مستقل لكل بيضة في قاعدة البيانات.
    </div>

    <div class="form-group">
      <label class="form-label">الزوج <span class="form-label-required">*</span></label>
      <select id="lay-pair" class="form-select">
        ${pairOptionsHtml}
      </select>
    </div>

    <div style="background-color:var(--surface-subtle);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;">
          <span class="badge badge-primary">البيضة الأولى</span>
          تاريخ الوضع <span class="form-label-required">*</span>
        </label>
        <input type="date" id="egg1-date" class="form-input" value="${today}" />
      </div>

      <div style="border-top:1px dashed var(--border-subtle);padding-top:12px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;margin-bottom:8px;">
          <input type="checkbox" id="has-egg2" style="width:18px;height:18px;accent-color:var(--primary);" />
          <span>تسجيل البيضة الثانية الآن؟ (اختياري)</span>
        </label>

        <div id="egg2-container" style="display:none;margin-top:8px;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="badge badge-primary">البيضة الثانية</span>
            تاريخ وضع البيضة الثانية
          </label>
          <input type="date" id="egg2-date" class="form-input" value="${today}" />
          <span class="form-help">عادة ما تضع الحمامة البيضة الثانية بعد 40 إلى 44 ساعة من الأولى.</span>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات العش (اختياري)</label>
      <input type="text" id="lay-note" class="form-input" placeholder="مثال: حجم البيض ممتاز، قشرة قوية..." />
    </div>
  `;

  const hasEgg2Checkbox = body.querySelector('#has-egg2') as HTMLInputElement;
  const egg2Container = body.querySelector('#egg2-container') as HTMLElement;
  hasEgg2Checkbox?.addEventListener('change', () => {
    if (egg2Container) {
      egg2Container.style.display = hasEgg2Checkbox.checked ? 'block' : 'none';
    }
  });

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ وضع البيض</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const pairSelect = document.getElementById('lay-pair') as HTMLSelectElement;
    const egg1DateInput = document.getElementById('egg1-date') as HTMLInputElement;
    const egg2DateInput = document.getElementById('egg2-date') as HTMLInputElement;
    const noteInput = document.getElementById('lay-note') as HTMLInputElement;

    const selectedPairId = pairSelect?.value;
    const egg1Date = egg1DateInput?.value;
    const hasEgg2 = hasEgg2Checkbox?.checked;
    const egg2Date = hasEgg2 ? egg2DateInput?.value : null;

    if (!selectedPairId) {
      showToast('يرجى اختيار الزوج', 'error');
      return;
    }
    if (!egg1Date) {
      showToast('يرجى تحديد تاريخ وضع البيضة الأولى', 'error');
      egg1DateInput?.focus();
      return;
    }

    const pair = pairs.find((p) => p.id === selectedPairId);
    let coopId = pair?.coopId || preselectedCoopId || '';

    if (!coopId) {
      // إذا لم يكن الزوج مسكناً، نطلب ربطه بسلاكة أو استخدام أول سلاكة نشطة
      const activeCoop = coops.find((c) => c.active);
      if (activeCoop) {
        coopId = activeCoop.id;
      } else {
        showToast('يرجى تسكين الزوج في سلاكة أولاً', 'error');
        return;
      }
    }

    try {
      const createdEggs = await layEggs({
        pairId: selectedPairId,
        coopId,
        egg1Date,
        egg2Date,
        note: noteInput?.value,
      });

      showToast(`تم تسجيل ${createdEggs.length} بيضة بسجلات مستقلة وتوثيقها بنجاح`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل البيض: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 8. فحص التخصيب (Fertility Check) - لكل بيضة على حدة
// -----------------------------------------------------------------
export function showEggFertilityCheckModal(
  egg: Egg,
  pairName: string,
  coopNumber: string,
  onSuccess: () => void
) {
  // التحقق من أن البيضة صالحة للفحص
  if (egg.status === 'broken' || egg.status === 'lost') {
    showToast('لا يمكن فحص بيضة مكسورة أو مفقودة!', 'error');
    return;
  }

  const { body, footer } = createModalBase(`فحص تخصيب البيضة رقم ${egg.eggNumber}`, icons.egg);

  const today = getTodayDate();

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:4px;font-size:0.9rem;">
      <div><strong>الزوج:</strong> ${pairName}</div>
      <div><strong>السلاكة:</strong> رقم ${coopNumber}</div>
      <div><strong>تاريخ الوضع:</strong> ${formatDateArabic(egg.laidDate)}</div>
      <div><strong>الحالة الحالية:</strong> ${egg.status === 'pending' ? 'بانتظار الفحص' : egg.status === 'fertile' ? 'مخصبة' : 'رايقة'}</div>
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">نتيجة الفحص بالضوء (كشاف البيض) <span class="form-label-required">*</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;">
        <label style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border:2px solid #86EFAC;border-radius:var(--radius-md);background-color:#DCFCE7;cursor:pointer;text-align:center;">
          <input type="radio" name="fertility-result" value="fertile" checked style="width:20px;height:20px;accent-color:#166534;" />
          <span style="font-weight:800;color:#166534;font-size:1.05rem;">مخصبة ✓</span>
          <span style="font-size:0.75rem;color:#14532D;">يظهر بها عروق دم أو جنين واضح، وتستمر بالحضانة للفقس.</span>
        </label>

        <label style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border:2px solid #D1D5DB;border-radius:var(--radius-md);background-color:#F3F4F6;cursor:pointer;text-align:center;">
          <input type="radio" name="fertility-result" value="infertile" style="width:20px;height:20px;accent-color:#4B5563;" />
          <span style="font-weight:800;color:#374151;font-size:1.05rem;">رايقة (غير مخصبة)</span>
          <span style="font-size:0.75rem;color:#4B5563;">البيضة شفافة ولا تحتوي على أي أوعية دموية أو جنين.</span>
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ الفحص <span class="form-label-required">*</span></label>
      <input type="date" id="check-date" class="form-input" value="${today}" />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات الفحص (اختياري)</label>
      <input type="text" id="check-note" class="form-input" placeholder="مثال: نبض الجنين قوي، شبكة أوعية ممتازة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ نتيجة الفحص</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const radioSelected = document.querySelector('input[name="fertility-result"]:checked') as HTMLInputElement;
    const checkDateInput = document.getElementById('check-date') as HTMLInputElement;
    const noteInput = document.getElementById('check-note') as HTMLInputElement;

    const isFertile = radioSelected?.value === 'fertile';
    const checkDate = checkDateInput?.value || today;

    try {
      await checkEggFertility(egg.id, isFertile, checkDate, noteInput?.value);
      showToast(
        isFertile
          ? 'تم تسجيل البيضة كمخصبة وتحديد موعد الفقس المتوقع'
          : 'تم تسجيل البيضة كرايقة (غير مخصبة) وتوثيق الحدث',
        'success'
      );
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل الفحص: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 9. كسر أو فقدان بيضة (Broken or Lost Egg)
// تغيير حالة هذه البيضة فقط وبدون التأثير على البيضة الأخرى!
// -----------------------------------------------------------------
export function showEggBrokenOrLostModal(
  egg: Egg,
  pairName: string,
  coopNumber: string,
  onSuccess: () => void
) {
  const { body, footer } = createModalBase(`تسجيل كسر أو فقدان البيضة رقم ${egg.eggNumber}`, icons.eggCrack);

  const today = getTodayDate();

  body.innerHTML = `
    <div style="background-color:var(--danger-bg);padding:12px;border-radius:var(--radius-md);color:var(--danger);font-size:0.88rem;line-height:1.4;">
      <strong>تنبيه:</strong> هذا الإجراء سيغير حالة هذه البيضة فقط (رقم ${egg.eggNumber}) ولن يؤثر على البيضة الأخرى في العش. يتم توثيق الحدث بالسجل ولا يُحذف السجل أبداً.
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">نوع الحالة <span class="form-label-required">*</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        <label style="display:flex;align-items:center;gap:8px;padding:12px;border:1.5px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;">
          <input type="radio" name="egg-issue" value="broken" checked style="width:18px;height:18px;accent-color:var(--danger);" />
          <span style="font-weight:700;">بيضة مكسورة</span>
        </label>

        <label style="display:flex;align-items:center;gap:8px;padding:12px;border:1.5px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;">
          <input type="radio" name="egg-issue" value="lost" style="width:18px;height:18px;accent-color:var(--danger);" />
          <span style="font-weight:700;">بيضة مفقودة</span>
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ الحادثة <span class="form-label-required">*</span></label>
      <input type="date" id="issue-date" class="form-input" value="${today}" />
    </div>

    <div class="form-group">
      <label class="form-label">السبب (اختياري)</label>
      <input type="text" id="issue-reason" class="form-input" placeholder="مثال: قشرة رقيقة، قتال بين الأبوين، انزلاق من الطاجن..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-danger btn-lg" id="btn-save">تأكيد التسجيل</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const radioSelected = document.querySelector('input[name="egg-issue"]:checked') as HTMLInputElement;
    const issueDateInput = document.getElementById('issue-date') as HTMLInputElement;
    const reasonInput = document.getElementById('issue-reason') as HTMLInputElement;

    const newStatus = (radioSelected?.value === 'lost' ? 'lost' : 'broken') as 'broken' | 'lost';
    const date = issueDateInput?.value || today;
    const reason = reasonInput?.value;

    try {
      await markEggBrokenOrLost(egg.id, newStatus, date, reason);
      showToast(
        newStatus === 'broken'
          ? 'تم تسجيل كسر البيضة فقط مع بقاء البيضة الأخرى إن وُجدت'
          : 'تم تسجيل فقدان البيضة فقط مع بقاء البيضة الأخرى إن وُجدت',
        'success'
      );
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التسجيل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 10. سجل تاريخ الأحداث (Event History Modal)
// -----------------------------------------------------------------
export async function showEventHistoryModal(title: string, entityId: string) {
  const events = await getEventsForEntity(entityId);
  const { body, footer } = createModalBase(`سجل تاريخ: ${title}`, icons.history);

  if (events.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icons.history}</div>
        <div class="empty-title">لا توجد أحداث مسجلة بعد</div>
        <div class="empty-desc">أي تغيير أو تعديل يتم حفظه وتوثيقه هنا تلقائياً ولا يُمسح أبداً.</div>
      </div>
    `;
  } else {
    let timelineHtml = `<div class="timeline">`;
    events.forEach((evt) => {
      let icon = icons.info;
      if (evt.type.includes('create')) icon = icons.plus;
      if (evt.type.includes('egg')) icon = icons.egg;
      if (evt.type.includes('deactivate')) icon = icons.pause;
      if (evt.type.includes('activate')) icon = icons.play;
      if (evt.type.includes('broken')) icon = icons.eggCrack;

      timelineHtml += `
        <div class="timeline-item">
          <div class="timeline-dot">${icon}</div>
          <div class="timeline-content">
            <span class="timeline-time">${formatDateTimeArabic(evt.date)}</span>
            <span class="timeline-text">${evt.note || evt.type}</span>
            ${
              evt.oldValue || evt.newValue
                ? `<div class="timeline-diff">
                    ${evt.oldValue ? `<span style="color:var(--danger);text-decoration:line-through;margin-left:6px;">السابق: ${evt.oldValue}</span>` : ''}
                    ${evt.newValue ? `<span style="color:var(--success);">الجديد: ${evt.newValue}</span>` : ''}
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    });
    timelineHtml += `</div>`;
    body.innerHTML = timelineHtml;
  }

  footer.innerHTML = `
    <button type="button" class="btn btn-primary btn-lg" id="btn-close" style="width:100%;">إغلاق السجل</button>
  `;
  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
}

// -----------------------------------------------------------------
// 11. إعدادات مدة الحضن وفحص التخصيب (Settings Modal)
// -----------------------------------------------------------------
export async function showSettingsModal(onSuccess: () => void) {
  const settings = await getSettings();
  const { body, footer } = createModalBase('إعدادات المزرعة والحضانة', icons.settings);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label">
          مدة فحص التخصيب المتوقعة (بالأيام)
          <span class="form-label-required">*</span>
        </label>
        <input type="number" id="setting-check-days" class="form-input" min="3" max="14" value="${settings.fertilityCheckDays}" />
        <span class="form-help">الافتراضي 7 أيام بعد وضع البيض. يظهر تنبيه عند حلول الموعد.</span>
      </div>

      <div class="form-group">
        <label class="form-label">
          مدة حضن البيض حتى الفقس (بالأيام)
          <span class="form-label-required">*</span>
        </label>
        <input type="number" id="setting-incubation-days" class="form-input" min="14" max="25" value="${settings.incubationDays}" />
        <span class="form-help">الافتراضي 18 يوماً للحمام. يُحسب منه موعد الفقس المتوقع والعد التنازلي.</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التعديل (لتوثيقه بسجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="setting-reason" class="form-input" placeholder="مثال: ضبط أوقات الحضانة لموسم الصيف أو لسلالة محددة..." />
    </div>

    <div style="padding:12px;background-color:#EBF2ED;border-radius:var(--radius-md);font-size:0.8rem;color:var(--text-secondary);line-height:1.4;">
      <strong>تأكيد قواعد النظام:</strong> كل البيانات مخزنة محلياً في IndexedDB داخل هذا الجهاز، ولن تضيع عند إعادة تحميل الصفحة أو انقطاع الإنترنت.
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ الإعدادات</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const checkDaysInput = document.getElementById('setting-check-days') as HTMLInputElement;
    const incubationDaysInput = document.getElementById('setting-incubation-days') as HTMLInputElement;
    const reasonInput = document.getElementById('setting-reason') as HTMLInputElement;

    const checkDays = parseInt(checkDaysInput?.value, 10);
    const incubationDays = parseInt(incubationDaysInput?.value, 10);
    const reason = reasonInput?.value.trim();

    if (isNaN(checkDays) || checkDays <= 0) {
      showToast('يرجى إدخال عدد أيام فحص تخصيب صحيح', 'error');
      return;
    }
    if (isNaN(incubationDays) || incubationDays <= 0) {
      showToast('يرجى إدخال عدد أيام حضن صحيح', 'error');
      return;
    }
    if (!reason) {
      showToast('يرجى كتابة سبب التعديل لتوثيقه في سجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await updateSettings(incubationDays, checkDays, 20, reason);
      showToast('تم حفظ الإعدادات وتحديث مواعيد الحضانة بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل حفظ الإعدادات: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 12. تسجيل الفقس (Record Egg Hatch) - المرحلة الثانية
// -----------------------------------------------------------------
export function showRecordHatchModal(
  egg: Egg,
  pairName: string,
  coopNumber: string,
  onSuccess: () => void
) {
  if (egg.status === 'hatched') {
    showToast('هذه البيضة مسجلة كفاقسة بالفعل', 'error');
    return;
  }
  if (egg.status === 'broken' || egg.status === 'lost') {
    showToast('لا يمكن تسجيل فقس بيضة مكسورة أو مفقودة', 'error');
    return;
  }
  if (egg.status === 'infertile') {
    showToast('لا يمكن تسجيل فقس بيضة رايقة (غير مخصبة)', 'error');
    return;
  }

  const { body, footer } = createModalBase(`تسجيل فقس البيضة رقم ${egg.eggNumber}`, icons.squab);
  const today = getTodayDate();

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:4px;font-size:0.9rem;">
      <div><strong>الزوج:</strong> ${pairName}</div>
      <div><strong>السلاكة:</strong> رقم ${coopNumber}</div>
      <div><strong>تاريخ الوضع:</strong> ${formatDateArabic(egg.laidDate)}</div>
    </div>

    <div style="background-color:#EBF2ED;border:1px solid #C7E4D0;padding:12px;border-radius:var(--radius-md);color:var(--primary);font-size:0.86rem;line-height:1.4;">
      <strong>تأكيد قواعد النظام:</strong>
      <ul style="margin-right:18px;margin-top:4px;">
        <li>تتحول حالة البيضة تلقائيًا إلى "فقست".</li>
        <li>يُنشأ تلقائيًا سجل زغلول مستقل برقم تعريفي، وحالته "حي في الإنتاج".</li>
        <li>فقس هذه البيضة لا يؤثر إطلاقاً على البيضة الأخرى في العش، وتظل متابعتها مستمرة.</li>
      </ul>
    </div>

    <div class="form-group" style="margin-top:6px;">
      <label class="form-label">تاريخ الفقس <span class="form-label-required">*</span></label>
      <input type="date" id="hatch-date" class="form-input" value="${today}" />
      <span class="form-help">الافتراضي تاريخ اليوم، ويمكن تعديله بدقة.</span>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات عند خروج الزغلول (اختياري)</label>
      <input type="text" id="hatch-note" class="form-input" placeholder="مثال: خروج طبيعي وقوي، حيوية ممتازة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">تأكيد الفقس وإنشاء الزغلول</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const hatchDateInput = document.getElementById('hatch-date') as HTMLInputElement;
    const noteInput = document.getElementById('hatch-note') as HTMLInputElement;

    const hatchDate = hatchDateInput?.value || today;

    try {
      const { squab } = await recordEggHatch(egg.id, hatchDate, noteInput?.value);
      showToast(`تم تسجيل الفقس بنجاح وإنشاء ${squab.codeNumber} (حي في الإنتاج)`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل الفقس: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 13. تسجيل النفوق (Record Squab Death) - المرحلة الثانية
// -----------------------------------------------------------------
export function showRecordSquabDeathModal(
  squab: Squab,
  onSuccess: () => void
) {
  if (squab.status === 'deceased') {
    showToast('هذا الزغلول مسجل كنافق بالفعل', 'error');
    return;
  }

  const { body, footer } = createModalBase(`تسجيل نفوق ${squab.codeNumber}`, icons.skull);
  const today = getTodayDate();
  const currentAge = getSquabAge(squab.hatchDate, today);

  body.innerHTML = `
    <div style="background-color:var(--danger-bg);padding:12px;border-radius:var(--radius-md);color:var(--danger);font-size:0.88rem;line-height:1.4;">
      <strong>تأكيد قواعد النظام:</strong>
      <ul style="margin-right:18px;margin-top:4px;">
        <li>تتغير حالة الزغلول إلى "نافق" ولا يُحذف السجل أبدًا.</li>
        <li>يُخصم من العدد الحي فقط، ولا يؤثر على الزغلول الآخر أو البيض في نفس السلاكة.</li>
        <li>يُحسب العمر وقت النفوق تلقائيًا بناءً على تاريخ النفوق المدخل.</li>
      </ul>
    </div>

    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">تاريخ النفوق <span class="form-label-required">*</span></label>
      <input type="date" id="death-date" class="form-input" value="${today}" />
      <span class="form-help" id="death-age-preview">العمر وقت النفوق: ${formatAgeArabic(currentAge)}</span>
    </div>

    <div class="form-group">
      <label class="form-label">سبب النفوق (اختياري)</label>
      <input type="text" id="death-reason" class="form-input" placeholder="مثال: دهس تحت الأبوين، ضعف تغذية، برد مفاجئ، كنكر..." />
    </div>
  `;

  const deathDateInput = body.querySelector('#death-date') as HTMLInputElement;
  const agePreview = body.querySelector('#death-age-preview') as HTMLElement;
  deathDateInput?.addEventListener('input', () => {
    const age = getSquabAge(squab.hatchDate, deathDateInput.value);
    if (agePreview) {
      agePreview.textContent = `العمر وقت النفوق: ${formatAgeArabic(age)}`;
    }
  });

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-danger btn-lg" id="btn-save">تأكيد تسجيل النفوق</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const deathDate = deathDateInput?.value || today;
    const reasonInput = document.getElementById('death-reason') as HTMLInputElement;

    try {
      await recordSquabDeath(squab.id, deathDate, reasonInput?.value);
      showToast(`تم تسجيل نفوق ${squab.codeNumber} وتوثيق الحدث والعمر بالسجل`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل النفوق: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 14. تسجيل وزن جديد للزغلول (Add Squab Weight)
// -----------------------------------------------------------------
export function showAddSquabWeightModal(
  squab: Squab,
  onSuccess: () => void
) {
  const { body, footer } = createModalBase(`تسجيل وزن لـ ${squab.codeNumber}`, icons.scale);
  const today = getTodayDate();
  const age = getSquabAge(squab.hatchDate, today);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-secondary);">
      تاريخ الفقس: ${formatDateArabic(squab.hatchDate)} • العمر الحالي: <strong>${formatAgeArabic(age)}</strong>
    </div>

    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">الوزن بالجرام <span class="form-label-required">*</span></label>
      <input type="number" id="squab-weight-grams" class="form-input" min="1" max="2000" placeholder="مثال: 120 أو 350..." autofocus />
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ الوزن <span class="form-label-required">*</span></label>
      <input type="date" id="squab-weight-date" class="form-input" value="${today}" />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات الوزن (اختياري)</label>
      <input type="text" id="squab-weight-note" class="form-input" placeholder="مثال: وزن قبل الأكل، حويصلة ممتلئة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ الوزن</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const weightInput = document.getElementById('squab-weight-grams') as HTMLInputElement;
    const dateInput = document.getElementById('squab-weight-date') as HTMLInputElement;
    const noteInput = document.getElementById('squab-weight-note') as HTMLInputElement;

    const grams = parseFloat(weightInput?.value);
    const date = dateInput?.value || today;

    if (isNaN(grams) || grams <= 0) {
      showToast('يرجى إدخال وزن صحيح بالجرام', 'error');
      weightInput?.focus();
      return;
    }

    try {
      await addSquabWeight(squab.id, grams, date, noteInput?.value);
      showToast(`تم حفظ وزن ${grams} جرام وتوثيقه بسجل الزغلول`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل حفظ الوزن: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 15. تصحيح بيانات الزغلول (Correction with Audit Logging)
// -----------------------------------------------------------------
export function showEditSquabModal(
  squab: Squab,
  onSuccess: () => void
) {
  const { body, footer } = createModalBase(`تصحيح بيانات ${squab.codeNumber}`, icons.edit);

  body.innerHTML = `
    <div style="background-color:var(--primary-light);padding:10px 12px;border-radius:var(--radius-md);color:var(--primary);font-size:0.84rem;line-height:1.4;">
      <strong>قاعدة التصحيح:</strong> يمكن تصحيح تاريخ الفقس أو تاريخ النفوق؛ يُعاد حساب العمر تلقائيًا، ويُحفظ في سجل الأحداث القيمة القديمة والجديدة والسبب دون تكرار أي عدد.
    </div>

    <div class="form-group" style="margin-top:6px;">
      <label class="form-label">الرمز / الرقم التعريفي <span class="form-label-required">*</span></label>
      <input type="text" id="edit-squab-code" class="form-input" value="${squab.codeNumber}" />
    </div>

    <div class="form-group">
      <label class="form-label">تاريخ الفقس <span class="form-label-required">*</span></label>
      <input type="date" id="edit-squab-hatch-date" class="form-input" value="${squab.hatchDate}" />
      <span class="form-help">عند تغيير تاريخ الفقس، يُعاد حساب العمر تلقائياً في كل الشاشات.</span>
    </div>

    ${
      squab.status === 'deceased'
        ? `
      <div class="form-group">
        <label class="form-label">تاريخ النفوق</label>
        <input type="date" id="edit-squab-death-date" class="form-input" value="${squab.deathDate || ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">سبب النفوق</label>
        <input type="text" id="edit-squab-death-reason" class="form-input" value="${squab.deathReason || ''}" />
      </div>
    `
        : ''
    }

    <div class="form-group">
      <label class="form-label">المرض أو الإصابة (اختياري)</label>
      <input type="text" id="edit-squab-illness" class="form-input" value="${squab.illnessOrInjury || ''}" placeholder="اكتب المرض أو الإصابة إن وُجدت، أو اتركها فارغة" />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات عامة</label>
      <textarea id="edit-squab-notes" class="form-textarea">${squab.notes || ''}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التصحيح (إلزامي للتوثيق في سجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="edit-squab-reason" class="form-input" placeholder="مثال: تصحيح تاريخ الفقس الحقيقي، إضافة تفاصيل الإصابة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save">حفظ التصحيح وتوثيقه</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save')?.addEventListener('click', async () => {
    const codeInput = document.getElementById('edit-squab-code') as HTMLInputElement;
    const hatchDateInput = document.getElementById('edit-squab-hatch-date') as HTMLInputElement;
    const deathDateInput = document.getElementById('edit-squab-death-date') as HTMLInputElement | null;
    const deathReasonInput = document.getElementById('edit-squab-death-reason') as HTMLInputElement | null;
    const illnessInput = document.getElementById('edit-squab-illness') as HTMLInputElement;
    const notesInput = document.getElementById('edit-squab-notes') as HTMLTextAreaElement;
    const reasonInput = document.getElementById('edit-squab-reason') as HTMLInputElement;

    const codeNumber = codeInput?.value.trim();
    const hatchDate = hatchDateInput?.value;
    const reason = reasonInput?.value.trim();

    if (!codeNumber) {
      showToast('يرجى إدخال الرقم التعريفي للزغلول', 'error');
      codeInput?.focus();
      return;
    }
    if (!hatchDate) {
      showToast('يرجى تحديد تاريخ الفقس', 'error');
      hatchDateInput?.focus();
      return;
    }
    if (!reason) {
      showToast('يرجى كتابة سبب التصحيح لتوثيق الحدث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await updateSquab(
        squab.id,
        {
          codeNumber,
          hatchDate,
          deathDate: deathDateInput ? deathDateInput.value : undefined,
          deathReason: deathReasonInput ? deathReasonInput.value : undefined,
          illnessOrInjury: illnessInput ? illnessInput.value : undefined,
          notes: notesInput ? notesInput.value : undefined,
        },
        reason
      );
      showToast('تم تصحيح بيانات الزغلول وتحديث العمر وتوثيق الحدث بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التصحيح: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 16. نقل الزغاليل إلى سلاكات التجميع (Transfer to Collection Modal) - المرحلة الثالثة
// -----------------------------------------------------------------
export async function showTransferToCollectionModal(
  originCoopId: string,
  onSuccess: () => void
) {
  const [allSquabs, allCoops, pairs, originCoop] = await Promise.all([
    getSquabs(),
    getCoops(),
    getPairs(),
    getCoop(originCoopId),
  ]);

  // الزغاليل الحية في هذه السلاكة فقط
  const liveSquabsInCoop = allSquabs.filter(
    (s) => (s.currentLocationId === originCoopId || (!s.currentLocationId && s.originCoopId === originCoopId)) &&
           s.status === 'alive_production'
  );

  // ترتيب الزغاليل: الأكبر عمراً (20 يوماً فأكثر) أولاً
  liveSquabsInCoop.sort((a, b) => {
    const ageA = getSquabAge(a.hatchDate);
    const ageB = getSquabAge(b.hatchDate);
    return ageB - ageA;
  });

  const collectionCoops = allCoops.filter((c) => c.type === 'collection' && c.active);

  const { body, footer } = createModalBase('نقل زغاليل إلى سلاكة تجميع', icons.truck);
  const today = getTodayDate();

  if (liveSquabsInCoop.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icons.squab}</div>
        <div class="empty-title">لا توجد زغاليل حية جاهزة للنقل في هذه السلاكة</div>
        <div class="empty-desc">يجب أن تحتوي السلاكة على زغاليل حية في الإنتاج لتتمكن من نقلها.</div>
      </div>
    `;
    footer.innerHTML = `
      <button type="button" class="btn btn-primary btn-lg" id="btn-close" style="width:100%;">إغلاق</button>
    `;
    footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
    return;
  }

  if (collectionCoops.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icons.alert}</div>
        <div class="empty-title">لا توجد سلاكات تجميع نشطة</div>
        <div class="empty-desc">يجب أولاً إضافة سلاكة من نوع "تجميع" في المزرعة لتتمكن من استقبال الزغاليل.</div>
      </div>
    `;
    footer.innerHTML = `
      <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
      <button type="button" class="btn btn-primary btn-lg" id="btn-add-collection-coop">إضافة سلاكة تجميع الآن</button>
    `;
    footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
    footer.querySelector('#btn-add-collection-coop')?.addEventListener('click', () => {
      closeModal();
      showAddCoopModal(onSuccess);
    });
    return;
  }

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.85rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:3px;">
      <div>السلاكة الحالية: <strong>سلاكة ${originCoop ? originCoop.number : ''} (إنتاج)</strong></div>
      <div>مبدأ أساسي: <strong>لا يُنشأ زغلول جديد عند النقل، بل ينتقل نفس السجل وتستمر هويته وعمره الحقيقي.</strong></div>
    </div>

    <!-- اختيار سلاكة التجميع وتاريخ النقل -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;">
      <div class="form-group">
        <label class="form-label">سلاكة التجميع الهدف <span class="form-label-required">*</span></label>
        <select id="select-collection-coop" class="form-select">
          ${collectionCoops
            .map((c) => `<option value="${c.id}">سلاكة ${c.number} (تجميع)</option>`)
            .join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">تاريخ النقل <span class="form-label-required">*</span></label>
        <input type="date" id="input-transfer-date" class="form-input" value="${today}" />
      </div>
    </div>

    <!-- قائمة الزغاليل المتاحة للاختيار -->
    <div class="form-group">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <label class="form-label" style="margin-bottom:0;">اختر الزغاليل المراد نقلها:</label>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-sm btn-outline" id="btn-select-all" style="padding:4px 8px;font-size:0.75rem;">تحديد الكل</button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-deselect-all" style="padding:4px 8px;font-size:0.75rem;">إلغاء التحديد</button>
        </div>
      </div>

      <div id="transfer-squabs-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-left:2px;padding-right:2px;">
        ${liveSquabsInCoop
          .map((squab) => {
            const age = getSquabAge(squab.hatchDate);
            const isReady = age >= 20;
            const pair = pairs.find((p) => p.id === squab.pairId);

            return `
            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;background-color:#FFFFFF;border:1px solid ${isReady ? '#A7F3D0' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:10px 12px;cursor:pointer;transition:all 0.15s ease;">
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="checkbox" class="squab-checkbox" value="${squab.id}" ${isReady ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary);cursor:pointer;" />
                <div style="display:flex;flex-direction:column;gap:2px;">
                  <div style="font-weight:700;font-size:0.92rem;display:flex;align-items:center;gap:6px;">
                    ${squab.codeNumber}
                    <span class="badge" style="background-color:${isReady ? '#DCFCE7' : '#FEF3C7'};color:${isReady ? '#15803D' : '#92400E'};font-size:0.72rem;">
                      ${isReady ? 'جاهز للنقل (عمر ' + age + ' يوم)' : 'عمر ' + age + ' يوم (أقل من 20)'}
                    </span>
                  </div>
                  <div style="font-size:0.78rem;color:var(--text-secondary);">
                    الزوج: ${pair ? pair.name : '—'} • تاريخ الفقس: ${formatDateArabic(squab.hatchDate)}
                  </div>
                </div>
              </div>

              ${
                !isReady
                  ? `<span style="font-size:0.72rem;color:#B45309;font-weight:600;text-align:left;">يُسمح بالنقل مع التنبيه</span>`
                  : ''
              }
            </label>
          `;
          })
          .join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات الدفعة (اختياري)</label>
      <input type="text" id="transfer-note" class="form-input" placeholder="مثال: دفعة زاجل، أوزان ممتازة، سلالة معينة..." />
    </div>
  `;

  // Select all / Deselect all
  body.querySelector('#btn-select-all')?.addEventListener('click', () => {
    body.querySelectorAll<HTMLInputElement>('.squab-checkbox').forEach((cb) => (cb.checked = true));
  });
  body.querySelector('#btn-deselect-all')?.addEventListener('click', () => {
    body.querySelectorAll<HTMLInputElement>('.squab-checkbox').forEach((cb) => (cb.checked = false));
  });

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-transfer">تأكيد النقل وإنشاء الدفعة</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-transfer')?.addEventListener('click', async () => {
    const selectedCheckboxes = body.querySelectorAll<HTMLInputElement>('.squab-checkbox:checked');
    const squabIds = Array.from(selectedCheckboxes).map((cb) => cb.value);

    if (squabIds.length === 0) {
      showToast('يرجى تحديد زغلول واحد على الأقل للنقل', 'error');
      return;
    }

    const coopSelect = body.querySelector('#select-collection-coop') as HTMLSelectElement;
    const dateInput = body.querySelector('#input-transfer-date') as HTMLInputElement;
    const noteInput = body.querySelector('#transfer-note') as HTMLInputElement;

    const collectionCoopId = coopSelect?.value;
    const transferDate = dateInput?.value || today;

    // فحص ما إذا كان هناك زغاليل أقل من 20 يوماً للتنبيه
    const underageSquabs = liveSquabsInCoop.filter(
      (s) => squabIds.includes(s.id) && getSquabAge(s.hatchDate) < 20
    );

    try {
      const { batch } = await transferSquabsToCollection({
        squabIds,
        collectionCoopId,
        transferDate,
        note: noteInput?.value,
      });

      const msg = underageSquabs.length > 0
        ? `تم نقل ${squabIds.length} زغلول بنجاح إلى ${batch.batchNumber} (منها ${underageSquabs.length} زغلول أقل من 20 يوم)`
        : `تم نقل ${squabIds.length} زغلول بنجاح وإنشاء ${batch.batchNumber}`;

      showToast(msg, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل عملية النقل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 17. تسجيل البيع (Record Sale Modal) - المرحلة الثالثة
// -----------------------------------------------------------------
export async function showRecordSaleModal(
  batchId?: string,
  preSelectedSquabIds: string[] = [],
  onSuccess: () => void = () => {}
) {
  const [allSquabs, pairs, batches] = await Promise.all([
    getSquabs(),
    getPairs(),
    getBatches(),
  ]);

  // تصفية الزغاليل المؤهلة للبيع فقط: الحية في التجميع أو الإنتاج (استبعاد النافق والمباع)
  let eligibleSquabs = allSquabs.filter(
    (s) => s.status === 'transferred_collection' || s.status === 'alive_production'
  );

  if (batchId) {
    eligibleSquabs = eligibleSquabs.filter((s) => s.batchId === batchId);
  }

  // ترتيب حسب العمر (الأكبر سناً أولاً لتسهيل اختيار الأقدم)
  eligibleSquabs.sort((a, b) => new Date(a.hatchDate).getTime() - new Date(b.hatchDate).getTime());

  const { body, footer } = createModalBase('تسجيل بيع زغاليل', icons.cash);
  const today = getTodayDate();

  if (eligibleSquabs.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icons.cash}</div>
        <div class="empty-title">لا توجد زغاليل حية متاحة للبيع في هذه القائمة</div>
        <div class="empty-desc">تم بيع جميع زغاليل هذه المجموعة أو أنها مسجلة كنافقة.</div>
      </div>
    `;
    footer.innerHTML = `
      <button type="button" class="btn btn-primary btn-lg" id="btn-close" style="width:100%;">إغلاق</button>
    `;
    footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
    return;
  }

  body.innerHTML = `
    <!-- شرح القواعد الصارمة للبيع -->
    <div style="background-color:#EBF2ED;border:1px solid #C7E4D0;padding:10px 12px;border-radius:var(--radius-md);color:var(--primary);font-size:0.84rem;line-height:1.4;">
      <strong>قواعد البيع:</strong> يتم تحديد الزغاليل بهوياتها الفردية، ويُسمح بأي عدد فردي دون تقريب لأزواج. لا يُسجل إيراد افتراضي، بل المبلغ الفعلي فقط.
    </div>

    <!-- مساعد اختيار الأقدم تلقائياً -->
    <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div style="font-weight:700;font-size:0.86rem;color:var(--text-main);display:flex;align-items:center;gap:6px;">
        ${icons.clock} اختيار الأقدم تلقائياً:
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="number" id="input-oldest-count" class="form-input" min="1" max="${eligibleSquabs.length}" value="${Math.min(2, eligibleSquabs.length)}" style="width:70px;padding:6px;text-align:center;" />
        <button type="button" class="btn btn-sm btn-outline" id="btn-select-oldest" style="font-weight:700;">تحديد</button>
        <button type="button" class="btn btn-sm btn-outline" id="btn-clear-selection" style="font-size:0.75rem;">مسح</button>
      </div>
    </div>

    <!-- قائمة اختيار الزغاليل الفردية -->
    <div class="form-group" style="margin-top:6px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <label class="form-label" style="margin-bottom:0;">الزغاليل المحددة للبيع (<span id="selected-squabs-count">0</span> زغلول):</label>
        <span style="font-size:0.75rem;color:var(--text-muted);">الأكبر عمراً مرتب في الأعلى</span>
      </div>

      <div id="sale-squabs-list" style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;">
        ${eligibleSquabs
          .map((squab) => {
            const age = getSquabAge(squab.hatchDate);
            const pair = pairs.find((p) => p.id === squab.pairId);
            const latestWeight = squab.weights && squab.weights.length > 0 ? squab.weights[squab.weights.length - 1].weightGrams : null;
            const isChecked = preSelectedSquabIds.includes(squab.id);

            return `
            <label style="display:flex;align-items:center;justify-content:space-between;gap:8px;background-color:#FFFFFF;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 12px;cursor:pointer;">
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" class="sale-squab-cb" value="${squab.id}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer;" />
                <div style="display:flex;flex-direction:column;gap:2px;">
                  <div style="font-weight:700;font-size:0.9rem;">
                    ${squab.codeNumber} • <span style="color:${age >= 30 ? '#15803D' : '#92400E'};">عمر ${age} يوم</span>
                  </div>
                  <div style="font-size:0.76rem;color:var(--text-secondary);">
                    الزوج: ${pair ? pair.name : '—'} ${latestWeight ? `• آخر وزن: ${latestWeight} جم` : ''}
                  </div>
                </div>
              </div>

              ${age >= 30 ? `<span class="badge badge-success" style="font-size:0.7rem;">عمر بيع 30+</span>` : ''}
            </label>
          `;
          })
          .join('')}
      </div>
    </div>

    <!-- تفاصيل البيع والأسعار المحسوبة حياً -->
    <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:10px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">تاريخ البيع <span class="form-label-required">*</span></label>
          <input type="date" id="input-sale-date" class="form-input" value="${today}" />
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">المشتري (اختياري)</label>
          <input type="text" id="input-sale-buyer" class="form-input" placeholder="اسم التاجر أو العميل..." />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">سعر الزغلول الواحد (ج.م) <span class="form-label-required">*</span></label>
          <input type="number" id="input-price-per-squab" class="form-input" min="1" step="1" placeholder="مثال: 60 أو 75..." />
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">المبلغ الإجمالي (ج.م) <span class="form-label-required">*</span></label>
          <input type="number" id="input-total-sale-amount" class="form-input" min="1" step="1" placeholder="يُحسب تلقائياً..." />
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">ملاحظات البيع (اختياري)</label>
        <input type="text" id="input-sale-notes" class="form-input" placeholder="مثال: تسليم عند باب المزرعة، دفع نقدي..." />
      </div>
    </div>
  `;

  // دوال احتساب الأسعار الديناميكية المتبادلة
  const checkboxes = body.querySelectorAll<HTMLInputElement>('.sale-squab-cb');
  const countSpan = body.querySelector('#selected-squabs-count') as HTMLElement;
  const pricePerSquabInput = body.querySelector('#input-price-per-squab') as HTMLInputElement;
  const totalAmountInput = body.querySelector('#input-total-sale-amount') as HTMLInputElement;

  function updateCountAndTotals() {
    const selected = body.querySelectorAll<HTMLInputElement>('.sale-squab-cb:checked');
    const count = selected.length;
    if (countSpan) countSpan.textContent = String(count);

    const pricePerSquab = parseFloat(pricePerSquabInput?.value);
    if (!isNaN(pricePerSquab) && count > 0) {
      totalAmountInput.value = String(Math.round(pricePerSquab * count));
    } else if (count === 0) {
      totalAmountInput.value = '0';
    }
  }

  checkboxes.forEach((cb) => {
    cb.addEventListener('change', updateCountAndTotals);
  });

  pricePerSquabInput?.addEventListener('input', () => {
    const selected = body.querySelectorAll<HTMLInputElement>('.sale-squab-cb:checked');
    const count = selected.length;
    const price = parseFloat(pricePerSquabInput.value);
    if (!isNaN(price) && count > 0) {
      totalAmountInput.value = String(Math.round(price * count));
    }
  });

  totalAmountInput?.addEventListener('input', () => {
    const selected = body.querySelectorAll<HTMLInputElement>('.sale-squab-cb:checked');
    const count = selected.length;
    const total = parseFloat(totalAmountInput.value);
    if (!isNaN(total) && count > 0) {
      pricePerSquabInput.value = (total / count).toFixed(1);
    }
  });

  // مساعد اختيار الأقدم تلقائياً
  body.querySelector('#btn-select-oldest')?.addEventListener('click', () => {
    const countInput = body.querySelector('#input-oldest-count') as HTMLInputElement;
    const n = parseInt(countInput?.value, 10) || 1;
    checkboxes.forEach((cb, index) => {
      cb.checked = index < n;
    });
    updateCountAndTotals();
  });

  body.querySelector('#btn-clear-selection')?.addEventListener('click', () => {
    checkboxes.forEach((cb) => (cb.checked = false));
    updateCountAndTotals();
  });

  // تحديث أولي
  updateCountAndTotals();

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-sale">تأكيد وتسجيل البيع</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-sale')?.addEventListener('click', async () => {
    const selectedCbs = body.querySelectorAll<HTMLInputElement>('.sale-squab-cb:checked');
    const selectedIds = Array.from(selectedCbs).map((cb) => cb.value);

    if (selectedIds.length === 0) {
      showToast('يرجى تحديد زغلول واحد على الأقل للبيع', 'error');
      return;
    }

    const pricePerSquab = parseFloat(pricePerSquabInput?.value);
    const totalAmount = parseFloat(totalAmountInput?.value);

    if (isNaN(totalAmount) || totalAmount <= 0) {
      showToast('يرجى إدخال سعر صحيح للبيع', 'error');
      pricePerSquabInput?.focus();
      return;
    }

    const effectivePriceEach = !isNaN(pricePerSquab) && pricePerSquab > 0
      ? pricePerSquab
      : totalAmount / selectedIds.length;

    const dateInput = body.querySelector('#input-sale-date') as HTMLInputElement;
    const buyerInput = body.querySelector('#input-sale-buyer') as HTMLInputElement;
    const notesInput = body.querySelector('#input-sale-notes') as HTMLInputElement;

    const saleItems = selectedIds.map((id) => ({
      squabId: id,
      price: Math.round(effectivePriceEach * 100) / 100,
    }));

    try {
      const { sale } = await recordSale({
        items: saleItems,
        date: dateInput?.value || today,
        buyer: buyerInput?.value,
        note: notesInput?.value,
      });

      showToast(`تم تسجيل عملية البيع بنجاح بمبلغ ${sale.totalAmount} ج.م لعدد ${saleItems.length} زغلول`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل البيع: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 18. تأجيل موعد البيع (Postpone Sale Modal) - المرحلة الثالثة
// -----------------------------------------------------------------
export function showPostponeSaleModal(
  squabs: Squab[],
  batchId?: string,
  onSuccess: () => void = () => {}
) {
  const { body, footer } = createModalBase('تأجيل موعد البيع', icons.clock);
  const today = getTodayDate();
  const defaultPostponeDate = addDays(today, 5);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.85rem;color:var(--text-secondary);line-height:1.4;">
      <strong>تأكيد قواعد النظام:</strong> التأجيل لا يغير تاريخ الفقس ولا تاريخ النقل ولا العمر. العمر يستمر صحيحاً بالأيام من تاريخ الفقس.
    </div>

    <!-- اختيار النطاق: كل الدفعة أو زغاليل محددة -->
    <div class="form-group" style="margin-top:6px;">
      <label class="form-label">الزغاليل المشمولة بالتأجيل (${squabs.length} زغلول):</label>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto;">
        ${squabs
          .map(
            (s) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:0.88rem;background-color:#FFFFFF;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:6px 10px;cursor:pointer;">
            <input type="checkbox" class="postpone-cb" value="${s.id}" checked style="width:16px;height:16px;accent-color:var(--primary);" />
            <span>${s.codeNumber} (عمر ${getSquabAge(s.hatchDate)} يوم)</span>
          </label>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- تاريخ التأجيل مع أزرار سريعة -->
    <div class="form-group">
      <label class="form-label">تأجيل البيع إلى تاريخ <span class="form-label-required">*</span></label>
      <input type="date" id="input-postpone-date" class="form-input" value="${defaultPostponeDate}" />
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button type="button" class="btn btn-sm btn-outline btn-quick-date" data-days="3">+3 أيام</button>
        <button type="button" class="btn btn-sm btn-outline btn-quick-date" data-days="5">+5 أيام</button>
        <button type="button" class="btn btn-sm btn-outline btn-quick-date" data-days="7">+ أسبوع</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التأجيل (اختياري)</label>
      <input type="text" id="input-postpone-reason" class="form-input" placeholder="مثال: مراجعة الوزن - وزن خفيف، طلب المشتري..." />
    </div>
  `;

  const dateInput = body.querySelector('#input-postpone-date') as HTMLInputElement;
  body.querySelectorAll('.btn-quick-date').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = parseInt((btn as HTMLElement).dataset.days || '5', 10);
      if (dateInput) dateInput.value = addDays(today, days);
    });
  });

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-postpone">تأكيد تأجيل البيع</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-postpone')?.addEventListener('click', async () => {
    const selected = body.querySelectorAll<HTMLInputElement>('.postpone-cb:checked');
    const squabIds = Array.from(selected).map((cb) => cb.value);

    if (squabIds.length === 0) {
      showToast('يرجى تحديد زغلول واحد على الأقل', 'error');
      return;
    }

    const postponedDate = dateInput?.value;
    const reasonInput = body.querySelector('#input-postpone-reason') as HTMLInputElement;

    if (!postponedDate) {
      showToast('يرجى تحديد تاريخ التأجيل', 'error');
      return;
    }

    try {
      await postponeSquabsSale(squabIds, postponedDate, reasonInput?.value);
      showToast(`تم تأجيل موعد البيع لـ ${squabIds.length} زغلول إلى ${formatDateArabic(postponedDate)}`, 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تأجيل البيع: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 19. تصحيح تاريخ النقل (Correct Transfer Date Modal)
// -----------------------------------------------------------------
export async function showCorrectTransferDateModal(
  batch: Batch,
  onSuccess: () => void = () => {}
) {
  const squabsInBatch = await getSquabsByBatch(batch.id);
  const { body, footer } = createModalBase(`تصحيح تاريخ نقل ${batch.batchNumber}`, icons.edit);

  body.innerHTML = `
    <div style="background-color:var(--primary-light);padding:10px 12px;border-radius:var(--radius-md);color:var(--primary);font-size:0.84rem;line-height:1.4;">
      تعديل تاريخ النقل يعيد احتساب (العمر عند النقل) تلقائياً لجميع زغاليل الدفعة (${squabsInBatch.length} زغلول) ويوثق ذلك في سجل الأحداث.
    </div>

    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">تاريخ النقل الجديد <span class="form-label-required">*</span></label>
      <input type="date" id="input-new-transfer-date" class="form-input" value="${batch.transferDate}" />
    </div>

    <div class="form-group">
      <label class="form-label">سبب التصحيح (إلزامي للتوثيق في سجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="input-transfer-correct-reason" class="form-input" placeholder="مثال: تصحيح خطأ إدخال تاريخ النقل الفعلي..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-correction">حفظ التصحيح وتوثيقه</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-correction')?.addEventListener('click', async () => {
    const dateInput = body.querySelector('#input-new-transfer-date') as HTMLInputElement;
    const reasonInput = body.querySelector('#input-transfer-correct-reason') as HTMLInputElement;

    const newDate = dateInput?.value;
    const reason = reasonInput?.value.trim();

    if (!newDate) {
      showToast('يرجى تحديد تاريخ النقل', 'error');
      return;
    }
    if (!reason) {
      showToast('يرجى كتابة سبب التصحيح لتوثيقه بسجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      const squabIds = squabsInBatch.map((s) => s.id);
      await correctTransferDate(squabIds, newDate, reason, batch.id);

      showToast('تم تصحيح تاريخ النقل وإعادة حساب الأعمار بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التصحيح: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 20. إلغاء أو تصحيح عملية البيع (Cancel / Correct Sale Modal)
// -----------------------------------------------------------------
export function showCancelSaleModal(
  sale: Sale,
  onSuccess: () => void = () => {}
) {
  const { body, footer } = createModalBase('إلغاء عملية بيع واستعادة الزغاليل', icons.history);

  body.innerHTML = `
    <div style="background-color:var(--danger-bg);padding:12px;border-radius:var(--radius-md);color:var(--danger);font-size:0.86rem;line-height:1.4;">
      <strong>تأكيد قاعدة التصحيح:</strong> إلغاء البيع يعيد الزغاليل المباعة إلى حالتها كزغاليل حية في سلاكتها/دفعتها، ويُخصم المبلغ من المبيعات، مع الاحتفاظ الكامل بسجل ما حدث في سجل الأحداث (Event Log).
    </div>

    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-top:6px;font-size:0.88rem;">
      <div>تاريخ البيع: <strong>${formatDateArabic(sale.date)}</strong></div>
      <div>المبلغ الإجمالي: <strong>${sale.totalAmount} ج.م</strong></div>
      ${sale.buyer ? `<div>المشتري: <strong>${sale.buyer}</strong></div>` : ''}
    </div>

    <div class="form-group" style="margin-top:8px;">
      <label class="form-label">سبب الإلغاء (إلزامي للتوثيق في سجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="input-cancel-sale-reason" class="form-input" placeholder="مثال: تراجع المشتري عن الاستلام، تسجيل بيع بالخطأ..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">تراجع</button>
    <button type="button" class="btn btn-danger btn-lg" id="btn-confirm-cancel-sale">تأكيد إلغاء البيع واستعادة الزغاليل</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-cancel-sale')?.addEventListener('click', async () => {
    const reasonInput = body.querySelector('#input-cancel-sale-reason') as HTMLInputElement;
    const reason = reasonInput?.value.trim();

    if (!reason) {
      showToast('يرجى توضيح سبب الإلغاء للتوثيق بسجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await cancelSale(sale.id, reason);
      showToast('تم إلغاء عملية البيع واستعادة الزغاليل وتوثيق الحدث بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل إلغاء البيع: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 21. إضافة وتعديل نوع العلف (Feed Type Modal)
// -----------------------------------------------------------------
export function showAddFeedTypeModal(
  feedTypeToEdit?: FeedType,
  onSuccess: () => void = () => {}
) {
  const isEdit = Boolean(feedTypeToEdit);
  const { body, footer } = createModalBase(
    isEdit ? 'تعديل نوع العلف' : 'إضافة نوع علف جديد',
    icons.grain
  );

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم نوع العلف <span class="form-label-required">*</span></label>
      <input type="text" id="input-feed-name" class="form-input" placeholder="مثال: علف بادي 21%، خلطة حبوب، ذرة صفراء..." value="${feedTypeToEdit ? feedTypeToEdit.name : ''}" />
    </div>

    <div class="form-group">
      <label class="form-label">حد التنبيه عند انخفاض المخزون (كجم) <span class="form-label-required">*</span></label>
      <input type="number" id="input-feed-threshold" class="form-input" min="0" step="1" placeholder="مثال: 50" value="${feedTypeToEdit ? feedTypeToEdit.alertThresholdKg : '25'}" />
      <span class="form-help">يظهر تنبيه في لوحة التحكم والمهام عندما يقل المخزون الفعلي عن هذا الرقم.</span>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات (اختياري)</label>
      <textarea id="input-feed-notes" class="form-textarea" placeholder="أي تفاصيل عن التركيبة أو المورد المفضل...">${feedTypeToEdit?.notes || ''}</textarea>
    </div>

    ${
      isEdit
        ? `
      <div class="form-group">
        <label class="form-label">سبب التعديل (إلزامي للتوثيق بسجل الأحداث) <span class="form-label-required">*</span></label>
        <input type="text" id="input-feed-reason" class="form-input" placeholder="سبب التعديل..." />
      </div>
    `
        : ''
    }
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-feed-type">${isEdit ? 'حفظ التعديل' : 'إضافة العلف'}</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-feed-type')?.addEventListener('click', async () => {
    const nameInput = body.querySelector('#input-feed-name') as HTMLInputElement;
    const threshInput = body.querySelector('#input-feed-threshold') as HTMLInputElement;
    const notesInput = body.querySelector('#input-feed-notes') as HTMLTextAreaElement;
    const reasonInput = body.querySelector('#input-feed-reason') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const threshold = Number(threshInput?.value);
    const notes = notesInput?.value.trim();

    if (!name) {
      showToast('يرجى إدخال اسم نوع العلف', 'error');
      nameInput?.focus();
      return;
    }
    if (isNaN(threshold) || threshold < 0) {
      showToast('يرجى تحديد حد تنبيه صحيح (صفر أو أكثر)', 'error');
      threshInput?.focus();
      return;
    }

    try {
      if (isEdit && feedTypeToEdit) {
        const reason = reasonInput?.value.trim();
        if (!reason) {
          showToast('يرجى توضيح سبب التعديل للتوثيق بسجل الأحداث', 'error');
          reasonInput?.focus();
          return;
        }
        await updateFeedType(feedTypeToEdit.id, { name, alertThresholdKg: threshold, notes }, reason);
        showToast('تم تعديل نوع العلف وتوثيقه بنجاح', 'success');
      } else {
        await addFeedType({ name, alertThresholdKg: threshold, notes });
        showToast('تم إضافة نوع العلف بنجاح', 'success');
      }
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل الحفظ: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 22. تسجيل شراء علف (Feed Purchase Modal) - ينشئ مصروفاً تلقائياً
// -----------------------------------------------------------------
export async function showRecordFeedPurchaseModal(
  preselectedFeedTypeId?: string,
  onSuccess: () => void = () => {}
) {
  const feedTypes = await getFeedTypes({ activeOnly: true });
  if (feedTypes.length === 0) {
    showToast('يرجى إضافة نوع علف واحد على الأقل أولاً قبل تسجيل الشراء', 'error');
    showAddFeedTypeModal(undefined, onSuccess);
    return;
  }

  const { body, footer } = createModalBase('شراء وتوريد علف للمخزون', icons.grain);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.86rem;line-height:1.4;">
      <strong>تكامل آلي:</strong> تسجيل شراء العلف هنا سيزيد كمية المخزون ويُنشئ تلقائيًا مصروفًا مرتبطًا به في قسم المصروفات بنفس التكلفة، لضمان عدم إدخال المصروف مرتين.
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">نوع العلف <span class="form-label-required">*</span></label>
      <select id="select-purchase-feed-type" class="form-select">
        ${feedTypes
          .map(
            (ft) =>
              `<option value="${ft.id}" ${ft.id === preselectedFeedTypeId ? 'selected' : ''}>${ft.name} (كجم)</option>`
          )
          .join('')}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">تاريخ الشراء <span class="form-label-required">*</span></label>
        <input type="date" id="input-purchase-date" class="form-input" value="${getTodayDate()}" />
      </div>

      <div class="form-group">
        <label class="form-label">الكمية المشتراة (كجم) <span class="form-label-required">*</span></label>
        <input type="number" id="input-purchase-qty" class="form-input" min="0.1" step="0.5" placeholder="مثال: 500" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">سعر الكيلو (ج.م) <span class="form-label-required">*</span></label>
        <input type="number" id="input-purchase-unit-price" class="form-input" min="0.01" step="0.25" placeholder="مثال: 18.5" />
      </div>

      <div class="form-group">
        <label class="form-label">إجمالي التكلفة (تلقائي)</label>
        <input type="text" id="input-purchase-total-cost" class="form-input" readonly value="0 ج.م" style="background-color:var(--surface-subtle);font-weight:bold;" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">اسم المورد / المحل (اختياري)</label>
      <input type="text" id="input-purchase-supplier" class="form-input" placeholder="مثال: شركة البركة للأعلاف..." />
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظات / رقم الفاتورة (اختياري)</label>
      <input type="text" id="input-purchase-reason" class="form-input" placeholder="مثال: فاتورة رقم 1024، شكائر 50 كجم..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-purchase">تسجيل الشراء والمصروف</button>
  `;

  const qtyInput = body.querySelector('#input-purchase-qty') as HTMLInputElement;
  const unitPriceInput = body.querySelector('#input-purchase-unit-price') as HTMLInputElement;
  const totalCostInput = body.querySelector('#input-purchase-total-cost') as HTMLInputElement;

  const updateTotal = () => {
    const q = Number(qtyInput?.value) || 0;
    const p = Number(unitPriceInput?.value) || 0;
    const total = Math.round(q * p * 100) / 100;
    if (totalCostInput) totalCostInput.value = `${total} ج.م`;
  };

  qtyInput?.addEventListener('input', updateTotal);
  unitPriceInput?.addEventListener('input', updateTotal);

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-purchase')?.addEventListener('click', async () => {
    const feedTypeId = (body.querySelector('#select-purchase-feed-type') as HTMLSelectElement)?.value;
    const date = (body.querySelector('#input-purchase-date') as HTMLInputElement)?.value;
    const quantity = Number(qtyInput?.value);
    const unitPrice = Number(unitPriceInput?.value);
    const supplier = (body.querySelector('#input-purchase-supplier') as HTMLInputElement)?.value.trim();
    const reason = (body.querySelector('#input-purchase-reason') as HTMLInputElement)?.value.trim();

    if (!feedTypeId) {
      showToast('يرجى تحديد نوع العلف', 'error');
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      showToast('يرجى إدخال كمية صحيحة أكبر من الصفر', 'error');
      qtyInput?.focus();
      return;
    }
    if (isNaN(unitPrice) || unitPrice <= 0) {
      showToast('يرجى إدخال سعر صحيح للكيلو', 'error');
      unitPriceInput?.focus();
      return;
    }

    try {
      await recordFeedPurchase({
        feedTypeId,
        date,
        quantity,
        unitPrice,
        supplier: supplier || undefined,
        reason: reason || undefined,
      });

      showToast('تم تسجيل شراء العلف وإضافة المصروف بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التسجيل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 23. تعديل يدوي لمخزون العلف (Stock Manual Adjustment Modal)
// -----------------------------------------------------------------
export async function showStockManualAdjustmentModal(
  preselectedFeedTypeId?: string,
  onSuccess: () => void = () => {}
) {
  const feedTypes = await getFeedTypes({ activeOnly: true });
  if (feedTypes.length === 0) {
    showToast('لا توجد أنواع علف مسجلة', 'error');
    return;
  }

  const { body, footer } = createModalBase('تعديل يدوي لمخزون العلف (جرد / هدر / تصحيح)', icons.tune);

  body.innerHTML = `
    <div style="background-color:var(--warning-bg);color:var(--warning);padding:10px 12px;border-radius:var(--radius-md);font-size:0.86rem;line-height:1.4;">
      <strong>قاعدة التدقيق:</strong> أي تعديل يدوي يتطلب إدخال التاريخ والسبب الإلزامي، ويتم توثيقه كاملاً في سجل الأحداث (Event Log) ولا يتم مسحه أبداً.
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">نوع العلف <span class="form-label-required">*</span></label>
      <select id="select-adjust-feed-type" class="form-select">
        ${feedTypes
          .map(
            (ft) =>
              `<option value="${ft.id}" ${ft.id === preselectedFeedTypeId ? 'selected' : ''}>${ft.name}</option>`
          )
          .join('')}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">تاريخ التعديل / الجرد <span class="form-label-required">*</span></label>
        <input type="date" id="input-adjust-date" class="form-input" value="${getTodayDate()}" />
      </div>

      <div class="form-group">
        <label class="form-label">نوع حركة التعديل <span class="form-label-required">*</span></label>
        <select id="select-adjust-sign" class="form-select">
          <option value="subtract">خصم / عجز / هدر / تلف (-)</option>
          <option value="add">إضافة / فائض جرد (+)</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">كمية التعديل (كجم) <span class="form-label-required">*</span></label>
      <input type="number" id="input-adjust-qty" class="form-input" min="0.1" step="0.1" placeholder="مثال: 5.5" />
    </div>

    <div class="form-group">
      <label class="form-label">سبب التعديل (إلزامي للتوثيق في سجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="input-adjust-reason" class="form-input" placeholder="مثال: تسوية جرد نهاية الشهر، تلف شكارة بسبب الرطوبة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-adjust">تسجيل وتوثيق التعديل</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-adjust')?.addEventListener('click', async () => {
    const feedTypeId = (body.querySelector('#select-adjust-feed-type') as HTMLSelectElement)?.value;
    const date = (body.querySelector('#input-adjust-date') as HTMLInputElement)?.value;
    const sign = (body.querySelector('#select-adjust-sign') as HTMLSelectElement)?.value;
    const qtyInput = body.querySelector('#input-adjust-qty') as HTMLInputElement;
    const reasonInput = body.querySelector('#input-adjust-reason') as HTMLInputElement;

    const rawQty = Number(qtyInput?.value);
    const reason = reasonInput?.value.trim();

    if (!feedTypeId) {
      showToast('يرجى اختيار نوع العلف', 'error');
      return;
    }
    if (isNaN(rawQty) || rawQty <= 0) {
      showToast('يرجى إدخال كمية صحيحة أكبر من الصفر', 'error');
      qtyInput?.focus();
      return;
    }
    if (!reason) {
      showToast('يرجى توضيح سبب التعديل للتوثيق بسجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    const quantity = sign === 'subtract' ? -Math.abs(rawQty) : Math.abs(rawQty);

    try {
      await recordStockManualAdjustment({
        feedTypeId,
        date,
        quantity,
        reason,
      });

      showToast('تم تسجيل التعديل اليدوي وتحديث المخزون بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التسجيل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 24. إضافة معدل استهلاك علف يومي (Feed Rate Config Modal)
// -----------------------------------------------------------------
export function showAddFeedRateConfigModal(onSuccess: () => void = () => {}) {
  const { body, footer } = createModalBase('إضافة معدل استهلاك علف يومي جديد', icons.settings);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.86rem;line-height:1.4;">
      <strong>تأريخ المعدلات:</strong> المعدل المحدد يسري من تاريخ السريان المحدد وما بعده حتى يأتي معدل أحدث. الفترات السابقة تحتفظ بمعدلاتها كما هي تماماً.
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">تاريخ السريان <span class="form-label-required">*</span></label>
      <input type="date" id="input-rate-effective-date" class="form-input" value="${getTodayDate()}" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">معدل الفرد البالغ (جرام / يوم) <span class="form-label-required">*</span></label>
        <input type="number" id="input-rate-adult" class="form-input" min="1" step="1" placeholder="مثال: 40" value="40" />
        <span class="form-help">يُضرب في عدد الأفراد الحقيقي لكل زوج</span>
      </div>

      <div class="form-group">
        <label class="form-label">زغلول الإنتاج (جرام / يوم) <span class="form-label-required">*</span></label>
        <input type="number" id="input-rate-prod-squab" class="form-input" min="0" step="1" placeholder="مثال: 25" value="25" />
        <span class="form-help">حتى عمر الفطام والنقل</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">زغلول التجميع (جرام / يوم) <span class="form-label-required">*</span></label>
      <input type="number" id="input-rate-coll-squab" class="form-input" min="0" step="1" placeholder="مثال: 45" value="45" />
      <span class="form-help">من تاريخ النقل حتى البيع</span>
    </div>

    <div class="form-group">
      <label class="form-label">ملاحظة / سبب التغيير (اختياري)</label>
      <input type="text" id="input-rate-note" class="form-input" placeholder="مثال: تعديل شتوي للخلطة، بدء دورة تغذية مكثفة..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-rate">حفظ وسريان المعدل</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-rate')?.addEventListener('click', async () => {
    const dateInput = body.querySelector('#input-rate-effective-date') as HTMLInputElement;
    const adultInput = body.querySelector('#input-rate-adult') as HTMLInputElement;
    const prodInput = body.querySelector('#input-rate-prod-squab') as HTMLInputElement;
    const collInput = body.querySelector('#input-rate-coll-squab') as HTMLInputElement;
    const noteInput = body.querySelector('#input-rate-note') as HTMLInputElement;

    const effectiveFromDate = dateInput?.value;
    const adultGrams = Number(adultInput?.value);
    const prodSquabGrams = Number(prodInput?.value);
    const collSquabGrams = Number(collInput?.value);
    const note = noteInput?.value.trim();

    if (!effectiveFromDate) {
      showToast('يرجى تحديد تاريخ السريان', 'error');
      return;
    }
    if (isNaN(adultGrams) || adultGrams <= 0) {
      showToast('يرجى تحديد معدل صحيح للبالغ أكبر من الصفر', 'error');
      adultInput?.focus();
      return;
    }
    if (isNaN(prodSquabGrams) || prodSquabGrams < 0) {
      showToast('يرجى تحديد معدل صحيح لزغلول الإنتاج', 'error');
      prodInput?.focus();
      return;
    }
    if (isNaN(collSquabGrams) || collSquabGrams < 0) {
      showToast('يرجى تحديد معدل صحيح لزغلول التجميع', 'error');
      collInput?.focus();
      return;
    }

    try {
      await addFeedRateConfig({
        effectiveFromDate,
        adultGrams,
        prodSquabGrams,
        collSquabGrams,
        note: note || undefined,
      });

      showToast('تم حفظ معدل الاستهلاك وسيسري من التاريخ المحدد', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل حفظ المعدل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 25. إضافة وتعديل مصروف (Expense Modal)
// -----------------------------------------------------------------
export function showAddExpenseModal(
  prefill?: {
    accountingType?: AccountingType;
    category?: ExpenseCategory;
    amount?: number;
    description?: string;
  },
  onSuccess: () => void = () => {}
) {
  const { body, footer } = createModalBase('تسجيل مصروف جديد', icons.receipt);

  body.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">تاريخ المصروف <span class="form-label-required">*</span></label>
        <input type="date" id="input-expense-date" class="form-input" value="${getTodayDate()}" />
      </div>

      <div class="form-group">
        <label class="form-label">المبلغ (ج.م) <span class="form-label-required">*</span></label>
        <input type="number" id="input-expense-amount" class="form-input" min="0.01" step="0.5" placeholder="مثال: 250" value="${prefill?.amount || ''}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">النوع المحاسبي <span class="form-label-required">*</span></label>
        <select id="select-expense-accounting-type" class="form-select">
          <option value="operational" ${prefill?.accountingType === 'operational' ? 'selected' : ''}>تشغيلي (كهرباء، ماء، صيانة، تنظيف...)</option>
          <option value="production_cost" ${prefill?.accountingType === 'production_cost' ? 'selected' : ''}>تكلفة إنتاج (أدوية، فيتامينات، فرشة...)</option>
          <option value="establishment" ${prefill?.accountingType === 'establishment' ? 'selected' : ''}>تأسيس (شراء سلاكات، معدات، حمام أمهات...)</option>
          <option value="specific_operation" ${prefill?.accountingType === 'specific_operation' ? 'selected' : ''}>مرتبط بعملية محددة (نقل، تطهير خاص...)</option>
        </select>
        <span class="form-help">يحدد كيفية ظهور المصروف في حساب صافي التشغيل مقابل صافي الربح بعد التأسيس.</span>
      </div>

      <div class="form-group">
        <label class="form-label">التصنيف <span class="form-label-required">*</span></label>
        <select id="select-expense-category" class="form-select">
          <option value="feed">علف وحبوب</option>
          <option value="medication">أدوية وفيتامينات وتحصينات</option>
          <option value="equipment">معدات ومستلزمات</option>
          <option value="utilities">كهرباء ومياه ومرافق</option>
          <option value="maintenance">صيانة وتطهير ونظافة</option>
          <option value="other">مصروفات أخرى</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">البيان / وصف المصروف <span class="form-label-required">*</span></label>
      <input type="text" id="input-expense-desc" class="form-input" placeholder="مثال: شراء فيتامين هـ + سيلينيوم، فاتورة كهرباء شهر مايو..." value="${prefill?.description || ''}" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">الجهة المستفيدة / المدفوع له (اختياري)</label>
        <input type="text" id="input-expense-payee" class="form-input" placeholder="مثال: الصيدلية البيطرية، فني الصيانة..." />
      </div>

      <div class="form-group">
        <label class="form-label">ملاحظات (اختياري)</label>
        <input type="text" id="input-expense-note" class="form-input" placeholder="أي تفاصيل إضافية..." />
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-expense">تسجيل المصروف</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-expense')?.addEventListener('click', async () => {
    const date = (body.querySelector('#input-expense-date') as HTMLInputElement)?.value;
    const amountInput = body.querySelector('#input-expense-amount') as HTMLInputElement;
    const accountingType = (body.querySelector('#select-expense-accounting-type') as HTMLSelectElement)?.value as AccountingType;
    const category = (body.querySelector('#select-expense-category') as HTMLSelectElement)?.value as ExpenseCategory;
    const descInput = body.querySelector('#input-expense-desc') as HTMLInputElement;
    const payee = (body.querySelector('#input-expense-payee') as HTMLInputElement)?.value.trim();
    const note = (body.querySelector('#input-expense-note') as HTMLInputElement)?.value.trim();

    const amount = Number(amountInput?.value);
    const description = descInput?.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      amountInput?.focus();
      return;
    }
    if (!description) {
      showToast('يرجى كتابة بيان ووصف المصروف', 'error');
      descInput?.focus();
      return;
    }

    try {
      await addExpense({
        date,
        amount,
        accountingType,
        category,
        description,
        payee: payee || undefined,
        note: note || undefined,
      });

      showToast('تم تسجيل المصروف بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل المصروف: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

export function showEditExpenseModal(
  expense: Expense,
  onSuccess: () => void = () => {}
) {
  const { body, footer } = createModalBase('تعديل سجل المصروف', icons.receipt);

  body.innerHTML = `
    ${
      expense.feedPurchaseId
        ? `
      <div style="background-color:var(--info-bg);color:var(--info);padding:10px 12px;border-radius:var(--radius-md);font-size:0.86rem;margin-bottom:10px;">
        هذا المصروف مرتبط بحركة شراء علف تلقائية.
      </div>
    `
        : ''
    }

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">تاريخ المصروف <span class="form-label-required">*</span></label>
        <input type="date" id="input-edit-expense-date" class="form-input" value="${expense.date}" />
      </div>

      <div class="form-group">
        <label class="form-label">المبلغ (ج.م) <span class="form-label-required">*</span></label>
        <input type="number" id="input-edit-expense-amount" class="form-input" min="0.01" step="0.5" value="${expense.amount}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">النوع المحاسبي <span class="form-label-required">*</span></label>
        <select id="select-edit-expense-accounting-type" class="form-select">
          <option value="operational" ${expense.accountingType === 'operational' ? 'selected' : ''}>تشغيلي</option>
          <option value="production_cost" ${expense.accountingType === 'production_cost' ? 'selected' : ''}>تكلفة إنتاج</option>
          <option value="establishment" ${expense.accountingType === 'establishment' ? 'selected' : ''}>تأسيس</option>
          <option value="specific_operation" ${expense.accountingType === 'specific_operation' ? 'selected' : ''}>مرتبط بعملية محددة</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">التصنيف <span class="form-label-required">*</span></label>
        <select id="select-edit-expense-category" class="form-select">
          <option value="feed" ${expense.category === 'feed' ? 'selected' : ''}>علف وحبوب</option>
          <option value="medication" ${expense.category === 'medication' ? 'selected' : ''}>أدوية وفيتامينات</option>
          <option value="equipment" ${expense.category === 'equipment' ? 'selected' : ''}>معدات ومستلزمات</option>
          <option value="utilities" ${expense.category === 'utilities' ? 'selected' : ''}>كهرباء ومياه ومرافق</option>
          <option value="maintenance" ${expense.category === 'maintenance' ? 'selected' : ''}>صيانة وتطهير</option>
          <option value="other" ${expense.category === 'other' ? 'selected' : ''}>مصروفات أخرى</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">البيان / وصف المصروف <span class="form-label-required">*</span></label>
      <input type="text" id="input-edit-expense-desc" class="form-input" value="${expense.description}" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">الجهة المستفيدة (اختياري)</label>
        <input type="text" id="input-edit-expense-payee" class="form-input" value="${expense.payee || ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">ملاحظات (اختياري)</label>
        <input type="text" id="input-edit-expense-note" class="form-input" value="${expense.note || ''}" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">سبب التعديل (إلزامي للتوثيق بسجل الأحداث) <span class="form-label-required">*</span></label>
      <input type="text" id="input-edit-expense-reason" class="form-input" placeholder="سبب تعديل هذا المصروف..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-edit-expense">حفظ التعديل</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-edit-expense')?.addEventListener('click', async () => {
    const date = (body.querySelector('#input-edit-expense-date') as HTMLInputElement)?.value;
    const amountInput = body.querySelector('#input-edit-expense-amount') as HTMLInputElement;
    const accountingType = (body.querySelector('#select-edit-expense-accounting-type') as HTMLSelectElement)?.value as AccountingType;
    const category = (body.querySelector('#select-edit-expense-category') as HTMLSelectElement)?.value as ExpenseCategory;
    const descInput = body.querySelector('#input-edit-expense-desc') as HTMLInputElement;
    const payee = (body.querySelector('#input-edit-expense-payee') as HTMLInputElement)?.value.trim();
    const note = (body.querySelector('#input-edit-expense-note') as HTMLInputElement)?.value.trim();
    const reasonInput = body.querySelector('#input-edit-expense-reason') as HTMLInputElement;

    const amount = Number(amountInput?.value);
    const description = descInput?.value.trim();
    const reason = reasonInput?.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      amountInput?.focus();
      return;
    }
    if (!description) {
      showToast('يرجى كتابة بيان ووصف المصروف', 'error');
      descInput?.focus();
      return;
    }
    if (!reason) {
      showToast('يرجى توضيح سبب التعديل للتوثيق بسجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await updateExpense(
        expense.id,
        {
          date,
          amount,
          accountingType,
          category,
          description,
          payee: payee || undefined,
          note: note || undefined,
        },
        reason
      );

      showToast('تم تعديل المصروف وتوثيقه بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تعديل المصروف: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 26. إضافة إيراد يدوي (بيع حمام بالغ أو إيرادات أخرى)
// -----------------------------------------------------------------
export function showAddManualRevenueModal(onSuccess: () => void = () => {}) {
  const { body, footer } = createModalBase('تسجيل إيراد إضافي (بالغ / أخرى)', icons.trendingUp);

  body.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">تاريخ الإيراد <span class="form-label-required">*</span></label>
        <input type="date" id="input-revenue-date" class="form-input" value="${getTodayDate()}" />
      </div>

      <div class="form-group">
        <label class="form-label">المبلغ (ج.م) <span class="form-label-required">*</span></label>
        <input type="number" id="input-revenue-amount" class="form-input" min="0.01" step="0.5" placeholder="مثال: 450" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">تصنيف الإيراد <span class="form-label-required">*</span></label>
      <select id="select-revenue-category" class="form-select">
        <option value="adult_sale">بيع حمام بالغ (أمهات / فرز / ذكور أو إناث فردية)</option>
        <option value="other">إيراد آخر (سماد وزرق حمام، مخلفات، ريش، خدمات...)</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">البيان / الوصف <span class="form-label-required">*</span></label>
      <input type="text" id="input-revenue-desc" class="form-input" placeholder="مثال: بيع زوج حمام أمهات مستبعد، بيع شيكارة زرق حمام..." />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">المشتري (اختياري)</label>
        <input type="text" id="input-revenue-buyer" class="form-input" placeholder="اسم المشتري..." />
      </div>

      <div class="form-group">
        <label class="form-label">ملاحظات (اختياري)</label>
        <input type="text" id="input-revenue-note" class="form-input" placeholder="أي ملاحظات إضافية..." />
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-revenue">تسجيل الإيراد</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-revenue')?.addEventListener('click', async () => {
    const date = (body.querySelector('#input-revenue-date') as HTMLInputElement)?.value;
    const amountInput = body.querySelector('#input-revenue-amount') as HTMLInputElement;
    const category = (body.querySelector('#select-revenue-category') as HTMLSelectElement)?.value as ManualRevenueCategory;
    const descInput = body.querySelector('#input-revenue-desc') as HTMLInputElement;
    const buyer = (body.querySelector('#input-revenue-buyer') as HTMLInputElement)?.value.trim();
    const note = (body.querySelector('#input-revenue-note') as HTMLInputElement)?.value.trim();

    const amount = Number(amountInput?.value);
    const description = descInput?.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      amountInput?.focus();
      return;
    }
    if (!description) {
      showToast('يرجى كتابة بيان الإيراد', 'error');
      descInput?.focus();
      return;
    }

    try {
      await addManualRevenue({
        date,
        amount,
        category,
        description,
        buyer: buyer || undefined,
        note: note || undefined,
      });

      showToast('تم تسجيل الإيراد بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل تسجيل الإيراد: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -----------------------------------------------------------------
// 27. تعديل عدد طيور الزوج الفعلي مع تاريخ السريان والسبب
// -----------------------------------------------------------------
export function showPairBirdCountChangeModal(
  pair: Pair,
  onSuccess: () => void = () => {}
) {
  const currentCount = pair.currentBirdCount ?? 2;
  const { body, footer } = createModalBase(`تعديل عدد طيور الزوج: ${pair.name}`, icons.pair);

  body.innerHTML = `
    <div style="background-color:var(--surface-subtle);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.86rem;line-height:1.4;">
      <strong>تأريخ عدد الطيور:</strong> يؤثر هذا العدد على الحساب الحقيقي الدقيق لاستهلاك العلف اليومي، حيث يُحسب العلف بعدد الأفراد الفعلي لكل زوج في كل تاريخ، وليس برقم افتراضي ثابت.
    </div>

    <div class="form-group" style="margin-top:10px;">
      <label class="form-label">العدد الحالي المسجل: <strong>${currentCount} طير</strong></label>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">العدد الجديد الفعلي <span class="form-label-required">*</span></label>
        <select id="select-new-bird-count" class="form-select">
          <option value="2" ${currentCount === 2 ? 'selected' : ''}>طائران (فردان - ذكر وأنثى كامل)</option>
          <option value="1" ${currentCount === 1 ? 'selected' : ''}>طائر واحد (فردي - بعد نفوق أو بيع أحدهما)</option>
          <option value="0" ${currentCount === 0 ? 'selected' : ''}>صفر (لا يوجد طيور حالياً في الزوج)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">تاريخ السريان <span class="form-label-required">*</span></label>
        <input type="date" id="input-count-effective-date" class="form-input" value="${getTodayDate()}" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">السبب (إلزامي للتوثيق بسجل الأحداث وحسابات العلف) <span class="form-label-required">*</span></label>
      <input type="text" id="input-count-reason" class="form-input" placeholder="مثال: نفوق الأنثى، استبعاد الذكر وبيعه، إدخال أنثى جديدة للزوج..." />
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-count">حفظ وتوثيق التغيير</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-count')?.addEventListener('click', async () => {
    const newCount = Number((body.querySelector('#select-new-bird-count') as HTMLSelectElement)?.value);
    const effectiveDate = (body.querySelector('#input-count-effective-date') as HTMLInputElement)?.value;
    const reasonInput = body.querySelector('#input-count-reason') as HTMLInputElement;
    const reason = reasonInput?.value.trim();

    if (!effectiveDate) {
      showToast('يرجى تحديد تاريخ السريان', 'error');
      return;
    }
    if (!reason) {
      showToast('يرجى كتابة سبب التغيير لتوثيقه بسجل الأحداث', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await recordPairBirdCountChange(pair.id, effectiveDate, newCount, reason);
      showToast('تم حفظ تغيير عدد الطيور وتوثيق السجل بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل الحفظ: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -------------------------------------------------------------
// المرحلة الخامسة: نوافذ التنبيهات وترتيب الأزواج
// -------------------------------------------------------------

/**
 * نافذة تأجيل مهمة / تنبيه:
 * تتيح تحديد تاريخ مستقبلي لإخفاء التنبيه حتى حلوله
 */
export function showSnoozeTaskModal(task: TodayTask, onSuccess: () => void): void {
  const { body, footer } = createModalBase('تذكير لاحقاً بالتنبيه', icons.calendar);

  const tomorrow = addDays(getTodayDate(), 1);
  const after3Days = addDays(getTodayDate(), 3);
  const afterWeek = addDays(getTodayDate(), 7);

  body.innerHTML = `
    <div class="mb-4">
      <div class="font-bold text-gray-800">${task.title}</div>
      <div class="text-xs text-gray-500 mt-1">${task.subtitle}</div>
    </div>

    <div class="form-group">
      <label class="form-label">اختر موعد إعادة التذكير:</label>
      <div class="grid grid-cols-3 gap-2 mb-3">
        <button type="button" class="btn btn-outline text-xs py-2" id="btn-quick-tomorrow">غداً</button>
        <button type="button" class="btn btn-outline text-xs py-2" id="btn-quick-3days">بعد 3 أيام</button>
        <button type="button" class="btn btn-outline text-xs py-2" id="btn-quick-week">بعد أسبوع</button>
      </div>

      <label class="form-label text-xs">أو حدد تاريخاً مخصصاً:</label>
      <input type="date" id="input-snooze-date" class="form-input" min="${tomorrow}" value="${tomorrow}" />
      <div class="text-xs text-gray-500 mt-1">لن يظهر التنبيه في القائمة إلا بحلول هذا التاريخ أو عند تنفيذ المهمة فعلياً.</div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-confirm-snooze">تأكيد التأجيل</button>
  `;

  const dateInput = body.querySelector('#input-snooze-date') as HTMLInputElement;

  body.querySelector('#btn-quick-tomorrow')?.addEventListener('click', () => {
    dateInput.value = tomorrow;
  });
  body.querySelector('#btn-quick-3days')?.addEventListener('click', () => {
    dateInput.value = after3Days;
  });
  body.querySelector('#btn-quick-week')?.addEventListener('click', () => {
    dateInput.value = afterWeek;
  });

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-snooze')?.addEventListener('click', async () => {
    const chosenDate = dateInput.value;
    if (!chosenDate) {
      showToast('يرجى تحديد تاريخ إعادة التذكير', 'error');
      return;
    }
    if (chosenDate < tomorrow) {
      showToast('يجب أن يكون تاريخ إعادة التذكير في المستقبل', 'error');
      return;
    }

    try {
      await snoozeTask(task.id, chosenDate);
      showToast('تم تأجيل التنبيه بنجاح حتى ' + formatDateArabic(chosenDate), 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التأجيل: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

/**
 * نافذة تخصيص تفضيلات وأنواع تنبيهات مهام اليوم:
 * تتيح تفعيل أو تعطيل أي نوع من التنبيهات
 */
export async function showAlertPreferencesModal(onSuccess: () => void): Promise<void> {
  const settings = await getSettings();
  const prefs = settings.alertPreferences || {
    fertilityCheck: true,
    hatchExpected: true,
    eggLayingExpected: true,
    readyForTransfer: true,
    batchReadyForSale: true,
    lowFeedStock: true,
  };

  const { body, footer } = createModalBase('تخصيص أنواع التنبيهات والمهام', icons.settings);

  body.innerHTML = `
    <div class="text-sm text-gray-600 mb-4">
      حدد التنبيهات التي ترغب بظهورها في شاشة مهام اليوم الرئيسية:
    </div>

    <div class="space-y-3">
      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-fertility-check" class="w-5 h-5 accent-emerald-600" ${prefs.fertilityCheck !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">فحص التخصيب المستحق</div>
          <div class="text-xs text-gray-500">تنبيه عند حلول موعد اليوم الخامس أو السابع لفحص البيض بالضوء</div>
        </div>
      </label>

      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-hatch-expected" class="w-5 h-5 accent-emerald-600" ${prefs.hatchExpected !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">الفقس المتوقع للبيض المخصب</div>
          <div class="text-xs text-gray-500">تنبيه في يوم الفقس المتوقع (أو قبله بيوم واحد)</div>
        </div>
      </label>

      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-egg-laying" class="w-5 h-5 accent-emerald-600" ${prefs.eggLayingExpected !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">وضع بيض متوقع للأزواج</div>
          <div class="text-xs text-gray-500">تنبيه للأزواج النشطة التي مضى على آخر دورة لها أكثر من 20 يوماً دون بيض نشط</div>
        </div>
      </label>

      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-ready-transfer" class="w-5 h-5 accent-emerald-600" ${prefs.readyForTransfer !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">زغاليل جاهزة للنقل (عمر الفطام 20+ يوماً)</div>
          <div class="text-xs text-gray-500">تنبيه بالزغاليل الحية في سلاكات الإنتاج التي بلغت عمر النقل</div>
        </div>
      </label>

      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-ready-sale" class="w-5 h-5 accent-emerald-600" ${prefs.batchReadyForSale !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">دفعات وزغاليل جاهزة للبيع (عمر 30+ يوماً)</div>
          <div class="text-xs text-gray-500">تنبيه بمراجعة الوزن والبيع عند بلوغ الزغاليل موعد البيع المستهدف</div>
        </div>
      </label>

      <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
        <input type="checkbox" id="pref-low-feed" class="w-5 h-5 accent-emerald-600" ${prefs.lowFeedStock !== false ? 'checked' : ''} />
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-sm">انخفاض مخزون العلف عن حد الأمان</div>
          <div class="text-xs text-gray-500">تنبيه عاجل عند نزول الرصيد الفعلي لأي نوع علف عن حد التنبيه</div>
        </div>
      </label>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary btn-lg" id="btn-save-prefs">حفظ التفضيلات</button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-save-prefs')?.addEventListener('click', async () => {
    const updatedPrefs: AlertPreferences = {
      fertilityCheck: (body.querySelector('#pref-fertility-check') as HTMLInputElement).checked,
      hatchExpected: (body.querySelector('#pref-hatch-expected') as HTMLInputElement).checked,
      eggLayingExpected: (body.querySelector('#pref-egg-laying') as HTMLInputElement).checked,
      readyForTransfer: (body.querySelector('#pref-ready-transfer') as HTMLInputElement).checked,
      batchReadyForSale: (body.querySelector('#pref-ready-sale') as HTMLInputElement).checked,
      lowFeedStock: (body.querySelector('#pref-low-feed') as HTMLInputElement).checked,
    };

    try {
      await updateAlertPreferences(updatedPrefs);
      showToast('تم تحديث تفضيلات التنبيهات بنجاح', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التحديث: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

/**
 * نافذة تفاصيل أداء الزوج وتقييمه في الفترة المحددة:
 */
export function showPairRankingDetailModal(
  item: PairRankingItem,
  fromDate: string,
  toDate: string,
  navigate: (view: any, param?: any) => void
): void {
  const { body, footer } = createModalBase(`تقييم أداء ${item.pairName}`, icons.stats);

  const badgeClass =
    item.colorIndicator === 'green'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : item.colorIndicator === 'yellow'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : item.colorIndicator === 'red'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : 'bg-gray-100 text-gray-700 border-gray-300';

  body.innerHTML = `
    <div class="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
      <div>
        <div class="text-xs text-gray-500">الفترة: ${formatDateArabic(fromDate)} إلى ${formatDateArabic(toDate)}</div>
        <div class="text-xs text-gray-600 mt-0.5">السلاكة الحالية: ${item.coopNumber ? 'سلاكة ' + item.coopNumber : 'غير محددة'}</div>
      </div>
      <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeClass}">
        ${item.colorIndicatorLabel}
      </span>
    </div>

    <div class="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg mb-4 border border-gray-200">
      ${item.colorIndicatorReason}
    </div>

    ${
      !item.hasSufficientData
        ? `<div class="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold mb-4">
            تنبيه: ${item.insufficientDataReason}
           </div>`
        : ''
    }

    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">الدورات في الفترة</div>
        <div class="text-lg font-bold text-gray-800">${item.cyclesCount} <span class="text-xs font-normal text-gray-500">(${item.completedCyclesCount} مكتملة)</span></div>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">نسبة التخصيب</div>
        <div class="text-lg font-bold ${item.fertilityRate !== null && item.fertilityRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
          ${item.fertilityRate !== null ? item.fertilityRate + '%' : 'غير متاح'}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">${item.fertileEggsCount} مخصب من أصل ${item.fertileEggsCount + item.infertileEggsCount}</div>
      </div>

      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">نسبة الفقس</div>
        <div class="text-lg font-bold ${item.hatchRate !== null && item.hatchRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
          ${item.hatchRate !== null ? item.hatchRate + '%' : 'غير متاح'}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">${item.hatchCount} فقست</div>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">نسبة البقاء للزغاليل</div>
        <div class="text-lg font-bold ${item.survivalRate !== null && item.survivalRate >= 80 ? 'text-emerald-700' : 'text-gray-800'}">
          ${item.survivalRate !== null ? item.survivalRate + '%' : 'غير متاح'}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">${item.deceasedSquabsCount} نافق من ${item.bornSquabsCount} ناتج</div>
      </div>

      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">الزغاليل الواصلة للبيع</div>
        <div class="text-lg font-bold text-emerald-700">${item.reachedSaleCount} زغلول</div>
        <div class="text-[10px] text-gray-400 mt-0.5">مباعة أو حية بعمر 30+ يوم</div>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div class="text-xs text-gray-500">إيراد المبيعات الفعلي</div>
        <div class="text-lg font-bold text-emerald-800">${item.actualRevenue.toLocaleString('ar-EG')} ج.م</div>
        <div class="text-[10px] text-gray-400 mt-0.5">من فواتير البيع المسجلة</div>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close">إغلاق</button>
    <button type="button" class="btn btn-primary" id="btn-goto-pair">
      ${icons.pair || ''} الذهاب لصفحة الزوج
    </button>
  `;

  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-goto-pair')?.addEventListener('click', () => {
    closeModal();
    navigate('pair_detail', { pairId: item.pairId });
  });
}

function triggerFileDownload(content: string, fileName: string, contentType = 'application/json') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

// -------------------------------------------------------------
// 1. نافذة فحص سلامة وتناسق البيانات (المرحلة السادسة)
// -------------------------------------------------------------
export function showDataIntegrityModal(
  report: DataIntegrityReport,
  onRefresh: () => void,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const { overlay, body, footer } = createModalBase('فحص سلامة وتناسق البيانات', icons.shieldCheck || '');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="font-size:0.86rem;color:var(--text-secondary);margin:0;">
        يفحص هذا المدقق 6 قواعد أساسية لسلامة البيانات دون أي تعديل أو إصلاح تلقائي صامت، لضمان صحة السجلات المالية والإنتاجية.
      </p>

      <!-- ملخص الفحص -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="padding:10px;border-radius:var(--radius-md);background-color:${report.criticalCount > 0 ? '#FEE2E2' : '#E8F5E9'};border:1px solid ${report.criticalCount > 0 ? '#FCA5A5' : '#C8E6C9'};">
          <div style="font-size:0.75rem;color:var(--text-secondary);">أخطاء حرجة تعيق الحسابات</div>
          <div style="font-size:1.2rem;font-weight:800;color:${report.criticalCount > 0 ? '#991B1B' : '#2E7D32'};">${report.criticalCount} خطأ</div>
        </div>
        <div style="padding:10px;border-radius:var(--radius-md);background-color:${report.warningCount > 0 ? '#FEF3C7' : '#F3F4F6'};border:1px solid ${report.warningCount > 0 ? '#FDE68A' : '#E5E7EB'};">
          <div style="font-size:0.75rem;color:var(--text-secondary);">تنبيهات وملاحظات تناسق</div>
          <div style="font-size:1.2rem;font-weight:800;color:${report.warningCount > 0 ? '#92400E' : '#374151'};">${report.warningCount} ملاحظة</div>
        </div>
      </div>

      ${
        report.totalIssuesCount === 0
          ? `
        <div style="padding:24px 16px;text-align:center;background-color:#E8F5E9;border:1px solid #C8E6C9;border-radius:var(--radius-md);color:#1B5E20;">
          <div style="font-size:2rem;margin-bottom:8px;">✓</div>
          <div style="font-weight:800;font-size:1.05rem;margin-bottom:4px;">سجلات المزرعة سليمة 100%</div>
          <div style="font-size:0.84rem;color:#2E7D32;">
            لا توجد أي زغاليل مجهولة النسب، ولا تعارض في الحالات، ولا تواريخ متناقضة، ولا أرصدة سالبة في المخزون.
          </div>
        </div>
      `
          : `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;padding-left:4px;">
          ${report.issues
            .map(
              (issue) => `
            <div style="border:1px solid ${issue.severity === 'critical' ? '#FCA5A5' : '#FDE68A'};background-color:${issue.severity === 'critical' ? '#FFF5F5' : '#FFFDF5'};border-radius:var(--radius-md);padding:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:800;font-size:0.9rem;color:${issue.severity === 'critical' ? '#991B1B' : '#92400E'};">
                  ${issue.title}
                </span>
                <span class="badge ${issue.severity === 'critical' ? 'badge-danger' : 'badge-warning'}">
                  ${issue.severity === 'critical' ? 'حرج' : 'تنبيه'}
                </span>
              </div>
              <p style="font-size:0.82rem;color:var(--text-main);margin:0 0 8px;line-height:1.4;">
                ${issue.description}
              </p>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.75rem;color:var(--text-secondary);">${issue.suggestedAction}</span>
                <button class="btn btn-primary btn-sm btn-action-goto" data-type="${issue.entityType}" data-id="${issue.entityId}" data-coop="${issue.coopId || ''}" data-pair="${issue.pairId || ''}" data-squab="${issue.squabId || ''}" data-batch="${issue.batchId || ''}" style="font-size:0.78rem;padding:4px 10px;min-height:32px;">
                  فتح السجل للتصحيح
                </button>
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

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close">إغلاق</button>
    <button type="button" class="btn btn-primary" id="btn-recheck">
      ${icons.refresh || ''} إعادة الفحص الآن
    </button>
  `;

  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-recheck')?.addEventListener('click', async () => {
    closeModal();
    onRefresh();
  });

  body.querySelectorAll('.btn-action-goto').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      const type = el.dataset.type;
      const id = el.dataset.id;
      const coopId = el.dataset.coop;
      const pairId = el.dataset.pair;
      const squabId = el.dataset.squab;
      const batchId = el.dataset.batch;

      closeModal();

      if (squabId) {
        navigate('squab_detail', { squabId });
      } else if (batchId) {
        navigate('batch_detail', { batchId });
      } else if (coopId) {
        navigate('coop_detail', { coopId });
      } else if (pairId) {
        navigate('pair_detail', { pairId });
      } else if (type === 'feed_type') {
        navigate('inventory');
      } else if (type === 'sale') {
        navigate('finances');
      } else {
        navigate('dashboard');
      }
    });
  });
}

// -------------------------------------------------------------
// 2. نافذة استعادة النسخة الاحتياطية (المرحلة السادسة)
// -------------------------------------------------------------
export function showRestoreBackupModal(onSuccess: () => void) {
  const { overlay, body, footer } = createModalBase('استعادة نسخة احتياطية', icons.database || '');

  let parsedBackupData: any = null;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="padding:12px;background-color:#EBF3F0;border:1px solid #C5DDD3;border-radius:var(--radius-md);font-size:0.84rem;color:var(--text-main);">
        <strong style="color:var(--primary);display:block;margin-bottom:4px;">حماية بياناتك الحالية:</strong>
        قبل تنفيذ أي استبدال، سيقوم التطبيق تلقائياً بإنشاء وتنزيل ملف نسخة أمان لبياناتك الحالية لحفظها.
      </div>

      <div class="form-group">
        <label class="form-label">اختر ملف النسخة الاحتياطية (.json) <span class="form-label-required">*</span></label>
        <input type="file" id="input-backup-file" accept=".json,application/json" class="form-input" style="padding:8px;" />
      </div>

      <div id="backup-summary-area" style="display:none;flex-direction:column;gap:10px;">
        <div style="font-weight:800;font-size:0.92rem;color:var(--text-main);">ملخص السجلات في الملف المختار:</div>
        <div id="backup-counts-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;"></div>
        
        <div style="padding:10px;background-color:#FFF5F5;border:1px solid #FCA5A5;border-radius:var(--radius-md);color:#991B1B;font-size:0.82rem;">
          ⚠️ <strong>تأكيد الاستبدال:</strong> استعادة النسخة ستستبدل الجداول الحالية في جهازك ببيانات هذا الملف.
        </div>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary" id="btn-confirm-restore" disabled>
      ${icons.database || ''} تأكيد الاستبدال والاستعادة
    </button>
  `;

  const fileInput = body.querySelector('#input-backup-file') as HTMLInputElement;
  const summaryArea = body.querySelector('#backup-summary-area') as HTMLElement;
  const countsGrid = body.querySelector('#backup-counts-grid') as HTMLElement;
  const confirmBtn = footer.querySelector('#btn-confirm-restore') as HTMLButtonElement;

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) {
      summaryArea.style.display = 'none';
      confirmBtn.disabled = true;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateBackupFile(parsed);

        if (!validation.isValid) {
          showToast(validation.error || 'الملف غير صالح', 'error');
          summaryArea.style.display = 'none';
          confirmBtn.disabled = true;
          return;
        }

        parsedBackupData = parsed;
        const counts = parsed.recordCounts || {};

        countsGrid.innerHTML = `
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">السلاكات: <strong>${counts.coops ?? parsed.data?.coops?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">الأزواج: <strong>${counts.pairs ?? parsed.data?.pairs?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">البيض: <strong>${counts.eggs ?? parsed.data?.eggs?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">الزغاليل: <strong>${counts.squabs ?? parsed.data?.squabs?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">دفعات التجميع: <strong>${counts.batches ?? parsed.data?.batches?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">المبيعات: <strong>${counts.sales ?? parsed.data?.sales?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">المصروفات: <strong>${counts.expenses ?? parsed.data?.expenses?.length ?? 0}</strong></div>
          <div style="background:#F9FAFB;padding:6px 8px;border-radius:4px;border:1px solid #E5E7EB;">حركات المخزون: <strong>${counts.stock_movements ?? parsed.data?.stock_movements?.length ?? 0}</strong></div>
        `;

        summaryArea.style.display = 'flex';
        confirmBtn.disabled = false;
        showToast('تم فحص ملف النسخة الاحتياطية بنجاح وهو سليم وجاهز', 'info');
      } catch (err: unknown) {
        showToast('فشل قراءة الملف كـ JSON صالح: ' + (err instanceof Error ? err.message : String(err)), 'error');
        summaryArea.style.display = 'none';
        confirmBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  });

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);

  confirmBtn?.addEventListener('click', async () => {
    if (!parsedBackupData) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'جاري حفظ نسخة الأمان والاستعادة...';

    try {
      const result = await restoreBackupData(parsedBackupData, (safetyJson) => {
        // تنزيل نسخة الأمان للمستخدم تلقائياً
        const fileName = `pigeon_farm_safety_backup_before_restore_${getTodayDate()}.json`;
        triggerFileDownload(safetyJson, fileName);
      });

      showToast('تمت استعادة النسخة الاحتياطية بنجاح!', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل استعادة النسخة: ' + (err instanceof Error ? err.message : String(err)), 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'تأكيد الاستبدال والاستعادة';
    }
  });
}

// -------------------------------------------------------------
// 3. نافذة مسح كل البيانات بتأكيد مزدوج (المرحلة السادسة)
// -------------------------------------------------------------
export function showWipeAllDataModal(onSuccess: () => void) {
  const { overlay, body, footer } = createModalBase('مسح شامل لكافة البيانات', icons.trash || '');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="padding:14px;background-color:#FEE2E2;border:1px solid #FCA5A5;border-radius:var(--radius-md);color:#991B1B;font-size:0.86rem;line-height:1.5;">
        <strong>تحذير نهائي:</strong> سيؤدي هذا الإجراء إلى مسح كافة السلاكات والأزواج والبيض والزغاليل والمبيعات والمصروفات وحركات المخزون بالكامل من المتصفح. هذا الإجراء لا يمكن الرجوع عنه.
      </div>

      <div style="padding:12px;background-color:#EBF3F0;border:1px solid #C5DDD3;border-radius:var(--radius-md);font-size:0.84rem;">
        <span style="font-weight:bold;color:var(--primary);display:block;margin-bottom:4px;">توصية هامة:</span>
        يُنصح بتصدير نسخة احتياطية أولاً قبل المسح للرجوع إليها إن أردت:
        <button type="button" class="btn btn-outline btn-sm" id="btn-export-before-wipe" style="margin-top:6px;width:100%;">
          ${icons.download || ''} تصدير نسخة احتياطية الآن
        </button>
      </div>

      <div class="form-group">
        <label class="form-label" style="color:var(--danger);font-weight:bold;">
          للتأكيد، اكتب كلمة "مسح" في الحقل أدناه:
        </label>
        <input type="text" id="input-confirm-word" class="form-input" placeholder="اكتب مسح هنا" autocomplete="off" />
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-danger" id="btn-confirm-wipe" disabled>
      ${icons.trash || ''} مسح كافة البيانات نهائياً
    </button>
  `;

  const inputWord = body.querySelector('#input-confirm-word') as HTMLInputElement;
  const confirmBtn = footer.querySelector('#btn-confirm-wipe') as HTMLButtonElement;
  const exportBtn = body.querySelector('#btn-export-before-wipe') as HTMLButtonElement;

  exportBtn?.addEventListener('click', async () => {
    try {
      const backup = await exportBackupData();
      const json = JSON.stringify(backup, null, 2);
      const fileName = `pigeon_farm_backup_${getTodayDate()}.json`;
      triggerFileDownload(json, fileName);
      showToast('تم تنزيل النسخة الاحتياطية بنجاح!', 'success');
    } catch (err: unknown) {
      showToast('فشل التصدير: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });

  inputWord?.addEventListener('input', () => {
    confirmBtn.disabled = inputWord.value.trim() !== 'مسح';
  });

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);

  confirmBtn?.addEventListener('click', async () => {
    try {
      await wipeAllData(true);
      showToast('تم مسح كافة البيانات بنجاح، التطبيق الآن فارغ تماماً', 'info');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل مسح البيانات: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -------------------------------------------------------------
// 4. نافذة التراجع عن آخر عملية (المرحلة السادسة)
// -------------------------------------------------------------
export function showUndoModal(action: UndoableAction, onSuccess: () => void) {
  const { overlay, body, footer } = createModalBase('التراجع عن العملية الأخيرة', icons.undo || '');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="font-size:0.86rem;color:var(--text-secondary);margin:0;">
        التراجع يعيد الكيان إلى حالته السابقة ويسجل الحدث كاملاً في سجل التدقيق (Event Log) منعاً لأي مسح صامت.
      </p>

      <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.86rem;">
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:2px;">العملية المطلوب التراجع عنها:</div>
        <div style="font-weight:800;color:var(--text-main);font-size:0.95rem;">${action.description}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">وقت التنفيذ: ${formatDateTimeArabic(action.timestamp)}</div>
      </div>

      <div class="form-group">
        <label class="form-label">سبب التراجع (لتوثيقه بسجل الأحداث) <span class="form-label-required">*</span></label>
        <input type="text" id="input-undo-reason" class="form-input" placeholder="مثال: تسجيل خاطئ بالسهو، خطأ في التاريخ..." />
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-cancel">إلغاء</button>
    <button type="button" class="btn btn-primary" id="btn-confirm-undo">
      ${icons.undo || ''} تأكيد التراجع وتوثيق السبب
    </button>
  `;

  footer.querySelector('#btn-cancel')?.addEventListener('click', closeModal);
  footer.querySelector('#btn-confirm-undo')?.addEventListener('click', async () => {
    const reasonInput = body.querySelector('#input-undo-reason') as HTMLInputElement;
    const reason = reasonInput?.value.trim();

    if (!reason) {
      showToast('يرجى إدخال سبب التراجع لتوثيقه في سجل التدقيق', 'error');
      reasonInput?.focus();
      return;
    }

    try {
      await executeUndo(reason);
      showToast('تم التراجع عن العملية بنجاح وتوثيق ذلك في سجل الأحداث', 'success');
      closeModal();
      onSuccess();
    } catch (err: unknown) {
      showToast('فشل التراجع: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  });
}

// -------------------------------------------------------------
// 5. نافذة البحث السريع (المرحلة السادسة)
// -------------------------------------------------------------
export function showQuickSearchModal(navigate: (view: string, params?: Record<string, string>) => void) {
  const { overlay, body, footer } = createModalBase('البحث السريع في المزرعة', icons.search || '');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="form-group" style="margin-bottom:0;">
        <input
          type="text"
          id="input-quick-search"
          class="form-input"
          placeholder="ابحث برقم السلاكة (مثال: 1)، اسم الزوج (شقلباظ)، كود الزغلول..."
          style="font-size:0.95rem;padding:10px 14px;"
          autofocus
        />
      </div>

      <div id="search-results-list" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;padding-left:4px;">
        <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
          اكتب كلمة البحث للوصول المباشر إلى أي سلاكة أو زوج أو زغلول أو دفعة...
        </div>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close" style="width:100%;">إغلاق</button>
  `;

  const searchInput = body.querySelector('#input-quick-search') as HTMLInputElement;
  const resultsContainer = body.querySelector('#search-results-list') as HTMLElement;

  let debounceTimer: any = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const q = searchInput.value.trim();
      if (!q) {
        resultsContainer.innerHTML = `
          <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
            اكتب كلمة البحث للوصول المباشر إلى أي سلاكة أو زوج أو زغلول أو دفعة...
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);">جاري البحث...</div>`;
      const results = await searchFarm(q);

      if (results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
            لا توجد نتائج مطابقة لـ "${q}"
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = results
        .map(
          (r) => `
        <div class="search-result-item" data-view="${r.targetView}" data-params='${JSON.stringify(r.params)}' style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:800;font-size:0.92rem;color:var(--text-main);">${r.title}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);">${r.subtitle}</div>
          </div>
          <span class="badge ${r.type === 'coop' ? 'badge-primary' : r.type === 'pair' ? 'badge-success' : 'badge-neutral'}">
            ${r.type === 'coop' ? 'سلاكة' : r.type === 'pair' ? 'زوج' : r.type === 'squab' ? 'زغلول' : 'دفعة'}
          </span>
        </div>
      `
        )
        .join('');

      resultsContainer.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', () => {
          const el = item as HTMLElement;
          const targetView = el.dataset.view;
          const paramsStr = el.dataset.params;
          if (targetView && paramsStr) {
            closeModal();
            navigate(targetView, JSON.parse(paramsStr));
          }
        });
      });
    }, 200);
  });

  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
}

// -------------------------------------------------------------
// 6. نافذة دليل تثبيت التطبيق PWA (المرحلة السادسة)
// -------------------------------------------------------------
export function showPWAInstallGuideModal() {
  const { overlay, body, footer } = createModalBase('تثبيت تطبيق مزرعة الحمام (PWA)', icons.download || '');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <p style="font-size:0.86rem;color:var(--text-secondary);margin:0;">
        تثبيت التطبيق يمنحك تجربة تطبيق أصلي على شاشة هاتفك مع شاشة كاملة وسرعة فائقة وعمل 100% بدون إنترنت.
      </p>

      <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="font-weight:800;font-size:0.92rem;color:var(--primary);margin-bottom:6px;">
          📱 على هواتف أندرويد (Google Chrome):
        </div>
        <ol style="margin:0;padding-right:20px;font-size:0.84rem;color:var(--text-main);display:flex;flex-direction:column;gap:4px;">
          <li>اضغط على زر القائمة (الثلاث نقاط) في أعلى زاوية المتصفح.</li>
          <li>اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</li>
          <li>اضغط تأكيد، وسيظهر التطبيق فوراً بين تطبيقات هاتفك.</li>
        </ol>
      </div>

      <div style="background-color:var(--surface-subtle);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <div style="font-weight:800;font-size:0.92rem;color:var(--primary);margin-bottom:6px;">
          🍎 على هواتف آيفون وآيباد (Safari):
        </div>
        <ol style="margin:0;padding-right:20px;font-size:0.84rem;color:var(--text-main);display:flex;flex-direction:column;gap:4px;">
          <li>اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح سفاري بالأسفل.</li>
          <li>مرر للأسفل واختر <strong>"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)</strong>.</li>
          <li>اضغط <strong>"إضافة" (Add)</strong> في أعلى الزاوية.</li>
        </ol>
      </div>

      <div style="padding:10px 12px;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-md);color:#92400E;font-size:0.8rem;">
        ℹ️ <strong>ملاحظة التنبيهات:</strong> التنبيهات تعمل لحظياً داخل التطبيق أثناء فتحه لحساب المواعيد بدقة، ولا تعمل كإشعارات دفع (Push) أثناء إغلاق التطبيق في هذه المرحلة.
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-primary" id="btn-close" style="width:100%;">فهمت ذلك</button>
  `;

  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
}

// -------------------------------------------------------------
// 7. نافذة عرض نتائج الاختبارات الشاملة (13 سيناريو)
// -------------------------------------------------------------
export function showTestSuiteModal(results: Array<{ id: number; name: string; status: 'نجح' | 'فشل'; details: string; notes: string }>) {
  const allPassed = results.every((r) => r.status === 'نجح');
  const { overlay, body, footer } = createModalBase(
    `نتائج الاختبارات الشاملة (13 سيناريو)`,
    icons.shieldCheck || ''
  );

  const passedCount = results.filter((r) => r.status === 'نجح').length;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="padding:12px;background-color:${allPassed ? '#DCFCE7' : '#FEF2F2'};border:1px solid ${allPassed ? '#86EFAC' : '#FCA5A5'};border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:800;font-size:0.95rem;color:${allPassed ? '#166534' : '#991B1B'};">
            ${allPassed ? '✓ اكتملت جميع الاختبارات بنجاح 100%' : '⚠️ بعض الاختبارات لم تكتمل بنجاح'}
          </div>
          <div style="font-size:0.8rem;color:${allPassed ? '#15803D' : '#B91C1C'};">
            تم فحص ${results.length} سيناريو تغطي كافة قواعد المراحل الست. تم اجتياز: ${passedCount} من ${results.length}.
          </div>
        </div>
        <span class="badge ${allPassed ? 'badge-success' : 'badge-danger'}" style="font-size:0.9rem;padding:6px 12px;">
          ${passedCount} / ${results.length}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto;padding-left:4px;">
        ${results
          .map(
            (r) => `
          <div style="background-color:var(--surface);border:1px solid ${r.status === 'نجح' ? '#A7F3D0' : '#FECACA'};border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-weight:700;font-size:0.88rem;color:var(--text-main);">
                ${r.name}
              </span>
              <span class="badge ${r.status === 'نجح' ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem;">
                ${r.status === 'نجح' ? '✓ نجح' : '✗ فشل'}
              </span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.4;">
              ${r.details}
            </div>
            <div style="font-size:0.75rem;color:var(--primary);font-weight:600;">
              📌 ${r.notes}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-primary" id="btn-close" style="width:100%;">إغلاق النتائج</button>
  `;

  footer.querySelector('#btn-close')?.addEventListener('click', closeModal);
}

