/**********************************************************************
 * BASE AFFILIATE PARTNER - HE THONG QUAN LY PARTNER & LEAD (MIEN PHI)
 * Chay tren Google Sheets + Apps Script.
 *
 * CACH DUNG NHANH:
 *  1) Tao 1 Google Sheet trong, vao Tien ich mo rong > Apps Script
 *  2) Xoa het code mac dinh, dan toan bo file nay vao, bam Luu
 *  3) Sua phan CONFIG ben duoi
 *  4) Chon ham "caiDat" o thanh tren cung > bam Chay > cap quyen
 *  5) Trien khai > Tao ban trien khai moi > Ung dung web
 *     (Thuc thi voi tu cach: Toi | Ai co quyen truy cap: Bat ky ai)
 *     -> copy URL, dan vao Webhook cua Unbounce
 **********************************************************************/

const CONFIG = {
  ADMIN_EMAILS: 'giang.hoang03@base.vn',   // nhieu email: cach nhau dau phay
  PORTAL_URL: '',                           // link Google Sites (dien sau khi tao)
  HOTLINE: '0943 860 401',
  SENDER_NAME: 'Base Affiliate Partner',
  REPLY_TO: 'giang.hoang03@base.vn',
};

/* ---------------- DANH SACH CO DINH (theo pipeline Base) ---------------- */
const SHEET_PARTNER = 'Partner';
const SHEET_LEAD = 'Lead';
const SHEET_LOG = 'Nhật ký email';

const PARTNER_HEADERS = ['Thời gian', 'Họ và tên', 'Email', 'Số điện thoại', 'Khu vực', 'Tên công ty',
  'Vị trí công việc', 'Website công ty', 'Profile', 'Mã số thuế', 'Quy mô nhân sự', 'Kỳ vọng hợp tác',
  'Trạng thái duyệt', 'Mã partner', 'Ghi chú gửi partner', 'Ghi chú nội bộ'];

const LEAD_HEADERS = ['Mã lead', 'Thời gian', 'Mã partner', 'Email partner', 'Tên partner',
  'Công ty khách hàng', 'Người liên hệ', 'Chức vụ', 'SĐT khách hàng', 'Email khách hàng', 'Quy mô KH',
  'Nhu cầu / ghi chú', 'Tên deal trên Base', 'Cảnh báo trùng', 'Kiểm tra lead', 'BC phụ trách',
  'Email BC', '% hoa hồng', 'Giai đoạn', 'Giá trị deal (VNĐ)', 'Ghi chú gửi partner', 'Cập nhật lần cuối'];

const PARTNER_STATUS = ['Chờ duyệt', 'Đã duyệt', 'Từ chối'];
const LEAD_CHECK = ['Chờ kiểm tra', 'Hợp lệ', 'Không hợp lệ', 'Trùng lead'];
const STAGES = ['LEAD - OUTREACH', 'FIRST TOUCH', 'MQL', 'MEETING BOOKED', 'SAL', 'SHOWCASE',
  'NEGOTIATION', 'PAYMENT', 'THÀNH CÔNG', 'THẤT BẠI'];

// Cach dien giai tung giai doan cho partner de hieu
const STAGE_INFO = {
  'LEAD - OUTREACH': 'Base đã tiếp nhận và bắt đầu liên hệ khách hàng của bạn.',
  'FIRST TOUCH': 'Base đã có buổi trao đổi đầu tiên với khách hàng.',
  'MQL': 'Khách hàng được xác nhận có nhu cầu phù hợp với giải pháp của Base.',
  'MEETING BOOKED': 'Đã đặt lịch họp tư vấn với khách hàng.',
  'SAL': 'Đội kinh doanh đã chính thức tiếp nhận cơ hội này.',
  'SHOWCASE': 'Base đã trình bày và demo giải pháp cho khách hàng.',
  'NEGOTIATION': 'Hai bên đang trao đổi phương án và báo giá.',
  'PAYMENT': 'Khách hàng đã đồng ý và đang trong giai đoạn thanh toán.',
  'THÀNH CÔNG': 'Deal đã chốt thành công. Cảm ơn bạn đã giới thiệu!',
  'THẤT BẠI': 'Rất tiếc, deal này chưa thành công ở thời điểm hiện tại.',
};

/* ============================ CAI DAT ============================ */
function caiDat() {
  const ss = SpreadsheetApp.getActive();
  const p = taoSheet_(ss, SHEET_PARTNER, PARTNER_HEADERS);
  const l = taoSheet_(ss, SHEET_LEAD, LEAD_HEADERS);
  taoSheet_(ss, SHEET_LOG, ['Thời gian', 'Khóa', 'Gửi tới', 'Tiêu đề']);

  dropdown_(p, 'Trạng thái duyệt', PARTNER_STATUS);
  dropdown_(l, 'Kiểm tra lead', LEAD_CHECK);
  dropdown_(l, 'Giai đoạn', STAGES);

  // Form dang ky lead (tao 1 lan)
  const props = PropertiesService.getScriptProperties();
  let form;
  const formId = props.getProperty('LEAD_FORM_ID');
  if (formId) { try { form = FormApp.openById(formId); } catch (e) { form = null; } }
  if (!form) {
    form = FormApp.create('Đăng ký lead - Base Affiliate Partner');
    form.setDescription('Dành cho Partner đã được duyệt. Đăng nhập bằng đúng email bạn đã đăng ký Partner.');
    form.setCollectEmail(true);
    try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); } catch (e) {}
    form.addTextItem().setTitle('Công ty khách hàng').setRequired(true);
    form.addTextItem().setTitle('Người liên hệ').setRequired(true);
    form.addTextItem().setTitle('Chức vụ');
    form.addTextItem().setTitle('SĐT khách hàng').setRequired(true);
    form.addTextItem().setTitle('Email khách hàng');
    form.addListItem().setTitle('Quy mô KH')
      .setChoiceValues(['Dưới 10 người', '10 - 50 người', '51 - 200 người', '201 - 500 người', 'Trên 500 người']);
    form.addParagraphTextItem().setTitle('Nhu cầu / ghi chú')
      .setHelpText('Khách đang gặp vấn đề gì, quan tâm sản phẩm nào của Base.');
    form.setConfirmationMessage('Đã nhận lead. Base sẽ kiểm tra và gửi email cho bạn trong 24-48h.');
    props.setProperty('LEAD_FORM_ID', form.getId());
  }
  props.setProperty('LEAD_FORM_URL', form.getPublishedUrl());

  // Trigger (xoa cu, tao moi)
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('xuLyChinhSua').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('xuLyLeadMoi').forForm(form).onFormSubmit().create();

  SpreadsheetApp.getUi().alert('Cài đặt xong!\n\nLink form đăng ký lead (dán vào Google Sites):\n'
    + form.getPublishedUrl() + '\n\nLink chỉnh sửa form:\n' + form.getEditUrl());
}

/* ======== 1) NHAN DANG KY PARTNER TU UNBOUNCE / TRANG HTML ======== */
function doPost(e) {
  const d = docDuLieuPost_(e);
  const g = (keys) => { for (const k of keys) if (d[k]) return String(d[k]).trim(); return ''; };
  const row = {
    'Thời gian': new Date(),
    'Họ và tên': g(['Họ và tên', 'ho_ten', 'name', 'full_name']),
    'Email': g(['Email', 'email']).toLowerCase(),
    'Số điện thoại': g(['Số điện thoại', 'so_dien_thoai', 'sdt', 'phone']),
    'Khu vực': g(['Khu vực', 'khu_vuc']),
    'Tên công ty': g(['Tên công ty', 'cong_ty', 'company']),
    'Vị trí công việc': g(['Vị trí công việc', 'vi_tri']),
    'Website công ty': g(['Website công ty', 'website']),
    'Profile': g(['Profile', 'profile']),
    'Mã số thuế': g(['Mã số thuế', 'ma_so_thue', 'mst']),
    'Quy mô nhân sự': g(['Quy mô nhân sự', 'quy_mo']),
    'Kỳ vọng hợp tác': g(['Kỳ vọng hợp tác', 'ky_vong']),
    'Trạng thái duyệt': 'Chờ duyệt',
  };
  if (!row['Email'] || g(['botcheck'])) return json_({ success: false });

  ghiDong_(sheet_(SHEET_PARTNER), row);

  guiEmail_('partner-nhan|' + row['Email'] + '|' + Date.now(), row['Email'],
    'Base đã nhận đăng ký Partner của bạn',
    `<p>Chào ${esc_(row['Họ và tên'])},</p>
     <p>Cảm ơn bạn đã đăng ký chương trình Base Affiliate Partner 2026. Hồ sơ của bạn sẽ được xét duyệt trong <b>24-48 giờ làm việc</b>. Base sẽ gửi email thông báo kết quả cùng hướng dẫn truy cập Partner Portal.</p>`);

  guiEmail_('admin-partner|' + row['Email'] + '|' + Date.now(), CONFIG.ADMIN_EMAILS,
    `[Partner mới] ${row['Tên công ty']} - ${row['Họ và tên']}`,
    `<p>Có đăng ký Partner mới cần duyệt:</p>${bang_(row)}
     <p><a href="${SpreadsheetApp.getActive().getUrl()}">Mở Google Sheet để duyệt</a></p>`);

  return json_({ success: true });
}

/* =========== 2) PARTNER GUI LEAD QUA GOOGLE FORM =========== */
function xuLyLeadMoi(e) {
  const res = e.response;
  const email = (res.getRespondentEmail() || '').toLowerCase();
  const tl = {};
  res.getItemResponses().forEach(ir => tl[ir.getItem().getTitle()] = String(ir.getResponse() || '').trim());

  const partner = timPartner_(email);
  if (!partner || partner['Trạng thái duyệt'] !== 'Đã duyệt') {
    if (email) guiEmail_('lead-tuchoi|' + email + '|' + Date.now(), email, 'Chưa gửi được lead',
      `<p>Email <b>${esc_(email)}</b> chưa có trong danh sách Partner đã được duyệt, nên lead vừa gửi chưa được ghi nhận.</p>
       <p>Vui lòng đăng nhập Google bằng đúng email đã đăng ký Partner, hoặc liên hệ hotline ${CONFIG.HOTLINE}.</p>`);
    return;
  }

  const sh = sheet_(SHEET_LEAD);
  const maLead = 'L' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMdd') + '-' + String(sh.getLastRow()).padStart(3, '0');
  const congTy = tl['Công ty khách hàng'] || '';
  const row = {
    'Mã lead': maLead,
    'Thời gian': new Date(),
    'Mã partner': partner['Mã partner'],
    'Email partner': email,
    'Tên partner': partner['Họ và tên'],
    'Công ty khách hàng': congTy,
    'Người liên hệ': tl['Người liên hệ'] || '',
    'Chức vụ': tl['Chức vụ'] || '',
    'SĐT khách hàng': tl['SĐT khách hàng'] || '',
    'Email khách hàng': tl['Email khách hàng'] || '',
    'Quy mô KH': tl['Quy mô KH'] || '',
    'Nhu cầu / ghi chú': tl['Nhu cầu / ghi chú'] || '',
    'Tên deal trên Base': `[Partner ${partner['Họ và tên']}] ${congTy}`,
    'Cảnh báo trùng': kiemTraTrung_(sh, congTy, tl['SĐT khách hàng']),
    'Kiểm tra lead': 'Chờ kiểm tra',
  };
  ghiDong_(sh, row);

  guiEmail_('lead-nhan|' + maLead, email, `Base đã nhận lead ${congTy} (${maLead})`,
    `<p>Chào ${esc_(partner['Họ và tên'])},</p>
     <p>Base đã nhận thông tin khách hàng <b>${esc_(congTy)}</b> bạn giới thiệu. Mã lead: <b>${maLead}</b>.</p>
     <p>Đội ngũ sẽ kiểm tra tính hợp lệ (trùng lead, đúng đối tượng) và báo kết quả cho bạn trong 24-48 giờ làm việc.</p>`);

  guiEmail_('admin-lead|' + maLead, CONFIG.ADMIN_EMAILS, `[Lead mới] ${row['Tên deal trên Base']}`,
    `${row['Cảnh báo trùng'] ? '<p style="color:#B91C1C"><b>' + esc_(row['Cảnh báo trùng']) + '</b></p>' : ''}
     ${bang_(row)}<p><a href="${SpreadsheetApp.getActive().getUrl()}">Mở Google Sheet để kiểm tra</a></p>`);
}

/* ============ 3) ADMIN DOI TRANG THAI TRONG SHEET -> EMAIL ============ */
function xuLyChinhSua(e) {
  const sh = e.range.getSheet();
  const name = sh.getName();
  if (name !== SHEET_PARTNER && name !== SHEET_LEAD) return;
  const c = cot_(sh);
  const colStart = e.range.getColumn(), colEnd = colStart + e.range.getNumColumns() - 1;
  for (let r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
    if (r < 2) continue;
    for (let col = colStart; col <= colEnd; col++) {
      const header = Object.keys(c).find(k => c[k] === col);
      if (name === SHEET_PARTNER && header === 'Trạng thái duyệt') xuLyDuyetPartner_(sh, r, c);
      if (name === SHEET_LEAD && ['Kiểm tra lead', 'BC phụ trách', '% hoa hồng'].includes(header)) xuLyKiemTraLead_(sh, r, c);
      if (name === SHEET_LEAD && header === 'Giai đoạn') xuLyGiaiDoan_(sh, r, c);
    }
  }
}

function xuLyDuyetPartner_(sh, r, c) {
  const p = docDong_(sh, r, c);
  if (!p['Email']) return;
  if (p['Trạng thái duyệt'] === 'Đã duyệt') {
    let ma = p['Mã partner'];
    if (!ma) {
      const props = PropertiesService.getScriptProperties();
      const n = Number(props.getProperty('PARTNER_SEQ') || 0) + 1;
      props.setProperty('PARTNER_SEQ', String(n));
      ma = 'P' + String(n).padStart(4, '0');
      sh.getRange(r, c['Mã partner']).setValue(ma);
    }
    const formUrl = PropertiesService.getScriptProperties().getProperty('LEAD_FORM_URL');
    guiEmail_('duyet|' + p['Email'], p['Email'], 'Chào mừng bạn trở thành Base Affiliate Partner',
      `<p>Chào ${esc_(p['Họ và tên'])},</p>
       <p>Hồ sơ của bạn đã được duyệt. Mã Partner của bạn: <b>${ma}</b>.</p>
       <p><b>Cách truy cập Partner Portal:</b> đăng nhập Google bằng đúng email <b>${esc_(p['Email'])}</b>. Nếu email này chưa phải tài khoản Google, bạn có thể tạo miễn phí tại accounts.google.com (chọn "Dùng địa chỉ email hiện tại").</p>
       <p>${CONFIG.PORTAL_URL ? '<a href="' + CONFIG.PORTAL_URL + '">Mở Partner Portal</a><br>' : ''}
       ${formUrl ? '<a href="' + formUrl + '">Gửi lead đầu tiên</a>' : ''}</p>
       ${p['Ghi chú gửi partner'] ? '<p>' + esc_(p['Ghi chú gửi partner']) + '</p>' : ''}`);
  } else if (p['Trạng thái duyệt'] === 'Từ chối') {
    guiEmail_('tuchoi|' + p['Email'], p['Email'], 'Kết quả đăng ký Base Affiliate Partner',
      `<p>Chào ${esc_(p['Họ và tên'])},</p>
       <p>Cảm ơn bạn đã quan tâm chương trình Base Affiliate Partner. Ở thời điểm này hồ sơ của bạn chưa phù hợp để tham gia.</p>
       ${p['Ghi chú gửi partner'] ? '<p>Lý do: ' + esc_(p['Ghi chú gửi partner']) + '</p>' : ''}
       <p>Nếu cần trao đổi thêm, vui lòng gọi hotline ${CONFIG.HOTLINE}.</p>`);
  }
}

function xuLyKiemTraLead_(sh, r, c) {
  const l = docDong_(sh, r, c);
  const kq = l['Kiểm tra lead'];
  if (!l['Email partner'] || !l['Mã lead']) return;

  if (kq === 'Hợp lệ') {
    if (!l['BC phụ trách'] || l['% hoa hồng'] === '') {
      sh.getRange(r, c['Kiểm tra lead']).setNote('Điền "BC phụ trách" và "% hoa hồng" để hệ thống gửi email cho partner.');
      return;
    }
    sh.getRange(r, c['Kiểm tra lead']).clearNote();
    const sent = guiEmail_('hople|' + l['Mã lead'], l['Email partner'],
      `Lead ${l['Công ty khách hàng']} đã được xác nhận hợp lệ`,
      `<p>Chào ${esc_(l['Tên partner'])},</p>
       <p>Lead <b>${esc_(l['Công ty khách hàng'])}</b> (${l['Mã lead']}) đã được xác nhận <b>hợp lệ</b>.</p>
       <ul><li>Người phụ trách (BC): <b>${esc_(l['BC phụ trách'])}</b>${l['Email BC'] ? ' - ' + esc_(l['Email BC']) : ''}</li>
       <li>Hoa hồng nếu deal thành công: <b>${phanTram_(l['% hoa hồng'])}</b> giá trị hợp đồng</li></ul>
       <p>Base sẽ gửi email mỗi khi deal chuyển giai đoạn.</p>`, l['Email BC']);
    if (sent && !l['Giai đoạn']) sh.getRange(r, c['Giai đoạn']).setValue('LEAD - OUTREACH');
  } else if (kq === 'Không hợp lệ' || kq === 'Trùng lead') {
    guiEmail_('khonghople|' + l['Mã lead'], l['Email partner'],
      `Kết quả kiểm tra lead ${l['Công ty khách hàng']}`,
      `<p>Chào ${esc_(l['Tên partner'])},</p>
       <p>Lead <b>${esc_(l['Công ty khách hàng'])}</b> (${l['Mã lead']}) ${kq === 'Trùng lead' ? 'đã có trong hệ thống của Base trước đó (trùng lead)' : 'chưa đáp ứng điều kiện ghi nhận'}.</p>
       ${l['Ghi chú gửi partner'] ? '<p>Chi tiết: ' + esc_(l['Ghi chú gửi partner']) + '</p>' : ''}
       <p>Cảm ơn bạn và mong tiếp tục nhận được giới thiệu từ bạn.</p>`);
  }
  sh.getRange(r, c['Cập nhật lần cuối']).setValue(new Date());
}

function xuLyGiaiDoan_(sh, r, c) {
  const l = docDong_(sh, r, c);
  const gd = l['Giai đoạn'];
  if (!gd || !l['Email partner'] || l['Kiểm tra lead'] !== 'Hợp lệ') return;
  // Email LEAD - OUTREACH da gui kem email "hop le"
  if (gd === 'LEAD - OUTREACH') return;

  let them = '';
  if (gd === 'THÀNH CÔNG') {
    const gt = Number(String(l['Giá trị deal (VNĐ)']).replace(/[^\d]/g, '')) || 0;
    const pt = Number(String(l['% hoa hồng']).replace(',', '.').replace('%', '')) || 0;
    const ptThuc = pt > 0 && pt < 1 ? pt * 100 : pt;
    if (gt) them = `<p>Giá trị hợp đồng: <b>${gt.toLocaleString('vi-VN')} đ</b><br>
      Hoa hồng dự kiến (${ptThuc}%): <b>${Math.round(gt * ptThuc / 100).toLocaleString('vi-VN')} đ</b></p>
      <p>Đội ngũ Base sẽ liên hệ bạn về thủ tục nhận hoa hồng.</p>`;
  }
  const ghiChu = l['Ghi chú gửi partner'] ? `<p>${gd === 'THẤT BẠI' ? 'Lý do' : 'Ghi chú'}: ${esc_(l['Ghi chú gửi partner'])}</p>` : '';

  guiEmail_('giaidoan|' + l['Mã lead'] + '|' + gd, l['Email partner'],
    `[${l['Mã lead']}] ${l['Công ty khách hàng']}: ${tenGiaiDoan_(gd)}`,
    `<p>Chào ${esc_(l['Tên partner'])},</p>
     <p>Deal <b>${esc_(l['Công ty khách hàng'])}</b> vừa chuyển sang giai đoạn <b>${tenGiaiDoan_(gd)}</b>.</p>
     <p>${STAGE_INFO[gd] || ''}</p>${them}${ghiChu}
     ${thanhTienDo_(gd)}
     <p>Người phụ trách: ${esc_(l['BC phụ trách'] || '')}</p>`, l['Email BC']);
  sh.getRange(r, c['Cập nhật lần cuối']).setValue(new Date());
}

/* ============================ TIEN ICH ============================ */
function guiEmail_(key, to, subject, body, cc) {
  if (!to) return false;
  const log = sheet_(SHEET_LOG);
  if (!key.match(/\|\d{13}$/)) {           // chong gui trung cho email trang thai
    const keys = log.getLastRow() > 1 ? log.getRange(2, 2, log.getLastRow() - 1, 1).getValues().flat() : [];
    if (keys.includes(key)) return true;
  }
  const opts = { to: to, subject: subject, name: CONFIG.SENDER_NAME, replyTo: CONFIG.REPLY_TO, htmlBody: khung_(body) };
  if (cc) opts.cc = cc;
  MailApp.sendEmail(opts);
  log.appendRow([new Date(), key, to, subject]);
  return true;
}

function khung_(body) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1E293B;max-width:600px">
    <div style="font-weight:bold;font-size:17px;color:#2563EB;margin-bottom:16px">Base.vn · Affiliate Partner</div>
    ${body}
    <hr style="border:0;border-top:1px solid #E2E8F0;margin:24px 0 12px">
    <div style="font-size:13px;color:#64748B">Đội ngũ Phát triển Đối tác Base.vn · Hotline ${CONFIG.HOTLINE}
    ${CONFIG.PORTAL_URL ? ' · <a href="' + CONFIG.PORTAL_URL + '">Partner Portal</a>' : ''}</div></div>`;
}

function thanhTienDo_(gd) {
  const main = STAGES.slice(0, 8);
  const idx = gd === 'THÀNH CÔNG' ? 8 : main.indexOf(gd);
  if (idx < 0) return '';
  const cells = main.map((s, i) => `<td style="padding:4px 6px;font-size:10px;text-align:center;border-radius:4px;
    background:${i <= idx ? '#16A34A' : '#E2E8F0'};color:${i <= idx ? '#fff' : '#64748B'}">${s}</td>`).join('');
  return `<table cellspacing="3" style="margin:12px 0"><tr>${cells}</tr></table>`;
}

function tenGiaiDoan_(gd) {
  const m = { 'THÀNH CÔNG': 'Thành công', 'THẤT BẠI': 'Thất bại' };
  return m[gd] || gd;
}
function phanTram_(v) {
  const n = Number(String(v).replace(',', '.').replace('%', ''));
  if (isNaN(n)) return esc_(v);
  return (n > 0 && n < 1 ? n * 100 : n) + '%';
}
function kiemTraTrung_(sh, congTy, sdt) {
  if (sh.getLastRow() < 2) return '';
  const c = cot_(sh);
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const chuan = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const so = s => String(s || '').replace(/\D/g, '').slice(-9);
  const hit = data.find(d => (congTy && chuan(d[c['Công ty khách hàng'] - 1]) === chuan(congTy)) ||
    (sdt && so(sdt).length >= 8 && so(d[c['SĐT khách hàng'] - 1]) === so(sdt)));
  return hit ? `Có thể trùng với lead ${hit[c['Mã lead'] - 1]} (${hit[c['Tên partner'] - 1]})` : '';
}
function timPartner_(email) {
  const sh = sheet_(SHEET_PARTNER);
  if (sh.getLastRow() < 2 || !email) return null;
  const c = cot_(sh);
  for (let r = sh.getLastRow(); r >= 2; r--) {
    const p = docDong_(sh, r, c);
    if (String(p['Email']).toLowerCase() === email) return p;
  }
  return null;
}
function taoSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E9EFF8');
  sh.setFrozenRows(1);
  return sh;
}
function dropdown_(sh, header, list) {
  const col = cot_(sh)[header];
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sh.getRange(2, col, 2000, 1).setDataValidation(rule);
}
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function cot_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const m = {}; h.forEach((v, i) => { if (v) m[v] = i + 1; }); return m;
}
function docDong_(sh, r, c) {
  const v = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const o = {}; Object.keys(c).forEach(k => o[k] = v[c[k] - 1]); return o;
}
function ghiDong_(sh, obj) {
  const c = cot_(sh);
  const arr = new Array(sh.getLastColumn()).fill('');
  Object.keys(obj).forEach(k => { if (c[k]) arr[c[k] - 1] = obj[k]; });
  sh.appendRow(arr);
}
function bang_(obj) {
  return '<table style="border-collapse:collapse;font-size:14px">' + Object.keys(obj).map(k =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748B">${esc_(k)}</td><td style="padding:4px 0">${esc_(obj[k] instanceof Date ? obj[k].toLocaleString('vi-VN') : obj[k])}</td></tr>`).join('') + '</table>';
}
function docDuLieuPost_(e) {
  let d = {};
  try {
    if (e.parameter && e.parameter['data.json']) {          // Unbounce
      const j = JSON.parse(e.parameter['data.json']);
      Object.keys(j).forEach(k => d[k] = Array.isArray(j[k]) ? j[k].join(', ') : j[k]);
    } else if (e.postData && e.postData.contents && e.postData.contents.trim().startsWith('{')) {
      d = JSON.parse(e.postData.contents);                   // trang HTML / JSON
    } else { d = e.parameter || {}; }
  } catch (err) { d = e.parameter || {}; }
  return d;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
