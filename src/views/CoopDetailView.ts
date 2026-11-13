import {
  getCoop,
  getPairs,
  getEggsByCoop,
  getSquabs,
  getBatchesByCoop,
  getEventsForEntity,
  getSettings,
} from '../db/indexedDB';
import {
  getEggSchedule,
  formatDateArabic,
  formatDateTimeArabic,
  getSquabAge,
  formatAgeArabic,
  getEffectiveSaleDate,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showEditCoopModal,
  showToggleCoopModal,
  showLayEggModal,
  showEggFertilityCheckModal,
  showEggBrokenOrLostModal,
  showAddPairModal,
  showEditPairModal,
  showChangePairModal,
  showCoopPreviousPairsModal,
  showRecordHatchModal,
  showRecordSquabDeathModal,
  showAddSquabWeightModal,
  showTransferToCollectionModal,
  showEventHistoryModal,
} from '../components/Modal';

export async function renderCoopDetailView(
  container: HTMLElement,
  coopId: string,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [coop, pairs, eggs, allSquabs, batches, events, settings] = await Promise.all([
    getCoop(coopId),
    getPairs(),
    getEggsByCoop(coopId),
    getSquabs(),
    getBatchesByCoop(coopId),
    getEventsForEntity(coopId),
    getSettings(),
  ]);

  if (!coop) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">السلاكة غير موجودة</div>
        <button class="btn btn-primary" id="btn-back-coops">${icons.back} العودة لقائمة السلاكات</button>
      </div>
    `;
    container.querySelector('#btn-back-coops')?.addEventListener('click', () => navigate('coops'));
    return;
  }

  const isCollection = coop.type === 'collection';
  const residentPair = pairs.find((p) => p.coopId === coop.id && p.status === 'active');
  const previousPairs = pairs.filter((p) => p.coopId === coop.id && p.status === 'inactive');
  const activeEggs = eggs.filter((e) => e.status === 'pending' || e.status === 'fertile');
  const hatchedEggs = eggs.filter((e) => e.status === 'hatched');
  const otherHistoricalEggs = eggs.filter(
    (e) => e.status === 'infertile' || e.status === 'broken' || e.status === 'lost'
  );

  // الزغاليل الحية المتواجدة حالياً في هذه السلاكة
  const liveSquabsHere = allSquabs.filter(
    (s) =>
      (s.currentLocationId === coop.id || (!s.currentLocationId && s.originCoopId === coop.id)) &&
      (s.status === 'alive_production' || s.status === 'transferred_collection')
  );

  // الزغاليل التي نفقت في هذه السلاكة
  const deceasedSquabsHere = allSquabs.filter(
    (s) =>
      (s.currentLocationId === coop.id || (!s.currentLocationId && s.originCoopId === coop.id)) &&
      s.status === 'deceased'
  );

  // الزغاليل التي نشأت أصلاً من هذه السلاكة وتم نقلها للتجميع (سجل تاريخي لسلاكة الإنتاج)
  const transferredFromHere = allSquabs.filter(
    (s) => s.originCoopId === coop.id && (s.status === 'transferred_collection' || s.status === 'sold')
  );

  container.innerHTML = `
    <!-- Top Back Bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <button class="btn btn-outline btn-sm" id="btn-back">
        ${icons.back} العودة للسلاكات
      </button>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" id="btn-edit-coop">
          ${icons.edit} تعديل
        </button>
        <button class="btn btn-outline btn-sm" id="btn-toggle-coop" style="color:${coop.active ? 'var(--danger)' : 'var(--success)'};">
          ${coop.active ? icons.pause : icons.play}
          ${coop.active ? 'إيقاف السلاكة' : 'تفعيل'}
        </button>
      </div>
    </div>

    <!-- Coop Overview Card -->
    <div class="card" style="background:linear-gradient(135deg, #FFFFFF 0%, var(--surface-subtle) 100%);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:58px;height:58px;border-radius:var(--radius-lg);background-color:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900;">
            ${coop.number}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);margin:0;">سلاكة رقم ${coop.number}</h1>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary);flex-wrap:wrap;">
              <span class="badge ${isCollection ? 'badge-muted' : 'badge-primary'}">
                ${isCollection ? 'سلاكة تجميع وفطام' : 'سلاكة إنتاج وتزاوج'}
              </span>
              <span class="badge ${coop.active ? 'badge-success' : 'badge-danger'}">
                ${coop.active ? 'نشطة للعمل' : 'متوقفة حالياً'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Current Occupancy Summary Badges -->
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;font-size:0.82rem;">
        ${
          !isCollection
            ? `
          <span class="badge ${activeEggs.length > 0 ? 'badge-warning' : 'badge-muted'}">
            ${icons.egg} ${activeEggs.length} بيض بالحضانة
          </span>
          <span class="badge ${liveSquabsHere.length > 0 ? 'badge-success' : 'badge-muted'}">
            ${icons.squab} ${liveSquabsHere.length} زغاليل حية
          </span>
        `
            : `
          <span class="badge ${batches.length > 0 ? 'badge-primary' : 'badge-muted'}">
            ${icons.box} ${batches.length} دفعات تجميع
          </span>
          <span class="badge ${liveSquabsHere.length > 0 ? 'badge-success' : 'badge-muted'}">
            ${icons.squab} ${liveSquabsHere.length} زغاليل حية بالتجميع
          </span>
        `
        }
      </div>

      ${
        coop.notes
          ? `<div style="padding:10px 12px;background-color:#F0F4F1;border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-secondary);margin-top:8px;">
              <strong>ملاحظات:</strong> ${coop.notes}
            </div>`
          : ''
      }
    </div>

    ${
      /* ========================================================================= */
      /* سلاكة التجميع: عرض الدفعات المستقلة (لا تُدمج أبداً وتُعرض كل دفعة منفصلة) */
      /* ========================================================================= */
      isCollection
        ? `
      <!-- Batches Section for Collection Coop -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${icons.box}
            دفعات التجميع في هذه السلاكة (${batches.length})
          </div>
        </div>

        ${
          batches.length === 0
            ? `
          <div class="empty-state" style="padding:24px 16px;">
            <div class="empty-icon">${icons.box}</div>
            <div class="empty-title">لا توجد دفعات تجميع في هذه السلاكة بعد</div>
            <div class="empty-desc">
              يمكنك نقل الزغاليل المفطومة (عمر 20+ يوم) من سلاكات الإنتاج إلى هنا، وستُنشأ كل عملية نقل كدفعة مستقلة.
            </div>
          </div>
        `
            : `
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${batches
              .map((batch) => {
                const bSquabs = allSquabs.filter((s) => s.batchId === batch.id);
                const bLive = bSquabs.filter((s) => s.status === 'transferred_collection' || s.status === 'alive_production');
                const bSold = bSquabs.filter((s) => s.status === 'sold');
                const bDead = bSquabs.filter((s) => s.status === 'deceased');

                // نطاق الأعمار
                let ageRange = '—';
                if (bLive.length > 0) {
                  const ages = bLive.map((s) => getSquabAge(s.hatchDate));
                  const min = Math.min(...ages);
                  const max = Math.max(...ages);
                  ageRange = min === max ? `${min} يوم` : `من ${min} إلى ${max} يوم`;
                }

                // نطاق مواعيد البيع المستهدفة
                let targetSaleRange = '—';
                if (bLive.length > 0) {
                  const dates = bLive.map((s) => getEffectiveSaleDate(s)).sort();
                  targetSaleRange = dates[0] === dates[dates.length - 1]
                    ? formatDateArabic(dates[0])
                    : `من ${formatDateArabic(dates[0])} إلى ${formatDateArabic(dates[dates.length - 1])}`;
                }

                let statusBadge = `<span class="badge" style="background-color:#E0F2FE;color:#0284C7;">قيد التربية</span>`;
                if (batch.status === 'fully_sold') {
                  statusBadge = `<span class="badge badge-success">مباعة بالكامل ✓</span>`;
                } else if (bLive.some((s) => getSquabAge(s.hatchDate) >= 30)) {
                  statusBadge = `<span class="badge" style="background-color:#FEF3C7;color:#92400E;font-weight:700;">جاهزة للبيع (30+ يوم)</span>`;
                }

                return `
                <div class="batch-card-item" data-batch-id="${batch.id}" style="cursor:pointer;background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px;display:flex;flex-direction:column;gap:10px;transition:all 0.15s ease;">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:44px;height:44px;border-radius:var(--radius-md);background-color:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:900;">
                        ${icons.box}
                      </div>
                      <div>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="font-weight:800;font-size:1.05rem;color:var(--text-main);">${batch.batchNumber}</span>
                          ${statusBadge}
                        </div>
                        <div style="font-size:0.78rem;color:var(--text-secondary);">
                          تاريخ النقل: <strong>${formatDateArabic(batch.transferDate)}</strong>
                        </div>
                      </div>
                    </div>

                    <button class="btn btn-outline btn-sm btn-open-batch" data-batch-id="${batch.id}" style="padding:6px 12px;font-size:0.8rem;">
                      عرض الدفعة ←
                    </button>
                  </div>

                  <!-- Metrics bar -->
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;background-color:#FFFFFF;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px;text-align:center;">
                    <div>
                      <span style="font-size:0.72rem;color:var(--text-secondary);display:block;">الحي بالدفعة</span>
                      <strong style="color:#15803D;font-size:1.05rem;">${bLive.length}</strong>
                    </div>
                    <div>
                      <span style="font-size:0.72rem;color:var(--text-secondary);display:block;">المباع</span>
                      <strong style="color:var(--text-main);font-size:1.05rem;">${bSold.length}</strong>
                    </div>
                    <div>
                      <span style="font-size:0.72rem;color:var(--text-secondary);display:block;">الأعمار</span>
                      <strong style="color:var(--text-main);font-size:0.82rem;">${ageRange}</strong>
                    </div>
                  </div>

                  <div style="font-size:0.8rem;color:var(--text-secondary);display:flex;justify-content:space-between;">
                    <span>موعد البيع المستهدف:</span>
                    <strong style="color:#0284C7;">${targetSaleRange}</strong>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>
    `
        : `
      /* ========================================================================= */
      /* سلاكة الإنتاج: الزوج، البيض، الزغاليل الحية، وزر النقل، والسجل التاريخي */
      /* ========================================================================= */

      <!-- Resident Pair Section -->
      <div class="card" style="border:1px solid var(--border-subtle);">
        <div class="card-header" style="flex-wrap:wrap;gap:8px;">
          <div class="card-title">
            ${icons.pair}
            الزوج الساكن حالياً
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${
              residentPair
                ? `
              <button class="btn btn-sm btn-outline" id="btn-edit-resident-pair" title="تعديل بيانات الزوج والسلالة">
                ${icons.edit} تعديل بيانات الزوج
              </button>
              <button class="btn btn-sm btn-outline" id="btn-change-resident-pair" style="color:var(--primary);font-weight:700;">
                🔄 تغيير الزوج
              </button>
            `
                : `
              <button class="btn btn-sm btn-primary" id="btn-assign-pair">
                ${icons.plus} تسكين زوج جديد
              </button>
            `
            }
          </div>
        </div>

        ${
          residentPair
            ? `
          <div id="card-resident-pair-clickable" style="cursor:pointer;background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px;margin:4px 0;transition:all 0.2s ease;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:800;font-size:1.15rem;color:var(--primary);">${residentPair.name}</span>
                ${residentPair.breed ? `<span class="badge badge-primary" style="font-size:0.8rem;">سلالة: ${residentPair.breed}</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge badge-success">نشط للإنتاج</span>
                <span style="font-size:0.8rem;color:var(--text-secondary);font-weight:600;">عرض التفاصيل ←</span>
              </div>
            </div>

            <div style="font-size:0.82rem;color:var(--text-secondary);">
              تاريخ التكوين: ${formatDateArabic(residentPair.pairedDate)}
            </div>

            <div style="font-size:0.82rem;color:var(--text-muted);display:flex;gap:14px;flex-wrap:wrap;">
              <span><strong>الذكر:</strong> ${residentPair.maleInfo}</span>
              <span><strong>الأنثى:</strong> ${residentPair.femaleInfo}</span>
            </div>
          </div>
        `
            : `
          <div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.9rem;background-color:var(--surface-subtle);border-radius:var(--radius-md);margin:4px 0;">
            لا يوجد زوج مسكن في هذه السلاكة حالياً. اضغط "تسكين زوج جديد" لتسكين زوج فيها.
          </div>
        `
        }

        <!-- Previous Pairs History Button -->
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button class="btn btn-sm btn-outline" id="btn-previous-pairs-history" style="font-size:0.8rem;padding:4px 10px;color:var(--text-secondary);">
            ${icons.history} تاريخ الأزواج السابقين لهذه السلاكة (${previousPairs.length})
          </button>
        </div>
      </div>

      <!-- Live Squabs Section (الزغاليل الحية في هذه السلاكة) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${icons.squab}
            الزغاليل الحية في السلاكة (${liveSquabsHere.length})
          </div>
          ${
            liveSquabsHere.length > 0
              ? `<button class="btn btn-primary btn-sm" id="btn-transfer-to-collection" style="font-weight:700;">
                  ${icons.truck} نقل إلى التجميع
                </button>`
              : ''
          }
        </div>

        ${
          liveSquabsHere.length === 0
            ? `
          <div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.88rem;">
            لا توجد زغاليل حية في هذه السلاكة حالياً. (تظهر هنا تلقائيًا عند تسجيل فقس أي بيضة).
          </div>
        `
            : `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${liveSquabsHere
              .map((squab) => {
                const age = getSquabAge(squab.hatchDate);
                const isReady = age >= (settings.weaningAgeDays || 20);
                const latestWeight = squab.weights && squab.weights.length > 0 ? squab.weights[squab.weights.length - 1] : null;

                return `
                <div style="background-color:var(--surface-subtle);border:1.5px solid ${isReady ? '#FDE68A' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:14px;display:flex;flex-direction:column;gap:10px;">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:44px;height:44px;border-radius:var(--radius-md);background-color:#DCFCE7;color:#166534;display:flex;align-items:center;justify-content:center;font-weight:900;">
                        ${icons.squab}
                      </div>
                      <div style="display:flex;flex-direction:column;gap:2px;">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                          <span style="font-weight:800;font-size:1.05rem;">${squab.codeNumber}</span>
                          <span class="badge badge-success">حي في الإنتاج</span>
                          ${
                            isReady
                              ? `<span class="badge badge-warning" style="font-weight:800;">
                                  ${icons.truck} جاهز للنقل
                                </span>`
                              : ''
                          }
                        </div>
                        <div style="font-size:0.82rem;color:var(--text-secondary);">
                          الفقس: ${formatDateArabic(squab.hatchDate)} • <strong>العمر: ${formatAgeArabic(age)}</strong>
                        </div>
                      </div>
                    </div>

                    <button class="btn btn-outline btn-sm btn-view-squab" data-squab-id="${squab.id}">
                      صفحة الزغلول ←
                    </button>
                  </div>

                  ${
                    latestWeight || squab.illnessOrInjury
                      ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:0.8rem;background-color:#FFFFFF;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                      ${
                        latestWeight
                          ? `<span><strong>الوزن الأخير:</strong> ${latestWeight.weightGrams} جم (${formatDateArabic(latestWeight.date)})</span>`
                          : ''
                      }
                      ${
                        squab.illnessOrInjury
                          ? `<span style="color:#B45309;"><strong>الحالة الصحية:</strong> ${squab.illnessOrInjury}</span>`
                          : '<span style="color:#15803D;"><strong>الحالة:</strong> سليم</span>'
                      }
                    </div>
                  `
                      : ''
                  }

                  <!-- Contextual Action Buttons for Squab -->
                  <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--border-subtle);padding-top:8px;">
                    <button class="btn btn-secondary btn-sm btn-weight-squab" data-squab-id="${squab.id}">
                      ${icons.scale} تسجيل وزن
                    </button>
                    <button class="btn btn-danger btn-sm btn-death-squab" data-squab-id="${squab.id}">
                      ${icons.skull} تسجيل نفوق
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

      <!-- Active Eggs Section -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${icons.egg}
            البيض قيد الحضانة (${activeEggs.length})
          </div>
          ${
            coop.active && residentPair
              ? `<button class="btn btn-sm btn-primary" id="btn-lay-egg-coop">${icons.plus} تسجيل وضع بيض</button>`
              : ''
          }
        </div>

        ${
          activeEggs.length === 0
            ? `
          <div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.88rem;">
            لا يوجد بيض بالحضانة حالياً.
            ${
              coop.active && residentPair
                ? `<div style="margin-top:8px;"><button class="btn btn-outline btn-sm" id="btn-empty-lay">${icons.plus} تسجيل وضع بيض الآن</button></div>`
                : ''
            }
          </div>
        `
            : `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${activeEggs
              .map((egg) => {
                const schedule = getEggSchedule(egg, settings);
                return `
                <div style="background-color:var(--surface-subtle);border:1.5px solid ${schedule.isCheckDue ? '#FCD34D' : 'var(--border-subtle)'};border-radius:var(--radius-md);padding:14px;display:flex;flex-direction:column;gap:10px;">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:40px;height:40px;border-radius:var(--radius-md);background-color:${schedule.badgeBg};color:${schedule.badgeText};display:flex;align-items:center;justify-content:center;font-weight:900;">
                        ${icons.egg}
                      </div>
                      <div style="display:flex;flex-direction:column;gap:2px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span style="font-weight:800;font-size:0.98rem;">البيضة رقم ${egg.eggNumber}</span>
                          <span class="badge" style="background-color:${schedule.badgeBg};color:${schedule.badgeText};">
                            ${schedule.statusText}
                          </span>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);">
                          تاريخ الوضع: ${formatDateArabic(egg.laidDate)} • منذ ${schedule.daysSinceLaid} يوم
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style="font-size:0.85rem;font-weight:700;color:${schedule.isCheckDue ? '#92400E' : 'var(--text-main)'};background-color:#FFFFFF;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
                    ${schedule.countdownText}
                  </div>

                  <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--border-subtle);padding-top:8px;">
                    <button class="btn btn-success btn-sm btn-egg-hatch" data-egg-id="${egg.id}">
                      ${icons.squab} تسجيل فقس
                    </button>
                    <button class="btn btn-primary btn-sm btn-egg-check" data-egg-id="${egg.id}">
                      ${icons.check} فحص التخصيب
                    </button>
                    <button class="btn btn-danger btn-sm btn-egg-broken" data-egg-id="${egg.id}">
                      ${icons.eggCrack} كسر أو فقد
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

      <!-- Transferred Squabs History (سجل تاريخي للزغاليل المنقولة من هذه السلاكة) -->
      ${
        transferredFromHere.length > 0
          ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              ${icons.truck}
              زغاليل منقولة من هذه السلاكة (${transferredFromHere.length})
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);">سجل تاريخي</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            ${transferredFromHere
              .map((s) => {
                const age = getSquabAge(s.hatchDate);
                const isSold = s.status === 'sold';
                return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-md);border:1px solid var(--border-subtle);font-size:0.85rem;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="squab-name-link" data-squab-id="${s.id}" style="font-weight:700;color:var(--primary);cursor:pointer;">
                      ${s.codeNumber}
                    </span>
                    <span class="badge ${isSold ? 'badge-primary' : 'badge-muted'}" style="font-size:0.7rem;">
                      ${isSold ? 'مباع ✓' : 'منقول للتجميع'}
                    </span>
                  </div>
                  <div style="color:var(--text-secondary);font-size:0.8rem;">
                    نُقل بعمر ${s.ageAtTransfer ?? '—'} يوم (${formatDateArabic(s.transferDate || '')})
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `
          : ''
      }
    `
    }

    <!-- Deceased Squabs in this Coop (الزغاليل النافقة) -->
    ${
      deceasedSquabsHere.length > 0
        ? `
      <div class="card" style="border-color:#FEE2E2;">
        <div class="card-header" style="border-color:#FEE2E2;">
          <div class="card-title" style="color:var(--danger);">
            ${icons.skull}
            زغاليل نافقة في هذه السلاكة (${deceasedSquabsHere.length})
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${deceasedSquabsHere
            .map((s) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background-color:#FFF5F5;border-radius:var(--radius-md);border:1px solid #FECACA;font-size:0.85rem;">
              <div>
                <span class="squab-name-link" data-squab-id="${s.id}" style="font-weight:700;color:var(--danger);cursor:pointer;">${s.codeNumber}</span>
                <span style="color:var(--text-secondary);margin-right:8px;">عمر النفوق: ${s.deathAgeDays ?? '—'} يوم</span>
              </div>
              <div style="color:var(--text-muted);font-size:0.78rem;">
                ${s.deathReason ? `السبب: ${s.deathReason}` : `بتاريخ ${formatDateArabic(s.deathDate || '')}`}
              </div>
            </div>
          `)
            .join('')}
        </div>
      </div>
    `
        : ''
    }

    <!-- Historical Eggs Section (البيض الذي فقس أو استبعد) -->
    ${
      hatchedEggs.length > 0 || otherHistoricalEggs.length > 0
        ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${icons.history}
            سجل البيض السابق في السلاكة (${hatchedEggs.length + otherHistoricalEggs.length})
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;">
          ${hatchedEggs
            .map(
              (egg) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background-color:#F0FDF4;border-radius:var(--radius-sm);font-size:0.82rem;">
              <span>البيضة رقم ${egg.eggNumber} (وضعت ${formatDateArabic(egg.laidDate)})</span>
              <span class="badge badge-success">فقست ✓ (${formatDateArabic(egg.hatchDate || '')})</span>
            </div>
          `
            )
            .join('')}

          ${otherHistoricalEggs
            .map(
              (egg) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background-color:var(--surface-subtle);border-radius:var(--radius-sm);font-size:0.82rem;">
              <span>البيضة رقم ${egg.eggNumber} (وضعت ${formatDateArabic(egg.laidDate)})</span>
              <span class="badge ${egg.status === 'infertile' ? 'badge-muted' : 'badge-danger'}">
                ${egg.status === 'infertile' ? 'رايقة' : egg.status === 'broken' ? 'مكسورة' : 'مفقودة'}
              </span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }

    <!-- Event History for Coop -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.history}
          سجل أحداث السلاكة
        </div>
      </div>

      ${
        events.length === 0
          ? `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem;">لا توجد أحداث مسجلة لهذه السلاكة.</div>`
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
  container.querySelector('#btn-back')?.addEventListener('click', () => navigate('coops'));

  container.querySelector('#btn-edit-coop')?.addEventListener('click', () => {
    showEditCoopModal(coop, () => renderCoopDetailView(container, coopId, navigate));
  });

  container.querySelector('#btn-toggle-coop')?.addEventListener('click', () => {
    showToggleCoopModal(coop, () => renderCoopDetailView(container, coopId, navigate));
  });

  container.querySelector('#card-resident-pair-clickable')?.addEventListener('click', () => {
    if (residentPair) navigate('pair_detail', { pairId: residentPair.id });
  });

  container.querySelector('#btn-view-pair')?.addEventListener('click', () => {
    if (residentPair) navigate('pair_detail', { pairId: residentPair.id });
  });

  container.querySelector('#btn-edit-resident-pair')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (residentPair) {
      showEditPairModal(residentPair, () => renderCoopDetailView(container, coopId, navigate));
    }
  });

  container.querySelector('#btn-change-resident-pair')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (residentPair) {
      showChangePairModal(coop, residentPair, () => renderCoopDetailView(container, coopId, navigate));
    }
  });

  container.querySelector('#btn-previous-pairs-history')?.addEventListener('click', () => {
    showCoopPreviousPairsModal(coop, navigate);
  });

  container.querySelector('#btn-assign-pair')?.addEventListener('click', () => {
    showAddPairModal(coop.id, () => renderCoopDetailView(container, coopId, navigate));
  });

  container.querySelector('#btn-lay-egg-coop')?.addEventListener('click', () => {
    if (residentPair) {
      showLayEggModal(residentPair.id, coop.id, () => renderCoopDetailView(container, coopId, navigate));
    }
  });

  container.querySelector('#btn-empty-lay')?.addEventListener('click', () => {
    if (residentPair) {
      showLayEggModal(residentPair.id, coop.id, () => renderCoopDetailView(container, coopId, navigate));
    }
  });

  // Transfer to Collection button (المرحلة الثالثة)
  container.querySelector('#btn-transfer-to-collection')?.addEventListener('click', () => {
    showTransferToCollectionModal(coop.id, () => renderCoopDetailView(container, coopId, navigate));
  });

  // Batch clicks in collection coop
  container.querySelectorAll('.batch-card-item, .btn-open-batch').forEach((elem) => {
    elem.addEventListener('click', (e) => {
      e.stopPropagation();
      const bId = (elem as HTMLElement).dataset.batchId;
      if (bId) navigate('batch_detail', { batchId: bId });
    });
  });

  // Egg Hatch buttons
  container.querySelectorAll('.btn-egg-hatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eggId = (btn as HTMLElement).dataset.eggId;
      const targetEgg = eggs.find((e) => e.id === eggId);
      if (targetEgg) {
        showRecordHatchModal(
          targetEgg,
          residentPair ? residentPair.name : '—',
          coop.number,
          () => renderCoopDetailView(container, coopId, navigate)
        );
      }
    });
  });

  // Egg check buttons
  container.querySelectorAll('.btn-egg-check').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eggId = (btn as HTMLElement).dataset.eggId;
      const targetEgg = eggs.find((e) => e.id === eggId);
      if (targetEgg) {
        showEggFertilityCheckModal(
          targetEgg,
          residentPair ? residentPair.name : '—',
          coop.number,
          () => renderCoopDetailView(container, coopId, navigate)
        );
      }
    });
  });

  // Egg broken / lost buttons
  container.querySelectorAll('.btn-egg-broken').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eggId = (btn as HTMLElement).dataset.eggId;
      const targetEgg = eggs.find((e) => e.id === eggId);
      if (targetEgg) {
        showEggBrokenOrLostModal(
          targetEgg,
          residentPair ? residentPair.name : '—',
          coop.number,
          () => renderCoopDetailView(container, coopId, navigate)
        );
      }
    });
  });

  // Squab link & actions
  container.querySelectorAll('.squab-name-link, .btn-view-squab').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const squabId = (btn as HTMLElement).dataset.squabId;
      if (squabId) navigate('squab_detail', { squabId });
    });
  });

  container.querySelectorAll('.btn-weight-squab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const squabId = (btn as HTMLElement).dataset.squabId;
      const targetSquab = allSquabs.find((s) => s.id === squabId);
      if (targetSquab) {
        showAddSquabWeightModal(targetSquab, () => renderCoopDetailView(container, coopId, navigate));
      }
    });
  });

  container.querySelectorAll('.btn-death-squab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const squabId = (btn as HTMLElement).dataset.squabId;
      const targetSquab = allSquabs.find((s) => s.id === squabId);
      if (targetSquab) {
        showRecordSquabDeathModal(targetSquab, () => renderCoopDetailView(container, coopId, navigate));
      }
    });
  });
}
