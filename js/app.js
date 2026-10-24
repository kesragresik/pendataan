/**
 * Sistem Informasi Pendataan Tempat Ibadah
 * Bagian Kesejahteraan Rakyat - Sekretariat Daerah Kabupaten Gresik
 * Interactive Engine with Mandatory Kecamatan Gateway & Scoped District Export
 */

// Endpoint sinkronisasi data online (sumber data sistem pusat)
const REMOTE_DATA_ENDPOINT = atob("aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvZS8yUEFDWC0xdlR0NXpuckZORk40QW9pR1R3OWJKYk1mczZYb0RRWF9OeDlfdmZ2MF9xbWN0NVg2Wl9uQU5JZUpGcG9IWmlYR0hfNkRNV0VMaG52YXdLVi9wdWI/Z2lkPTE3MzE1OTU5MTYmc2luZ2xlPXRydWUmb3V0cHV0PWNzdg==");

const STORAGE_KEY_THEME = "tempat_ibadah_theme";
const STORAGE_KEY_CACHE = "tempat_ibadah_cached_csv";
const STORAGE_KEY_TIME = "tempat_ibadah_cached_time";

// State Global
const state = {
  selectedKecamatan: null,       // null = Halaman Landing Pemilihan Kecamatan; string = Halaman Dashboard Kecamatan
  landingSearchQuery: "",        // Pencarian nama kecamatan di halaman landing
  rawHeaders: [],                // Header mentah CSV
  rawRows: [],                   // Seluruh baris data se-Kabupaten Gresik
  kecamatanSummaryList: [],      // Rangkuman 18 kecamatan beserta total & breakdown jenis
  kecamatanAllRows: [],          // SELURUH data tempat ibadah pada kecamatan yang sedang dipilih (100% 1 kecamatan)
  kemenagAllRows: [],            // SELURUH data tempat ibadah Kemenag khusus kecamatan yang dipilih (untuk unduh)
  filteredRows: [],              // Data tempat ibadah hasil filter di layar (search/kategori/status)
  currentPage: 1,
  rowsPerPage: 25,
  sortColIndex: -1,
  sortAsc: false,                // Default descending saat kolom timestamp aktif
  searchQuery: "",
  filterJenisVal: "ALL",
  filterStatusVal: "ALL",
  jenisColIdx: -1,
  kecamatanColIdx: -1,
  statusColIdx: -1,
  timestampColIdx: -1,
  lastUpdated: null
};

/**
 * Menghilangkan semua spasi yang ada di depan kata/kalimat pada data
 * (Termasuk spasi biasa, tab, non-breaking space & spasi di awal setiap baris baru)
 */
function cleanLeadingSpaces(val) {
  if (val === null || val === undefined) return "";
  let str = val.toString();
  // Hilangkan BOM atau karakter zero-width jika ada
  str = str.replace(/^[\uFEFF\u200B]+/, "");
  // Hilangkan spasi/tab/nbsp di depan setiap baris baru/kalimat
  str = str.replace(/^[ \t\u00A0\r]+/gm, "");
  // Hilangkan spasi di awal string
  return str.trimStart();
}



// Robust CSV Parser (Menangani koma dalam kutip, baris baru/multiline di dalam sel)
function parseCSV(csvText) {
  if (!csvText) return [];
  const cleanText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(cleanLeadingSpaces(currentCell));
        currentCell = "";
      } else if (char === '\n') {
        currentRow.push(cleanLeadingSpaces(currentCell));
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(cleanLeadingSpaces(currentCell));
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Inisialisasi Saat Dokumen Dimuat
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initEventListeners();
  bootstrapData();
});

// Setup Dark/Light Theme
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  if (theme === "dark") {
    btn.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
    btn.setAttribute("title", "Ubah ke Mode Terang");
  } else {
    btn.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
    btn.setAttribute("title", "Ubah ke Mode Gelap");
  }
}

// Inisialisasi Kontrol UI & Event Listener
function initEventListeners() {
  // 1. Kontrol Landing Page: Pencarian Kecamatan
  const landingSearch = document.getElementById("landingKecamatanSearch");
  const landingClear = document.getElementById("landingKecamatanClear");

  if (landingSearch) {
    landingSearch.addEventListener("input", (e) => {
      state.landingSearchQuery = e.target.value.trim().toLowerCase();
      if (landingClear) {
        landingClear.style.display = state.landingSearchQuery ? "flex" : "none";
      }
      renderLandingKecamatan();
    });
  }

  if (landingClear) {
    landingClear.addEventListener("click", () => {
      landingSearch.value = "";
      state.landingSearchQuery = "";
      landingClear.style.display = "none";
      renderLandingKecamatan();
      landingSearch.focus();
    });
  }

  // 2. Tombol Ganti Kecamatan (Kembali ke Landing)
  const changeKecBtn = document.getElementById("changeKecamatanBtn");
  if (changeKecBtn) {
    changeKecBtn.addEventListener("click", () => {
      showLandingPage();
    });
  }

  // 3. Kontrol Tabel Dashboard: Pencarian Instan di Kecamatan Terpilih
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      if (clearBtn) {
        clearBtn.style.display = state.searchQuery ? "flex" : "none";
      }
      state.currentPage = 1;
      applyFilters();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      searchInput.value = "";
      state.searchQuery = "";
      clearBtn.style.display = "none";
      state.currentPage = 1;
      applyFilters();
      searchInput.focus();
    });
  }

  // 4. Dropdown Filter Jenis & Status di Dashboard
  const categoryFilter = document.getElementById("categoryFilterSelect");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      state.filterJenisVal = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  const statusFilter = document.getElementById("statusFilterSelect");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      state.filterStatusVal = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 5. Dropdown Baris per Halaman
  const rowsPerPageSelect = document.getElementById("rowsPerPageSelect");
  if (rowsPerPageSelect) {
    rowsPerPageSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      state.rowsPerPage = val === "ALL" ? Infinity : parseInt(val, 10);
      state.currentPage = 1;
      renderTable();
    });
  }

  // 6. Tombol Refresh / Sinkronisasi Online
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      syncOnlineData(true);
    });
  }

  // 7. Toggle Theme
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // 8. Tombol Ekspor (PASTI 1 KECAMATAN PENUH)
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportToExcel);
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", exportToPDF);
  }


  // 10. Tombol Unduh Data Kemenag (Excel .xlsx)
  const dlKemenagBtn = document.getElementById("downloadKemenagBtn");
  if (dlKemenagBtn) {
    dlKemenagBtn.addEventListener("click", () => {
      exportKemenagExcel(state.selectedKecamatan);
    });
  }

  // 11. Tombol Muat Ulang pada Layar Error Inisialisasi
  const initRefreshBtn = document.getElementById("initLoaderRefreshBtn");
  if (initRefreshBtn) {
    initRefreshBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }
}

// ==========================================================================
// PENGENDALI LAYAR PEMUAT AWAL APLIKASI (FULL-PAGE BLOCKING LOADER)
// ==========================================================================
function showInitLoader(message = "Memuat data tempat ibadah...") {
  const loader = document.getElementById("appInitLoader");
  const activeState = document.getElementById("initLoaderActiveState");
  const errorState = document.getElementById("initLoaderErrorState");
  const msgEl = document.getElementById("initLoaderMsg");

  if (loader) {
    loader.classList.remove("loader-fade-out");
    loader.style.display = "flex";
  }
  if (activeState) activeState.style.display = "flex";
  if (errorState) errorState.style.display = "none";
  if (msgEl) msgEl.textContent = message;
}

function hideInitLoader() {
  const loader = document.getElementById("appInitLoader");
  if (!loader) return;
  loader.classList.add("loader-fade-out");
  setTimeout(() => {
    loader.style.display = "none";
  }, 400);
}

function showInitLoaderError(customMessage) {
  const loader = document.getElementById("appInitLoader");
  const activeState = document.getElementById("initLoaderActiveState");
  const errorState = document.getElementById("initLoaderErrorState");
  const errorMsgEl = document.getElementById("initErrorMsg");

  if (loader) {
    loader.classList.remove("loader-fade-out");
    loader.style.display = "flex";
  }
  if (activeState) activeState.style.display = "none";
  if (errorState) errorState.style.display = "flex";
  if (errorMsgEl && customMessage) {
    errorMsgEl.innerHTML = customMessage;
  }
}

// Helper untuk mengambil CSV data online terbaru dengan batas waktu (timeout)
async function fetchFreshOnlineCSV(timeoutMs = 4000) {
  const directEndpoint = `${REMOTE_DATA_ENDPOINT}&_t=${Date.now()}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(directEndpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      if (text && text.includes("JENIS TEMPAT IBADAH") && text.length > 1000) {
        return text;
      }
    }
  } catch (e) {
    // Jaringan offline, CORS, atau timeout
  }
  return null;
}

// Memuat Data Pertama Kali (Menunggu data terbaru sebelum layar loading ditutup agar tidak ada lonjakan data)
async function bootstrapData() {
  const startTime = Date.now();
  showInitLoader("Memeriksa dan mengambil data terbaru...");

  try {
    // 1. Coba ambil data online terbaru terlebih dahulu (timeout 3.5 detik)
    let rawCSV = await fetchFreshOnlineCSV(3500);
    let isFreshOnline = false;

    if (rawCSV) {
      isFreshOnline = true;
      localStorage.setItem(STORAGE_KEY_CACHE, rawCSV);
      const now = new Date();
      localStorage.setItem(STORAGE_KEY_TIME, now.toISOString());
      state.lastUpdated = now;
    } else {
      // 2. Jika online gagal/timeout/offline, gunakan data cadangan lokal (cache atau snapshot file data.js)
      const cachedCSV = localStorage.getItem(STORAGE_KEY_CACHE);
      const cachedTime = localStorage.getItem(STORAGE_KEY_TIME);
      const initialCSV = window.INITIAL_DATABASE_CSV || "";

      const cachedLines = cachedCSV ? (cachedCSV.match(/\n/g) || []).length : 0;
      const initialLines = initialCSV ? (initialCSV.match(/\n/g) || []).length : 0;

      if (initialLines >= cachedLines && initialCSV.length > 500) {
        rawCSV = initialCSV;
        state.lastUpdated = window.INITIAL_DATABASE_TIME ? new Date(window.INITIAL_DATABASE_TIME) : new Date();
      } else if (cachedCSV && cachedCSV.length > 500) {
        rawCSV = cachedCSV;
        state.lastUpdated = cachedTime ? new Date(cachedTime) : new Date();
      } else if (initialCSV && initialCSV.length > 500) {
        rawCSV = initialCSV;
        state.lastUpdated = window.INITIAL_DATABASE_TIME ? new Date(window.INITIAL_DATABASE_TIME) : new Date();
      }
    }

    // 3. Masukkan data ke state dan render ke antarmuka pengguna
    if (rawCSV) {
      const isLoaded = loadCSVToState(rawCSV);
      if (isLoaded && state.rawRows.length > 0) {
        updateBannerMetrics();
        const isFileProtocol = window.location.protocol === "file:";

        if (isFreshOnline) {
          updateStatus("active", `Terhubung Online (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
        } else if (isFileProtocol) {
          updateStatus("active", `Data Aktif (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
        } else {
          updateStatus("active", `Terhubung (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
        }

        // Pastikan loading screen tampil minimal 450ms agar transisi halus
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 450 - elapsed);
        setTimeout(() => {
          hideInitLoader();
        }, delay);

        return;
      }
    }

    // 4. Jika gagal total (tidak ada data online dan tidak ada data offline)
    showInitLoaderError(
      "Terjadi kendala saat mengambil data sistem pendataan tempat ibadah. Silakan muat ulang (refresh) halaman ini atau hubungi <strong>Bagian Kesejahteraan Rakyat (Kesra) Kabupaten Gresik</strong>."
    );
  } catch (err) {
    console.error("Gagal bootstrap data:", err);
    showInitLoaderError(
      "Terjadi kendala saat memproses data sistem pendataan tempat ibadah. Silakan muat ulang (refresh) halaman ini atau hubungi <strong>Bagian Kesejahteraan Rakyat (Kesra) Kabupaten Gresik</strong>."
    );
  }
}

// Parsing dan Masukkan ke State
function loadCSVToState(csvContent) {
  const parsed = parseCSV(csvContent);
  if (!parsed || parsed.length <= 1) return false;

  // Bersihkan semua spasi di depan kata/kalimat pada seluruh kolom dan baris
  let headers = parsed[0].map(h => cleanLeadingSpaces(h).trim());
  let rows = parsed.slice(1).map(row => row.map(cell => cleanLeadingSpaces(cell)));

  // Cukup tampilkan data sampai kolom "Keterangan Dokumen Kurang" saja, sisanya tidak usah
  const lastColIdx = headers.findIndex(h => {
    const formatted = formatColumnHeader(h);
    return formatted === "Keterangan Dokumen Kurang" ||
      /jika belum lengkap|dokumen.*kurang|keterangan.*dokumen/i.test(h);
  });

  if (lastColIdx !== -1) {
    const maxCols = lastColIdx + 1;
    headers = headers.slice(0, maxCols);
    rows = rows.map(r => r.slice(0, maxCols));
  }

  state.rawHeaders = headers;
  state.rawRows = rows;

  detectKeyColumns();
  computeKecamatanSummaries();

  // Update total data besar di landing hero
  const heroTotalNumberEl = document.getElementById("landingHeroTotalNumber");
  if (heroTotalNumberEl) {
    heroTotalNumberEl.textContent = state.rawRows.length.toLocaleString("id-ID");
  }

  renderLandingKecamatan();

  // Jika user sudah berada di dashboard kecamatan tertentu, refresh datanya
  if (state.selectedKecamatan) {
    state.kecamatanAllRows = state.rawRows.filter(row => {
      const val = (row[state.kecamatanColIdx] || "").trim().toUpperCase();
      return val === state.selectedKecamatan.toUpperCase();
    });
    if (state.timestampColIdx !== -1) {
      state.kecamatanAllRows.sort((a, b) => {
        const timeA = parseTimestampValue(a[state.timestampColIdx]);
        const timeB = parseTimestampValue(b[state.timestampColIdx]);
        if (!isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
        if (!isNaN(timeA)) return -1;
        if (!isNaN(timeB)) return 1;
        return 0;
      });
    }
    populateCategoryDropdownForSelectedKecamatan();
    applyFilters();
  }

  setLoadingState(false);
  return true;
}

// Deteksi Kolom-Kolom Kunci
function detectKeyColumns() {
  state.jenisColIdx = state.rawHeaders.findIndex(h => /jenis|lembaga/i.test(h));
  state.kecamatanColIdx = state.rawHeaders.findIndex(h => /kecamatan/i.test(h));
  state.statusColIdx = state.rawHeaders.findIndex(h => /apakah sudah terisi|lengkap/i.test(h));
  state.timestampColIdx = state.rawHeaders.findIndex(h => /timestamp|waktu|tanggal/i.test(h));

  // Default otomatis sorting descending pada kolom timestamp jika ditemukan
  if (state.timestampColIdx !== -1) {
    state.sortColIndex = state.timestampColIdx;
    state.sortAsc = false;
  }
}

// Hitung Rangkuman 18 Kecamatan Gresik Secara Dinamis
function computeKecamatanSummaries() {
  if (state.kecamatanColIdx === -1 || state.rawRows.length === 0) {
    state.kecamatanSummaryList = [];
    return;
  }

  const map = {};

  state.rawRows.forEach(row => {
    let kec = (row[state.kecamatanColIdx] || "").trim().toUpperCase();
    if (!kec) kec = "LAINNYA";

    if (!map[kec]) {
      map[kec] = {
        name: kec,
        total: 0,
        lengkap: 0,
        belum: 0,
        categories: {}
      };
    }

    map[kec].total++;

    // Hitung status kelengkapan
    if (state.statusColIdx !== -1) {
      const statusVal = (row[state.statusColIdx] || "").trim().toLowerCase();
      if (statusVal.includes("sudah lengkap")) {
        map[kec].lengkap++;
      } else {
        map[kec].belum++;
      }
    }

    // Hitung kategori (Hanya 10 kategori baku resmi)
    if (state.jenisColIdx !== -1) {
      const rawJenis = (row[state.jenisColIdx] || "").trim();
      const normCat = normalizeCategory(rawJenis);
      if (normCat) {
        map[kec].categories[normCat] = (map[kec].categories[normCat] || 0) + 1;
      }
    }
  });

  // Urutkan kecamatan berdasarkan nama alfabetis
  state.kecamatanSummaryList = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

// ==========================================================================
// 10 KELOMPOK DATA TEMPAT IBADAH & LEMBAGA KEAGAMAAN BAKU
// Urutan Resmi:
// 1. MASJID
// 2. MUSHOLLAH
// 3. LANGGAR
// 4. VIHARA
// 5. KLENTENG
// 6. PURA
// 7. GEREJA KRISTEN (selain Katolik)
// 8. GEREJA KATOLIK (Katolik sendiri)
// 9. KEPERCAYAAN KEPADA YME
// 10. RUMAH DOA
// 11. LEMBAGA KEAGAMAAN
// ==========================================================================
const ALLOWED_CATEGORIES = [
  "MASJID",
  "MUSHOLLAH",
  "LANGGAR",
  "VIHARA",
  "KLENTENG",
  "PURA",
  "GEREJA KRISTEN",
  "GEREJA KATOLIK",
  "KEPERCAYAAN KEPADA YME",
  "RUMAH DOA",
  "LEMBAGA KEAGAMAAN"
];

function normalizeCategory(rawJenis) {
  if (!rawJenis) return null;
  const upper = rawJenis.trim().toUpperCase();

  // 1. MASJID
  if (upper.includes("MASJID")) return "MASJID";

  // 2. MUSHOLLAH (mushola, mushalla, mushollah, musolla)
  if (/MUSHOLLAH|MUSHOLA|MUSHALLA|MUSHOLLA|MUSOLLA/i.test(upper)) return "MUSHOLLAH";

  // 3. LANGGAR (e.g. LANGGAR, LANGGAR SINDUJOYO, LANGGAR AR-RAHMAN, dsb.)
  if (upper.includes("LANGGAR")) return "LANGGAR";

  // 4. VIHARA (vihara, wihara)
  if (upper.includes("VIHARA") || upper.includes("WIHARA")) return "VIHARA";

  // 5. KLENTENG (klenteng, kelenteng)
  if (upper.includes("KLENTENG") || upper.includes("KELENTENG")) return "KLENTENG";

  // 6. PURA
  if (upper.includes("PURA")) return "PURA";

  // 8. GEREJA KATOLIK (Gereja Katolik sendiri)
  if (/KATOLIK/i.test(upper)) return "GEREJA KATOLIK";

  // 7. GEREJA KRISTEN (Gereja selain Katolik: Gereja, Gereja Kristen, Gereja Nasrani, Protestan, dsb.)
  if (upper.includes("GEREJA") || /KRISTEN|PROTESTAN|NASRANI/i.test(upper)) return "GEREJA KRISTEN";

  // 9. KEPERCAYAAN KEPADA YME
  if (/KEPERCAYAAN|YME/i.test(upper)) return "KEPERCAYAAN KEPADA YME";

  // 10. RUMAH DOA
  if (upper.includes("RUMAH DOA")) return "RUMAH DOA";

  // 11. LEMBAGA KEAGAMAAN (termasuk LEMBAGA, YAYASAN, ORGANISASI, TPQ, PESANTREN)
  if (/LEMBAGA|YAYASAN|ORGANISASI|TPQ|PESANTREN/i.test(upper)) return "LEMBAGA KEAGAMAAN";

  // Selain kategori di atas, tidak usah ditampilkan
  return null;
}

function getCategoryRank(catName) {
  const idx = ALLOWED_CATEGORIES.indexOf(catName);
  return idx !== -1 ? idx : 999;
}

function getCategoryIcon(cat) {
  switch (cat) {
    case "MASJID": return "🕌";
    case "MUSHOLLAH": return "🕋";
    case "LANGGAR": return "📿";
    case "VIHARA": return "🪷";
    case "KLENTENG": return "🏮";
    case "PURA": return "🛕";
    case "GEREJA KRISTEN": return "⛪";
    case "GEREJA KATOLIK": return "⛪";
    case "KEPERCAYAAN KEPADA YME": return "🕊️";
    case "RUMAH DOA": return "🏠";
    case "LEMBAGA KEAGAMAAN": return "🏛️";
    default: return "📍";
  }
}

// ==========================================================================
// RENDER HALAMAN LANDING: GRID 18 KECAMATAN MANDATORY
// ==========================================================================
function renderLandingKecamatan() {
  const gridEl = document.getElementById("kecamatanGrid");
  const emptyEl = document.getElementById("landingEmptyState");
  if (!gridEl) return;

  gridEl.innerHTML = "";

  let list = state.kecamatanSummaryList;
  if (state.landingSearchQuery) {
    list = list.filter(k => k.name.toLowerCase().includes(state.landingSearchQuery));
  }

  if (list.length === 0) {
    gridEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "flex";
    return;
  }

  gridEl.style.display = "grid";
  if (emptyEl) emptyEl.style.display = "none";

  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "kecamatan-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Pilih Kecamatan ${item.name}`);

    // Persentase kelengkapan
    const pctLengkap = item.total > 0 ? Math.round((item.lengkap / item.total) * 100) : 0;

    // Urutkan kategori sesuai 10 kelompok data resmi yang ditentukan
    const sortedCats = Object.entries(item.categories)
      .filter(([cat]) => ALLOWED_CATEGORIES.includes(cat))
      .sort((a, b) => getCategoryRank(a[0]) - getCategoryRank(b[0]));

    const breakdownHtml = sortedCats.map(([cat, count]) => {
      const icon = getCategoryIcon(cat);
      return `<span class="breakdown-chip">${icon} ${count} ${escapeHTML(cat)}</span>`;
    }).join("");

    card.innerHTML = `
      <div>
        <div class="kecamatan-card-top">
          <div class="kecamatan-card-title-wrap">
            <h3 class="kecamatan-card-title">${escapeHTML(item.name)}</h3>
            <span class="kecamatan-card-subtitle">Kabupaten Gresik</span>
          </div>
          <div class="kecamatan-card-count-text" title="Total Tempat Ibadah Terdata">
            <span class="count-text-number">${item.total.toLocaleString("id-ID")}</span>
            <span class="count-text-label">Data</span>
          </div>
        </div>

        <div class="kecamatan-breakdown">
          ${breakdownHtml}
        </div>

        <div class="kecamatan-progress-wrap">
          <div class="kecamatan-progress-labels">
            <span class="lengkap-text">✓ ${item.lengkap.toLocaleString("id-ID")} Lengkap (${pctLengkap}%)</span>
          </div>
          <div class="kecamatan-progress-bar">
            <div class="kecamatan-progress-fill" style="width: ${pctLengkap}%;"></div>
          </div>
        </div>
      </div>

      <div class="kecamatan-card-footer">
        <span>Buka Data Kecamatan</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
    `;

    // Klik untuk masuk ke dashboard kecamatan tersebut
    card.addEventListener("click", () => {
      selectKecamatan(item.name);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectKecamatan(item.name);
      }
    });

    gridEl.appendChild(card);
  });
}

// ==========================================================================
// LOGIKA PEMILIHAN KECAMATAN & PERPINDAHAN TAMPILAN
// ==========================================================================
function selectKecamatan(kecamatanName) {
  state.selectedKecamatan = kecamatanName;

  // 1. Filter SELURUH baris data survei Kesra khusus kecamatan ini (100% 1 KECAMATAN UTUH)
  state.kecamatanAllRows = state.rawRows.filter(row => {
    const val = (row[state.kecamatanColIdx] || "").trim().toUpperCase();
    return val === kecamatanName.toUpperCase();
  });

  // 2. Muat seluruh data resmi Kemenag untuk kecamatan ini
  state.kemenagAllRows = (window.KEMENAG_BY_KECAMATAN && window.KEMENAG_BY_KECAMATAN[kecamatanName.toUpperCase()]) || [];
  state.kemenagFilteredRows = [...state.kemenagAllRows];

  // Otomatis urutkan default seluruh data kecamatan berdasarkan timestamp descending
  if (state.timestampColIdx !== -1) {
    state.sortColIndex = state.timestampColIdx;
    state.sortAsc = false;

    state.kecamatanAllRows.sort((a, b) => {
      const timeA = parseTimestampValue(a[state.timestampColIdx]);
      const timeB = parseTimestampValue(b[state.timestampColIdx]);
      if (!isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
      if (!isNaN(timeA)) return -1;
      if (!isNaN(timeB)) return 1;
      return 0;
    });
  }

  // 3. Reset kontrol & filter di dashboard tabel
  state.currentPage = 1;
  state.searchQuery = "";
  state.filterJenisVal = "ALL";
  state.filterStatusVal = "ALL";

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");
  if (searchInput) searchInput.value = "";
  if (clearBtn) clearBtn.style.display = "none";

  const statusFilter = document.getElementById("statusFilterSelect");
  if (statusFilter) statusFilter.value = "ALL";

  // 4. Update info banner aktif kecamatan & badge Kemenag
  const activeBadgeName = document.getElementById("activeKecName");
  const statsKecName = document.getElementById("statsKecName");
  const exportKecBadge = document.getElementById("exportKecBadge");

  if (activeBadgeName) activeBadgeName.textContent = `KEC. ${kecamatanName}`;
  if (statsKecName) statsKecName.textContent = kecamatanName;
  if (exportKecBadge) exportKecBadge.textContent = `Kec. ${kecamatanName}`;

  // Update metrik Kemenag di dashboard
  const kemenagCount = state.kemenagAllRows.length;
  const metricKemenag = document.getElementById("metricKemenagTotal");
  if (metricKemenag) metricKemenag.textContent = kemenagCount.toLocaleString("id-ID");

  const kemenagDownloadBadge = document.getElementById("kemenagDownloadBadge");
  if (kemenagDownloadBadge) kemenagDownloadBadge.textContent = `${kemenagCount.toLocaleString("id-ID")} Data`;

  const dashboardKemenagPillText = document.getElementById("dashboardKemenagPillText");
  if (dashboardKemenagPillText) dashboardKemenagPillText.textContent = `${kemenagCount.toLocaleString("id-ID")} Data Kemenag`;

  // 5. Update dropdown kategori hanya untuk jenis yang ada di kecamatan terpilih
  populateCategoryDropdownForSelectedKecamatan();

  // 7. Tampilkan Dashboard View & Sembunyikan Landing View
  const landingView = document.getElementById("landingView");
  const dashboardView = document.getElementById("dashboardView");

  if (landingView) landingView.style.display = "none";
  if (dashboardView) dashboardView.style.display = "flex";

  // 8. Jalankan filter awal dan render tabel
  applyFilters();

  // Scroll ke atas halaman dengan halus
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Kembali ke Halaman Pemilihan Kecamatan ("Ganti Kecamatan")
function showLandingPage() {
  state.selectedKecamatan = null;
  state.kecamatanAllRows = [];
  state.filteredRows = [];

  const landingView = document.getElementById("landingView");
  const dashboardView = document.getElementById("dashboardView");

  if (dashboardView) dashboardView.style.display = "none";
  if (landingView) landingView.style.display = "flex";

  // Re-render kartu kecamatan jika ada update
  renderLandingKecamatan();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Isi Dropdown Jenis Tempat Ibadah Khusus untuk Kecamatan Terpilih (Kesra)
function populateCategoryDropdownForSelectedKecamatan() {
  const jenisSelect = document.getElementById("categoryFilterSelect");
  if (!jenisSelect) return;

  jenisSelect.innerHTML = `<option value="ALL">Semua Jenis (${state.kecamatanAllRows.length})</option>`;

  if (state.jenisColIdx !== -1 && state.kecamatanAllRows.length > 0) {
    const jenisCountMap = {};

    state.kecamatanAllRows.forEach(row => {
      const rawJenis = (row[state.jenisColIdx] || "").trim();
      const normCat = normalizeCategory(rawJenis);
      if (normCat) {
        jenisCountMap[normCat] = (jenisCountMap[normCat] || 0) + 1;
      }
    });

    ALLOWED_CATEGORIES.forEach(cat => {
      if (jenisCountMap[cat]) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = `${cat} (${jenisCountMap[cat]})`;
        jenisSelect.appendChild(opt);
      }
    });
  }
}


/**
 * Parse string timestamp/tanggal menjadi nilai milidetik (ms) untuk pengurutan akurat
 * Mendukung format: M/D/YYYY, DD/MM/YYYY, YYYY-MM-DD, ISO, dengan/tanpa jam dan menit
 */
function parseTimestampValue(val) {
  if (!val) return NaN;
  const str = val.toString().trim();
  if (!str) return NaN;

  // 1. Coba Date.parse bawaan
  const parsedMs = Date.parse(str);
  if (!isNaN(parsedMs)) return parsedMs;

  // 2. Format DD/MM/YYYY atau DD-MM-YYYY (dengan atau tanpa jam:menit:detik)
  const parts = str.split(/[ /:T-]/).filter(Boolean);
  if (parts.length >= 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (p0 > 0 && p0 <= 31 && p1 > 0 && p1 <= 12 && p2 > 1000) {
      const d = new Date(p2, p1 - 1, p0, parseInt(parts[3] || 0, 10), parseInt(parts[4] || 0, 10), parseInt(parts[5] || 0, 10));
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  return NaN;
}

// ==========================================================================
// FILTERING & PENGURUTAN DI DALAM KECAMATAN TERPILIH
// ==========================================================================
function applyFilters() {
  if (!state.selectedKecamatan || state.kecamatanAllRows.length === 0) {
    state.filteredRows = [];
    renderTable();
    updateBannerMetrics();
    return;
  }

  // Filter dimulai dari data 1 kecamatan terpilih (state.kecamatanAllRows)
  let result = [...state.kecamatanAllRows];

  // 1. Filter Jenis
  if (state.jenisColIdx !== -1 && state.filterJenisVal !== "ALL") {
    result = result.filter(row => {
      const rawJenis = (row[state.jenisColIdx] || "").trim();
      const normCat = normalizeCategory(rawJenis);
      return normCat === state.filterJenisVal;
    });
  }

  // 2. Filter Status Kelengkapan
  if (state.statusColIdx !== -1 && state.filterStatusVal !== "ALL") {
    result = result.filter(row => {
      const val = (row[state.statusColIdx] || "").trim().toLowerCase();
      return val.includes(state.filterStatusVal.toLowerCase());
    });
  }

  // 3. Pencarian Bebas di dalam Kecamatan Terpilih
  if (state.searchQuery) {
    result = result.filter(row => {
      return row.some(cell => {
        if (!cell) return false;
        return cell.toString().toLowerCase().includes(state.searchQuery);
      });
    });
  }

  // 4. Pengurutan Kolom (Sorting)
  if (state.sortColIndex !== -1) {
    const idx = state.sortColIndex;
    const isAsc = state.sortAsc;
    const isTimestampCol = (idx === state.timestampColIdx) || /timestamp|waktu|tanggal/i.test(state.rawHeaders[idx] || "");

    result.sort((a, b) => {
      const valA = (a[idx] || "").toString().trim();
      const valB = (b[idx] || "").toString().trim();

      // Prioritas 1: Jika kolom adalah Timestamp / Tanggal
      if (isTimestampCol) {
        const timeA = parseTimestampValue(valA);
        const timeB = parseTimestampValue(valB);
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return isAsc ? timeA - timeB : timeB - timeA;
        }
        if (!isNaN(timeA)) return isAsc ? -1 : 1;
        if (!isNaN(timeB)) return isAsc ? 1 : -1;
      }

      // Prioritas 2: Angka murni
      const numA = parseFloat(valA.replace(/[^0-9.-]+/g, ""));
      const numB = parseFloat(valB.replace(/[^0-9.-]+/g, ""));

      if (!isNaN(numA) && !isNaN(numB) && valA === numA.toString() && valB === numB.toString()) {
        return isAsc ? numA - numB : numB - numA;
      }

      // Prioritas 3: Teks biasa (alfabetis / numerik)
      return isAsc
        ? valA.localeCompare(valB, undefined, { numeric: true })
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
  }

  state.filteredRows = result;
  updateBannerMetrics();
  renderTable();
}


// Render Header & Body Tabel
function renderTable() {
  const tableHead = document.getElementById("tableHead");
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const tableContainer = document.getElementById("tableContainer");

  if (!tableHead || !tableBody) return;

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (state.filteredRows.length === 0) {
    if (tableContainer) tableContainer.style.display = "none";
    if (emptyState) emptyState.style.display = "flex";
    const title = document.getElementById("emptyStateTitle");
    const desc = document.getElementById("emptyStateDesc");
    if (title) title.textContent = "Tidak Ada Data Ditemukan";
    if (desc) desc.textContent = `Tidak ada tempat ibadah di Kecamatan ${state.selectedKecamatan || ""} yang cocok dengan kata kunci atau filter yang Anda pilih.`;
    renderPagination(0);
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (tableContainer) tableContainer.style.display = "block";

  // 1. Render Header Tabel
  const trHead = document.createElement("tr");

  const thNo = document.createElement("th");
  thNo.className = "row-index";
  thNo.textContent = "#";
  trHead.appendChild(thNo);

  state.rawHeaders.forEach((colName, index) => {
    const th = document.createElement("th");
    th.className = "sortable";

    const isCurrentSort = state.sortColIndex === index;
    let arrowIcon = "↕";
    if (isCurrentSort) {
      arrowIcon = state.sortAsc ? "▲" : "▼";
    }

    const displayTitle = formatColumnHeader(colName);
    if (index === state.jenisColIdx || displayTitle.toLowerCase() === "jenis") {
      th.classList.add("col-jenis");
    }

    th.innerHTML = `
      <div class="th-content">
        <span>${escapeHTML(displayTitle)}</span>
        <span class="sort-icon ${isCurrentSort ? 'active' : ''}">${arrowIcon}</span>
      </div>
    `;

    th.addEventListener("click", () => {
      if (state.sortColIndex === index) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortColIndex = index;
        // Jika kolom timestamp yang diklik, urutkan descending (data terbaru dahulu)
        state.sortAsc = (index === state.timestampColIdx) ? false : true;
      }
      applyFilters();
    });

    trHead.appendChild(th);
  });

  tableHead.appendChild(trHead);

  // 2. Render Baris Data (Body)
  const totalRows = state.filteredRows.length;
  const isShowAll = !isFinite(state.rowsPerPage) || state.rowsPerPage >= totalRows;
  const startIdx = isShowAll ? 0 : Math.max(0, (state.currentPage - 1) * state.rowsPerPage);
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + state.rowsPerPage, totalRows);
  const pageRows = state.filteredRows.slice(startIdx, endIdx);

  pageRows.forEach((row, rowIdx) => {
    const tr = document.createElement("tr");

    const tdNo = document.createElement("td");
    tdNo.className = "row-index";
    tdNo.textContent = startIdx + rowIdx + 1;
    tr.appendChild(tdNo);

    state.rawHeaders.forEach((colName, colIdx) => {
      const td = document.createElement("td");
      if (colIdx === state.jenisColIdx) {
        td.className = "col-jenis";
      }
      td.innerHTML = formatCellValue(row[colIdx], colName);
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  const fromCount = totalRows === 0 ? 0 : startIdx + 1;
  renderPagination(totalRows, fromCount, endIdx);
}

// Formatter Khusus untuk Sel Tabel (Default: Bersihkan spasi di depan kata/kalimat)
function formatCellValue(val, colHeader = "") {
  if (val === undefined || val === null || val === "") {
    return `<span style="color:var(--text-light);">-</span>`;
  }

  // Bersihkan data dari semua spasi di depan kata/kalimat sebelum ditampilkan
  let str = cleanLeadingSpaces(val).trimEnd();
  if (str === "") {
    return `<span style="color:var(--text-light);">-</span>`;
  }

  const lowerHeader = (colHeader || "").toLowerCase();



  // Badge Jenis Tempat Ibadah (Modern Data Chip dengan Dot Indicator)
  if (/jenis/i.test(lowerHeader)) {
    const lowerVal = str.toLowerCase();
    let badgeClass = "badge-lembaga";
    if (lowerVal.includes("masjid")) {
      badgeClass = "badge-islam";
    } else if (lowerVal.includes("mushollah") || lowerVal.includes("mushola") || lowerVal.includes("langgar")) {
      badgeClass = "badge-musholla";
    } else if (lowerVal.includes("katolik")) {
      badgeClass = "badge-katolik";
    } else if (lowerVal.includes("gereja") || lowerVal.includes("kristen") || lowerVal.includes("nasrani") || lowerVal.includes("protestan")) {
      badgeClass = "badge-kristen";
    } else if (lowerVal.includes("pura")) {
      badgeClass = "badge-hindu";
    } else if (lowerVal.includes("vihara") || lowerVal.includes("buddha")) {
      badgeClass = "badge-buddha";
    } else if (lowerVal.includes("klenteng") || lowerVal.includes("khonghucu")) {
      badgeClass = "badge-khonghucu";
    } else if (lowerVal.includes("kepercayaan")) {
      badgeClass = "badge-kepercayaan";
    } else if (lowerVal.includes("rumah doa")) {
      badgeClass = "badge-rumahdoa";
    }
    return `<span class="table-badge ${badgeClass}">${escapeHTML(str)}</span>`;
  }

  // Badge Status Kelengkapan (khusus kolom status utama, bukan kolom alasan kekurangan)
  if ((/apakah sudah terisi|kelengkapan/i.test(lowerHeader)) && !lowerHeader.includes("jika belum")) {
    const lowerVal = str.toLowerCase();
    if (lowerVal.includes("sudah lengkap")) {
      return `<span class="table-badge badge-lengkap">✓ Sudah Lengkap</span>`;
    } else if (lowerVal.includes("belum lengkap")) {
      return `<span class="table-badge badge-belum">⚠ Belum Lengkap</span>`;
    }
  }

  // Link URL
  if (/^https?:\/\//i.test(str)) {
    return `<a href="${escapeHTML(str)}" target="_blank" rel="noopener noreferrer" class="link-cell">
      Buka Tautan
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    </a>`;
  }

  // Multiline Text: pastikan setiap baris bersih dari spasi di depan kata/kalimat
  if (str.includes("\n")) {
    const cleanLines = str.split("\n").map(l => cleanLeadingSpaces(l));
    return escapeHTML(cleanLines.join("\n")).replace(/\n/g, "<br>");
  }

  return escapeHTML(str);
}

// Format Judul Kolom Tabel (Menerjemahkan nama kolom bahasa Inggris ke Bahasa Indonesia yang baku)
function formatColumnHeader(colName) {
  if (!colName) return "";
  const clean = colName.trim();
  const lower = clean.toLowerCase();

  // 1. Kolom "Timestamp" diganti "Waktu Pendataan"
  if (/timestamp/i.test(lower)) {
    return "Waktu Pendataan";
  }

  // 2. Kolom "Email Address" atau "Email" diganti "Alamat Email"
  if (/email(\s*address)?/i.test(lower)) {
    return "Alamat Email";
  }

  // 3. Kolom "JENIS TEMPAT IBADAH & LEMBAGA KEAGAMAAN" diganti "Jenis"
  if (/jenis/i.test(lower) && (/tempat\s+ibadah/i.test(lower) || /lembaga/i.test(lower))) {
    return "Jenis";
  }

  // 4. Kolom "NAMA TEMPAT IBADAH/ LEMBAGA KEAGAMAAN" diganti "Nama Tempat Ibadah"
  if (/nama\s+tempat\s+ibadah/i.test(lower)) {
    return "Nama Tempat Ibadah";
  }

  // 5. Kolom "KECAMATAN" -> "Kecamatan"
  if (/^kecamatan$/i.test(lower)) {
    return "Kecamatan";
  }

  // 6. Kolom "DESA" -> "Desa"
  if (/^desa$/i.test(lower)) {
    return "Desa";
  }

  // 7. Kolom "ALAMAT" -> "Alamat"
  if (/^alamat$/i.test(lower)) {
    return "Alamat";
  }

  // 8. Kolom "NAMA PENGURUS" -> "Nama Pengurus"
  if (/nama\s+pengurus/i.test(lower)) {
    return "Nama Pengurus";
  }

  // 9. Kolom status kelengkapan utama disingkat menjadi "Kelengkapan Data"
  if (/apakah sudah terisi|sebelum di submit/i.test(lower)) {
    return "Kelengkapan Data";
  }

  // 10. Kolom alasan kekurangan dokumen -> "Keterangan Dokumen Kurang"
  if (/jika belum lengkap|dokumen.*kurang|keterangan.*dokumen/i.test(lower)) {
    return "Keterangan Dokumen Kurang";
  }

  // Terjemahan umum jika ada kolom bahasa Inggris lain
  if (/^date$/i.test(lower)) return "Tanggal";
  if (/^time$/i.test(lower)) return "Waktu";
  if (/^phone(\s*number)?$/i.test(lower)) return "Nomor Telepon";
  if (/^contact$/i.test(lower)) return "Kontak";
  if (/^status$/i.test(lower)) return "Status";
  if (/^action$/i.test(lower)) return "Aksi";
  if (/^name$/i.test(lower)) return "Nama";
  if (/^address$/i.test(lower)) return "Alamat";
  if (/^category$/i.test(lower)) return "Kategori";
  if (/^notes?$/i.test(lower)) return "Catatan";

  return clean;
}

// Render Kontrol Pagination
function renderPagination(totalRows, from = 0, to = 0) {
  const infoEl = document.getElementById("paginationInfo");
  const controlsEl = document.getElementById("paginationControls");

  if (!infoEl || !controlsEl) return;

  if (totalRows === 0) {
    infoEl.textContent = "Tidak ada data yang ditampilkan";
    controlsEl.innerHTML = "";
    return;
  }

  const isShowAll = !isFinite(state.rowsPerPage) || (from === 1 && to === totalRows);
  if (isShowAll) {
    infoEl.textContent = `Menampilkan seluruh ${totalRows.toLocaleString("id-ID")} tempat ibadah di Kec. ${state.selectedKecamatan || ""}`;
    controlsEl.innerHTML = "";
    return;
  }

  infoEl.textContent = `Menampilkan ${from} - ${to} dari total ${totalRows.toLocaleString("id-ID")} tempat ibadah di Kec. ${state.selectedKecamatan || ""}`;

  const totalPages = Math.ceil(totalRows / state.rowsPerPage);
  if (totalPages <= 1) {
    controlsEl.innerHTML = "";
    return;
  }

  let html = `
    <button class="page-btn" ${state.currentPage === 1 ? "disabled" : ""} onclick="changePage(${state.currentPage - 1})" title="Halaman Sebelumnya">
      &laquo;
    </button>
  `;

  const startPage = Math.max(1, state.currentPage - 2);
  const endPage = Math.min(totalPages, state.currentPage + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding: 0 4px; color: var(--text-light);">...</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="changePage(${p})">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding: 0 4px; color: var(--text-light);">...</span>`;
    html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="page-btn" ${state.currentPage === totalPages ? "disabled" : ""} onclick="changePage(${state.currentPage + 1})" title="Halaman Selanjutnya">
      &raquo;
    </button>
  `;

  controlsEl.innerHTML = html;
}

window.changePage = function (newPage) {
  state.currentPage = newPage;
  renderTable();
  const tableEl = document.querySelector(".table-responsive");
  if (tableEl) tableEl.scrollTop = 0;
};

// Format waktu pembaruan terakhir: hh:mm:ss WIB (contoh: 18:40:40 WIB)
function formatTimeWIB(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} WIB`;
}

// Update Angka Metrik Banner
function updateBannerMetrics() {
  const metricTotal = document.getElementById("metricTotal");
  const metricFiltered = document.getElementById("metricFiltered");
  const metricLastSync = document.getElementById("metricLastSync");
  const metricKemenag = document.getElementById("metricKemenagTotal");

  if (metricTotal) {
    metricTotal.textContent = state.kecamatanAllRows.length.toLocaleString("id-ID");
  }

  if (metricKemenag) {
    metricKemenag.textContent = state.kemenagAllRows.length.toLocaleString("id-ID");
  }

  if (metricFiltered) {
    metricFiltered.textContent = state.filteredRows.length.toLocaleString("id-ID");
  }

  if (metricLastSync && state.lastUpdated) {
    metricLastSync.textContent = formatTimeWIB(state.lastUpdated);
  }
}

function updateStatus(status, label) {
  const ind = document.getElementById("statusIndicator");
  const txt = document.getElementById("statusText");
  if (!ind || !txt) return;

  ind.className = `status-indicator ${status}`;
  txt.textContent = label;
}

function setLoadingState(isLoading) {
  const loadingEl = document.getElementById("loadingState");
  const refreshIcon = document.querySelector("#refreshBtn svg");

  if (loadingEl) {
    loadingEl.style.display = isLoading ? "flex" : "none";
  }

  if (refreshIcon) {
    if (isLoading) refreshIcon.classList.add("spinner");
    else refreshIcon.classList.remove("spinner");
  }
}

function renderErrorState(errorMessage) {
  const tableContainer = document.getElementById("tableContainer");
  const emptyState = document.getElementById("emptyState");
  const titleEl = document.getElementById("emptyStateTitle");
  const descEl = document.getElementById("emptyStateDesc");

  if (tableContainer) tableContainer.style.display = "none";
  if (emptyState) emptyState.style.display = "flex";

  if (titleEl) titleEl.innerHTML = `<span style="color: #ef4444;">Gagal Mengambil Data</span>`;
  if (descEl) descEl.innerHTML = escapeHTML(errorMessage);
  renderPagination(0);
}

// ==========================================================================
// EXPORT EXCEL (.XLSX) - ATURAN WAJIB: SELALU 1 KECAMATAN PENUH
// (Mengabaikan filter pencarian di layar tabel)
// ==========================================================================
function exportToExcel() {
  if (!state.selectedKecamatan) {
    showToast("Silakan pilih kecamatan terlebih dahulu untuk mengekspor data!", "error");
    return;
  }


  if (!state.kecamatanAllRows || state.kecamatanAllRows.length === 0) {
    showToast("Tidak ada data survei Kesra untuk kecamatan ini!", "warning");
    return;
  }

  // ATURAN MANDATORY: Ekspor SELALU mengambil seluruh data 1 kecamatan tersebut!
  const dataToExport = state.kecamatanAllRows;

  showToast(`Menyiapkan Excel seluruh data Kesra Kecamatan ${state.selectedKecamatan}...`, "info");

  try {
    if (typeof XLSX === "undefined") {
      throw new Error("Pustaka ekspor Excel (.xlsx) belum termuat. Anda dapat menggunakan tombol CSV sebagai alternatif.");
    }

    const kecName = state.selectedKecamatan.toUpperCase();
    const titleRow1 = [`DATA PENDATAAN TEMPAT IBADAH & LEMBAGA KEAGAMAAN KABUPATEN GRESIK`];
    const titleRow2 = [`WILAYAH KECAMATAN ${kecName} - BAGIAN KESRA KAB. GRESIK`];
    const emptyRow = [];
    const exportHeaders = ["No", ...state.rawHeaders.map(formatColumnHeader)];
    const exportRows = dataToExport.map((row, idx) => {
      const formattedCells = state.rawHeaders.map((_, colIdx) => cleanLeadingSpaces(row[colIdx] || ""));
      return [idx + 1, ...formattedCells];
    });
    const exportData = [titleRow1, titleRow2, emptyRow, exportHeaders, ...exportRows];

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Otomatis atur lebar kolom agar rapi dan tidak terpotong (dihitung dari kolom header tabel dan isinya)
    const colWidths = exportHeaders.map((header, colIdx) => {
      let maxLen = header.length;
      exportRows.forEach(r => {
        const val = r[colIdx] ? r[colIdx].toString() : "";
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    // Beri nama tab kerja sesuai nama kecamatan (maksimal 31 karakter batasan Excel)
    const tabName = state.selectedKecamatan.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, tabName);

    const dateFormatted = formatIndoDateFileName();
    const fileName = `Data_Pendataan_Tempat_Ibadah_Kesra_${kecName}_${dateFormatted}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showToast(`Sukses mengekspor ${dataToExport.length.toLocaleString("id-ID")} data Kesra Kecamatan ${state.selectedKecamatan} ke Excel!`, "success");
  } catch (err) {
    console.error("Gagal export excel:", err);
    showToast("Gagal ekspor ke Excel: " + err.message, "error");
  }
}

// ==========================================================================
// EXPORT DATA RESMI KEMENAG PER KECAMATAN (.XLSX)
// ==========================================================================
function exportKemenagExcel(kecamatanName) {
  const kec = (kecamatanName || state.selectedKecamatan || "").trim().toUpperCase();
  if (!kec) {
    showToast("Silakan pilih kecamatan terlebih dahulu!", "error");
    return;
  }

  const records = (window.KEMENAG_BY_KECAMATAN && window.KEMENAG_BY_KECAMATAN[kec]) || [];
  if (records.length === 0) {
    showToast(`Tidak ada data Kemenag ditemukan untuk Kecamatan ${kec}`, "warning");
    return;
  }

  showToast(`Menyiapkan Excel Data Kemenag Kecamatan ${kec} (${records.length} tempat ibadah)...`, "info");

  try {
    if (typeof XLSX === "undefined") {
      throw new Error("Pustaka ekspor Excel (.xlsx) belum termuat.");
    }

    // Susun 2 baris judul resmi di atas tabel
    const titleRow1 = [`DATA TEMPAT IBADAH KEMENTERIAN AGAMA (KEMENAG)`];
    const titleRow2 = [`WILAYAH KECAMATAN ${kec} - KABUPATEN GRESIK`];
    const emptyRow = [];
    const headerRow = [
      "No",
      "Jenis Tempat Ibadah",
      "Nama Tempat Ibadah",
      "Alamat / Dusun / Desa",
      "Kecamatan",
      "Kabupaten"
    ];

    const dataRows = records.map((item, idx) => [
      idx + 1,
      item.jenis || "",
      cleanLeadingSpaces(item.nama || ""),
      cleanLeadingSpaces(item.alamat || ""),
      kec,
      "Gresik"
    ]);

    const aoa = [
      titleRow1,
      titleRow2,
      emptyRow,
      headerRow,
      ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Styling lebar kolom agar sangat rapi di Microsoft Excel
    ws['!cols'] = [
      { wch: 6 },   // No
      { wch: 20 },  // Jenis
      { wch: 38 },  // Nama
      { wch: 45 },  // Alamat
      { wch: 18 },  // Kecamatan
      { wch: 14 }   // Kabupaten
    ];

    const wb = XLSX.utils.book_new();
    const tabName = `Kec ${kec}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, tabName);

    const dateFormatted = formatIndoDateFileName();
    const fileName = `Data_Kemenag_Tempat_Ibadah_Kecamatan_${kec}_${dateFormatted}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showToast(`Sukses mengunduh ${records.length.toLocaleString("id-ID")} Data Kemenag Kecamatan ${kec}!`, "success");
  } catch (err) {
    console.error("Gagal mengunduh Excel Kemenag:", err);
    showToast("Gagal mengunduh Excel: " + err.message, "error");
  }
}

// Ekspos fungsi unduh ke global window agar dapat dipanggil dari mana saja
window.exportKemenagExcel = exportKemenagExcel;

// Format Tanggal Indonesia untuk Penamaan Berkas (Contoh: 10-Oktober-2026 atau 29-Desember-2020)
function formatIndoDateFileName(date = new Date()) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${monthName}-${year}`;
}

// ==========================================================================
// EXPORT PDF (.PDF) - ATURAN WAJIB: SELALU 1 KECAMATAN PENUH
// (Mengabaikan filter pencarian di layar tabel)
// ==========================================================================
function exportToPDF() {
  if (!state.selectedKecamatan || !state.kecamatanAllRows || state.kecamatanAllRows.length === 0) {
    showToast("Silakan pilih kecamatan terlebih dahulu untuk mengekspor data!", "error");
    return;
  }

  // ATURAN MANDATORY: Ekspor SELALU mengambil seluruh data 1 kecamatan tersebut!
  const dataToExport = state.kecamatanAllRows;

  showToast(`Menyiapkan dokumen PDF seluruh data Kecamatan ${state.selectedKecamatan}...`, "info");

  try {
    const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : (typeof jsPDF !== "undefined" ? jsPDF : null);
    if (!jsPDFClass) {
      throw new Error("Pustaka ekspor PDF belum termuat.");
    }

    const doc = new jsPDFClass({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const kecName = state.selectedKecamatan.toUpperCase();
    const dateFormatted = formatIndoDateFileName();
    const fileName = `Data_Pendataan_Tempat_Ibadah_${kecName}_${dateFormatted}.pdf`;

    // Judul Dokumen & Metadata Resmi Kop Dokumen (2 Row di atas tabel)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`DATA PENDATAAN TEMPAT IBADAH & LEMBAGA KEAGAMAAN KABUPATEN GRESIK`, 14, 13);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text(`WILAYAH KECAMATAN ${kecName} - BAGIAN KESRA KAB. GRESIK`, 14, 19);

    const infoText = `Total Data: ${dataToExport.length} Tempat Ibadah | Tanggal Unduh: ${dateFormatted}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(infoText, 14, 24);

    // Header tabel (Bahasa Indonesia)
    const exportHeaders = ["No", ...state.rawHeaders.map(formatColumnHeader)];
    const exportRows = dataToExport.map((row, idx) => {
      const formattedCells = state.rawHeaders.map((_, colIdx) => cleanLeadingSpaces(row[colIdx] || "-"));
      return [idx + 1, ...formattedCells];
    });

    doc.autoTable({
      head: [exportHeaders],
      body: exportRows,
      startY: 27,
      margin: { top: 27, left: 8, right: 8, bottom: 12 },
      styles: {
        font: "helvetica",
        fontSize: 6.5,
        cellPadding: 1.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        overflow: "linebreak",
        valign: "middle"
      },
      headStyles: {
        fillColor: [5, 150, 105], // Emerald Green #059669
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
        halign: "center"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" }, // No
        1: { cellWidth: 16 }, // Timestamp
        2: { cellWidth: 26 }, // Email
        3: { cellWidth: 18 }, // Jenis
        4: { cellWidth: 32 }, // Nama
        5: { cellWidth: 16 }, // Kecamatan
        6: { cellWidth: 18 }, // Desa
        7: { cellWidth: 42 }, // Alamat
        8: { cellWidth: 24 }, // Pengurus
        9: { cellWidth: 22, halign: "center" }, // Kelengkapan
        10: { cellWidth: "auto" } // Dokumen kurang
      },
      didDrawPage: function (data) {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageCount} | Kabupaten Gresik`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 5
        );
      }
    });

    doc.save(fileName);
    showToast(`Dokumen PDF Kecamatan ${state.selectedKecamatan} (${dataToExport.length} data) berhasil diunduh!`, "success");
  } catch (err) {
    console.error("Gagal export PDF:", err);
    showToast("Gagal ekspor ke PDF: " + err.message, "error");
  }
}

// Sinkronisasi Pembaruan Online dari Server Data di Latar Belakang
async function syncOnlineData(isManual = false) {
  if (isManual) {
    setLoadingState(true);
    updateStatus("loading", "Menyinkronkan data...");
    showToast("Menghubungkan ke server data ...", "info");
  }

  const isFileProtocol = window.location.protocol === "file:";
  const freshCSV = await fetchFreshOnlineCSV(6000);

  if (freshCSV) {
    localStorage.setItem(STORAGE_KEY_CACHE, freshCSV);
    const now = new Date();
    localStorage.setItem(STORAGE_KEY_TIME, now.toISOString());
    state.lastUpdated = now;

    loadCSVToState(freshCSV);
    updateBannerMetrics(); // Pastikan jam Pembaruan Terakhir langsung berubah di layar!
    updateStatus("active", `Terhubung Online (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
    setLoadingState(false);

    if (isManual) {
      showToast(`Data online berhasil disinkronkan (${formatTimeWIB(now)})! Total: ${state.rawRows.length.toLocaleString("id-ID")} data.`, "success");
    }
    return true;
  } else {
    setLoadingState(false);
    if (state.rawRows.length > 0) {
      if (isFileProtocol) {
        updateStatus("active", `Data Aktif (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
        if (isManual) {
          showToast(`Menampilkan seluruh ${state.rawRows.length.toLocaleString("id-ID")} data. Browser membatasi sinkronisasi langsung pada protokol file:// lokal karena kebijakan keamanan origin. Sinkronisasi data otomatis aktif penuh saat di-deploy ke GitHub Pages.`, "info");
        }
      } else {
        updateStatus("active", `Terhubung (${state.rawRows.length.toLocaleString("id-ID")} Data)`);
        if (isManual) {
          showToast("Data sudah yang paling mutakhir atau server sedang sibuk. Menampilkan data tersimpan.", "info");
        }
      }
      return true;
    } else {
      updateStatus("error", "Gagal Terhubung");
      renderErrorState("Tidak dapat memuat pembaruan data. Periksa koneksi internet Anda.");
      return false;
    }
  }
}

// Toast Notification
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
