/************************************************************
 * app.js — VISITOR DC-SPLIT (GitHub Pages) — FULL PACKAGE
 * ✅ ปรับ Popup QR ให้ “ไม่บิดเบี้ยว” + มาตรฐาน
 * - ใช้ JSONP เรียก Google Apps Script Web App (ไม่ติด CORS)
 * - QR แสดงจาก <canvas> โดยตรง (คม + ไม่ยืด)
 * - CSS บังคับเป็นสี่เหลี่ยมจัตุรัส (aspect-ratio: 1/1)
 * - ตอนดาวน์โหลด ใช้ canvas ของ QR โดยตรง (คมที่สุด) ไม่ผ่าน html2canvas
 ************************************************************/

/***********************
 * GitHub Frontend Config
 ***********************/
const CFG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxYsepGAWnvvxM8lS68fQJgxMBF_7aDcF_-f6qX_RdA3-j8FhWLHoR-KgyYF2U2iGg7xA/exec',
  SECRET: 'CHANGE_ME_SUPER_SECRET_906',
  ORIGIN: window.location.origin,
  JSONP_TIMEOUT_MS: 15000,
  DOWNLOAD_PREFIX: 'visitor',
  PRIVACY_IMG_URL: 'https://lh5.googleusercontent.com/d/1yR7QQHgqPNOhOOVKl7jGK_yrMf7UOYxn',
  COMPANY_FALLBACK: [
    "CPAXTRA","Smart DC","Makro","CPF","ALL Now","Linfox",
    "บุคคลภายนอก","หน่วยงานราชการ","คนลงสินค้า","อื่นๆ"
  ],
  AUTO_ID_PREFIX: 'DCs01',

  // ✅ ขนาด QR ที่สร้าง (ยิ่งใหญ่ยิ่งคม)
  QR_SIZE: 768
};

/***********************
 * Utilities
 ***********************/
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/***********************
 * JSONP Helper (No CORS)
 ***********************/
function jsonpRequest(params) {
  return new Promise((resolve, reject) => {
    const cb = `__cb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');

    const q = new URLSearchParams({
      ...params,
      secret: CFG.SECRET,
      origin: CFG.ORIGIN,
      callback: cb
    });

    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('JSONP timeout / GAS ช้าเกินไป'));
    }, CFG.JSONP_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (resp) => {
      if (done) return;
      done = true;
      cleanup();

      if (!resp || resp.ok !== true) {
        reject(new Error(resp?.error || 'API error'));
        return;
      }
      resolve(resp.data);
    };

    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('Network error / GAS unreachable'));
    };

    script.src = `${CFG.GAS_URL}?${q.toString()}`;
    document.head.appendChild(script);
  });
}

function api(action, payload = null) {
  const params = { action };
  if (payload != null) params.payload = JSON.stringify(payload);
  return jsonpRequest(params);
}

/***********************
 * Privacy Popup
 ***********************/
function showPrivacyMessage() {
  const imgUrl = CFG.PRIVACY_IMG_URL;

  const html = `
    <div style="padding:6px;">
      <div style="border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12);margin-bottom:10px;">
        <a href="${imgUrl}" target="_blank" rel="noopener">
          <img src="${imgUrl}" alt="กฎระเบียบความปลอดภัย" style="width:100%;display:block;">
        </a>
      </div>
      <ol style="margin:0 12px 12px;padding-left:18px;color:#1f2937;font-size:14px;line-height:1.55">
        <li>ให้ท่านศึกษากฏระเบียบความปลอดภัยการเข้าพื้นที่คลังสินค้าอย่างละเอียด</li>
        <li>ข้าฯ ยินยอมเปิดเผยข้อมูลส่วนบุคคล</li>
        <li>ข้าฯจะยึดถือปฏิบัติกฏระเบียบความปลอดภัยอย่างเคร่งครัด</li>
      </ol>
      <label style="display:flex;justify-content:center;align-items:center;gap:10px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;">
        <input type="radio" id="ackRadio" name="ack" />
        <span>รับทราบกฎระเบียบความปลอดภัย</span>
      </label>
    </div>
  `;

  const form = document.getElementById('registration-form');
  if (form) form.style.display = 'none';

  let acknowledged = false;

  Swal.fire({
    title: 'Visitor เข้า-ออกพื้นที่ QR Code',
    html,
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    didOpen: () => {
      const r = document.getElementById('ackRadio');
      r?.addEventListener('change', function () {
        if (this.checked) {
          acknowledged = true;
          Swal.close();
        }
      });
    },
    willClose: () => {
      if (acknowledged) {
        if (form) {
          form.style.display = 'block';
          form.reset();
        }
        $('#companyOtherWrap').hide();
        document.getElementById('fullName')?.focus();
      }
    }
  });
}

/***********************
 * Generate Unique ID
 ***********************/
const usedIds = new Set();
function generateUniqueId() {
  const chars = "0123456789";
  let id = "";
  do {
    id = CFG.AUTO_ID_PREFIX;
    for (let i = 0; i < 9; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

/***********************
 * Load DC Options
 ***********************/
async function loadDCOptions() {
  const list = await api('getDCOptions');
  const sel = document.getElementById('dcSelect');
  if (!sel) throw new Error('ไม่พบ element #dcSelect');

  sel.innerHTML = `<option value="">-- เลือก DC --</option>`;
  (list || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.dc;
    opt.textContent = `${item.dc} - ${item.name}`;
    opt.dataset.name = item.name;
    sel.appendChild(opt);
  });

  $('#dcSelect').off('change').on('change', function () { $(this).removeClass('invalid'); });
}

/***********************
 * Load Company Options
 ***********************/
async function loadCompanyOptions() {
  let options = [];
  try { options = await api('getRadioOptions'); } catch (_) { options = []; }

  const container = document.getElementById('companyGroup');
  if (!container) throw new Error('ไม่พบ element #companyGroup');
  container.innerHTML = "";

  const list = (options && options.length) ? options : CFG.COMPANY_FALLBACK;

  list.forEach(opt => {
    const safeOpt = String(opt);
    const id = "company_" + safeOpt.replace(/\s+/g, "_");
    const label = document.createElement("label");
    label.className = "radio-chip";
    label.innerHTML = `
      <input type="radio" name="company" value="${escapeHtml(safeOpt)}" id="${escapeHtml(id)}" required />
      <span class="radio-dot"></span> ${escapeHtml(safeOpt)}
    `;
    container.appendChild(label);
  });

  $('input[name="company"]').off('change').on('change', function () {
    $('#companyGroup').removeClass('invalid');
    if (this.value === 'อื่นๆ') {
      $('#companyOtherWrap').slideDown(120);
      $('#companyOther').attr('required', true).focus();
    } else {
      $('#companyOtherWrap').slideUp(120);
      $('#companyOther').val('').removeAttr('required').removeClass('invalid');
    }
  });
}

/***********************
 * Input Filters + Validation
 ***********************/
function markInvalid(sel) { $(sel).addClass('invalid'); }
function clearInvalid() { $('.invalid').removeClass('invalid'); }

function validateForm() {
  const errors = [];
  let first = null;

  const dc = $('#dcSelect').val();
  if (!dc) { errors.push('กรุณาเลือก "DC"'); markInvalid('#dcSelect'); first = first || '#dcSelect'; }

  const fullName = $('#fullName').val().trim();
  if (!fullName) { errors.push('กรุณากรอก "ชื่อ-นามสกุล"'); markInvalid('#fullName'); first = first || '#fullName'; }

  const gender = $('input[name="gender"]:checked').val();
  if (!gender) { errors.push('กรุณาเลือก "เพศ"'); markInvalid('#genderGroup'); first = first || '#genderGroup'; }

  const phone = $('#phone').val().trim();
  if (!/^0\d{9}$/.test(phone)) { errors.push('หมายเลขโทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก'); markInvalid('#phone'); first = first || '#phone'; }

  const company = $('input[name="company"]:checked').val();
  if (!company) { errors.push('กรุณาเลือก "บริษัท"'); markInvalid('#companyGroup'); first = first || '#companyGroup'; }

  const companyOther = $('#companyOther').val().trim();
  if (company === 'อื่นๆ' && !companyOther) { errors.push('คุณเลือก "อื่นๆ" กรุณากรอก "ชื่อบริษัท"'); markInvalid('#companyOther'); first = first || '#companyOther'; }

  return { ok: errors.length === 0, errors, firstInvalid: first };
}

function bindInputFilters() {
  $('#fullName').off('input').on('input', function () {
    const clean = this.value.replace(/[^A-Za-zก-๙เแโใไ์่้๊๋ึั็ํๅฯ\s]/g, '');
    if (clean !== this.value) this.value = clean;
    $(this).removeClass('invalid');
  });

  $('#phone').off('input').on('input', function () {
    let digits = this.value.replace(/\D/g, '').slice(0, 10);
    this.value = digits;
    this.setCustomValidity(/^0\d{9}$/.test(digits) ? '' : 'ต้องขึ้นต้นด้วย 0 และเป็นตัวเลข 10 หลัก');
    $(this).removeClass('invalid');
  });

  $('input[name="gender"]').off('change').on('change', function () { $('#genderGroup').removeClass('invalid'); });
  $('#companyOther').off('input').on('input', function () { $(this).removeClass('invalid'); });
}

/***********************
 * ✅ QR Renderer (No distortion)
 * - คืนค่า: { host, getCanvas, getPngDataUrl }
 ***********************/
function createQrRenderer(text) {
  const host = document.createElement('div');

  // qrcodejs จะสร้าง <canvas> (หรือ <img> แล้วแต่ browser)
  // เราบังคับให้คงสัดส่วนด้วย CSS ใน popup
  new QRCode(host, {
    text,
    width: CFG.QR_SIZE,
    height: CFG.QR_SIZE,
    correctLevel: QRCode.CorrectLevel.M
  });

  const getCanvas = () => host.querySelector('canvas') || null;

  const getPngDataUrl = () => {
    const c = getCanvas();
    if (c) return c.toDataURL('image/png');
    const img = host.querySelector('img');
    return img ? img.src : '';
  };

  return { host, getCanvas, getPngDataUrl };
}

/***********************
 * ✅ QR Popup HTML — Standard + No stretch
 * - ใช้ canvas ใส่ใน container แล้ว CSS คุมสัดส่วน
 ***********************/
function buildQrPopupHtml({ autoId, dc, dcName, fullName, gender, companyResolved, phone, timestampClient }) {
  return `
<style>
  #qrWrap, #qrWrap *{ box-sizing:border-box; }
  #qrWrap{ font-family:'Sarabun',sans-serif; color:#0f172a; }
  :root{
    --bg:#fff;
    --bd:rgba(15,23,42,.10);
    --muted:#64748b;
    --shadow:0 18px 50px rgba(2,6,23,.18);
    --r:18px;
    --ac:#F85B1A;
    --ac2:#FF6B6B;
  }

  .q{ width:100%; max-width:560px; margin:0 auto; }
  .qCard{
    background:var(--bg);
    border:1px solid var(--bd);
    border-radius:var(--r);
    overflow:hidden;
    box-shadow:var(--shadow);
  }

  .qTop{
    padding:12px 14px;
    background:linear-gradient(135deg,var(--ac2),var(--ac));
    color:#fff;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
  }
  .qTopTitle{
    font-weight:900;
    font-size:clamp(12px, 3.4vw, 14px);
    line-height:1.15;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    letter-spacing:.2px;
  }
  .qTopBadge{
    flex:0 0 auto;
    font-size:11px;
    font-weight:900;
    padding:7px 10px;
    border-radius:999px;
    background:rgba(255,255,255,.18);
    border:1px solid rgba(255,255,255,.25);
    white-space:nowrap;
  }

  .qBody{ padding:14px 14px 0; }

  /* ✅ QR container (square + no stretch) */
  .qQrBox{
    width:min(78vw, 320px);
    margin:0 auto;
    padding:12px;
    background:#fff;
    border:1px solid rgba(148,163,184,.45);
    border-radius:18px;
  }
  .qQrFrame{
    width:100%;
    aspect-ratio: 1 / 1;      /* ✅ บังคับสี่เหลี่ยม */
    display:grid;
    place-items:center;
    background:#fff;
  }
  .qQrFrame canvas,
  .qQrFrame img{
    width:100% !important;
    height:100% !important;
    max-width:100% !important;
    max-height:100% !important;
    object-fit:contain !important; /* ✅ ไม่ยืด */
    image-rendering: pixelated;    /* ✅ ช่วยคมในบางเครื่อง */
  }

  .qIdRow{
    margin-top:12px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:10px 12px;
    border-radius:16px;
    background:#0b1220;
    color:#fff;
  }
  .qIdLabel{ font-size:11px; opacity:.85; margin-bottom:3px; }
  .qIdCode{ font-size:13px; font-weight:900; overflow-wrap:anywhere; word-break:break-word; }
  .qCopyBtn{
    border:none;
    background:rgba(255,255,255,.16);
    color:#fff;
    font-weight:900;
    font-size:12px;
    padding:9px 12px;
    border-radius:14px;
    cursor:pointer;
    touch-action:manipulation;
    white-space:nowrap;
  }

  .qGrid{ margin-top:12px; display:grid; gap:8px; }
  .qRow{
    display:grid;
    grid-template-columns:92px 1fr;
    gap:10px;
    padding:10px 12px;
    border-radius:16px;
    border:1px solid rgba(148,163,184,.35);
    background:linear-gradient(180deg,#f8fafc,#f1f5f9);
  }
  .qK{ font-size:12px; font-weight:900; color:#334155; white-space:nowrap; }
  .qV{ font-size:13px; color:#0f172a; overflow-wrap:anywhere; word-break:break-word; line-height:1.35; min-width:0; }

  .qHint{
    text-align:center;
    font-size:12px;
    color:var(--muted);
    padding:12px 6px 12px;
    line-height:1.35;
  }

  .qActions{
    position:sticky;
    bottom:0;
    padding:10px 12px calc(10px + env(safe-area-inset-bottom));
    background:rgba(255,255,255,.92);
    backdrop-filter:blur(10px);
    border-top:1px solid rgba(148,163,184,.25);
    display:grid;
    gap:10px;
  }
  .qBtn{
    width:100%;
    border:none;
    cursor:pointer;
    padding:12px 12px;
    border-radius:16px;
    font-weight:900;
    font-size:14px;
    touch-action:manipulation;
  }
  .qBtnPrimary{
    color:#fff;
    background:linear-gradient(135deg,var(--ac),var(--ac2));
    box-shadow:0 10px 18px rgba(248,91,26,.25);
  }

  @media (max-width:360px){
    .qQrBox{ width:min(86vw, 280px); }
    .qRow{ grid-template-columns:80px 1fr; }
    .qV{ font-size:12px; }
  }
</style>

<div class="q" id="qrWrap">
  <div class="qCard" id="qrCard">
    <div class="qTop">
      <div class="qTopTitle">เก็บ QRCode ไว้สแกนออก</div>
      <div class="qTopBadge">แนะนำ: ดาวน์โหลดรูป</div>
    </div>

    <div class="qBody">
      <!-- ✅ เราจะเอา canvas ของ QR มา append ลงใน qQrFrame หลัง Swal เปิด -->
      <div class="qQrBox">
        <div class="qQrFrame" id="qrMount"></div>
      </div>

      <div class="qIdRow">
        <div>
          <div class="qIdLabel">รหัสพื้นที่</div>
          <div class="qIdCode" id="idCode">${escapeHtml(autoId)}</div>
        </div>
        <button type="button" class="qCopyBtn" id="copy-id">คัดลอก</button>
      </div>

      <div class="qGrid">
        <div class="qRow"><div class="qK">DC</div><div class="qV">${escapeHtml(dc)} - ${escapeHtml(dcName)}</div></div>
        <div class="qRow"><div class="qK">ชื่อ</div><div class="qV">${escapeHtml(fullName)}</div></div>
        <div class="qRow"><div class="qK">เพศ</div><div class="qV">${escapeHtml(gender)}</div></div>
        <div class="qRow"><div class="qK">บริษัท</div><div class="qV">${escapeHtml(companyResolved)}</div></div>
        <div class="qRow"><div class="qK">โทร</div><div class="qV">${escapeHtml(phone)}</div></div>
        <div class="qRow"><div class="qK">เวลา</div><div class="qV">${escapeHtml(timestampClient)}</div></div>
      </div>

      <div class="qHint">ก่อนสแกนออก: เปิดรูปจากแกลเลอรี + เพิ่มความสว่างหน้าจอ</div>
    </div>

    <div class="qActions">
      <button type="button" class="qBtn qBtnPrimary" id="download-btn">ดาวน์โหลดรูป QR (คมชัด)</button>
    </div>
  </div>
</div>
`;
}

/***********************
 * Submit
 ***********************/
let isSubmitting = false;

function bindSubmit() {
  $('#registration-form').off('submit').on('submit', async function (e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearInvalid();
    const v = validateForm();
    if (!v.ok) {
      const list = '<ul style="text-align:left;margin:0 auto;max-width:420px;">' +
        v.errors.map(x => `<li>${escapeHtml(x)}</li>`).join('') + '</ul>';
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', html: list });
      if (v.firstInvalid) {
        document.querySelector(v.firstInvalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => document.querySelector(v.firstInvalid)?.focus(), 250);
      }
      return;
    }

    isSubmitting = true;
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = true;

    try {
      const dc = $('#dcSelect').val();
      const dcName = $('#dcSelect option:selected').data('name') || '';

      const fullName = $('#fullName').val().trim();
      const gender = $('input[name="gender"]:checked').val();
      const phone = $('#phone').val().trim();
      const company = $('input[name="company"]:checked').val();
      const companyOther = $('#companyOther').val().trim();

      const autoId = generateUniqueId();
      const timestampClient = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      const companyResolved = (company === 'อื่นๆ') ? companyOther : company;

      const payload = {
        autoId, dc, dcName,
        fullName, gender, phone,
        company, companyOther, companyResolved,
        timestampClient
      };

      // ✅ สร้าง QR renderer (ได้ canvas คมๆ)
      const qr = createQrRenderer(autoId);

      // ✅ สร้าง HTML popup (ไม่มี <img> แล้ว → ไม่ยืด/ไม่บิด)
      const htmlContent = buildQrPopupHtml(payload);

      Swal.fire({
        title: '',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        allowOutsideClick: true,
        width: 'clamp(320px, 92vw, 560px)',
        padding: '12px',
        backdrop: true,
        didOpen: () => {
          // ✅ mount QR canvas เข้าไปในกรอบ square
          const mount = document.getElementById('qrMount');
          if (mount) {
            mount.innerHTML = '';
            const canvas = qr.getCanvas();
            const dataUrl = qr.getPngDataUrl();

            if (canvas) {
              // ใช้ canvas ตรงๆ (คมที่สุด)
              mount.appendChild(canvas);
            } else if (dataUrl) {
              // fallback เป็น img ถ้าไม่มี canvas
              const img = new Image();
              img.alt = 'QR Code';
              img.src = dataUrl;
              mount.appendChild(img);
            }
          }
        }
      }).then(() => {
        $('#registration-form')[0].reset();
        $('#companyOtherWrap').hide();
        document.getElementById('registration-form').style.display = 'none';
        showPrivacyMessage();
      });

      // bind buttons inside popup
      setTimeout(() => {
        document.getElementById('copy-id')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(autoId);
            Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว', timer: 900, showConfirmButton: false });
          } catch (_) {
            Swal.fire({ icon: 'info', title: 'คัดลอกไม่สำเร็จ', text: 'ลองคัดลอกจากข้อความรหัสพื้นที่' });
          }
        });

        // ✅ ดาวน์โหลด “ไฟล์ QR เพียวๆ” จาก canvas โดยตรง (คมที่สุด ไม่บิด)
        document.getElementById('download-btn')?.addEventListener('click', () => {
          const dataUrl = qr.getPngDataUrl();
          if (!dataUrl) {
            Swal.fire({ icon: 'error', title: 'ดาวน์โหลดไม่สำเร็จ', text: 'ไม่พบข้อมูล QR' });
            return;
          }
          downloadDataUrl(dataUrl, `${CFG.DOWNLOAD_PREFIX}_${autoId}_QR.png`);
        });
      }, 120);

      // ✅ save to backend (JSONP)
      await api('saveData', payload);

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'ทำรายการไม่สำเร็จ',
        text: String(err && err.message ? err.message : err)
      });
    } finally {
      isSubmitting = false;
      if (btn) btn.disabled = false;
    }
  });
}

/***********************
 * Init
 ***********************/
document.addEventListener('DOMContentLoaded', async () => {
  try {
    bindInputFilters();
    bindSubmit();

    await loadDCOptions();
    await loadCompanyOptions();

    showPrivacyMessage();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ',
      text: 'Network error / CORS blocked / GAS unreachable: ' + String(err && err.message ? err.message : err)
    });
  }
});
