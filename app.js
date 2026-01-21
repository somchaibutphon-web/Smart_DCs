/***********************
 * GitHub Frontend Config
 ***********************/
const CFG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxYsepGAWnvvxM8lS68fQJgxMBF_7aDcF_-f6qX_RdA3-j8FhWLHoR-KgyYF2U2iGg7xA/exec', // ✅ ใส่ URL ของ Web App
  SECRET: 'CHANGE_ME_SUPER_SECRET_906',                      // ✅ ต้องตรงกับ API_SECRET ใน Code.gs
  ORIGIN: window.location.origin
};

/***********************
 * API helper
 ***********************/
async function api(action, payload = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000); // 12s timeout

  let res;
  try {
    res = await fetch(CFG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ดีแล้ว
      body: JSON.stringify({
        secret: CFG.SECRET,
        origin: CFG.ORIGIN,
        action,
        payload
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(t);
    throw new Error('Network error / CORS blocked / GAS unreachable: ' + (err?.message || err));
  }
  clearTimeout(t);

  const data = await res.json().catch(() => ({}));
  if (!data || data.ok !== true) {
    throw new Error((data && data.error) ? data.error : ('API error (HTTP ' + res.status + ')'));
  }
  return data.data;
}



/***********************
 * Privacy Popup (เหมือนเดิม)
 ***********************/
function showPrivacyMessage() {
  const imgUrl = 'https://lh5.googleusercontent.com/d/1yR7QQHgqPNOhOOVKl7jGK_yrMf7UOYxn';
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
  form.style.display = 'none';

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
        form.style.display = 'block';
        form.reset();
        $('#companyOtherWrap').hide();
        document.getElementById('fullName')?.focus();
      }
    }
  });
}

/***********************
 * Generate Unique ID (เหมือนเดิม)
 ***********************/
const usedIds = new Set();
function generateUniqueId() {
  const chars = "0123456789";
  let id = "";
  do {
    id = "DCs01";
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
  sel.innerHTML = `<option value="">-- เลือก DC --</option>`;
  (list || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.dc;
    opt.textContent = `${item.dc} - ${item.name}`;
    opt.dataset.name = item.name;
    sel.appendChild(opt);
  });
  $('#dcSelect').on('change', function () { $(this).removeClass('invalid'); });
}

/***********************
 * Load Company Options
 ***********************/
async function loadCompanyOptions() {
  let options = [];
  try { options = await api('getRadioOptions'); } catch (_) { options = []; }

  const container = document.getElementById("companyGroup");
  container.innerHTML = "";

  const list = (options && options.length) ? options : [
    "CPAXTRA","Smart DC","Makro","CPF","ALL Now","Linfox","บุคคลภายนอก","หน่วยงานราชการ","คนลงสินค้า","อื่นๆ"
  ];

  list.forEach(opt => {
    const id = "company_" + String(opt).replace(/\s+/g, "_");
    const label = document.createElement("label");
    label.className = "radio-chip";
    label.innerHTML = `
      <input type="radio" name="company" value="${opt}" id="${id}" required />
      <span class="radio-dot"></span> ${opt}
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
 * Input Filters
 ***********************/
$('#fullName').on('input', function () {
  const clean = this.value.replace(/[^A-Za-zก-๙เแโใไ์่้๊๋ึั็ํๅฯ\s]/g, '');
  if (clean !== this.value) this.value = clean;
  $(this).removeClass('invalid');
});

$('#phone').on('input', function () {
  let digits = this.value.replace(/\D/g, '').slice(0, 10);
  this.value = digits;
  this.setCustomValidity(/^0\d{9}$/.test(digits) ? '' : 'ต้องขึ้นต้นด้วย 0 และเป็นตัวเลข 10 หลัก');
  $(this).removeClass('invalid');
});

$('input[name="gender"]').on('change', function () { $('#genderGroup').removeClass('invalid'); });
$('#companyOther').on('input', function () { $(this).removeClass('invalid'); });

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

/***********************
 * QR Popup HTML (mobile-first)
 ***********************/
function buildQrPopupHtml({ qrDataURL, autoId, dc, dcName, fullName, gender, companyResolved, phone, timestampClient }) {
  return `
<style>
  #qrWrap, #qrWrap *{ box-sizing:border-box; }
  #qrWrap{ font-family:'Sarabun',sans-serif; color:#0f172a; }
  #qrWrap img{ width:100%; height:auto; display:block; }
  #qrWrap code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  :root{
    --q-bg:#fff; --q-bd:rgba(15,23,42,.10);
    --q-ac:#F85B1A; --q-ac2:#FF6B6B; --q-muted:#64748b;
    --q-r:18px;
  }
  .q{ width:100%; max-width:560px; margin:0 auto; }
  .qCard{
    background:var(--q-bg); border:1px solid var(--q-bd);
    border-radius:var(--q-r); overflow:hidden;
    box-shadow:0 18px 50px rgba(2,6,23,.18);
  }
  .qTop{
    padding:12px 14px;
    background:linear-gradient(135deg,var(--q-ac2),var(--q-ac));
    color:#fff; display:flex; align-items:center; justify-content:space-between; gap:10px;
  }
  .qTopTitle{
    font-weight:900;
    font-size:clamp(12px, 3.4vw, 14px);
    line-height:1.15;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    letter-spacing:.2px;
  }
  .qTopBadge{
    flex:0 0 auto; font-size:11px; font-weight:900;
    padding:7px 10px; border-radius:999px;
    background:rgba(255,255,255,.18);
    border:1px solid rgba(255,255,255,.25);
    white-space:nowrap;
  }
  .qBody{ padding:12px 12px 0; }
  .qQR{
    width:min(72vw, 280px);
    margin:0 auto;
    background:#fff;
    border:1px solid rgba(148,163,184,.45);
    border-radius:18px;
    padding:10px;
  }
  .qIdRow{
    margin-top:10px;
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding:10px 12px;
    border-radius:16px;
    background:#0b1220;
    color:#fff;
  }
  .qIdLabel{ font-size:11px; opacity:.85; margin-bottom:3px; }
  .qIdCode{ font-size:13px; font-weight:900; overflow-wrap:anywhere; word-break:break-word; }
  .qCopyBtn{
    border:none; background:rgba(255,255,255,.16); color:#fff;
    font-weight:900; font-size:12px; padding:9px 12px; border-radius:14px;
    cursor:pointer; touch-action:manipulation; white-space:nowrap;
  }
  .qGrid{ margin-top:10px; display:grid; gap:8px; }
  .qRow{
    display:grid; grid-template-columns:92px 1fr; gap:10px;
    padding:10px 12px;
    border-radius:16px;
    border:1px solid rgba(148,163,184,.35);
    background:linear-gradient(180deg,#f8fafc,#f1f5f9);
  }
  .qK{ font-size:12px; font-weight:900; color:#334155; white-space:nowrap; }
  .qV{ font-size:13px; color:#0f172a; overflow-wrap:anywhere; word-break:break-word; line-height:1.35; min-width:0; }
  .qActions{
    position:sticky; bottom:0;
    padding:10px 12px calc(10px + env(safe-area-inset-bottom));
    background:rgba(255,255,255,.92);
    backdrop-filter:blur(10px);
    border-top:1px solid rgba(148,163,184,.25);
    display:grid; gap:10px;
  }
  .qBtn{
    width:100%; border:none; cursor:pointer;
    padding:12px 12px; border-radius:16px;
    font-weight:900; font-size:14px;
    touch-action:manipulation;
  }
  .qBtnPrimary{
    color:#fff; background:linear-gradient(135deg,var(--q-ac),var(--q-ac2));
    box-shadow:0 10px 18px rgba(248,91,26,.25);
  }
  .qHint{
    text-align:center; font-size:12px; color:var(--q-muted);
    padding:10px 6px 12px; line-height:1.35;
  }
  @media (max-width:360px){
    .qQR{ width:min(82vw, 260px); }
    .qRow{ grid-template-columns:80px 1fr; }
    .qV{ font-size:12px; }
  }
</style>

<div class="q" id="qrWrap">
  <div class="qCard" id="qrCard">
    <div class="qTop">
      <div class="qTopTitle">เก็บQRCodeไว้สแกนออก</div>
      <div class="qTopBadge">แนะนำ: ดาวน์โหลดรูป</div>
    </div>

    <div class="qBody">
      <div class="qQR"><img src="${qrDataURL}" alt="QR Code"></div>

      <div class="qIdRow">
        <div>
          <div class="qIdLabel">รหัสพื้นที่</div>
          <div class="qIdCode" id="idCode">${autoId}</div>
        </div>
        <button type="button" class="qCopyBtn" id="copy-id">คัดลอก</button>
      </div>

      <div class="qGrid">
        <div class="qRow"><div class="qK">DC</div><div class="qV">${dc} - ${dcName}</div></div>
        <div class="qRow"><div class="qK">ชื่อ</div><div class="qV">${fullName}</div></div>
        <div class="qRow"><div class="qK">เพศ</div><div class="qV">${gender}</div></div>
        <div class="qRow"><div class="qK">บริษัท</div><div class="qV">${companyResolved}</div></div>
        <div class="qRow"><div class="qK">โทร</div><div class="qV">${phone}</div></div>
        <div class="qRow"><div class="qK">เวลา</div><div class="qV">${timestampClient}</div></div>
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

$('#registration-form').on('submit', async function (e) {
  e.preventDefault();
  if (isSubmitting) return;

  clearInvalid();
  const v = validateForm();
  if (!v.ok) {
    const list = '<ul style="text-align:left;margin:0 auto;max-width:420px;">' +
      v.errors.map(x => `<li>${x}</li>`).join('') + '</ul>';
    Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', html: list });
    if (v.firstInvalid) {
      document.querySelector(v.firstInvalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => document.querySelector(v.firstInvalid)?.focus(), 250);
    }
    return;
  }

  isSubmitting = true;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;

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

    // QR data url
    const qrHost = document.createElement('div');
    new QRCode(qrHost, { text: autoId, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    const qrCanvas = qrHost.querySelector('canvas');
    const qrImg = qrHost.querySelector('img');
    const qrDataURL = qrCanvas ? qrCanvas.toDataURL('image/png') : (qrImg ? qrImg.src : '');

    const htmlContent = buildQrPopupHtml({ qrDataURL, ...payload });

    // แสดง QR ก่อน (UX ดีบนมือถือ)
    Swal.fire({
      title: '<span class="qr-title">เก็บ QRCode ไว้สแกนออก</span>',
      html: htmlContent,
      showConfirmButton: false,
      showCloseButton: true,
      allowOutsideClick: true,
      width: 'clamp(320px, 92vw, 560px)',
      padding: '12px',
      backdrop: true
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

      document.getElementById('download-btn')?.addEventListener('click', async () => {
        const card = document.getElementById('qrCard');
        if (!card) return;

        const actions = card.querySelector('.qActions');
        if (actions) actions.style.display = 'none';

        const canvas = await html2canvas(card, {
          scale: Math.min(3, window.devicePixelRatio || 2),
          backgroundColor: '#ffffff',
          useCORS: true
        });

        if (actions) actions.style.display = 'grid';

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `visitor_${autoId}.png`;
        a.click();
      });
    }, 150);

    // save to backend
    await api('saveData', payload);

  } catch (err) {
    Swal.fire({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: String(err && err.message ? err.message : err) });
  } finally {
    isSubmitting = false;
    btn.disabled = false;
  }
});

/***********************
 * Init
 ***********************/
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadDCOptions();
    await loadCompanyOptions();
    showPrivacyMessage();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ',
      text: String(err && err.message ? err.message : err)
    });
  }
});



