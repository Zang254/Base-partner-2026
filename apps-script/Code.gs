/**********************************************************************
 * BASE AFFILIATE PARTNER 2026 - BACKEND v2 (Google Sheets + Apps Script)
 *
 * Tinh nang:
 *  - Nhan dang ky Partner tu website (GitHub Pages / Unbounce)
 *  - Admin chon "Da duyet" -> sinh Ma partner + tai khoan dang nhap, gui email
 *  - API cho Partner Portal: dang nhap, ho so, tai nguyen, dang ky lead, deal cua toi
 *  - Day lead sang Base Workflow (API), tu dong doc ket qua Approved & Assign
 *  - Nhan cap nhat stage tu Base CRM (Base Process goi webhook) -> email partner
 *
 * CAP NHAT TU BAN CU: dan de toan bo file nay -> Luu -> chay ham "caiDat"
 *   (ham nay CHI THEM cot/tab con thieu, KHONG xoa du lieu cu)
 *   -> Trien khai > Quan ly ban trien khai > but chi > Phien ban moi > Trien khai
 *
 * THUOC TINH TAP LENH (Cai dat du an > Thuoc tinh tap lenh) - KHONG dan vao code:
 *   BASE_WF_TOKEN   : access token v2 cua Base Workflow
 *   WF_ID           : ID workflow "MKT | Dang ky lead - Partner"
 *   WF_CREATOR      : username tai khoan dung ten tao nhiem vu (vd: giang.hoang03)
 *   WEBHOOK_SECRET  : chuoi bi mat tu dat, dung cho webhook tu Base Workflow / Base CRM
 *   WF_WEBHOOK_CREATE: 'Diem cuoi Webhook' (tao nhiem vu) cua workflow - thay cho token
 **********************************************************************/

const CONFIG = {
  // File Google Sheet luu du lieu Partner/Lead (lay ID trong link: /spreadsheets/d/<ID>/edit)
  SHEET_ID: '1PmC0IxpfZx1EHd3KkFVNLYNI9wUU6QDpLP5gkvfr-WY',
  ADMIN_EMAILS: 'giang.hoang03@base.vn',
  SITE_URL: 'https://zang254.github.io/Base-partner-2026/',
  PORTAL_URL: 'https://zang254.github.io/Base-partner-2026/portal.html',
  HOTLINE: '0943 860 401',
  SENDER_NAME: 'Base Affiliate Partner',
  REPLY_TO: 'giang.hoang03@base.vn',

  // Base Workflow: ten giai doan va ten truong dung y nhu tren Workflow
  WF_API: 'https://workflow.base.vn/extapi/v1',
  WF_STAGE_FAILED: 'Failed',
  WF_FIELD_VALID: 'Tình trạng lead',
  WF_FIELD_PERCENT: '% hoa hồng partner',
  WF_FIELD_BC: 'BC/CD phụ trách',
  WF_FIELD_CRM: 'Link deal CRM',
  // Truong tuy chinh dien khi tao nhiem vu: { 'ten truong tren Workflow': 'cot trong tab Lead' hoac '=gia tri co dinh' }
  WF_CREATE_FIELDS: {
    'Tên chương trình': '=AFF',
    'Partner ID': 'Partner ID (Base)',
    'Công ty đề xuất': 'Công ty khách hàng',
    'Người liên hệ': 'Người liên hệ',
    'Số điện thoại': 'SĐT khách hàng',
    'Email công ty': 'Email khách hàng',
    'Sản phẩm quan tâm': 'Sản phẩm quan tâm',
    'Quy mô': 'Quy mô KH',
    'Tỉnh/Thành phố': 'Tỉnh/Thành phố',
  },
};

/* ---------------- HANG SO ---------------- */
const SHEET_PARTNER = 'Partner';
const SHEET_LEAD = 'Lead';
const SHEET_LOG = 'Nhật ký email';
const SHEET_RES = 'Tài nguyên';

const PARTNER_HEADERS = ['Thời gian', 'Họ và tên', 'Email', 'Số điện thoại', 'Khu vực', 'Tên công ty',
  'Vị trí công việc', 'Website công ty', 'Profile', 'Mã số thuế', 'Quy mô nhân sự', 'Kỳ vọng hợp tác',
  'Trạng thái duyệt', 'Mã partner', 'Ghi chú gửi partner', 'Ghi chú nội bộ',
  'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân',
  'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản', 'Cập nhật hồ sơ',
  'Mật khẩu (mã hóa)', 'Salt', 'Phải đổi mật khẩu', 'Đăng nhập lần cuối'];

const LEAD_HEADERS = ['Mã lead', 'Thời gian', 'Mã partner', 'Email partner', 'Tên partner',
  'Công ty khách hàng', 'Người liên hệ', 'Chức vụ', 'SĐT khách hàng', 'Email khách hàng', 'Quy mô KH',
  'Nhu cầu / ghi chú', 'Tên deal trên Base', 'Cảnh báo trùng', 'Kiểm tra lead', 'BC phụ trách',
  'Email BC', '% hoa hồng', 'Giai đoạn', 'Giá trị deal (VNĐ)', 'Ghi chú gửi partner', 'Cập nhật lần cuối',
  'Sản phẩm quan tâm', 'Tỉnh/Thành phố', 'ID job Workflow', 'Giai đoạn Workflow', 'Link deal CRM', 'Partner ID (Base)'];

const RES_HEADERS = ['Nhóm', 'Tiêu đề', 'Mô tả', 'Link', 'Hiển thị'];

const PARTNER_STATUS = ['Chờ duyệt', 'Đã duyệt', 'Từ chối'];
const LEAD_CHECK = ['Chờ kiểm tra', 'Hợp lệ', 'Không hợp lệ', 'Trùng lead'];
const STAGES = ['LEAD - OUTREACH', 'FIRST TOUCH', 'MQL', 'MEETING BOOKED', 'SAL', 'SHOWCASE',
  'NEGOTIATION', 'PAYMENT', 'THÀNH CÔNG', 'THẤT BẠI'];

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

const STAGE_ALIAS = {
  'lead - outreach': 'LEAD - OUTREACH', 'lead outreach': 'LEAD - OUTREACH', 'first touch': 'FIRST TOUCH',
  'mql': 'MQL', 'meeting booked': 'MEETING BOOKED', 'sal': 'SAL', 'showcase': 'SHOWCASE',
  'negotiation': 'NEGOTIATION', 'payment': 'PAYMENT', 'thành công': 'THÀNH CÔNG', 'won': 'THÀNH CÔNG',
  'success': 'THÀNH CÔNG', 'thất bại': 'THẤT BẠI', 'lost': 'THẤT BẠI', 'failed': 'THẤT BẠI',
};

/* ============================ CAI DAT ============================ */
function caiDat() {
  const ss = ss_();
  const p = damBaoSheet_(ss, SHEET_PARTNER, PARTNER_HEADERS);
  const l = damBaoSheet_(ss, SHEET_LEAD, LEAD_HEADERS);
  damBaoSheet_(ss, SHEET_LOG, ['Thời gian', 'Khóa', 'Gửi tới', 'Tiêu đề']);
  const r = damBaoSheet_(ss, SHEET_RES, RES_HEADERS);
  if (r.getLastRow() < 2) {
    r.getRange(2, 1, 4, 5).setValues([
      ['Chính sách', 'Chính sách Affiliate Partner 2026', 'Bảng hoa hồng, điều kiện lead hợp lệ, quy trình phối hợp', '', 'Có'],
      ['Giới thiệu Base', 'Profile Base.vn', 'Hồ sơ năng lực, khách hàng tiêu biểu, giải thưởng', '', 'Có'],
      ['Sản phẩm', 'Bộ giải pháp Base Work, CRM, HRM, AI & Agents', 'Thông tin chi tiết từng bộ sản phẩm', 'https://base.vn', 'Có'],
      ['Sản phẩm', 'Case study theo ngành', 'Câu chuyện khách hàng để tư vấn sơ bộ', '', 'Có'],
    ]);
  }
  dropdown_(p, 'Trạng thái duyệt', PARTNER_STATUS);
  dropdown_(l, 'Kiểm tra lead', LEAD_CHECK);
  dropdown_(l, 'Giai đoạn', STAGES);
  ['Mật khẩu (mã hóa)', 'Salt'].forEach(h => { const c = cot_(p)[h]; if (c) p.hideColumns(c); });

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('xuLyChinhSua').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('dongBoWorkflow').timeBased().everyMinutes(10).create();

  thongBao_('Cài đặt v2 xong!\n\n- Đã thêm cột/tab còn thiếu (dữ liệu cũ giữ nguyên).\n- Đã bật đồng bộ Base Workflow mỗi 10 phút.\n\nNhớ: Triển khai > Quản lý bản triển khai > Phiên bản mới.\n\nDữ liệu lưu tại: ' + ss.getUrl());
}

function thongBao_(m) { try { SpreadsheetApp.getUi().alert(m); } catch (e) { Logger.log(m); } }

/* ============================ API ============================ */
function doPost(e) {
  if (e && e.parameter && e.parameter.src === 'wf') return json_(webhookWorkflow_(e));
  let d = {};
  try { d = docDuLieuPost_(e); } catch (err) { return json_({ ok: false, error: 'Dữ liệu không hợp lệ' }); }
  const action = d.action || 'register';
  try {
    switch (action) {
      case 'register': return json_(dangKyPartner_(d));
      case 'login': return json_(dangNhap_(d));
      case 'forgot': return json_(quenMatKhau_(d));
      case 'me': return json_(withAuth_(d, email => ({ ok: true, profile: hoSo_(email) })));
      case 'saveProfile': return json_(withAuth_(d, email => luuHoSo_(email, d.profile || {})));
      case 'changePassword': return json_(withAuth_(d, email => doiMatKhau_(email, d.oldPassword, d.newPassword)));
      case 'resources': return json_(withAuth_(d, () => ({ ok: true, items: taiNguyen_() })));
      case 'submitLead': return json_(withAuth_(d, email => guiLead_(email, d.lead || {})));
      case 'myDeals': return json_(withAuth_(d, email => ({ ok: true, deals: dealCuaToi_(email) })));
      case 'logout': if (d.token) CacheService.getScriptCache().remove('s_' + d.token); return json_({ ok: true });
      case 'crm': return json_(webhookCrm_(d));
      default: return json_({ ok: false, error: 'Hành động không hợp lệ' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Lỗi hệ thống, vui lòng thử lại sau.' });
  }
}

// Base Process co the goi webhook bang GET: ?action=crm&secret=...&lead=...&stage=...
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'crm') return json_(webhookCrm_(p));
  return json_({ ok: true, service: 'Base Affiliate Partner API' });
}

function withAuth_(d, fn) {
  const cache = CacheService.getScriptCache();
  const email = d.token ? cache.get('s_' + d.token) : null;
  if (!email) return { ok: false, auth: false, error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
  cache.put('s_' + d.token, email, 21600);
  return fn(email);
}

/* ---------- 1) Dang ky Partner ---------- */
function dangKyPartner_(d) {
  const g = (keys) => { for (const k of keys) if (d[k]) return String(d[k]).trim(); return ''; };
  if (g(['botcheck'])) return { ok: true };
  const row = {
    'Thời gian': new Date(),
    'Họ và tên': g(['Họ và tên', 'ho_ten', 'name']),
    'Email': g(['Email', 'email']).toLowerCase(),
    'Số điện thoại': g(['Số điện thoại', 'so_dien_thoai', 'phone']),
    'Khu vực': g(['Khu vực', 'khu_vuc']),
    'Tên công ty': g(['Tên công ty', 'cong_ty']),
    'Vị trí công việc': g(['Vị trí công việc', 'vi_tri']),
    'Website công ty': g(['Website công ty', 'website']),
    'Profile': g(['Profile', 'profile']),
    'Mã số thuế': g(['Mã số thuế', 'ma_so_thue']),
    'Quy mô nhân sự': g(['Quy mô nhân sự', 'quy_mo']),
    'Kỳ vọng hợp tác': g(['Kỳ vọng hợp tác', 'ky_vong']),
    'Trạng thái duyệt': 'Chờ duyệt',
  };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row['Email'])) return { ok: false, error: 'Email không hợp lệ' };
  const cu = timPartner_(row['Email']);
  if (cu && cu['Trạng thái duyệt'] === 'Đã duyệt') return { ok: false, error: 'Email này đã là Partner. Vui lòng đăng nhập.' };

  ghiDong_(sheet_(SHEET_PARTNER), row);
  guiEmail_('partner-nhan|' + row['Email'] + '|' + Date.now(), row['Email'], 'Base đã nhận đăng ký Partner của bạn',
    `<p>Chào ${esc_(row['Họ và tên'])},</p>
     <p>Cảm ơn bạn đã đăng ký chương trình Base Affiliate Partner 2026. Hồ sơ sẽ được xét duyệt trong <b>24-48 giờ làm việc</b>. Khi được duyệt, bạn sẽ nhận email kèm <b>mã Partner và tài khoản đăng nhập</b> Partner Portal.</p>`);
  guiEmail_('admin-partner|' + row['Email'] + '|' + Date.now(), CONFIG.ADMIN_EMAILS,
    `[Partner mới] ${row['Tên công ty']} - ${row['Họ và tên']}`,
    `<p>Có đăng ký Partner mới cần duyệt:</p>${bang_(row)}<p><a href="${ss_().getUrl()}">Mở Google Sheet để duyệt</a></p>`);
  return { ok: true };
}

/* ---------- 2) Tai khoan ---------- */
function dangNhap_(d) {
  const email = String(d.email || '').trim().toLowerCase();
  const pw = String(d.password || '');
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + email, fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { ok: false, error: 'Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.' };

  const sh = sheet_(SHEET_PARTNER), c = cot_(sh), r = timDongPartner_(email);
  const p = r ? docDong_(sh, r, c) : null;
  if (!p || p['Trạng thái duyệt'] !== 'Đã duyệt' || !p['Mật khẩu (mã hóa)'] || bam_(pw, p['Salt']) !== p['Mật khẩu (mã hóa)']) {
    cache.put(failKey, String(fails + 1), 900);
    return { ok: false, error: 'Email hoặc mật khẩu không đúng.' };
  }
  cache.remove(failKey);
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache.put('s_' + token, email, 21600);
  sh.getRange(r, c['Đăng nhập lần cuối']).setValue(new Date());
  return { ok: true, token: token, mustChange: p['Phải đổi mật khẩu'] === 'Có', profile: hoSo_(email) };
}

function quenMatKhau_(d) {
  const email = String(d.email || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  if (cache.get('forgot_' + email)) return { ok: true };
  cache.put('forgot_' + email, '1', 600);
  const r = timDongPartner_(email);
  if (r) {
    const sh = sheet_(SHEET_PARTNER), c = cot_(sh), p = docDong_(sh, r, c);
    if (p['Trạng thái duyệt'] === 'Đã duyệt') {
      const pw = datMatKhauMoi_(sh, r, c);
      guiEmail_('reset|' + email + '|' + Date.now(), email, 'Mật khẩu mới cho Partner Portal',
        `<p>Chào ${esc_(p['Họ và tên'])},</p><p>Mật khẩu tạm thời mới của bạn: <b style="font-size:17px">${pw}</b></p>
         <p>Hãy đăng nhập và đổi mật khẩu ngay. Nếu bạn không yêu cầu, vui lòng liên hệ ${CONFIG.HOTLINE}.</p>
         <p><a href="${CONFIG.PORTAL_URL}">Đăng nhập Partner Portal</a></p>`);
    }
  }
  return { ok: true }; // khong tiet lo email co ton tai hay khong
}

function doiMatKhau_(email, oldPw, newPw) {
  newPw = String(newPw || '');
  if (newPw.length < 8) return { ok: false, error: 'Mật khẩu mới cần ít nhất 8 ký tự.' };
  const sh = sheet_(SHEET_PARTNER), c = cot_(sh), r = timDongPartner_(email), p = docDong_(sh, r, c);
  if (bam_(String(oldPw || ''), p['Salt']) !== p['Mật khẩu (mã hóa)']) return { ok: false, error: 'Mật khẩu hiện tại không đúng.' };
  const salt = Utilities.getUuid();
  sh.getRange(r, c['Salt']).setValue(salt);
  sh.getRange(r, c['Mật khẩu (mã hóa)']).setValue(bam_(newPw, salt));
  sh.getRange(r, c['Phải đổi mật khẩu']).setValue('Không');
  return { ok: true };
}

function datMatKhauMoi_(sh, r, c) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = ''; for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  const salt = Utilities.getUuid();
  sh.getRange(r, c['Salt']).setValue(salt);
  sh.getRange(r, c['Mật khẩu (mã hóa)']).setValue(bam_(pw, salt));
  sh.getRange(r, c['Phải đổi mật khẩu']).setValue('Có');
  return pw;
}

function bam_(pw, salt) {
  let h = pw + '|' + salt;
  for (let i = 0; i < 300; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

/* ---------- 3) Ho so ---------- */
const PROFILE_VIEW = ['Mã partner', 'Họ và tên', 'Email', 'Số điện thoại', 'Tên công ty', 'Vị trí công việc', 'Khu vực',
  'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân', 'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản', 'Cập nhật hồ sơ'];
const PROFILE_EDIT = ['Số điện thoại', 'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân',
  'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản'];

function hoSo_(email) {
  const p = timPartner_(email); if (!p) return {};
  const o = {};
  PROFILE_VIEW.forEach(k => o[k] = p[k] instanceof Date ? Utilities.formatDate(p[k], 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm') : String(p[k] === undefined ? '' : p[k]));
  return o;
}

function luuHoSo_(email, prof) {
  const sh = sheet_(SHEET_PARTNER), c = cot_(sh), r = timDongPartner_(email);
  PROFILE_EDIT.forEach(k => { if (k in prof && c[k]) sh.getRange(r, c[k]).setValue("'" + String(prof[k]).trim().slice(0, 300)); });
  sh.getRange(r, c['Cập nhật hồ sơ']).setValue(new Date());
  return { ok: true, profile: hoSo_(email) };
}

/* ---------- 4) Tai nguyen ---------- */
function taiNguyen_() {
  const sh = sheet_(SHEET_RES); if (!sh || sh.getLastRow() < 2) return [];
  const c = cot_(sh), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return rows.filter(v => v[c['Tiêu đề'] - 1] && v[c['Hiển thị'] - 1] !== 'Không')
    .map(v => ({ group: String(v[c['Nhóm'] - 1]), title: String(v[c['Tiêu đề'] - 1]), desc: String(v[c['Mô tả'] - 1]), link: String(v[c['Link'] - 1]) }));
}

/* ---------- 5) Dang ky lead ---------- */
function guiLead_(email, L) {
  const need = ['Partner ID', 'Họ và tên', 'Sản phẩm quan tâm', 'Email', 'Số điện thoại', 'Vị trí công việc', 'Tên công ty', 'Tỉnh/Thành phố', 'Quy mô nhân sự'];
  for (const k of need) if (!String(L[k] || '').trim()) return { ok: false, error: 'Vui lòng điền: ' + k };
  const partner = timPartner_(email);
  if (!partner || partner['Trạng thái duyệt'] !== 'Đã duyệt') return { ok: false, error: 'Tài khoản chưa được duyệt.' };

  const sh = sheet_(SHEET_LEAD), lock = LockService.getScriptLock();
  if (!cot_(sh)['Partner ID (Base)']) damBaoSheet_(ss_(), SHEET_LEAD, LEAD_HEADERS);
  lock.waitLock(20000);
  let row;
  try {
    const maLead = 'L' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMdd') + '-' + String(sh.getLastRow()).padStart(3, '0');
    const congTy = String(L['Tên công ty']).trim();
    row = {
      'Mã lead': maLead, 'Thời gian': new Date(), 'Mã partner': partner['Mã partner'], 'Email partner': email,
      'Tên partner': partner['Họ và tên'], 'Công ty khách hàng': congTy, 'Người liên hệ': String(L['Họ và tên']).trim(),
      'Chức vụ': L['Vị trí công việc'], 'SĐT khách hàng': "'" + String(L['Số điện thoại']).trim(),
      'Email khách hàng': String(L['Email']).trim(), 'Quy mô KH': L['Quy mô nhân sự'],
      'Nhu cầu / ghi chú': String(L['Ghi chú'] || '').trim().slice(0, 2000),
      'Tên deal trên Base': `[Partner ${partner['Họ và tên']}] ${congTy}`,
      'Cảnh báo trùng': kiemTraTrung_(sh, congTy, L['Số điện thoại']),
      'Kiểm tra lead': 'Chờ kiểm tra', 'Sản phẩm quan tâm': L['Sản phẩm quan tâm'], 'Tỉnh/Thành phố': L['Tỉnh/Thành phố'],
      'Partner ID (Base)': String(L['Partner ID']).trim().slice(0, 100),
    };
    ghiDong_(sh, row);
  } finally { lock.releaseLock(); }

  let jobId = '';
  try { jobId = taoJobWorkflow_(row); } catch (err) { console.error('Workflow', err); }
  if (jobId) capNhatLead_(row['Mã lead'], { 'ID job Workflow': jobId, 'Giai đoạn Workflow': 'Lead' });

  guiEmail_('lead-nhan|' + row['Mã lead'], email, `Base đã nhận lead ${row['Công ty khách hàng']} (${row['Mã lead']})`,
    `<p>Chào ${esc_(row['Tên partner'])},</p>
     <p>Base đã nhận thông tin khách hàng <b>${esc_(row['Công ty khách hàng'])}</b>. Mã lead: <b>${row['Mã lead']}</b>.</p>
     <p>Đội ngũ sẽ kiểm tra tính hợp lệ và gửi kết quả trong 24-48 giờ làm việc, kèm người phụ trách và mức hoa hồng nếu deal thành công.</p>`);
  guiEmail_('admin-lead|' + row['Mã lead'], CONFIG.ADMIN_EMAILS, `[Lead mới] ${row['Tên deal trên Base']}`,
    `${row['Cảnh báo trùng'] ? '<p style="color:#B91C1C"><b>' + esc_(row['Cảnh báo trùng']) + '</b></p>' : ''}
     ${bang_(row)}<p>${jobId ? 'Đã tạo nhiệm vụ trên Base Workflow (ID ' + jobId + ').' : '<b>Chưa tạo được nhiệm vụ trên Base Workflow</b>, vui lòng tạo tay.'}</p>`);
  return { ok: true, maLead: row['Mã lead'] };
}

/* ---------- 6) Deal cua toi ---------- */
function dealCuaToi_(email) {
  const sh = sheet_(SHEET_LEAD); if (sh.getLastRow() < 2) return [];
  const c = cot_(sh), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const f = (v, k) => { if (!c[k]) return ''; const x = v[c[k] - 1]; return x instanceof Date ? Utilities.formatDate(x, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm') : String(x === undefined ? '' : x); };
  return rows.filter(v => String(v[c['Email partner'] - 1]).trim().toLowerCase() === email).map(v => ({
    ma: f(v, 'Mã lead'), thoiGian: f(v, 'Thời gian'), congTy: f(v, 'Công ty khách hàng'), lienHe: f(v, 'Người liên hệ'),
    sanPham: f(v, 'Sản phẩm quan tâm'), kiemTra: f(v, 'Kiểm tra lead'), bc: f(v, 'BC phụ trách'),
    hoaHong: f(v, '% hoa hồng'), giaiDoan: f(v, 'Giai đoạn'), giaTri: f(v, 'Giá trị deal (VNĐ)'),
    ghiChu: f(v, 'Ghi chú gửi partner'), capNhat: f(v, 'Cập nhật lần cuối'),
  })).reverse();
}

/* ============ BASE WORKFLOW ============ */
function wfProps_() {
  const p = PropertiesService.getScriptProperties();
  return { token: p.getProperty('BASE_WF_TOKEN'), wfId: p.getProperty('WF_ID'), creator: p.getProperty('WF_CREATOR') };
}

function wfCall_(path, params) {
  const pr = wfProps_(); if (!pr.token) return null;
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('WF_TOKEN_PARAM');
  const modes = saved ? [saved] : ['access_token_v2', 'access_token', 'header'];
  let last = null;
  for (const m of modes) {
    const payload = Object.assign({}, params), opt = { method: 'post', payload: payload, muteHttpExceptions: true };
    if (m === 'header') opt.headers = { Authorization: 'Bearer ' + pr.token }; else payload[m] = pr.token;
    const res = UrlFetchApp.fetch(CONFIG.WF_API + '/' + path, opt);
    try { last = JSON.parse(res.getContentText()); } catch (e) { last = { code: 0, message: 'non_json', http: res.getResponseCode(), body: res.getContentText().slice(0, 300) }; }
    const bad = last && /token/i.test(String(last.message || ''));
    if (!bad) { if (!saved) props.setProperty('WF_TOKEN_PARAM', m); return last; }
  }
  return last;
}

// Danh sach truong tuy chinh cua workflow: { ten truong: id }
function wfFieldMap_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('wf_fields');
  if (hit) return JSON.parse(hit);
  const pr = wfProps_(); if (!pr.wfId) return {};
  const res = wfCall_('workflow/get', { id: pr.wfId }), map = {};
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.name && o.id !== undefined && (o.type || o.field_type || o.options !== undefined)) map[String(o.name).trim()] = o.id;
      Object.keys(o).forEach(k => walk(o[k]));
    }
  })(res);
  if (Object.keys(map).length) cache.put('wf_fields', JSON.stringify(map), 3600);
  return map;
}

function taoJobWorkflow_(row) {
  const hook = PropertiesService.getScriptProperties().getProperty('WF_WEBHOOK_CREATE');
  if (hook) return taoJobQuaWebhook_(hook, row);
  const pr = wfProps_(); if (!pr.token || !pr.wfId || !pr.creator) return '';
  const fields = wfFieldMap_(), sdt = String(row['SĐT khách hàng']).replace(/^'/, '');
  const params = {
    workflow_id: pr.wfId, creator_username: pr.creator, name: row['Tên deal trên Base'],
    content: `Mã lead: ${row['Mã lead']}\nPartner ID: ${row['Partner ID (Base)'] || ''}\nPartner: ${row['Tên partner']} (${row['Mã partner']}) - ${row['Email partner']}\n` +
      `Khách hàng: ${row['Người liên hệ']} - ${row['Chức vụ']}\nCông ty: ${row['Công ty khách hàng']}\n` +
      `SĐT: ${sdt} | Email: ${row['Email khách hàng']}\n` +
      `Sản phẩm: ${row['Sản phẩm quan tâm']} | Quy mô: ${row['Quy mô KH']} | Khu vực: ${row['Tỉnh/Thành phố']}\n` +
      (row['Nhu cầu / ghi chú'] ? `Ghi chú: ${row['Nhu cầu / ghi chú']}\n` : '') +
      (row['Cảnh báo trùng'] ? `CẢNH BÁO: ${row['Cảnh báo trùng']}` : ''),
  };
  Object.keys(CONFIG.WF_CREATE_FIELDS).forEach(name => {
    const id = fields[name]; if (id === undefined) return;
    const src = CONFIG.WF_CREATE_FIELDS[name];
    params['custom_' + id] = src.charAt(0) === '=' ? src.slice(1) : String(row[src] || '').replace(/^'/, '');
  });
  const res = wfCall_('job/create', params);
  const id = res && (res.id || (res.job && res.job.id) || (res.data && res.data.id));
  if (!id) console.error('Tao job that bai: ' + JSON.stringify(res).slice(0, 500));
  return id ? String(id) : '';
}

// Doc nhiem vu qua API: { stage, fields }
function docJob_(id) {
  const res = wfCall_('job/get', { id: id }); if (!res) return null;
  return parseJob_(res.job || res.data || res);
}

// Doc stage + gia tri truong tu du lieu nhiem vu (API hoac webhook)
function parseJob_(job) {
  job = job.job || job.data || job;
  const st = job.stage;
  let stage = (st && typeof st === 'object' && (st.name || st.title)) || (typeof st === 'string' && isNaN(st) ? st : '') ||
    job.stage_name || job.stage_title || job.stage_export || '';
  if (String(job.status || '').toLowerCase() === 'failed' || String(job.failed) === '1') stage = stage || CONFIG.WF_STAGE_FAILED;
  const fields = {};
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (o.name !== undefined && (o.value !== undefined || o.display_value !== undefined || o.display !== undefined)) {
        let v = o.display_value !== undefined ? o.display_value : (o.display !== undefined ? o.display : o.value);
        if (Array.isArray(v)) v = v.map(x => (x && (x.name || x.username || x.value)) || x).join(', ');
        if (v && typeof v === 'object') v = v.name || v.username || v.value || JSON.stringify(v);
        fields[String(o.name).trim()] = String(v === null ? '' : v);
      }
      Object.keys(o).forEach(k => walk(o[k]));
    }
  })(job);
  // Truong hop webhook gui dang phang { "Tình trạng lead": "Hợp lệ", ... }
  [CONFIG.WF_FIELD_VALID, CONFIG.WF_FIELD_PERCENT, CONFIG.WF_FIELD_BC, CONFIG.WF_FIELD_CRM].forEach(k => {
    if (!fields[k] && job[k] !== undefined && typeof job[k] !== 'object') fields[k] = String(job[k]);
  });
  return { stage: String(stage), fields: fields };
}

// Chay moi 10 phut (chi khi dung token API)
function dongBoWorkflow() {
  const pr = wfProps_(); if (!pr.token) return;
  const sh = sheet_(SHEET_LEAD); if (sh.getLastRow() < 2) return;
  const c = cot_(sh), n = sh.getLastRow() - 1, data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  for (let i = 0; i < n; i++) {
    const v = data[i], id = v[c['ID job Workflow'] - 1];
    const gd = v[c['Giai đoạn'] - 1], kt = v[c['Kiểm tra lead'] - 1];
    if (!id || gd === 'THÀNH CÔNG' || gd === 'THẤT BẠI' || kt === 'Không hợp lệ' || kt === 'Trùng lead') continue;
    const job = docJob_(id); if (job) apDungJob_(sh, i + 2, c, job);
  }
}

// Cap nhat 1 dong lead theo du lieu nhiem vu Workflow: { stage, fields }
function apDungJob_(sh, r, c, job) {
  const v = docDong_(sh, r, c), kiemTra = v['Kiểm tra lead'];
  if (job.stage && job.stage !== v['Giai đoạn Workflow']) sh.getRange(r, c['Giai đoạn Workflow']).setValue(job.stage);
  const crm = job.fields[CONFIG.WF_FIELD_CRM];
  if (crm && crm !== v['Link deal CRM']) sh.getRange(r, c['Link deal CRM']).setValue(crm);
  if (kiemTra && kiemTra !== 'Chờ kiểm tra') return;
  const valid = String(job.fields[CONFIG.WF_FIELD_VALID] || '').toLowerCase();
  if (valid.indexOf('trùng') >= 0 || valid.indexOf('không') === 0 || job.stage === CONFIG.WF_STAGE_FAILED) {
    sh.getRange(r, c['Kiểm tra lead']).setValue(valid.indexOf('trùng') >= 0 ? 'Trùng lead' : 'Không hợp lệ');
    xuLyKiemTraLead_(sh, r, c);
  } else if (valid.indexOf('hợp lệ') >= 0 && job.fields[CONFIG.WF_FIELD_BC] && job.fields[CONFIG.WF_FIELD_PERCENT]) {
    sh.getRange(r, c['BC phụ trách']).setValue(job.fields[CONFIG.WF_FIELD_BC]);
    sh.getRange(r, c['% hoa hồng']).setValue(job.fields[CONFIG.WF_FIELD_PERCENT]);
    sh.getRange(r, c['Kiểm tra lead']).setValue('Hợp lệ');
    xuLyKiemTraLead_(sh, r, c);
  }
}

/* ============ KET NOI BASE WORKFLOW BANG WEBHOOK (khong can token) ============ */
// Tao nhiem vu qua "Diem cuoi Webhook" cua workflow
function taoJobQuaWebhook_(hook, row) {
  const name = row['Tên deal trên Base'] + ' (' + row['Mã lead'] + ')';
  const sdt = String(row['SĐT khách hàng']).replace(/^'/, '');
  const content = `Mã lead: ${row['Mã lead']}\nPartner ID: ${row['Partner ID (Base)'] || ''}\nPartner: ${row['Tên partner']} (${row['Mã partner']}) - ${row['Email partner']}\n` +
    `Khách hàng: ${row['Người liên hệ']} - ${row['Chức vụ']}\nCông ty: ${row['Công ty khách hàng']}\n` +
    `SĐT: ${sdt} | Email: ${row['Email khách hàng']}\n` +
    `Sản phẩm: ${row['Sản phẩm quan tâm']} | Quy mô: ${row['Quy mô KH']} | Khu vực: ${row['Tỉnh/Thành phố']}\n` +
    (row['Nhu cầu / ghi chú'] ? `Ghi chú: ${row['Nhu cầu / ghi chú']}\n` : '') + (row['Cảnh báo trùng'] ? `CẢNH BÁO: ${row['Cảnh báo trùng']}` : '');
  const payload = { name: name, content: content, description: content };
  Object.keys(CONFIG.WF_CREATE_FIELDS).forEach(k => {
    const src = CONFIG.WF_CREATE_FIELDS[k];
    const val = src.charAt(0) === '=' ? src.slice(1) : String(row[src] || '').replace(/^'/, '').trim();
    if (val) payload[k] = val;
  });
  // Gui; neu Base bao loi o truong tuy chinh nao thi bo truong do va gui lai (thong tin van nam trong noi dung)
  const boQua = [];
  for (let lan = 0; lan < 12; lan++) {
    const res = UrlFetchApp.fetch(hook, { method: 'post', payload: payload, muteHttpExceptions: true });
    const txt = res.getContentText();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    const loi = j && j.code === 0 ? String(j.message || '') : '';
    const m = loi.match(/custom field\):\s*(.+?)\s*\(/i);
    if (m && payload[m[1]] !== undefined) { boQua.push(m[1] + ' = ' + payload[m[1]]); delete payload[m[1]]; continue; }
    const fieldsSent = Object.keys(payload).filter(k => ['name', 'content', 'description'].indexOf(k) < 0).join(', ');
    ghiLogWebhook_(loi ? 'create-error' : 'create-ok', 'HTTP ' + res.getResponseCode() + ' | ' + txt.slice(0, 2000) +
      ' | Trường đã gửi: ' + (fieldsSent || '(không)') + (boQua.length ? ' | Trường bị Base từ chối: ' + boQua.join('; ') : ''));
    if (loi) return '';
    const id = j && (j.id || (j.job && j.job.id) || (j.data && (j.data.id || (j.data.job && j.data.job.id))));
    return id ? String(id) : 'webhook';
  }
  return '';
}

// Nhan webhook tu Base Workflow: URL dang  .../exec?src=wf&ev=TEN_SU_KIEN&secret=WEBHOOK_SECRET
function webhookWorkflow_(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || e.parameter.secret !== secret) return { ok: false, error: 'unauthorized' };
  const ev = e.parameter.ev || 'unknown';
  let body = {};
  const raw = (e.postData && e.postData.contents) || '';
  try { body = raw.trim().charAt(0) === '{' ? JSON.parse(raw) : Object.assign({}, e.parameter); } catch (err) { body = Object.assign({}, e.parameter); }
  Object.keys(body).forEach(k => { if (typeof body[k] === 'string' && /^[\[{]/.test(body[k].trim())) { try { body[k] = JSON.parse(body[k]); } catch (x) {} } });
  ghiLogWebhook_(ev, (raw || JSON.stringify(e.parameter)).slice(0, 5000));

  const str = JSON.stringify(body), m = str.match(/L\d{6}-\d{3,}/);
  if (!m) return { ok: true, note: 'không thấy mã lead' };
  const sh = sheet_(SHEET_LEAD), c = cot_(sh), n = sh.getLastRow() - 1; if (n < 1) return { ok: true };
  const i = sh.getRange(2, c['Mã lead'], n, 1).getValues().flat().indexOf(m[0]); if (i < 0) return { ok: true, note: 'mã lead không có trong Sheet' };
  const r = i + 2, job = parseJob_(body);
  if (ev === 'failed' && !job.stage) job.stage = CONFIG.WF_STAGE_FAILED;
  const jid = body.id || (body.job && body.job.id) || (body.data && body.data.id);
  if (jid && /^\d+$/.test(String(jid))) sh.getRange(r, c['ID job Workflow']).setValue(String(jid));
  apDungJob_(sh, r, c, job);
  return { ok: true, lead: m[0], stage: job.stage };
}

function ghiLogWebhook_(ev, text) {
  const ss = ss_(), sh = ss.getSheetByName('Webhook log') || ss.insertSheet('Webhook log');
  if (sh.getLastRow() === 0) sh.appendRow(['Thời gian', 'Sự kiện', 'Dữ liệu']);
  sh.appendRow([new Date(), ev, text]);
  if (sh.getLastRow() > 500) sh.deleteRows(2, 100);
}

/* ============ WEBHOOK TU BASE CRM (qua Base Process) ============ */
// Tham so: secret, stage + 1 trong: lead (Ma lead) | deal (ten deal) | crm (link/ID deal); tuy chon: value, note
function webhookCrm_(d) {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || d.secret !== secret) return { ok: false, error: 'unauthorized' };
  const stage = STAGE_ALIAS[String(d.stage || '').trim().toLowerCase()] || String(d.stage || '').trim().toUpperCase();
  if (STAGES.indexOf(stage) < 0) return { ok: false, error: 'stage không hợp lệ: ' + d.stage };
  const sh = sheet_(SHEET_LEAD), c = cot_(sh), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: false, error: 'không có lead' };
  const data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues(), key = s => String(s || '').trim().toLowerCase();
  let r = 0;
  for (let i = 0; i < n && !r; i++) {
    const v = data[i], ma = key(v[c['Mã lead'] - 1]), link = key(v[c['Link deal CRM'] - 1]);
    if ((d.lead && ma === key(d.lead)) ||
        (d.crm && link && (link.indexOf(key(d.crm)) >= 0 || key(d.crm).indexOf(link) >= 0)) ||
        (d.deal && (key(v[c['Tên deal trên Base'] - 1]) === key(d.deal) || (ma && key(d.deal).indexOf(ma) >= 0)))) r = i + 2;
  }
  if (!r) return { ok: false, error: 'không tìm thấy lead' };
  if (d.value) sh.getRange(r, c['Giá trị deal (VNĐ)']).setValue(String(d.value).replace(/[^\d]/g, ''));
  if (d.note) sh.getRange(r, c['Ghi chú gửi partner']).setValue(d.note);
  if (sh.getRange(r, c['Kiểm tra lead']).getValue() !== 'Hợp lệ') sh.getRange(r, c['Kiểm tra lead']).setValue('Hợp lệ');
  sh.getRange(r, c['Giai đoạn']).setValue(stage);
  xuLyGiaiDoan_(sh, r, c);
  return { ok: true, row: r, stage: stage };
}

/* ============ ADMIN SUA TAY TRONG SHEET -> EMAIL ============ */
function xuLyChinhSua(e) {
  const sh = e.range.getSheet(), name = sh.getName();
  if (name !== SHEET_PARTNER && name !== SHEET_LEAD) return;
  const c = cot_(sh), c0 = e.range.getColumn(), c1 = c0 + e.range.getNumColumns() - 1;
  for (let r = Math.max(2, e.range.getRow()); r < e.range.getRow() + e.range.getNumRows(); r++) {
    for (let col = c0; col <= c1; col++) {
      const h = Object.keys(c).find(k => c[k] === col);
      if (name === SHEET_PARTNER && h === 'Trạng thái duyệt') xuLyDuyetPartner_(sh, r, c);
      if (name === SHEET_LEAD && ['Kiểm tra lead', 'BC phụ trách', '% hoa hồng'].includes(h)) xuLyKiemTraLead_(sh, r, c);
      if (name === SHEET_LEAD && h === 'Giai đoạn') xuLyGiaiDoan_(sh, r, c);
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
    if (p['Mật khẩu (mã hóa)']) return; // da co tai khoan
    const pw = datMatKhauMoi_(sh, r, c);
    guiEmail_('taikhoan|' + p['Email'], p['Email'], 'Chào mừng bạn trở thành Base Affiliate Partner',
      `<p>Chào ${esc_(p['Họ và tên'])},</p>
       <p>Hồ sơ của bạn đã được duyệt. Mã Partner: <b>${ma}</b>.</p>
       <table style="border-collapse:collapse;margin:12px 0;font-size:15px">
         <tr><td style="padding:6px 16px 6px 0;color:#64748B">Trang đăng nhập</td><td><a href="${CONFIG.PORTAL_URL}">${CONFIG.PORTAL_URL}</a></td></tr>
         <tr><td style="padding:6px 16px 6px 0;color:#64748B">Email đăng nhập</td><td><b>${esc_(p['Email'])}</b></td></tr>
         <tr><td style="padding:6px 16px 6px 0;color:#64748B">Mật khẩu tạm thời</td><td><b style="font-size:17px">${pw}</b></td></tr>
       </table>
       <p>Lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đổi mật khẩu. Sau đó hãy bổ sung thông tin cá nhân và tài khoản nhận hoa hồng trong mục <b>Thông tin của tôi</b>.</p>
       ${p['Ghi chú gửi partner'] ? '<p>' + esc_(p['Ghi chú gửi partner']) + '</p>' : ''}`);
  } else if (p['Trạng thái duyệt'] === 'Từ chối') {
    guiEmail_('tuchoi|' + p['Email'], p['Email'], 'Kết quả đăng ký Base Affiliate Partner',
      `<p>Chào ${esc_(p['Họ và tên'])},</p>
       <p>Cảm ơn bạn đã quan tâm chương trình Base Affiliate Partner. Ở thời điểm này hồ sơ của bạn chưa phù hợp để tham gia.</p>
       ${p['Ghi chú gửi partner'] ? '<p>Lý do: ' + esc_(p['Ghi chú gửi partner']) + '</p>' : ''}
       <p>Nếu cần trao đổi thêm, vui lòng gọi ${CONFIG.HOTLINE}.</p>`);
  }
}

function xuLyKiemTraLead_(sh, r, c) {
  const l = docDong_(sh, r, c), kq = l['Kiểm tra lead'];
  if (!l['Email partner'] || !l['Mã lead']) return;
  if (kq === 'Hợp lệ') {
    if (!l['BC phụ trách'] || l['% hoa hồng'] === '') {
      sh.getRange(r, c['Kiểm tra lead']).setNote('Điền "BC phụ trách" và "% hoa hồng" để gửi email cho partner.');
      return;
    }
    sh.getRange(r, c['Kiểm tra lead']).clearNote();
    const sent = guiEmail_('hople|' + l['Mã lead'], l['Email partner'], `Lead ${l['Công ty khách hàng']} đã được xác nhận hợp lệ`,
      `<p>Chào ${esc_(l['Tên partner'])},</p>
       <p>Lead <b>${esc_(l['Công ty khách hàng'])}</b> (${l['Mã lead']}) đã được xác nhận <b>hợp lệ</b>.</p>
       <ul><li>Người phụ trách (BC): <b>${esc_(l['BC phụ trách'])}</b>${l['Email BC'] ? ' - ' + esc_(l['Email BC']) : ''}</li>
       <li>Hoa hồng nếu deal thành công: <b>${phanTram_(l['% hoa hồng'])}</b> giá trị hợp đồng</li></ul>
       <p>Bạn sẽ nhận email mỗi khi deal chuyển giai đoạn và theo dõi được trong mục <a href="${CONFIG.PORTAL_URL}">Deal của tôi</a>.</p>`, l['Email BC']);
    if (sent && !l['Giai đoạn']) sh.getRange(r, c['Giai đoạn']).setValue('LEAD - OUTREACH');
  } else if (kq === 'Không hợp lệ' || kq === 'Trùng lead') {
    guiEmail_('khonghople|' + l['Mã lead'], l['Email partner'], `Kết quả kiểm tra lead ${l['Công ty khách hàng']}`,
      `<p>Chào ${esc_(l['Tên partner'])},</p>
       <p>Lead <b>${esc_(l['Công ty khách hàng'])}</b> (${l['Mã lead']}) ${kq === 'Trùng lead' ? 'đã có trong hệ thống của Base trước đó (trùng lead)' : 'chưa đáp ứng điều kiện ghi nhận'}.</p>
       ${l['Ghi chú gửi partner'] ? '<p>Chi tiết: ' + esc_(l['Ghi chú gửi partner']) + '</p>' : ''}
       <p>Cảm ơn bạn và mong tiếp tục nhận được giới thiệu từ bạn.</p>`);
  }
  sh.getRange(r, c['Cập nhật lần cuối']).setValue(new Date());
}

function xuLyGiaiDoan_(sh, r, c) {
  const l = docDong_(sh, r, c), gd = l['Giai đoạn'];
  if (!gd || !l['Email partner'] || l['Kiểm tra lead'] !== 'Hợp lệ' || gd === 'LEAD - OUTREACH') return;
  let them = '';
  if (gd === 'THÀNH CÔNG') {
    const gt = Number(String(l['Giá trị deal (VNĐ)']).replace(/[^\d]/g, '')) || 0;
    const pt = Number(String(l['% hoa hồng']).replace(',', '.').replace('%', '')) || 0, p2 = pt > 0 && pt < 1 ? pt * 100 : pt;
    if (gt) them = `<p>Giá trị hợp đồng: <b>${gt.toLocaleString('vi-VN')} đ</b><br>Hoa hồng dự kiến (${p2}%): <b>${Math.round(gt * p2 / 100).toLocaleString('vi-VN')} đ</b></p>
      <p>Đội ngũ Base sẽ liên hệ bạn về thủ tục nhận hoa hồng.</p>`;
  }
  const ghiChu = l['Ghi chú gửi partner'] ? `<p>${gd === 'THẤT BẠI' ? 'Lý do' : 'Ghi chú'}: ${esc_(l['Ghi chú gửi partner'])}</p>` : '';
  guiEmail_('giaidoan|' + l['Mã lead'] + '|' + gd, l['Email partner'], `[${l['Mã lead']}] ${l['Công ty khách hàng']}: ${tenGD_(gd)}`,
    `<p>Chào ${esc_(l['Tên partner'])},</p>
     <p>Deal <b>${esc_(l['Công ty khách hàng'])}</b> vừa chuyển sang giai đoạn <b>${tenGD_(gd)}</b>.</p>
     <p>${STAGE_INFO[gd] || ''}</p>${them}${ghiChu}${thanhTienDo_(gd)}
     <p>Người phụ trách: ${esc_(l['BC phụ trách'] || '')}</p>`, l['Email BC']);
  sh.getRange(r, c['Cập nhật lần cuối']).setValue(new Date());
}

/* ============================ TIEN ICH ============================ */
function capNhatLead_(maLead, obj) {
  const sh = sheet_(SHEET_LEAD), c = cot_(sh), n = sh.getLastRow() - 1; if (n < 1) return;
  const i = sh.getRange(2, c['Mã lead'], n, 1).getValues().flat().indexOf(maLead); if (i < 0) return;
  Object.keys(obj).forEach(k => { if (c[k]) sh.getRange(i + 2, c[k]).setValue(obj[k]); });
}

function guiEmail_(key, to, subject, body, cc) {
  if (!to) return false;
  const log = sheet_(SHEET_LOG);
  if (!/\|\d{13}$/.test(key)) {
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
    <div style="font-weight:bold;font-size:17px;color:#1F62E8;margin-bottom:16px">Base.vn · Affiliate Partner</div>${body}
    <hr style="border:0;border-top:1px solid #E2E8F0;margin:24px 0 12px">
    <div style="font-size:13px;color:#64748B">Đội ngũ Phát triển Đối tác Base.vn · ${CONFIG.HOTLINE} · <a href="${CONFIG.PORTAL_URL}">Partner Portal</a></div></div>`;
}

function thanhTienDo_(gd) {
  const main = STAGES.slice(0, 8), idx = gd === 'THÀNH CÔNG' ? 8 : main.indexOf(gd);
  if (idx < 0) return '';
  return '<table cellspacing="3" style="margin:12px 0"><tr>' + main.map((s, i) =>
    `<td style="padding:4px 6px;font-size:10px;text-align:center;border-radius:4px;background:${i <= idx ? '#16A34A' : '#E2E8F0'};color:${i <= idx ? '#fff' : '#64748B'}">${s}</td>`).join('') + '</tr></table>';
}
function tenGD_(gd) { return ({ 'THÀNH CÔNG': 'Thành công', 'THẤT BẠI': 'Thất bại' })[gd] || gd; }
function phanTram_(v) { const n = Number(String(v).replace(',', '.').replace('%', '')); return isNaN(n) ? esc_(v) : (n > 0 && n < 1 ? n * 100 : n) + '%'; }

function kiemTraTrung_(sh, congTy, sdt) {
  if (sh.getLastRow() < 2) return '';
  const c = cot_(sh), data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const chuan = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(), so = s => String(s || '').replace(/\D/g, '').slice(-9);
  const hit = data.find(d => (congTy && chuan(d[c['Công ty khách hàng'] - 1]) === chuan(congTy)) ||
    (sdt && so(sdt).length >= 8 && so(d[c['SĐT khách hàng'] - 1]) === so(sdt)));
  return hit ? `Có thể trùng với lead ${hit[c['Mã lead'] - 1]} (${hit[c['Tên partner'] - 1]})` : '';
}

function timDongPartner_(email) {
  const sh = sheet_(SHEET_PARTNER); if (sh.getLastRow() < 2 || !email) return 0;
  const c = cot_(sh), n = sh.getLastRow() - 1;
  const emails = sh.getRange(2, c['Email'], n, 1).getValues().flat(), st = sh.getRange(2, c['Trạng thái duyệt'], n, 1).getValues().flat();
  let best = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (String(emails[i]).trim().toLowerCase() !== email) continue;
    if (st[i] === 'Đã duyệt') return i + 2;
    if (!best) best = i + 2;
  }
  return best;
}
function timPartner_(email) { const r = timDongPartner_(email); if (!r) return null; const sh = sheet_(SHEET_PARTNER); return docDong_(sh, r, cot_(sh)); }

function damBaoSheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(String) : [];
  const missing = headers.filter(h => cur.indexOf(h) < 0);
  if (missing.length) sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
  sh.getRange(1, 1, 1, cur.length + missing.length).setFontWeight('bold').setBackground('#E9EFF8');
  sh.setFrozenRows(1);
  return sh;
}
function dropdown_(sh, header, list) {
  const col = cot_(sh)[header]; if (!col) return;
  sh.getRange(2, col, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build());
}
let SS_CACHE_ = null;
function ss_() { return SS_CACHE_ || (SS_CACHE_ = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActive()); }
function sheet_(name) { return ss_().getSheetByName(name); }
function cot_(sh) { const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; const m = {}; h.forEach((v, i) => { if (v) m[v] = i + 1; }); return m; }
function docDong_(sh, r, c) { const v = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0]; const o = {}; Object.keys(c).forEach(k => o[k] = v[c[k] - 1]); return o; }
function ghiDong_(sh, obj) {
  const c = cot_(sh), arr = new Array(sh.getLastColumn()).fill('');
  Object.keys(obj).forEach(k => { if (c[k]) arr[c[k] - 1] = obj[k]; });
  sh.appendRow(arr);
}
function bang_(obj) {
  return '<table style="border-collapse:collapse;font-size:14px">' + Object.keys(obj).map(k =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748B">${esc_(k)}</td><td style="padding:4px 0">${esc_(obj[k] instanceof Date ? obj[k].toLocaleString('vi-VN') : String(obj[k]).replace(/^'/, ''))}</td></tr>`).join('') + '</table>';
}
function docDuLieuPost_(e) {
  if (e.parameter && e.parameter['data.json']) {
    const j = JSON.parse(e.parameter['data.json']), d = {};
    Object.keys(j).forEach(k => d[k] = Array.isArray(j[k]) ? j[k].join(', ') : j[k]); return d;
  }
  if (e.postData && e.postData.contents && e.postData.contents.trim().charAt(0) === '{') return JSON.parse(e.postData.contents);
  return e.parameter || {};
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ============ CONG CU (chay tay trong Apps Script) ============ */
// 0) Chuyen du lieu tu file Sheet cu (file dang gan voi Apps Script) sang file moi CONFIG.SHEET_ID
//    Chay 1 lan SAU khi chay caiDat. Chi chep cac dong chua co (theo Email / Ma lead).
function chuyenDuLieuCu() {
  const oldSs = SpreadsheetApp.getActive(), newSs = ss_();
  if (oldSs.getId() === newSs.getId()) { Logger.log('File cũ và file mới là một, không cần chuyển.'); return; }
  const plan = [[SHEET_PARTNER, null], [SHEET_LEAD, 'Mã lead'], [SHEET_RES, 'Tiêu đề'], [SHEET_LOG, 'Khóa']];
  plan.forEach(([name, keyCol]) => {
    const src = oldSs.getSheetByName(name), dst = newSs.getSheetByName(name);
    if (!src || !dst || src.getLastRow() < 2) return;
    const sc = cot_(src), dc = cot_(dst);
    const rows = src.getRange(2, 1, src.getLastRow() - 1, src.getLastColumn()).getValues();
    const seen = {};
    if (dst.getLastRow() > 1) {
      const dv = dst.getRange(2, 1, dst.getLastRow() - 1, dst.getLastColumn()).getValues();
      dv.forEach(v => { seen[keyCol ? v[dc[keyCol] - 1] : (v[dc['Email'] - 1] + '|' + v[dc['Thời gian'] - 1])] = 1; });
    }
    const out = [];
    rows.forEach(v => {
      const k = keyCol ? v[sc[keyCol] - 1] : (v[sc['Email'] - 1] + '|' + v[sc['Thời gian'] - 1]);
      if (!k || seen[k]) return;
      const arr = new Array(dst.getLastColumn()).fill('');
      Object.keys(sc).forEach(h => { if (dc[h]) arr[dc[h] - 1] = v[sc[h] - 1]; });
      out.push(arr);
    });
    if (out.length) dst.getRange(dst.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
    Logger.log(name + ': đã chuyển ' + out.length + ' dòng.');
  });
}

// 1) Kiem tra ket noi Base Workflow
function kiemTraWorkflow() {
  const pr = wfProps_();
  Logger.log('Token: ' + (pr.token ? 'có' : 'THIẾU') + ' | WF_ID: ' + (pr.wfId || 'THIẾU') + ' | WF_CREATOR: ' + (pr.creator || 'THIẾU'));
  if (pr.wfId && !/^\d+$/.test(String(pr.wfId).trim())) Logger.log('LỖI: WF_ID phải là một dãy số (lấy trong đường link workflow), đang là: ' + pr.wfId);
  PropertiesService.getScriptProperties().deleteProperty('WF_TOKEN_PARAM');
  const raw = wfCall_('workflow/get', { id: pr.wfId });
  Logger.log('Cách gửi token đang dùng: ' + (PropertiesService.getScriptProperties().getProperty('WF_TOKEN_PARAM') || 'chưa xác định'));
  Logger.log('Phản hồi gốc từ Base (rút gọn): ' + JSON.stringify(raw).replace(pr.token || '#', '***').slice(0, 3000));
  CacheService.getScriptCache().remove('wf_fields');
  Logger.log('Trường tùy chỉnh đọc được: ' + JSON.stringify(wfFieldMap_()));
}
// 2) Xem du lieu tho cua 1 nhiem vu (sua ID truoc khi chay)
function xemNhiemVu() {
  const ID = 'DIEN_ID_NHIEM_VU';
  Logger.log(JSON.stringify(wfCall_('job/get', { id: ID })).slice(0, 8000));
  Logger.log(JSON.stringify(docJob_(ID)));
}
// 3) Cap tai khoan cho cac partner da duyet truoc khi co ban v2
function capTaiKhoanChoPartnerCu() {
  const sh = sheet_(SHEET_PARTNER), c = cot_(sh); let n = 0;
  for (let r = 2; r <= sh.getLastRow(); r++) {
    const p = docDong_(sh, r, c);
    if (p['Trạng thái duyệt'] !== 'Đã duyệt' || p['Mật khẩu (mã hóa)'] || !p['Email']) continue;
    const pw = datMatKhauMoi_(sh, r, c); n++;
    guiEmail_('taikhoan|' + p['Email'], p['Email'], 'Tài khoản Partner Portal của bạn',
      `<p>Chào ${esc_(p['Họ và tên'])},</p><p>Base đã ra mắt Partner Portal mới. Thông tin đăng nhập của bạn:</p>
       <p>Trang đăng nhập: <a href="${CONFIG.PORTAL_URL}">${CONFIG.PORTAL_URL}</a><br>Email: <b>${esc_(p['Email'])}</b><br>
       Mã Partner: <b>${esc_(p['Mã partner'])}</b><br>Mật khẩu tạm thời: <b style="font-size:17px">${pw}</b></p>
       <p>Lần đăng nhập đầu tiên, bạn sẽ được yêu cầu đổi mật khẩu.</p>`);
  }
  Logger.log('Đã cấp tài khoản cho ' + n + ' partner.');
}
