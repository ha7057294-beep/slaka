import {
  getPair,
  getCoop,
  getCyclesForPair,
  getEggsByPair,
  getSquabsByPair,
  getEventsForEntity,
  getSettings,
  calculatePairStats,
  getPairRanking,
} from '../db/indexedDB';
import {
  getEggSchedule,
  formatDateArabic,
  formatDateTimeArabic,
  getSquabAge,
  formatAgeArabic,
  getRolling6MonthsPeriod,
} from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showEditPairModal,
  showTogglePairModal,
  showLayEggModal,
  showEggFertilityCheckModal,
  showEggBrokenOrLostModal,
  showRecordHatchModal,
  showPairBirdCountChangeModal,
  showPairRankingDetailModal,
} from '../components/Modal';

export async function renderPairDetailView(
  container: HTMLElement,
  pairId: string,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const rollingPeriod = getRolling6MonthsPeriod();
  const [pair, eggs, squabs, cycles, events, settings, pairStats, pairRankingData] = await Promise.all([
    getPair(pairId),
    getEggsByPair(pairId),
    getSquabsByPair(pairId),
    getCyclesForPair(pairId),
    getEventsForEntity(pairId),
    getSettings(),
    calculatePairStats(pairId),
    getPairRanking(rollingPeriod.fromDate, rollingPeriod.toDate),
  ]);

  const rankingItem = [...pairRankingData.rankedPairs, ...pairRankingData.insufficientDataPairs].find(
    (p) => p.pairId === pairId
  );
  const rankIndex = rankingItem && rankingItem.hasSufficientData
    ? pairRankingData.rankedPairs.findIndex((p) => p.pairId === pairId) + 1
    : null;

  if (!pair) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">الزوج غير موجود</div>
        <button class="btn btn-primary" id="btn-back-coops">${icons.back} العودة لقائمة السلاكات</button>
      </div>
    `;
    container.querySelector('#btn-back-coops')?.addEventListener('click', () => navigate('coops'));
    return;
  }

  const coop = pair.coopId ? await getCoop(pair.coopId) : null;

  container.innerHTML = `
    <!-- Top Back Bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <button class="btn btn-outline btn-sm" id="btn-back">
        ${icons.back} ${coop ? `العودة لسلاكة ${coop.number}` : 'العودة للسلاكات'}
      </button>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" id="btn-edit-pair">
          ${icons.edit} تعديل
        </button>
        <button class="btn btn-outline btn-sm" id="btn-toggle-pair" style="color:${pair.status === 'active' ? 'var(--danger)' : 'var(--success)'};">
          ${pair.status === 'active' ? icons.pause : icons.play}
          ${pair.status === 'active' ? 'إيقاف الزوج' : 'تنشيط الزوج'}
        </button>
      </div>
    </div>

    <!-- Pair Overview Card -->
    <div class="card" style="background:linear-gradient(135deg, #FFFFFF 0%, var(--surface-subtle) 100%);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:58px;height:58px;border-radius:var(--radius-lg);background-color:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">
            ${icons.pair}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);margin:0;">${pair.name}</h1>
              ${pair.breed ? `<span class="badge badge-primary" style="font-size:0.8rem;">نوع: ${pair.breed}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary);flex-wrap:wrap;">
              <span class="badge ${pair.status === 'active' ? 'badge-success' : 'badge-danger'}">
                ${pair.status === 'active' ? 'نشط للإنتاج' : 'سابق / متوقف'}
              </span>
              <span>تاريخ التكوين: ${formatDateArabic(pair.pairedDate)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Assigned Coop Link & Bird Count -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
        <div style="padding:10px 12px;background-color:#F8FAF8;border:1px solid var(--border-subtle);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="color:var(--primary);">${icons.coop}</span>
            <span style="font-weight:700;font-size:0.88rem;">
              ${coop ? `سلاكة رقم ${coop.number}` : 'غير مسكن'}
            </span>
          </div>
          ${
            coop
              ? `<button class="btn btn-outline btn-sm" id="btn-goto-coop" style="padding:2px 8px;font-size:0.8rem;">السلاكة ←</button>`
              : ''
          }
        </div>

        <div style="padding:10px 12px;background-color:#F8FAF8;border:1px solid var(--border-subtle);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:0.76rem;color:var(--text-muted);">أفراد الزوج الفعلية (للعلف):</div>
            <div style="font-weight:bold;font-size:0.92rem;color:var(--text-main);">
              ${pair.currentBirdCount ?? 2} فرد
              ${(pair.currentBirdCount ?? 2) < 2 ? '<span style="color:var(--warning);font-size:0.75rem;">(فردي/ناقص)</span>' : ''}
            </div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-change-bird-count" style="padding:2px 8px;font-size:0.8rem;">
            ${icons.tune} تعديل
          </button>
        </div>
      </div>

      <!-- Male and Female Details -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;">
        <div style="background-color:#EFF6FF;border:1px solid #BFDBFE;padding:10px 12px;border-radius:var(--radius-md);display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:6px;color:#1D4ED8;font-weight:800;font-size:0.88rem;">
            ${icons.male} بيانات الذكر
          </div>
          <div style="font-size:0.84rem;color:#1E3A8A;">${pair.maleInfo}</div>
        </div>

        <div style="background-color:#FDF2F8;border:1px solid #FBCFE8;padding:10px 12px;border-radius:var(--radius-md);display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:6px;color:#BE185D;font-weight:800;font-size:0.88rem;">
            ${icons.female} بيانات الأنثى
          </div>
          <div style="font-size:0.84rem;color:#831843;">${pair.femaleInfo}</div>
        </div>
      </div>

      ${
        pair.notes
          ? `<div style="padding:10px 12px;background-color:#F0F4F1;border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">
              <strong>ملاحظات:</strong> ${pair.notes}
            </div>`
          : ''
      }
    </div>

    <!-- 5. أرقام الزوج المستخرجة لحظياً (Pair Statistics Summary) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.tasks}
          إحصائيات إنتاج الزوج اللحظية
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;font-size:0.84rem;">
        <!-- Eggs Stats -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">إجمالي البيض</div>
          <div style="font-size:1.35rem;font-weight:800;color:var(--text-main);">${pairStats.totalEggs}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
            ${pairStats.fertileEggs} مخصب • ${pairStats.infertileEggs} رايق
          </div>
        </div>

        <!-- Hatching Stats -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">البيض الفاقس</div>
          <div style="font-size:1.35rem;font-weight:800;color:#0369A1;">${pairStats.hatchedEggs}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
            ${pairStats.brokenEggs + pairStats.lostEggs} كسر/فقد
          </div>
        </div>

        <!-- Squabs Stats -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">الزغاليل الحية</div>
          <div style="font-size:1.35rem;font-weight:800;color:#166534;">${pairStats.liveSquabs}</div>
          <div style="font-size:0.72rem;color:var(--danger);margin-top:2px;">
            ${pairStats.deceasedSquabs} نافق (إجمالي ${pairStats.totalSquabs})
          </div>
        </div>

        <!-- Phase 3: Transferred Squabs -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">المنقول للتجميع</div>
          <div style="font-size:1.35rem;font-weight:800;color:#4338CA;">${pairStats.transferredSquabs}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
            زغاليل نُقلت للفطام
          </div>
        </div>

        <!-- Phase 3: Sold Squabs -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">الزغاليل المباعة</div>
          <div style="font-size:1.35rem;font-weight:800;color:#15803D;">${pairStats.soldSquabs}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
            تم بيعها بالفعل
          </div>
        </div>

        <!-- Phase 3: Sales Revenue -->
        <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.75rem;">إيراد مبيعات الزوج</div>
          <div style="font-size:1.2rem;font-weight:800;color:#047857;">${pairStats.salesRevenue} <span style="font-size:0.75rem;font-weight:600;">ج.م</span></div>
          <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
            مبيعات فعلية مسجلة
          </div>
        </div>
      </div>
    </div>

    <!-- تقييم وترتيب الزوج في الفترة (المرحلة الخامسة) -->
    <div class="card" style="border-color:${rankingItem?.colorIndicator === 'green' ? '#A7F3D0' : rankingItem?.colorIndicator === 'yellow' ? '#FDE68A' : rankingItem?.colorIndicator === 'red' ? '#FECDD3' : 'var(--border-subtle)'};background-color:${rankingItem?.colorIndicator === 'green' ? '#F0FDF4' : rankingItem?.colorIndicator === 'yellow' ? '#FFFBEB' : rankingItem?.colorIndicator === 'red' ? '#FFF1F2' : 'var(--surface)'};">
      <div class="card-header" style="border-color:transparent;padding-bottom:4px;">
        <div class="card-title" style="font-size:0.98rem;display:flex;align-items:center;gap:6px;">
          ${icons.stats || '📊'}
          <span>تقييم وترتيب الزوج (آخر 6 أشهر)</span>
        </div>
        ${
          rankingItem
            ? `<span class="badge" style="font-weight:bold;font-size:0.75rem;background-color:${rankingItem.colorIndicator === 'green' ? '#DCFCE7' : rankingItem.colorIndicator === 'yellow' ? '#FEF3C7' : rankingItem.colorIndicator === 'red' ? '#FEE2E2' : '#F3F4F6'};color:${rankingItem.colorIndicator === 'green' ? '#15803D' : rankingItem.colorIndicator === 'yellow' ? '#B45309' : rankingItem.colorIndicator === 'red' ? '#BE123C' : '#4B5563'};border:1px solid currentColor;">
                ${rankingItem.colorIndicatorLabel}
               </span>`
            : ''
        }
      </div>

      <div style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:10px;">
        ${
          rankIndex !== null
            ? `<strong>المركز #${rankIndex}</strong> في المزرعة من أصل ${pairRankingData.rankedPairs.length} أزواج مؤهلة أتمت دورتين كاملتين.`
            : `<span>${rankingItem?.insufficientDataReason || 'لا توجد بيانات كافية للترتيب الرئيسي (أقل من دورتين مكتملتين بالفترة)'}</span>`
        }
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="font-size:0.78rem;color:var(--text-muted);">
          التخصيب: <strong>${rankingItem?.fertilityRate !== null && rankingItem?.fertilityRate !== undefined ? rankingItem.fertilityRate + '%' : 'غير متاح'}</strong> • 
          الفقس: <strong>${rankingItem?.hatchRate !== null && rankingItem?.hatchRate !== undefined ? rankingItem.hatchRate + '%' : 'غير متاح'}</strong> • 
          البقاء: <strong>${rankingItem?.survivalRate !== null && rankingItem?.survivalRate !== undefined ? rankingItem.survivalRate + '%' : 'غير متاح'}</strong> • 
          الواصل للبيع: <strong style="color:#047857;">${rankingItem?.reachedSaleCount ?? 0} زغلول</strong>
        </div>

        <div style="display:flex;gap:6px;">
          ${
            rankingItem
              ? `<button type="button" class="btn btn-sm btn-outline text-xs" id="btn-pair-rank-detail">
                  تفاصيل تقييم الزوج
                 </button>`
              : ''
          }
          <button type="button" class="btn btn-sm btn-primary text-xs" id="btn-pair-all-reports">
            جدول الترتيب الشامل ←
          </button>
        </div>
      </div>
    </div>

    <!-- Production Cycles & Nests (دورات الإنتاج والعشوش والبيض والزغاليل) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.egg}
          تاريخ الدورات والعشوش (${cycles.length})
        </div>
        ${
          pair.status === 'active'
            ? `<button class="btn btn-sm btn-primary" id="btn-lay-egg-pair">${icons.plus} تسجيل وضع بيض</button>`
            : ''
        }
      </div>

      ${
        cycles.length === 0
          ? `
        <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.9rem;">
          لم يسجل هذا الزوج أي دورة إنتاج (عش) حتى الآن.
          ${
            pair.status === 'active'
              ? `<div style="margin-top:10px;"><button class="btn btn-primary btn-sm" id="btn-first-egg-pair">${icons.plus} تسجيل أول وضع بيض</button></div>`
              : ''
          }
        </div>
      `
          : `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${cycles
            .map((cycle) => {
              const cycleEggs = eggs.filter((e) => e.cycleId === cycle.id);
              const cycleSquabs = squabs.filter((s) => s.cycleId === cycle.id);

              return `
              <div style="border:1.5px solid var(--border-subtle);border-radius:var(--radius-lg);padding:14px;background-color:var(--surface-subtle);display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:800;font-size:1.05rem;color:var(--primary);">عش رقم ${cycle.cycleNumber}</span>
                    <span class="badge ${cycle.status === 'active' ? 'badge-primary' : 'badge-muted'}">
                      ${cycle.status === 'active' ? 'عش نشط' : 'مكتمل'}
                    </span>
                  </div>
                  <span style="font-size:0.8rem;color:var(--text-muted);">
                    بداية العش: ${formatDateArabic(cycle.startDate)}
                  </span>
                </div>

                <!-- Eggs in this cycle -->
                <div>
                  <div style="font-weight:700;font-size:0.86rem;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                    ${icons.egg} البيض المسجل (${cycleEggs.length}):
                  </div>

                  ${
                    cycleEggs.length === 0
                      ? `<div style="font-size:0.82rem;color:var(--text-muted);padding:4px 0;">لم يتم تسجيل بيض في هذه الدورة بعد.</div>`
                      : `
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      ${cycleEggs
                        .map((egg) => {
                          const schedule = getEggSchedule(egg, settings);

                          return `
                          <div style="background-color:#FFFFFF;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:6px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                              <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-weight:800;font-size:0.95rem;">البيضة رقم ${egg.eggNumber}</span>
                                <span class="badge" style="background-color:${schedule.badgeBg};color:${schedule.badgeText};">
                                  ${schedule.statusText}
                                </span>
                              </div>
                              <span style="font-size:0.78rem;color:var(--text-muted);">
                                وضع: ${formatDateArabic(egg.laidDate)}
                              </span>
                            </div>

                            <div style="font-size:0.82rem;color:${schedule.isCheckDue ? '#92400E' : 'var(--text-secondary)'};font-weight:600;">
                              ${schedule.countdownText}
                            </div>

                            <!-- Contextual Actions -->
                            <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px dashed var(--border-subtle);padding-top:6px;margin-top:2px;">
                              ${
                                egg.status !== 'broken' && egg.status !== 'lost' && egg.status !== 'infertile' && egg.status !== 'hatched'
                                  ? `<button class="btn btn-primary btn-sm btn-egg-hatch" data-egg-id="${egg.id}">
                                      ${icons.squab} تسجيل فقس
                                    </button>`
                                  : ''
                              }

                              ${
                                egg.status === 'pending'
                                  ? `<button class="btn btn-outline btn-sm btn-egg-check" data-egg-id="${egg.id}">
                                      ${icons.check} فحص التخصيب
                                    </button>`
                                  : ''
                              }

                              ${
                                egg.status === 'pending' || egg.status === 'fertile'
                                  ? `<button class="btn btn-danger btn-sm btn-egg-broken" data-egg-id="${egg.id}">
                                      ${icons.eggCrack} تسجيل كسر/فقد
                                    </button>`
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
                </div>

                <!-- Squabs in this cycle (الزغاليل الناتجة من هذه الدورة: النافق والحي) -->
                ${
                  cycleSquabs.length > 0
                    ? `
                  <div style="border-top:1px solid var(--border-subtle);padding-top:10px;">
                    <div style="font-weight:700;font-size:0.86rem;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      ${icons.squab} الزغاليل الناتجة من هذا العش (${cycleSquabs.length}):
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                      ${cycleSquabs
                        .map((sqb) => {
                          const age = getSquabAge(sqb.hatchDate, sqb.deathDate);
                          const isAlive = sqb.status === 'alive_production';

                          return `
                          <div style="background-color:#FFFFFF;border:1px solid ${isAlive ? '#C7E4D0' : '#FCA5A5'};border-radius:var(--radius-md);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <div style="display:flex;align-items:center;gap:8px;">
                              <div style="width:34px;height:34px;border-radius:var(--radius-sm);background-color:${isAlive ? '#DCFCE7' : '#FEE2E2'};color:${isAlive ? '#166534' : '#991B1B'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
                                ${isAlive ? icons.squab : icons.skull}
                              </div>
                              <div style="display:flex;flex-direction:column;gap:1px;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                  <strong style="font-size:0.95rem;">${sqb.codeNumber}</strong>
                                  <span class="badge ${isAlive ? 'badge-success' : 'badge-danger'}" style="font-size:0.72rem;">
                                    ${isAlive ? 'حي' : 'نافق'}
                                  </span>
                                </div>
                                <span style="font-size:0.78rem;color:var(--text-secondary);">
                                  فقس: ${formatDateArabic(sqb.hatchDate)} • ${isAlive ? `العمر: ${formatAgeArabic(age)}` : `توفي بعمر ${age} يوم`}
                                </span>
                              </div>
                            </div>

                            <button class="btn btn-outline btn-sm btn-view-squab" data-squab-id="${sqb.id}" style="padding:4px 8px;font-size:0.78rem;">
                              تفاصيل الزغلول ←
                            </button>
                          </div>
                        `;
                        })
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    </div>

    <!-- Event History for this Pair (سجل أحداث الزوج بالكامل) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${icons.history}
          سجل أحداث الزوج (Event Log)
        </div>
      </div>

      ${
        events.length === 0
          ? `
        <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          لا توجد أحداث مسجلة لهذا الزوج حتى الآن.
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

  // Attach button events
  container.querySelector('#btn-back')?.addEventListener('click', () => {
    if (pair.coopId) {
      navigate('coop_detail', { coopId: pair.coopId });
    } else {
      navigate('coops');
    }
  });

  container.querySelector('#btn-goto-coop')?.addEventListener('click', () => {
    if (pair.coopId) navigate('coop_detail', { coopId: pair.coopId });
  });

  container.querySelector('#btn-change-bird-count')?.addEventListener('click', () => {
    showPairBirdCountChangeModal(pair, () => renderPairDetailView(container, pairId, navigate));
  });

  container.querySelector('#btn-edit-pair')?.addEventListener('click', () => {
    showEditPairModal(pair, () => renderPairDetailView(container, pairId, navigate));
  });

  container.querySelector('#btn-toggle-pair')?.addEventListener('click', () => {
    showTogglePairModal(pair, () => renderPairDetailView(container, pairId, navigate));
  });

  container.querySelector('#btn-lay-egg-pair')?.addEventListener('click', () => {
    showLayEggModal(pair.id, pair.coopId, () => renderPairDetailView(container, pairId, navigate));
  });

  container.querySelector('#btn-first-egg-pair')?.addEventListener('click', () => {
    showLayEggModal(pair.id, pair.coopId, () => renderPairDetailView(container, pairId, navigate));
  });

  // Egg Hatch buttons
  container.querySelectorAll('.btn-egg-hatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eggId = (btn as HTMLElement).dataset.eggId;
      const targetEgg = eggs.find((e) => e.id === eggId);
      if (targetEgg) {
        showRecordHatchModal(
          targetEgg,
          pair.name,
          coop ? coop.number : '—',
          () => renderPairDetailView(container, pairId, navigate)
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
          pair.name,
          coop ? coop.number : '—',
          () => renderPairDetailView(container, pairId, navigate)
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
          pair.name,
          coop ? coop.number : '—',
          () => renderPairDetailView(container, pairId, navigate)
        );
      }
    });
  });

  // Squab link buttons
  container.querySelectorAll('.btn-view-squab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const squabId = (btn as HTMLElement).dataset.squabId;
      if (squabId) navigate('squab_detail', { squabId });
    });
  });

  // Ranking buttons (المرحلة الخامسة)
  container.querySelector('#btn-pair-rank-detail')?.addEventListener('click', () => {
    if (rankingItem) {
      showPairRankingDetailModal(rankingItem, rollingPeriod.fromDate, rollingPeriod.toDate, navigate);
    }
  });

  container.querySelector('#btn-pair-all-reports')?.addEventListener('click', () => {
    navigate('reports');
  });
}

