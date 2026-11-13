import {
  getBatch,
  getSquabsByBatch,
  getCoop,
  getPairs,
  getEventsForEntity,
} from '../db/indexedDB';
import {
  formatDateArabic,
  formatDateTimeArabic,
  getSquabAge,
  formatAgeArabic,
  getEffectiveSaleDate,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showRecordSaleModal,
  showPostponeSaleModal,
  showCorrectTransferDateModal,
  showAddSquabWeightModal,
  showRecordSquabDeathModal,
  showEventHistoryModal,
} from '../components/Modal';

export async function renderBatchDetailView(
  container: HTMLElement,
  batchId: string,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [batch, squabs, pairs, events] = await Promise.all([
    getBatch(batchId),
    getSquabsByBatch(batchId),
    getPairs(),
    getEventsForEntity(batchId),
  ]);

  if (!batch) {
    container.innerHTML = `
      <div class="card" style="padding:24px;text-align:center;">
        <div style="color:var(--danger);font-size:1.1rem;font-weight:700;">الدفعة غير موجودة</div>
        <button class="btn btn-primary btn-sm" id="btn-back-coops" style="margin-top:12px;">العودة للسلاكات</button>
      </div>
    `;
    container.querySelector('#btn-back-coops')?.addEventListener('click', () => navigate('coops'));
    return;
  }

  const coop = await getCoop(batch.collectionCoopId);

  // إحصائيات الدفعة الحية
  const totalCount = squabs.length;
  const liveSquabs = squabs.filter(
    (s) => s.status === 'transferred_collection' || s.status === 'alive_production'
  );
  const soldSquabs = squabs.filter((s) => s.status === 'sold');
  const deceasedSquabs = squabs.filter((s) => s.status === 'deceased');

  // حساب نطاق الأعمار الحية في الدفعة
  let ageRangeText = '—';
  if (liveSquabs.length > 0) {
    const liveAges = liveSquabs.map((s) => getSquabAge(s.hatchDate));
    const minAge = Math.min(...liveAges);
    const maxAge = Math.max(...liveAges);
    ageRangeText = minAge === maxAge ? `${minAge} يوم` : `من ${minAge} إلى ${maxAge} يوم`;
  }

  // حساب نطاق مواعيد البيع المستهدفة
  let saleDatesRangeText = '—';
  if (liveSquabs.length > 0) {
    const dates = liveSquabs.map((s) => getEffectiveSaleDate(s)).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    saleDatesRangeText = firstDate === lastDate
      ? formatDateArabic(firstDate)
      : `من ${formatDateArabic(firstDate)} إلى ${formatDateArabic(lastDate)}`;
  }

  // شارة حالة الدفعة
  let statusBadgeBg = '#E0F2FE';
  let statusBadgeText = '#0284C7';
  let statusArabic = 'قيد التربية والتغذية';

  if (batch.status === 'fully_sold') {
    statusBadgeBg = '#DCFCE7';
    statusBadgeText = '#15803D';
    statusArabic = 'مباعة بالكامل ✓';
  } else if (liveSquabs.some((s) => getSquabAge(s.hatchDate) >= 30)) {
    statusBadgeBg = '#FEF3C7';
    statusBadgeText = '#92400E';
    statusArabic = 'جاهزة للبيع (بلغت 30+ يوم)';
  }

  container.innerHTML = `
    <!-- Top Action Navigation -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <button class="btn btn-outline btn-sm" id="btn-back-to-coop" style="padding:6px 12px;">
        ${icons.back} سلاكة ${coop ? coop.number : ''}
      </button>

      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-icon-only" id="btn-batch-history" title="سجل أحداث الدفعة">
          ${icons.history}
        </button>
        <button class="btn btn-outline btn-icon-only" id="btn-correct-transfer" title="تصحيح تاريخ النقل">
          ${icons.edit}
        </button>
      </div>
    </div>

    <!-- Batch Hero Card -->
    <div class="card" style="padding:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);background-color:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.2rem;flex-shrink:0;">
            ${icons.box}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <h1 style="font-size:1.25rem;font-weight:800;color:var(--text-main);margin:0;">
                ${batch.batchNumber}
              </h1>
              <span class="badge" style="background-color:${statusBadgeBg};color:${statusBadgeText};font-weight:700;">
                ${statusArabic}
              </span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;">
              سلاكة التجميع: <strong>سلاكة ${coop ? coop.number : '—'}</strong> • تاريخ النقل: <strong>${formatDateArabic(batch.transferDate)}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:14px;">
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 10px;text-align:center;">
          <span style="font-size:0.75rem;color:var(--text-secondary);display:block;">الحي بالدفعة</span>
          <strong style="font-size:1.2rem;color:#15803D;">${liveSquabs.length}</strong>
        </div>
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 10px;text-align:center;">
          <span style="font-size:0.75rem;color:var(--text-secondary);display:block;">المباع</span>
          <strong style="font-size:1.2rem;color:var(--text-main);">${soldSquabs.length}</strong>
        </div>
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:8px 10px;text-align:center;">
          <span style="font-size:0.75rem;color:var(--text-secondary);display:block;">النافق</span>
          <strong style="font-size:1.2rem;color:${deceasedSquabs.length > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${deceasedSquabs.length}</strong>
        </div>
      </div>

      <!-- Dates & Age Box -->
      <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:0.84rem;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-secondary);">نطاق الأعمار الحالية:</span>
          <strong>${ageRangeText}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-secondary);">مواعيد البيع المستهدفة:</span>
          <strong style="color:#0284C7;">${saleDatesRangeText}</strong>
        </div>
        ${batch.note ? `<div style="border-top:1px dashed var(--border-subtle);padding-top:6px;color:var(--text-secondary);">${batch.note}</div>` : ''}
      </div>

      <!-- Action Buttons for Batch -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <button class="btn btn-primary btn-lg" id="btn-batch-sell" ${liveSquabs.length === 0 ? 'disabled' : ''}>
          ${icons.cash} تسجيل بيع
        </button>
        <button class="btn btn-outline btn-lg" id="btn-batch-postpone" ${liveSquabs.length === 0 ? 'disabled' : ''}>
          ${icons.clock} تأجيل البيع
        </button>
      </div>
    </div>

    <!-- Squabs in Batch Section -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
      <h2 style="font-size:1.05rem;font-weight:800;color:var(--text-main);">
        زغاليل الدفعة (${squabs.length})
      </h2>
      <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">مرتبة حسب العمر</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${squabs
        .map((squab) => {
          const age = getSquabAge(squab.hatchDate, squab.deathDate);
          const pair = pairs.find((p) => p.id === squab.pairId);
          const latestWeight = squab.weights && squab.weights.length > 0 ? squab.weights[squab.weights.length - 1] : null;
          const isReadyForSale = (squab.status === 'transferred_collection' || squab.status === 'alive_production') && age >= 30;
          const targetSaleDateStr = getEffectiveSaleDate(squab);

          let statusBadge = '';
          if (squab.status === 'sold') {
            statusBadge = `<span class="badge" style="background-color:#E0E7FF;color:#4338CA;">مباع ✓</span>`;
          } else if (squab.status === 'deceased') {
            statusBadge = `<span class="badge" style="background-color:#FEE2E2;color:#991B1B;">نافق (عمر ${squab.deathAgeDays ?? age} يوم)</span>`;
          } else if (squab.postponedUntil) {
            statusBadge = `<span class="badge" style="background-color:#FEF3C7;color:#92400E;">مؤجل بيعه إلى ${formatDateArabic(squab.postponedUntil)}</span>`;
          } else if (isReadyForSale) {
            statusBadge = `<span class="badge badge-success">جاهز للبيع / راجع الوزن</span>`;
          } else {
            statusBadge = `<span class="badge badge-primary">حي في التجميع</span>`;
          }

          return `
          <div class="card" style="padding:14px;border-color:${isReadyForSale ? '#86EFAC' : 'var(--border-subtle)'};">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;border-radius:var(--radius-md);background-color:${squab.status === 'sold' ? '#EEF2FF' : squab.status === 'deceased' ? '#FEE2E2' : '#DCFCE7'};color:${squab.status === 'sold' ? '#4338CA' : squab.status === 'deceased' ? '#DC2626' : '#15803D'};display:flex;align-items:center;justify-content:center;font-weight:900;flex-shrink:0;">
                  ${squab.status === 'sold' ? icons.cash : squab.status === 'deceased' ? icons.skull : icons.squab}
                </div>
                <div style="display:flex;flex-direction:column;gap:2px;">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span class="squab-name-link" data-squab-id="${squab.id}" style="font-weight:800;font-size:0.98rem;color:var(--primary);cursor:pointer;">
                      ${squab.codeNumber}
                    </span>
                    ${statusBadge}
                  </div>
                  <div style="font-size:0.78rem;color:var(--text-secondary);">
                    الزوج: <strong>${pair ? pair.name : '—'}</strong> • تاريخ الفقس: ${formatDateArabic(squab.hatchDate)}
                  </div>
                </div>
              </div>

              <div style="text-align:left;flex-shrink:0;">
                <div style="font-weight:800;font-size:0.95rem;color:var(--text-main);">
                  ${formatAgeArabic(age)}
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);">
                  ${squab.ageAtTransfer !== undefined ? `عند النقل: ${squab.ageAtTransfer} يوم` : ''}
                </div>
              </div>
            </div>

            <!-- Details Bar -->
            <div style="background-color:var(--surface-subtle);border-radius:var(--radius-md);padding:8px 10px;margin-top:8px;display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;gap:6px;">
              <div>
                موعد البيع المستهدف: <strong style="color:var(--text-main);">${formatDateArabic(targetSaleDateStr)}</strong>
                ${squab.postponeReason ? `<span style="display:block;font-size:0.72rem;color:#B45309;">سبب التأجيل: ${squab.postponeReason}</span>` : ''}
              </div>
              <div>
                آخر وزن: <strong style="color:var(--text-main);">${latestWeight ? `${latestWeight.weightGrams} جم (${formatDateArabic(latestWeight.date)})` : 'لم يسجل'}</strong>
              </div>
            </div>

            <!-- Contextual Actions -->
            ${
              squab.status === 'transferred_collection' || squab.status === 'alive_production'
                ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px dashed var(--border-subtle);padding-top:8px;margin-top:8px;">
                <button class="btn btn-outline btn-sm btn-add-weight" data-squab-id="${squab.id}">
                  ${icons.scale} تسجيل وزن
                </button>
                <button class="btn btn-outline btn-sm btn-postpone-squab" data-squab-id="${squab.id}">
                  ${icons.clock} تأجيل بيعه
                </button>
                <button class="btn btn-danger btn-sm btn-death-squab" data-squab-id="${squab.id}">
                  ${icons.skull} تسجيل نفوق
                </button>
              </div>
            `
                : ''
            }
          </div>
        `;
        })
        .join('')}
    </div>

    <!-- Batch Event History -->
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">
          ${icons.history}
          سجل أحداث هذه الدفعة
        </div>
      </div>

      ${
        events.length === 0
          ? `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem;">لا توجد أحداث مسجلة لهذه الدفعة.</div>`
          : `
        <div class="timeline" style="margin-top:6px;">
          ${events
            .map(
              (evt) => `
            <div class="timeline-item">
              <div class="timeline-dot" style="width:30px;height:30px;">${icons.check}</div>
              <div class="timeline-content" style="padding:8px 10px;">
                <span class="timeline-time">${formatDateTimeArabic(evt.date)}</span>
                <span class="timeline-text" style="font-size:0.85rem;">${evt.note || evt.type}</span>
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

  // Handlers
  container.querySelector('#btn-back-to-coop')?.addEventListener('click', () => {
    navigate('coop_detail', { coopId: batch.collectionCoopId });
  });

  container.querySelector('#btn-batch-history')?.addEventListener('click', () => {
    showEventHistoryModal(batch.batchNumber, batch.id);
  });

  container.querySelector('#btn-correct-transfer')?.addEventListener('click', () => {
    showCorrectTransferDateModal(batch, () => renderBatchDetailView(container, batchId, navigate));
  });

  container.querySelector('#btn-batch-sell')?.addEventListener('click', () => {
    showRecordSaleModal(batch.id, [], () => renderBatchDetailView(container, batchId, navigate));
  });

  container.querySelector('#btn-batch-postpone')?.addEventListener('click', () => {
    showPostponeSaleModal(liveSquabs, batch.id, () => renderBatchDetailView(container, batchId, navigate));
  });

  container.querySelectorAll('.squab-name-link').forEach((elem) => {
    elem.addEventListener('click', () => {
      const id = (elem as HTMLElement).dataset.squabId;
      if (id) navigate('squab_detail', { squabId: id });
    });
  });

  container.querySelectorAll('.btn-add-weight').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.squabId;
      const targetSquab = squabs.find((s) => s.id === id);
      if (targetSquab) {
        showAddSquabWeightModal(targetSquab, () => renderBatchDetailView(container, batchId, navigate));
      }
    });
  });

  container.querySelectorAll('.btn-postpone-squab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.squabId;
      const targetSquab = squabs.find((s) => s.id === id);
      if (targetSquab) {
        showPostponeSaleModal([targetSquab], batch.id, () => renderBatchDetailView(container, batchId, navigate));
      }
    });
  });

  container.querySelectorAll('.btn-death-squab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.squabId;
      const targetSquab = squabs.find((s) => s.id === id);
      if (targetSquab) {
        showRecordSquabDeathModal(targetSquab, () => renderBatchDetailView(container, batchId, navigate));
      }
    });
  });
}
