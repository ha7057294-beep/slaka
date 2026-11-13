import {
  getSquab,
  getCoop,
  getPair,
  getEgg,
  getEventsForEntity,
  getSettings,
  getBatch,
  getSaleItemForSquab,
  getSale,
} from '../db/indexedDB';
import {
  formatDateArabic,
  formatDateTimeArabic,
  getSquabAge,
  formatAgeArabic,
  isSquabReadyForSale,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showRecordSquabDeathModal,
  showAddSquabWeightModal,
  showEditSquabModal,
  showPostponeSaleModal,
  showRecordSaleModal,
} from '../components/Modal';

export async function renderSquabDetailView(
  container: HTMLElement,
  squabId: string,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [squab, events, settings] = await Promise.all([
    getSquab(squabId),
    getEventsForEntity(squabId),
    getSettings(),
  ]);

  if (!squab) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">سجل الزغلول غير موجود</div>
        <button class="btn btn-primary" id="btn-back-coops">${icons.back} العودة للسلاكات</button>
      </div>
    `;
    container.querySelector('#btn-back-coops')?.addEventListener('click', () => navigate('coops'));
    return;
  }

  const [originCoop, currentCoop, pair, egg, batch] = await Promise.all([
    getCoop(squab.originCoopId),
    squab.currentLocationId && squab.currentLocationId !== squab.originCoopId
      ? getCoop(squab.currentLocationId)
      : null,
    getPair(squab.pairId),
    getEgg(squab.eggId),
    squab.batchId ? getBatch(squab.batchId) : null,
  ]);

  // If sold, fetch sale details
  let saleItem = null;
  let sale = null;
  if (squab.status === 'sold') {
    saleItem = await getSaleItemForSquab(squab.id);
    if (saleItem) {
      sale = await getSale(saleItem.saleId);
    }
  }

  const currentAge = getSquabAge(squab.hatchDate, squab.deathDate);
  const isReadyForTransfer =
    squab.status === 'alive_production' && currentAge >= (settings.weaningAgeDays || 20);
  const isReadyForSaleNow =
    (squab.status === 'alive_production' || squab.status === 'transferred_collection') &&
    isSquabReadyForSale(squab);

  const isAlive =
    squab.status === 'alive_production' || squab.status === 'transferred_collection';

  // Status badge styling and text
  let statusBadgeClass = 'badge-success';
  let statusLabel = 'حي في الإنتاج';
  if (squab.status === 'transferred_collection') {
    statusBadgeClass = 'badge-primary';
    statusLabel = 'منقول إلى التجميع';
  } else if (squab.status === 'sold') {
    statusBadgeClass = 'badge-warning';
    statusLabel = 'مباع';
  } else if (squab.status === 'deceased') {
    statusBadgeClass = 'badge-danger';
    statusLabel = 'نافق';
  }

  container.innerHTML = `
    <!-- Top Back Bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" id="btn-back-origin">
        ${icons.back} ${
          batch
            ? `الدفعة (${batch.batchNumber})`
            : originCoop
              ? `سلاكة ${originCoop.number}`
              : 'العودة'
        }
      </button>

      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" id="btn-edit-squab">
          ${icons.edit} تصحيح
        </button>

        ${
          isAlive
            ? `
          <button class="btn btn-outline btn-sm" id="btn-postpone-sale" style="color:#B45309;border-color:#FCD34D;">
            ${icons.clock} تأجيل البيع
          </button>
          <button class="btn btn-primary btn-sm" id="btn-sell-squab" style="background-color:#059669;">
            ${icons.cash} تسجيل بيع
          </button>
          <button class="btn btn-danger btn-sm" id="btn-record-death">
            ${icons.skull} نفوق
          </button>
        `
            : ''
        }
      </div>
    </div>

    <!-- Squab Hero Card -->
    <div class="card" style="background:linear-gradient(135deg, #FFFFFF 0%, var(--surface-subtle) 100%);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:58px;height:58px;border-radius:var(--radius-lg);background-color:${
            squab.status === 'deceased'
              ? '#FEE2E2'
              : squab.status === 'sold'
                ? '#FEF3C7'
                : squab.status === 'transferred_collection'
                  ? '#E0F2FE'
                  : '#DCFCE7'
          };color:${
            squab.status === 'deceased'
              ? '#991B1B'
              : squab.status === 'sold'
                ? '#B45309'
                : squab.status === 'transferred_collection'
                  ? '#0369A1'
                  : '#166534'
          };display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900;flex-shrink:0;">
            ${
              squab.status === 'deceased'
                ? icons.skull
                : squab.status === 'sold'
                  ? icons.cash
                  : squab.status === 'transferred_collection'
                    ? icons.box
                    : icons.squab
            }
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);">${squab.codeNumber}</h1>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="badge ${statusBadgeClass}">
                ${statusLabel}
              </span>
              <span class="badge badge-primary">
                ${squab.status === 'deceased' ? `العمر عند النفوق: ${formatAgeArabic(currentAge)}` : `العمر: ${formatAgeArabic(currentAge)}`}
              </span>
              ${
                isReadyForTransfer
                  ? `<span class="badge badge-warning" style="font-weight:800;">
                      ${icons.truck} جاهز للنقل (20+ يوم)
                    </span>`
                  : ''
              }
              ${
                isReadyForSaleNow
                  ? `<span class="badge" style="background-color:#D1FAE5;color:#059669;font-weight:800;">
                      ${icons.cash} جاهز للبيع (30+ يوم)
                    </span>`
                  : ''
              }
              ${
                squab.postponedUntil
                  ? `<span class="badge" style="background-color:#FEF3C7;color:#B45309;font-weight:700;">
                      ${icons.clock} مؤجل بيعه حتى ${formatDateArabic(squab.postponedUntil)}
                    </span>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Info Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;font-size:0.85rem;">
        <div style="background-color:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:3px;">
          <span style="color:var(--text-muted);">السلاكة الأصلية:</span>
          <strong>${originCoop ? `سلاكة إنتاج رقم ${originCoop.number}` : '—'}</strong>
          ${
            originCoop
              ? `<button class="btn btn-outline btn-sm" id="btn-goto-coop" style="margin-top:4px;padding:4px 8px;font-size:0.75rem;">فتح السلاكة الأصلية ←</button>`
              : ''
          }
        </div>

        <div style="background-color:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:3px;">
          <span style="color:var(--text-muted);">الزوج الأصلي:</span>
          <strong>${pair ? pair.name : '—'}</strong>
          ${
            pair
              ? `<button class="btn btn-outline btn-sm" id="btn-goto-pair" style="margin-top:4px;padding:4px 8px;font-size:0.75rem;">صفحة الزوج ←</button>`
              : ''
          }
        </div>
      </div>

      <!-- Batch & Current Location Card (المرحلة الثالثة) -->
      ${
        batch || currentCoop
          ? `
        <div style="background-color:#F0F7FF;border:1px solid #BAE6FD;border-radius:var(--radius-md);padding:10px 12px;margin-top:8px;display:flex;flex-direction:column;gap:5px;font-size:0.85rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#0369A1;font-weight:800;display:flex;align-items:center;gap:6px;">
              ${icons.box} بيانات التجميع والدفعة
            </span>
            ${
              batch
                ? `<button class="btn btn-sm btn-primary" id="btn-goto-batch" style="padding:4px 8px;font-size:0.75rem;">
                    فتح ${batch.batchNumber} ←
                  </button>`
                : ''
            }
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;">
            <div>
              <span style="color:var(--text-secondary);">المكان الحالي:</span>
              <strong>${currentCoop ? `سلاكة تجميع ${currentCoop.number}` : originCoop ? `سلاكة ${originCoop.number}` : '—'}</strong>
            </div>
            <div>
              <span style="color:var(--text-secondary);">الدفعة:</span>
              <strong>${batch ? batch.batchNumber : 'لا توجد دفعة'}</strong>
            </div>
            <div>
              <span style="color:var(--text-secondary);">تاريخ النقل:</span>
              <strong>${formatDateArabic(squab.transferDate || '')}</strong>
            </div>
            <div>
              <span style="color:var(--text-secondary);">العمر عند النقل:</span>
              <strong>${squab.ageAtTransfer !== undefined ? `${squab.ageAtTransfer} يوم` : '—'}</strong>
            </div>
            <div style="grid-column:1 / -1;">
              <span style="color:var(--text-secondary);">موعد البيع المستهدف (30 يوم):</span>
              <strong>${formatDateArabic(squab.targetSaleDate || '')}</strong>
            </div>
            ${
              squab.postponedUntil
                ? `
              <div style="grid-column:1 / -1;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-sm);padding:6px 8px;color:#92400E;">
                <div>تأجيل البيع حتى: <strong>${formatDateArabic(squab.postponedUntil)}</strong></div>
                ${squab.postponeReason ? `<div style="font-size:0.78rem;">السبب: ${squab.postponeReason}</div>` : ''}
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
          : ''
      }

      <!-- Sale Details Card (إن كان مباعاً - المرحلة الثالثة) -->
      ${
        squab.status === 'sold' && saleItem
          ? `
        <div style="background-color:#FEF3C7;border:1px solid #FCD34D;border-radius:var(--radius-md);padding:12px;margin-top:8px;display:flex;flex-direction:column;gap:5px;font-size:0.86rem;color:#78350F;">
          <div style="font-weight:800;display:flex;align-items:center;gap:6px;font-size:0.95rem;">
            ${icons.cash} بيانات عملية البيع
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;">
            <div>سعر البيع: <strong style="font-size:1.05rem;color:#92400E;">${saleItem.price} ج.م</strong></div>
            <div>تاريخ البيع: <strong>${sale ? formatDateArabic(sale.date) : '—'}</strong></div>
            ${sale?.buyer ? `<div style="grid-column:1 / -1;">المشتري: <strong>${sale.buyer}</strong></div>` : ''}
            ${sale?.note ? `<div style="grid-column:1 / -1;">ملاحظات: ${sale.note}</div>` : ''}
          </div>
        </div>
      `
          : ''
      }

      <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:0.84rem;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-secondary);">تاريخ الفقس:</span>
          <strong>${formatDateArabic(squab.hatchDate)}</strong>
        </div>
        ${
          egg
            ? `<div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">البيضة المصدر:</span>
                <span>البيضة رقم ${egg.eggNumber} (وضعت ${formatDateArabic(egg.laidDate)})</span>
              </div>`
            : ''
        }
      </div>

      ${
        squab.status === 'deceased'
          ? `
        <div style="background-color:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md);padding:12px;margin-top:8px;color:var(--danger);font-size:0.86rem;display:flex;flex-direction:column;gap:4px;">
          <div style="font-weight:800;display:flex;align-items:center;gap:6px;">
            ${icons.skull} بيانات النفوق
          </div>
          <div>تاريخ النفوق: <strong>${formatDateArabic(squab.deathDate || '')}</strong> (عمر ${currentAge} يوم)</div>
          ${squab.deathReason ? `<div>السبب: <strong>${squab.deathReason}</strong></div>` : ''}
        </div>
      `
          : ''
      }
    </div>

    <!-- Health & Disease Section -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.info} الحالة الصحية والملاحظات
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;font-size:0.88rem;">
        <div>
          <span style="color:var(--text-secondary);">المرض أو الإصابة:</span>
          <div style="margin-top:4px;padding:8px 12px;background-color:${squab.illnessOrInjury ? '#FFFBEB' : '#F0F7F2'};border:1px solid ${squab.illnessOrInjury ? '#FDE68A' : '#C7E4D0'};border-radius:var(--radius-md);font-weight:600;color:${squab.illnessOrInjury ? '#92400E' : 'var(--primary)'};">
            ${squab.illnessOrInjury ? squab.illnessOrInjury : 'سليم ولا توجد إصابات أو أمراض مسجلة'}
          </div>
        </div>

        ${
          squab.notes
            ? `
          <div style="margin-top:4px;">
            <span style="color:var(--text-secondary);">ملاحظات:</span>
            <div style="margin-top:2px;font-size:0.84rem;color:var(--text-main);">${squab.notes}</div>
          </div>
        `
            : ''
        }
      </div>
    </div>

    <!-- Weight Tracking Log (سجل متابعة الأوزان) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.scale} سجل الأوزان والنمو (${squab.weights ? squab.weights.length : 0})
        </div>
        ${
          isAlive
            ? `<button class="btn btn-sm btn-primary" id="btn-add-weight">
                ${icons.plus} تسجيل وزن
              </button>`
            : ''
        }
      </div>

      ${
        !squab.weights || squab.weights.length === 0
          ? `
        <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
          لم يتم تسجيل أي وزن لهذا الزغلول بعد. اضغط "تسجيل وزن" لتوثيق وزنه بالجرام.
        </div>
      `
          : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${squab.weights
            .map((wt, idx) => {
              const prevWt = idx > 0 ? squab.weights[idx - 1] : null;
              const delta = prevWt ? wt.weightGrams - prevWt.weightGrams : null;

              return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-weight:800;font-size:1.15rem;color:var(--primary);">${wt.weightGrams} جرام</span>
                  ${
                    delta !== null
                      ? `<span class="badge ${delta >= 0 ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem;">
                          ${delta >= 0 ? '+' : ''}${delta} جم
                        </span>`
                      : '<span class="badge badge-muted" style="font-size:0.72rem;">أول وزن</span>'
                  }
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.78rem;color:var(--text-muted);">
                  <span>${formatDateArabic(wt.date)}</span>
                  ${wt.note ? `<span style="color:var(--text-secondary);">${wt.note}</span>` : ''}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    </div>

    <!-- Complete Event Log for this Squab (سجل أحداث الزغلول) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.history} سجل أحداث الزغلول الكامل
        </div>
      </div>

      ${
        events.length === 0
          ? `
        <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
          لا توجد أحداث مسجلة بعد.
        </div>
      `
          : `
        <div class="timeline">
          ${events
            .map(
              (evt) => `
            <div class="timeline-item">
              <div class="timeline-dot" style="width:30px;height:30px;">${icons.check}</div>
              <div class="timeline-content" style="padding:8px 12px;">
                <span class="timeline-time">${formatDateTimeArabic(evt.date)}</span>
                <span class="timeline-text" style="font-size:0.88rem;">${evt.note || evt.type}</span>
                ${
                  evt.oldValue || evt.newValue
                    ? `<div class="timeline-diff" style="font-size:0.78rem;">
                        ${evt.oldValue ? `<span style="color:var(--danger);margin-left:6px;">السابق: ${evt.oldValue}</span>` : ''}
                        ${evt.newValue ? `<span style="color:var(--success);">الجديد: ${evt.newValue}</span>` : ''}
                      </div>`
                    : ''
                }
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

  // Attach event handlers
  container.querySelector('#btn-back-origin')?.addEventListener('click', () => {
    if (batch) {
      navigate('batch_detail', { batchId: batch.id });
    } else if (originCoop) {
      navigate('coop_detail', { coopId: originCoop.id });
    } else {
      navigate('coops');
    }
  });

  container.querySelector('#btn-goto-coop')?.addEventListener('click', () => {
    if (originCoop) navigate('coop_detail', { coopId: originCoop.id });
  });

  container.querySelector('#btn-goto-pair')?.addEventListener('click', () => {
    if (pair) navigate('pair_detail', { pairId: pair.id });
  });

  container.querySelector('#btn-goto-batch')?.addEventListener('click', () => {
    if (batch) navigate('batch_detail', { batchId: batch.id });
  });

  container.querySelector('#btn-edit-squab')?.addEventListener('click', () => {
    showEditSquabModal(squab, () => renderSquabDetailView(container, squabId, navigate));
  });

  container.querySelector('#btn-record-death')?.addEventListener('click', () => {
    showRecordSquabDeathModal(squab, () => renderSquabDetailView(container, squabId, navigate));
  });

  container.querySelector('#btn-add-weight')?.addEventListener('click', () => {
    showAddSquabWeightModal(squab, () => renderSquabDetailView(container, squabId, navigate));
  });

  container.querySelector('#btn-postpone-sale')?.addEventListener('click', () => {
    showPostponeSaleModal([squab], squab.batchId, () =>
      renderSquabDetailView(container, squabId, navigate)
    );
  });

  container.querySelector('#btn-sell-squab')?.addEventListener('click', () => {
    showRecordSaleModal(squab.batchId, [squab.id], () =>
      renderSquabDetailView(container, squabId, navigate)
    );
  });
}

