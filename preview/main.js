// 简易数据预览脚本：加载 JSON 并提供分级选择与搜索

const paths = {
  mainland: '/pages/school-selector/data/mainland_by_province.json',
  hmt: '/pages/school-selector/data/hk_macao_taiwan.json',
  foreign: '/pages/school-selector/data/foreign_by_country.json',
};

const state = {
  mainland: { data: {}, currentProvince: null },
  hmt: { data: {}, currentRegion: null },
  foreign: { data: {}, currentCountry: null },
  search: '',
};

async function loadData() {
  const [mainland, hmt, foreign] = await Promise.all([
    fetch(paths.mainland).then((r) => r.json()),
    fetch(paths.hmt).then((r) => r.json()),
    fetch(paths.foreign).then((r) => r.json()),
  ]);
  state.mainland.data = mainland;
  state.hmt.data = hmt;
  state.foreign.data = foreign;
}

function renderList(el, items, { selectableKey } = {}) {
  el.innerHTML = '';
  items.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    if (selectableKey) {
      li.addEventListener('click', () => {
        state[selectableKey].current = name;
      });
    }
    el.appendChild(li);
  });
}

function renderMainland() {
  const provincesEl = document.getElementById('mainland-provinces');
  const schoolsEl = document.getElementById('mainland-schools');
  const provinces = Object.keys(state.mainland.data).sort();

  provincesEl.innerHTML = '';
  provinces.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p;
    li.addEventListener('click', () => {
      state.mainland.currentProvince = p;
      const list = state.mainland.data[p] || [];
      const filtered = filterBySearch(list);
      renderList(schoolsEl, filtered);
      markActive(provincesEl, p);
    });
    provincesEl.appendChild(li);
  });

  // 选中第一个省份
  if (provinces.length) {
    provincesEl.firstChild.click();
  }
}

function renderHMT() {
  const regionsEl = document.getElementById('hmt-regions');
  const schoolsEl = document.getElementById('hmt-schools');
  const regions = Object.keys(state.hmt.data).sort();

  regionsEl.innerHTML = '';
  regions.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r;
    li.addEventListener('click', () => {
      state.hmt.currentRegion = r;
      const list = state.hmt.data[r] || [];
      const filtered = filterBySearch(list);
      renderList(schoolsEl, filtered);
      markActive(regionsEl, r);
    });
    regionsEl.appendChild(li);
  });

  if (regions.length) {
    regionsEl.firstChild.click();
  }
}

function renderForeign() {
  const countriesEl = document.getElementById('foreign-countries');
  const schoolsEl = document.getElementById('foreign-schools');
  const countries = Object.keys(state.foreign.data).sort();

  countriesEl.innerHTML = '';
  countries.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c;
    li.addEventListener('click', () => {
      state.foreign.currentCountry = c;
      const list = state.foreign.data[c] || [];
      const filtered = filterBySearch(list);
      renderList(schoolsEl, filtered);
      markActive(countriesEl, c);
    });
    countriesEl.appendChild(li);
  });

  if (countries.length) {
    countriesEl.firstChild.click();
  }
}

function filterBySearch(list) {
  if (!state.search) return list;
  const s = state.search.trim();
  if (!s) return list;
  return list.filter((name) => name.includes(s));
}

function markActive(listEl, text) {
  Array.from(listEl.children).forEach((li) => {
    li.classList.toggle('active', li.textContent === text);
  });
}

function bindTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset.tab;
      document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(`panel-${target}`).classList.remove('hidden');
    });
  });
}

function bindSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  const info = document.getElementById('searchInfo');

  input.addEventListener('input', () => {
    state.search = input.value;
    info.textContent = state.search ? `正在搜索：${state.search}` : '';
    rerenderCurrentPanel();
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    state.search = '';
    info.textContent = '';
    rerenderCurrentPanel();
  });
}

function rerenderCurrentPanel() {
  const active = document.querySelector('.tab.active').dataset.tab;
  if (active === 'mainland') renderMainland();
  if (active === 'hmt') renderHMT();
  if (active === 'foreign') renderForeign();
}

(async function init() {
  bindTabs();
  bindSearch();
  await loadData();
  renderMainland();
  renderHMT();
  renderForeign();
})();