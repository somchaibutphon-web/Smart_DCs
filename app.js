/*************************************************************
 * app.js — VISITOR DC-SPLIT (GitHub Pages) — FULL PACKAGE (V2)
 * ✅ JSONP เรียก Google Apps Script Web App (ไม่ติด CORS)
 * ✅ SweetAlert QR ใหม่: ไม่บิดเบี้ยว / มาตรฐาน / มือถือสวย
 *
 * ต้องมี element id ใน index.html:
 *   #registration-form, #dcSelect, #fullName, #phone,
 *   #genderGroup (radio name="gender"), #companyGroup,
 *   #companyOtherWrap, #companyOther, #submitBtn
 *
 * Dependencies (ใน index.html):
 * - jQuery
 * - SweetAlert2
 * - qrcodejs
 * - html2canvas (optional; ในโค้ดนี้ดาวน์โหลด QR เพียวจาก canvas)
 ************************************************************/

/***********************
 * GitHub Frontend Config
 ***********************/
const CFG = {
  // ✅ ใส่ URL ของ Web App (ต้องเป็น /exec)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxYsepGAWnvvxM8lS68fQJgxMBF_7aDcF_-f6qX_RdA3-j8FhWLHoR-KgyYF2U2iGg7xA/exec',

  // ✅ ต้องตรงกับ API_SECRET ใน Code.gs
  SECRET: 'CHANGE_ME_SUPER_SECRET_906',

  // ✅ ส่ง origin ให้ฝั่ง GAS ตรวจ (ถ้าคุณเปิด ALLOWED_ORIGINS)
  ORIGIN: window.location.origin,

  // JSONP timeout
  JSONP_TIMEOUT_MS: 15000,

  // ตั้งชื่อไฟล์ตอนดาวน์โหลด
  DOWNLOAD_PREFIX: 'visitor',

  // รูปกฎระเบียบ (เหมือนเดิม)
  PRIVACY_IMG_URL: 'https://lh5.googleusercontent.com/d/1yR7QQHgqPNOhOOVKl7jGK_yrMf7UOYxn',

  // fallback list ถ้าโหลดจากชีท Radio ไม่ได้
  COMPANY_FALLBACK: [
    "CPAXTRA","Smart DC","Makro","CPF","ALL Now","Linfox",
    "บุคคลภายนอก","หน่วยงานราชการ","คนลงสินค้า","อื่นๆ"
  ],

  // prefix AutoID
  AUTO_ID_PREFIX: 'DCs01'
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
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/***********************
 * JSONP Helper (No CORS)
 * - GAS ต้องรองรับ callback ที่ doGet
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
 * Validation + Filters
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
 * QR Renderer (Canvas-first, no distortion)
 ***********************/
function createQrRenderer(text) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '-99999px';
  document.body.appendChild(host);

  // สร้าง QR ด้วย qrcodejs (ได้ canvas ที่คม)
  new QRCode(host, {
    text: String(text),
    width: 512,
    height: 512,
    correctLevel: QRCode.CorrectLevel.M
  });

  const canvas = host.querySelector('canvas');
  const img = host.querySelector('img');

  function getCanvas() {
    if (!canvas) return null;
    // clone เพื่อไม่ผูกกับ host เดิม
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    return c;
  }

  function getPngDataUrl() {
    if (canvas) return canvas.toDataURL('image/png');
    if (img && img.src) return img.src;
    return '';
  }

  function destroy() {
    try { host.remove(); } catch (_) {}
  }

  return { getCanvas, getPngDataUrl, destroy };
}

/***********************
 * SweetAlert QR — NEW DESIGN (V2)
 ***********************/
function buildQrPopupHtmlV2({
  autoId, dc, dcName, fullName, gender, companyResolved, phone, timestampClient
}) {
  return `
<style>
  #qrWrap, #qrWrap *{ box-sizing:border-box; }
  #qrWrap{
    font-family:'Sarabun',system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    color:#0f172a;
  }

  :root{
    --card1:#0b1020;
    --card2:#070a14;
    --line:rgba(255,255,255,.10);
    --soft:rgba(255,255,255,.06);
    --muted:rgba(226,232,240,.72);
    --accent1:#FF6B6B;
    --accent2:#F85B1A;
    --radius:18px;
    --shadow:0 24px 70px rgba(0,0,0,.45);
  }

  .q2{ width:100%; max-width:520px; margin:0 auto; }
  .q2Card{
    border-radius:var(--radius);
    overflow:hidden;
    background: radial-gradient(1200px 500px at 20% -10%, rgba(255,107,107,.35), transparent 55%),
                radial-gradient(900px 450px at 90% 10%, rgba(248,91,26,.28), transparent 60%),
                linear-gradient(180deg, var(--card1), var(--card2));
    box-shadow:var(--shadow);
    border:1px solid rgba(255,255,255,.08);
  }

  .q2Top{
    padding:14px 16px 12px;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
  }
  .q2Title{ min-width:0; display:flex; flex-direction:column; gap:6px; }
  .q2Title h2{
    margin:0;
    font-size:15px;
    font-weight:900;
    color:#fff;
    line-height:1.2;
    letter-spacing:.2px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .q2Title p{ margin:0; font-size:12px; color:var(--muted); line-height:1.35; }

  .q2Badge{
    flex:0 0 auto;
    padding:8px 10px;
    border-radius:999px;
    font-size:11px;
    font-weight:900;
    color:#fff;
    border:1px solid rgba(255,255,255,.14);
    background: linear-gradient(135deg, rgba(255,107,107,.22), rgba(248,91,26,.20));
    white-space:nowrap;
  }

  .q2Body{ padding:0 16px 14px; display:grid; gap:12px; }

  .q2QrShell{
    border-radius:18px;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
    padding:12px;
    display:grid;
    gap:10px;
  }

  .q2QrBox{
    width:min(72vw, 310px);
    margin:0 auto;
    background:#fff;
    border-radius:16px;
    padding:12px;
    border:1px solid rgba(15,23,42,.10);
  }
  .q2QrFrame{
    width:100%;
    aspect-ratio:1/1;
    display:grid;
    place-items:center;
  }
  .q2QrFrame canvas,
  .q2QrFrame img{
    width:100% !important;
    height:100% !important;
    object-fit:contain !important;
  }

  .q2IdBar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:10px 12px;
    border-radius:14px;
    background: rgba(0,0,0,.35);
    border:1px solid rgba(255,255,255,.10);
  }
  .q2IdMeta{ min-width:0; }
  .q2IdLabel{ font-size:11px; color:var(--muted); margin-bottom:3px; }
  .q2IdCode{
    font-size:13px;
    font-weight:900;
    color:#fff;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    letter-spacing:.2px;
  }

  .q2BtnMini{
    flex:0 0 auto;
    border:none;
    cursor:pointer;
    padding:9px 10px;
    border-radius:12px;
    font-weight:900;
    font-size:12px;
    color:#fff;
    background: rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.14);
    touch-action:manipulation;
    white-space:nowrap;
  }
  .q2BtnMini:active{ transform:scale(.98); }

  .q2Grid{ display:grid; gap:8px; }
  .q2Row{
    display:grid;
    grid-template-columns: 88px 1fr;
    gap:10px;
    padding:10px 12px;
    border-radius:14px;
    background: rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);
  }
  .q2K{ font-size:12px; font-weight:900; color:rgba(226,232,240,.85); white-space:nowrap; }
  .q2V{
    font-size:13px;
    color:#fff;
    overflow-wrap:anywhere;
    word-break:break-word;
    line-height:1.35;
    min-width:0;
  }

  .q2Actions{ display:grid; gap:10px; margin-top:2px; }
  .q2Btn{
    width:100%;
    border:none;
    cursor:pointer;
    padding:12px 12px;
    border-radius:14px;
    font-weight:900;
    font-size:14px;
    touch-action:manipulation;
  }
  .q2BtnPrimary{
    color:#fff;
    background: linear-gradient(135deg, var(--accent2), var(--accent1));
    box-shadow: 0 14px 26px rgba(248,91,26,.22);
  }
  .q2BtnGhost{
    color:#fff;
    background: rgba(255,255,255,.08);
    border:1px solid rgba(255,255,255,.12);
  }
  .q2Hint{ text-align:center; font-size:12px; color:var(--muted); line-height:1.4; margin-top:2px; }

  .swal2-popup{ padding:0 !important; background:transparent !important; box-shadow:none !important; }
  .swal2-html-container{ margin:0 !important; padding:0 !important; }
  .swal2-close{ color:#fff !important; }

  @media (max-width:360px){
    .q2Row{ grid-template-columns: 78px 1fr; }
    .q2V{ font-size:12px; }
  }
</style>

<div class="q2" id="qrWrap">
  <div class="q2Card" id="qrCard">
    <div class="q2Top">
      <div class="q2Title">
        <h2>QR สำหรับสแกนออก</h2>
        <p>กรุณาเก็บไว้ให้เจ้าหน้าที่สแกนตอนออกจากพื้นที่</p>
      </div>
      <div class="q2Badge">SECURITY</div>
    </div>

    <div class="q2Body">

      <div class="q2QrShell">
        <div class="q2QrBox">
          <div class="q2QrFrame" id="qrMount"></div>
        </div>

        <div class="q2IdBar">
          <div class="q2IdMeta">
            <div class="q2IdLabel">รหัสพื้นที่</div>
            <div class="q2IdCode" id="idCode">${escapeHtml(autoId)}</div>
          </div>
          <button type="button" class="q2BtnMini" id="copy-id">คัดลอก</button>
        </div>
      </div>

      <div class="q2Grid">
        <div class="q2Row"><div class="q2K">DC</div><div class="q2V">${escapeHtml(dc)} - ${escapeHtml(dcName)}</div></div>
        <div class="q2Row"><div class="q2K">ชื่อ</div><div class="q2V">${escapeHtml(fullName)}</div></div>
        <div class="q2Row"><div class="q2K">เพศ</div><div class="q2V">${escapeHtml(gender)}</div></div>
        <div class="q2Row"><div class="q2K">บริษัท</div><div class="q2V">${escapeHtml(companyResolved)}</div></div>
        <div class="q2Row"><div class="q2K">โทร</div><div class="q2V">${escapeHtml(phone)}</div></div>
        <div class="q2Row"><div class="q2K">เวลา</div><div class="q2V">${escapeHtml(timestampClient)}</div></div>
      </div>

      <div class="q2Actions">
        <button type="button" class="q2Btn q2BtnPrimary" id="download-btn">ดาวน์โหลด QR (คมชัด)</button>
        <button type="button" class="q2Btn q2BtnGhost" id="close-btn">ปิดหน้าต่าง</button>
      </div>

      <div class="q2Hint">แนะนำ: เพิ่มความสว่างหน้าจอเพื่อสแกนได้เร็วขึ้น</div>
    </div>
  </div>
</div>
`;
}

/***********************
 * Submit (with NEW QR SweetAlert)
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

    let qr = null;

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

      // ✅ สร้าง QR (canvas) แบบคมๆ
      qr = createQrRenderer(autoId);

      // ✅ HTML ใหม่
      const htmlContent = buildQrPopupHtmlV2(payload);

      // ✅ แสดง QR ก่อน (UX ดี)
      Swal.fire({
        title: '',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        allowOutsideClick: true,
        width: 'clamp(320px, 92vw, 560px)',
        padding: '0px',
        backdrop: true,
        didOpen: () => {
          // mount QR canvas เข้าไปในกรอบ (ไม่บิด)
          const mount = document.getElementById('qrMount');
          if (mount) {
            mount.innerHTML = '';
            const canvas = qr.getCanvas();
            const dataUrl = qr.getPngDataUrl();

            if (canvas) mount.appendChild(canvas);
            else if (dataUrl) {
              const img = new Image();
              img.alt = 'QR Code';
              img.src = dataUrl;
              mount.appendChild(img);
            }
          }

          // copy
          document.getElementById('copy-id')?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(autoId);
              Swal.fire({ icon:'success', title:'คัดลอกแล้ว', timer:900, showConfirmButton:false });
            } catch {
              Swal.fire({ icon:'info', title:'คัดลอกไม่สำเร็จ', text:'ลองคัดลอกจากข้อความรหัสพื้นที่' });
            }
          });

          // download QR เพียวๆ (คมสุด ไม่บิด)
          document.getElementById('download-btn')?.addEventListener('click', () => {
            const dataUrl = qr.getPngDataUrl();
            if (!dataUrl) {
              Swal.fire({ icon:'error', title:'ดาวน์โหลดไม่สำเร็จ', text:'ไม่พบข้อมูล QR' });
              return;
            }
            downloadDataUrl(dataUrl, `${CFG.DOWNLOAD_PREFIX}_${autoId}_QR.png`);
          });

          // close
          document.getElementById('close-btn')?.addEventListener('click', () => Swal.close());
        }
      }).then(() => {
        // after close popup
        $('#registration-form')[0].reset();
        $('#companyOtherWrap').hide();
        document.getElementById('registration-form').style.display = 'none';
        showPrivacyMessage();
      });

      // ✅ บันทึกหลังบ้าน (JSONP — no CORS)
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
      try { qr?.destroy?.(); } catch (_) {}
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
      text: 'Network error / GAS unreachable: ' + String(err && err.message ? err.message : err)
    });
  }
});
