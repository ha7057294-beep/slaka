import { getCoops, getPairs, getEggs, getSquabs } from '../db/indexedDB';
import { Coop } from '../types';
import { icons } from '../utils/icons';
import { showAddCoopModal } from '../components/Modal';
import { getSquabAge } from '../utils/dateUtils';

export async function renderCoopsView(
  container: HTMLElement,
  navigate: (view: string, params?: Record<string, string>) => void
) {
  const [coops, pairs, eggs, squabs] = await Promise.all([
    getCoops(),
    getPairs(),
    getEggs(),
    getSquabs(),
  ]);

  let currentFilter = 'all';

  function filterCoops(filter: string): Coop[] {
    switch (filter) {
      case 'active':
        return coops.filter((c) => c.active);
      case 'inactive':
        return coops.filter((c) => !c.active);
      case 'production':
        return coops.filter((c) => c.type === 'production');
      case 'collection':
        return coops.filter((c) => c.type === 'collection');
      default:
        return coops;
    }
  }

  function renderList() {
    const listContainer = container.querySelector('#coops-list-container');
    if (!listContainer) return;

    const filtered = filterCoops(currentFilter);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icons.coop}</div>
          <div class="empty-title">لا توجد سلاكات في هذا القسم</div>
          <div class="empty-desc">
            ${coops.length === 0 ? 'ابدأ بإضافة أول سلاكة لمزرعتك.' : 'لا توجد سلاكات تطابق هذا الفلتر.'}
          </div>
          <button class="btn btn-primary btn-lg" id="btn-add-coop-empty">
            ${icons.plus} إضافة سلاكة جديدة
          </button>
        </div>
      `;
      listContainer.querySelector('#btn-add-coop-empty')?.addEventListener('click', () => {
        showAddCoopModal(() => renderCoopsView(container, navigate));
      });
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${filtered
          .map((coop) => {
            const residentPair = pairs.find((p) => p.coopId === coop.id && p.status === 'active');
            const coopEggs = eggs.filter((e) => e.coopId === coop.id && (e.status === 'pending' || e.status === 'fertile'));
            const coopSquabs = squabs.filter(
              (s) =>
                s.status === 'alive_production' &&
                (s.currentLocationId === coop.id || (!s.currentLocationId && s.originCoopId === coop.id))
            );
            const maxSquabAge =
              coopSquabs.length > 0
                ? Math.max(...coopSquabs.map((s) => getSquabAge(s.hatchDate)))
                : 0;
            const hasSquabsReadyForTransfer = coopSquabs.length > 0 && maxSquabAge >= 20;

            return `
            <div class="card coop-card" data-coop-id="${coop.id}" style="cursor:pointer;padding:16px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:48px;height:48px;border-radius:var(--radius-md);background-color:${coop.active ? 'var(--primary-light)' : '#F3F4F6'};color:${coop.active ? 'var(--primary)' : '#6B7280'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;flex-shrink:0;">
                    ${coop.number}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:3px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-weight:800;font-size:1.05rem;color:var(--text-main);">سلاكة رقم ${coop.number}</span>
                      <span class="badge ${coop.type === 'production' ? 'badge-primary' : 'badge-muted'}">
                        ${coop.type === 'production' ? 'إنتاج' : 'تجميع'}
                      </span>
                    </div>
                    <div style="font-size:0.86rem;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
                      ${
                        residentPair
                          ? `<span style="color:var(--primary);font-weight:700;">الزوج: ${residentPair.name}${residentPair.breed ? ` (${residentPair.breed})` : ''}</span>`
                          : `<span style="color:var(--text-muted);">فارغة (بدون زوج)</span>`
                      }
                    </div>
                  </div>
                </div>

                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                  <span class="badge ${coop.active ? 'badge-success' : 'badge-danger'}">
                    ${coop.active ? 'نشطة' : 'متوقفة'}
                  </span>
                  ${
                    coopEggs.length > 0
                      ? `<span class="badge badge-warning" style="font-size:0.75rem;">${coopEggs.length} بيض بالحضن</span>`
                      : ''
                  }
                  ${
                    coopSquabs.length > 0
                      ? `<span class="badge badge-squab" style="font-size:0.75rem;">${coopSquabs.length} زغلول · أكبرهم ${maxSquabAge} يوم</span>`
                      : ''
                  }
                  ${
                    hasSquabsReadyForTransfer
                      ? `<span class="badge badge-transfer" style="font-size:0.75rem;font-weight:700;">جاهز للنقل</span>`
                      : ''
                  }
                </div>
              </div>

              ${
                coop.notes
                  ? `<div style="font-size:0.8rem;color:var(--text-muted);border-top:1px dashed var(--border-subtle);padding-top:8px;margin-top:4px;">${coop.notes}</div>`
                  : ''
              }
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // Click on coop card to open details
    listContainer.querySelectorAll('.coop-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.coopId;
        if (id) navigate('coop_detail', { coopId: id });
      });
    });
  }

  container.innerHTML = `
    <!-- Top Action Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <h1 style="font-size:1.35rem;font-weight:800;color:var(--text-main);">السلاكات</h1>
        <p style="font-size:0.82rem;color:var(--text-secondary);">إدارة السلاكات والأبراج، متابعة إشغالها وأحداثها</p>
      </div>
      <button class="btn btn-primary btn-lg" id="btn-add-coop-top">
        ${icons.plus} إضافة سلاكة
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button class="filter-tab active" data-filter="all">الكل (${coops.length})</button>
      <button class="filter-tab" data-filter="active">نشطة (${coops.filter((c) => c.active).length})</button>
      <button class="filter-tab" data-filter="production">إنتاج (${coops.filter((c) => c.type === 'production').length})</button>
      <button class="filter-tab" data-filter="collection">تجميع (${coops.filter((c) => c.type === 'collection').length})</button>
      <button class="filter-tab" data-filter="inactive">متوقفة (${coops.filter((c) => !c.active).length})</button>
    </div>

    <!-- Coops List Container -->
    <div id="coops-list-container"></div>
  `;

  renderList();

  container.querySelector('#btn-add-coop-top')?.addEventListener('click', () => {
    showAddCoopModal(() => renderCoopsView(container, navigate));
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
