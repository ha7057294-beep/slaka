import { getEggs, getPairs, getCoops, getSettings } from '../db/indexedDB';
import { Egg } from '../types';
import { getEggSchedule, formatDateArabic } from '../utils/dateUtils';
import { icons } from '../utils/icons';
import {
  showLayEggModal,
  showEggFertilityCheckModal,
  showEggBrokenOrLostModal,
  showEventHistoryModal,
  showRecordHatchModal,
} from '../components/Modal';

export async function renderEggsView(
  container: HTMLElement,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [eggs, pairs, coops, settings] = await Promise.all([
    getEggs(),
    getPairs(),
    getCoops(),
    getSettings(),
  ]);

  let currentFilter = 'active';

  function filterEggs(filter: string): Egg[] {
    switch (filter) {
      case 'active':
        return eggs.filter((e) => e.status === 'pending' || e.status === 'fertile');
      case 'pending':
        return eggs.filter((e) => e.status === 'pending');
      case 'fertile':
        return eggs.filter((e) => e.status === 'fertile');
      case 'hatched':
        return eggs.filter((e) => e.status === 'hatched');
      case 'infertile':
        return eggs.filter((e) => e.status === 'infertile');
      case 'broken_lost':
        return eggs.filter((e) => e.status === 'broken' || e.status === 'lost');
      default:
        return eggs;
    }
  }

  function renderList() {
    const listContainer = container.querySelector('#eggs-list-container');
    if (!listContainer) return;

    const filtered = filterEggs(currentFilter);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icons.egg}</div>
          <div class="empty-title">لا يوجد بيض في هذا التصنيف</div>
          <div class="empty-desc">
            ${eggs.length === 0 ? 'ابدأ بتسجيل أول بيضة وضعت في المزرعة.' : 'لا يوجد بيض يطابق هذا الفلتر.'}
          </div>
          <button class="btn btn-primary btn-lg" id="btn-lay-egg-empty">
            ${icons.plus} تسجيل وضع بيض جديد
          </button>
        </div>
      `;
      listContainer.querySelector('#btn-lay-egg-empty')?.addEventListener('click', () => {
        showLayEggModal(null, null, () => renderEggsView(container, navigate));
      });
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${filtered
          .map((egg) => {
            const pair = pairs.find((p) => p.id === egg.pairId);
            const coop = coops.find((c) => c.id === egg.coopId);
            const schedule = getEggSchedule(egg, settings);

            return `
            <div class="card" style="padding:16px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:46px;height:46px;border-radius:var(--radius-md);background-color:${schedule.badgeBg};color:${schedule.badgeText};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.15rem;flex-shrink:0;">
                    ${egg.status === 'broken' || egg.status === 'lost' ? icons.eggCrack : egg.status === 'hatched' ? icons.squab : icons.egg}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:2px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-weight:800;font-size:1.05rem;">البيضة رقم ${egg.eggNumber}</span>
                      <span class="badge" style="background-color:${schedule.badgeBg};color:${schedule.badgeText};">
                        ${schedule.statusText}
                      </span>
                    </div>
                    <div style="font-size:0.84rem;color:var(--text-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      ${
                        pair
                          ? `<span class="goto-pair" data-pair-id="${pair.id}" style="color:var(--primary);font-weight:700;cursor:pointer;">الزوج: ${pair.name}</span>`
                          : ''
                      }
                      ${
                        coop
                          ? `<span class="goto-coop" data-coop-id="${coop.id}" style="color:var(--text-secondary);cursor:pointer;">(سلاكة ${coop.number})</span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>

                <button class="btn btn-outline btn-icon-only btn-egg-history" data-egg-id="${egg.id}" title="سجل أحداث البيضة">
                  ${icons.history}
                </button>
              </div>

              <!-- Dates & Countdown Box -->
              <div style="background-color:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;margin-top:6px;display:flex;flex-direction:column;gap:4px;">
                <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.82rem;color:var(--text-secondary);">
                  <span>تاريخ الوضع: <strong>${formatDateArabic(egg.laidDate)}</strong></span>
                  <span>منذ ${schedule.daysSinceLaid} يوم</span>
                </div>

                <div style="font-size:0.86rem;font-weight:700;color:${schedule.isCheckDue ? '#92400E' : 'var(--text-main)'};">
                  ${schedule.countdownText}
                </div>
              </div>

              <!-- Strict Contextual Action Buttons -->
              <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--border-subtle);padding-top:10px;margin-top:4px;">
                ${
                  (egg.status === 'pending' || egg.status === 'fertile')
                    ? `<button class="btn btn-success btn-sm btn-action-hatch" data-egg-id="${egg.id}" style="font-weight:700;">
                        ${icons.squab} تسجيل فقس
                      </button>`
                    : ''
                }

                ${
                  egg.status === 'pending'
                    ? `<button class="btn btn-primary btn-sm btn-action-check" data-egg-id="${egg.id}">
                        ${icons.check} فحص التخصيب
                      </button>`
                    : ''
                }

                ${
                  egg.status === 'fertile'
                    ? `<button class="btn btn-outline btn-sm btn-action-check" data-egg-id="${egg.id}">
                        ${icons.edit} إعادة فحص التخصيب
                      </button>`
                    : ''
                }

                ${
                  egg.status === 'pending' || egg.status === 'fertile'
                    ? `<button class="btn btn-danger btn-sm btn-action-broken" data-egg-id="${egg.id}">
                        ${icons.eggCrack} تسجيل كسر أو فقدان
                      </button>`
                    : ''
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // Attach row event listeners
    listContainer.querySelectorAll('.goto-pair').forEach((elem) => {
      elem.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (elem as HTMLElement).dataset.pairId;
        if (id) navigate('pair_detail', { pairId: id });
      });
    });

    listContainer.querySelectorAll('.goto-coop').forEach((elem) => {
      elem.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (elem as HTMLElement).dataset.coopId;
        if (id) navigate('coop_detail', { coopId: id });
      });
    });

    listContainer.querySelectorAll('.btn-egg-history').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.eggId;
        const targetEgg = eggs.find((e) => e.id === id);
        if (targetEgg) {
          showEventHistoryModal(`البيضة رقم ${targetEgg.eggNumber} (${formatDateArabic(targetEgg.laidDate)})`, targetEgg.id);
        }
      });
    });

    listContainer.querySelectorAll('.btn-action-hatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.eggId;
        const targetEgg = eggs.find((e) => e.id === id);
        if (targetEgg) {
          const pair = pairs.find((p) => p.id === targetEgg.pairId);
          const coop = coops.find((c) => c.id === targetEgg.coopId);
          showRecordHatchModal(
            targetEgg,
            pair ? pair.name : '—',
            coop ? coop.number : '—',
            () => renderEggsView(container, navigate)
          );
        }
      });
    });

    listContainer.querySelectorAll('.btn-action-check').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.eggId;
        const targetEgg = eggs.find((e) => e.id === id);
        if (targetEgg) {
          const pair = pairs.find((p) => p.id === targetEgg.pairId);
          const coop = coops.find((c) => c.id === targetEgg.coopId);
          showEggFertilityCheckModal(
            targetEgg,
            pair ? pair.name : '—',
            coop ? coop.number : '—',
            () => renderEggsView(container, navigate)
          );
        }
      });
    });

    listContainer.querySelectorAll('.btn-action-broken').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.eggId;
        const targetEgg = eggs.find((e) => e.id === id);
        if (targetEgg) {
          const pair = pairs.find((p) => p.id === targetEgg.pairId);
          const coop = coops.find((c) => c.id === targetEgg.coopId);
          showEggBrokenOrLostModal(
            targetEgg,
            pair ? pair.name : '—',
            coop ? coop.number : '—',
            () => renderEggsView(container, navigate)
          );
        }
      });
    });
  }

  container.innerHTML = `
    <!-- Top Action Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);">سجل البيض</h1>
        <p style="font-size:0.82rem;color:var(--text-secondary);">متابعة التخصيب، فترات الحضانة، ومواعيد الفقس المتوقعة</p>
      </div>
      <button class="btn btn-primary btn-lg" id="btn-lay-egg-top">
        ${icons.plus} تسجيل وضع بيض
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button class="filter-tab active" data-filter="active">
        بالحضانة (${eggs.filter((e) => e.status === 'pending' || e.status === 'fertile').length})
      </button>
      <button class="filter-tab" data-filter="pending">
        بانتظار الفحص (${eggs.filter((e) => e.status === 'pending').length})
      </button>
      <button class="filter-tab" data-filter="fertile">
        مخصبة (${eggs.filter((e) => e.status === 'fertile').length})
      </button>
      <button class="filter-tab" data-filter="hatched">
        فقست (${eggs.filter((e) => e.status === 'hatched').length})
      </button>
      <button class="filter-tab" data-filter="infertile">
        رايقة (${eggs.filter((e) => e.status === 'infertile').length})
      </button>
      <button class="filter-tab" data-filter="broken_lost">
        مكسورة/مفقودة (${eggs.filter((e) => e.status === 'broken' || e.status === 'lost').length})
      </button>
      <button class="filter-tab" data-filter="all">
        الكل (${eggs.length})
      </button>
    </div>

    <!-- Eggs List Container -->
    <div id="eggs-list-container"></div>
  `;

  renderList();

  container.querySelector('#btn-lay-egg-top')?.addEventListener('click', () => {
    showLayEggModal(null, null, () => renderEggsView(container, navigate));
  });

  container.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = (tab as HTMLElement).dataset.filter || 'active';
      renderList();
    });
  });
}
