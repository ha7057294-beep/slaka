import { getPairs, getCoops, getEggs } from '../db/indexedDB';
import { Pair } from '../types';
import { formatDateArabic } from '../utils/dateUtils';
import { icons } from '../utils/icons';
import { showAddPairModal } from '../components/Modal';

export async function renderPairsView(
  container: HTMLElement,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [pairs, coops, eggs] = await Promise.all([getPairs(), getCoops(), getEggs()]);

  let currentFilter = 'all';

  function filterPairs(filter: string): Pair[] {
    switch (filter) {
      case 'active':
        return pairs.filter((p) => p.status === 'active');
      case 'inactive':
        return pairs.filter((p) => p.status === 'inactive');
      default:
        return pairs;
    }
  }

  function renderList() {
    const listContainer = container.querySelector('#pairs-list-container');
    if (!listContainer) return;

    const filtered = filterPairs(currentFilter);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icons.pair}</div>
          <div class="empty-title">لا توجد أزواج في هذا القسم</div>
          <div class="empty-desc">
            ${pairs.length === 0 ? 'ابدأ بإضافة أول زوج حمام وحدد سلاكته.' : 'لا توجد أزواج تطابق هذا الفلتر.'}
          </div>
          <button class="btn btn-primary btn-lg" id="btn-add-pair-empty">
            ${icons.plus} إضافة زوج جديد
          </button>
        </div>
      `;
      listContainer.querySelector('#btn-add-pair-empty')?.addEventListener('click', () => {
        showAddPairModal(null, () => renderPairsView(container, navigate));
      });
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${filtered
          .map((pair) => {
            const coop = coops.find((c) => c.id === pair.coopId);
            const pairEggs = eggs.filter((e) => e.pairId === pair.id);
            const activeEggsCount = pairEggs.filter((e) => e.status === 'pending' || e.status === 'fertile').length;

            return `
            <div class="card pair-card" data-pair-id="${pair.id}" style="cursor:pointer;padding:16px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:48px;height:48px;border-radius:var(--radius-md);background-color:#E0F2FE;color:#0284C7;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                    ${icons.pair}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:3px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-weight:800;font-size:1.08rem;color:var(--text-main);">${pair.name}</span>
                    </div>
                    <div style="font-size:0.84rem;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
                      ${
                        coop
                          ? `<span class="badge badge-primary">سلاكة رقم ${coop.number}</span>`
                          : `<span class="badge badge-muted">بدون سلاكة</span>`
                      }
                      <span>تكوين: ${formatDateArabic(pair.pairedDate)}</span>
                    </div>
                  </div>
                </div>

                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                  <span class="badge ${pair.status === 'active' ? 'badge-success' : 'badge-danger'}">
                    ${pair.status === 'active' ? 'نشط' : 'متوقف'}
                  </span>
                  ${
                    activeEggsCount > 0
                      ? `<span class="badge badge-warning" style="font-size:0.75rem;">${activeEggsCount} بالحضانة</span>`
                      : ''
                  }
                </div>
              </div>

              <!-- Male and Female Info Preview -->
              <div style="background-color:var(--surface-subtle);border-radius:var(--radius-sm);padding:8px 12px;margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:0.82rem;">
                <div style="display:flex;align-items:center;gap:6px;color:#1E40AF;">
                  ${icons.male} <strong>الذكر:</strong> <span>${pair.maleInfo}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;color:#9D174D;">
                  ${icons.female} <strong>الأنثى:</strong> <span>${pair.femaleInfo}</span>
                </div>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px dashed var(--border-subtle);padding-top:8px;margin-top:4px;font-size:0.8rem;color:var(--text-muted);">
                <span>إجمالي الإنتاج: ${pairEggs.length} بيضة</span>
                <span style="color:var(--primary);font-weight:700;">عرض التفاصيل والعشوش ←</span>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    listContainer.querySelectorAll('.pair-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.pairId;
        if (id) navigate('pair_detail', { pairId: id });
      });
    });
  }

  container.innerHTML = `
    <!-- Top Action Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);">الأزواج</h1>
        <p style="font-size:0.82rem;color:var(--text-secondary);">إدارة ومتابعة أزواج الحمام، السلالات، والعشوش</p>
      </div>
      <button class="btn btn-primary btn-lg" id="btn-add-pair-top">
        ${icons.plus} إضافة زوج
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button class="filter-tab active" data-filter="all">الكل (${pairs.length})</button>
      <button class="filter-tab" data-filter="active">نشطة (${pairs.filter((p) => p.status === 'active').length})</button>
      <button class="filter-tab" data-filter="inactive">متوقفة (${pairs.filter((p) => p.status === 'inactive').length})</button>
    </div>

    <!-- Pairs List Container -->
    <div id="pairs-list-container"></div>
  `;

  renderList();

  container.querySelector('#btn-add-pair-top')?.addEventListener('click', () => {
    showAddPairModal(null, () => renderPairsView(container, navigate));
  });

  container.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = (tab as HTMLElement).dataset.filter || 'all';
      renderList();
    });
  });
}
