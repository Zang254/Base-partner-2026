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

const CODE_VERSION = '2026-10-08-anh'

const CONFIG = {
  // File Google Sheet luu du lieu Partner/Lead (lay ID trong link: /spreadsheets/d/<ID>/edit)
  SHEET_ID: '1FPlEpYFzMtNgnQDL_syYtemXAszgdsEJzEP1szs9adM',
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
  // Ma truong dau ra giai doan Approved & Assigned (Cai dat > Truong du lieu)
  WF_CODE_VALID: 'custom_tinh_trang_lead',
  WF_CODE_PERCENT: 'custom__hoa_hong_partner',
  WF_CODE_BC: 'custom_bccd_phu_trach',
  WF_CODE_CRM: 'custom_link_deal_crm',
  WF_CODE_VALUE: 'gia_tri_hop_dong',      // Gia tri hop dong (o so, giai doan In Progress)
  WF_FIELD_VALUE: 'Giá trị hợp đồng',
  // Cac truong doanh thu tren Workflow (ma truong). Gia tri la TONG CONG DON tren nhiem vu;
  // moi lan tang, he thong ghi them 1 dong vao tab 'Doanh thu' voi phan chenh lech.
  WF_REV: {
    ky_moi:     { code: 'gia_tri_hop_dong',     label: 'Giá trị hợp đồng' },
    dich_vu:    { code: 'doanh_thu_dich_vu',    label: 'Doanh thu dịch vụ' },
    trien_khai: { code: 'doanh_thu_trien_khai', label: 'Doanh thu triển khai' },
    up_cross:   { code: 'doanh_thu_up_cross',   label: 'Doanh thu up/cross' },
    gia_han:    { code: 'doanh_thu_gia_han',    label: 'Doanh thu gia hạn' },
  },
  WF_DATE_SIGN: { code: 'ngay_ky_hop_dong', label: 'Ngày ký hợp đồng' },
  // Neu Base gui ma lua chon thay vi chu, khai bao tai day, vd: { '1': 'Hợp lệ', '2': 'Không hợp lệ' }
  WF_VALID_OPTIONS: {},
  // Truong tuy chinh dien khi tao nhiem vu: { 'ten truong tren Workflow': 'cot trong tab Lead' hoac '=gia tri co dinh' }
  // Ma truong tren Base Workflow (Cai dat > Truong dau vao): [ten hien thi, nguon du lieu]
  WF_CREATE_FIELDS: {
    'custom_partner_id':      ['Partner ID', 'Partner ID (Base)'],
    'ten_cong_ty_khach_hang': ['Công ty đề xuất', 'Công ty khách hàng'],
    'dia_chi_tru_so':         ['Địa chỉ trụ sở', 'Tỉnh/Thành phố'],
    'email_cong_ty':          ['Email công ty', 'Email khách hàng'],
    'nguoi_lien_he_pic':      ['Người liên hệ (PIC)', '#PIC'],
    'pic_sdt':                ['PIC - SĐT', 'SĐT khách hàng'],
    'custom_note1':           ['Note(1)', '#NOTE'],
    'ma_so_thue':             ['Mã số thuế', 'MST khách hàng'],
    'quy_mo_cong_ty':         ['Quy mô công ty', 'Quy mô KH'],   // lua chon tren Base phai trung chinh xac voi form Portal
  },
};

/* ---------------- HANG SO ---------------- */
const SHEET_PARTNER = 'Partner';
const SHEET_LEAD = 'Lead';
const SHEET_LOG = 'Nhật ký email';
const SHEET_RES = 'Tài nguyên';

const PARTNER_HEADERS = ['Thời gian', 'Họ và tên', 'Email', 'Số điện thoại', 'Khu vực', 'Tên công ty',
  'Vị trí công việc', 'Website công ty', 'Profile', 'Mã số thuế', 'Quy mô nhân sự', 'Kỳ vọng hợp tác',
  'Trạng thái duyệt', 'Mã partner', 'Chương trình', 'Ngày bắt đầu kỳ', 'Cấp bậc', 'DT tích luỹ kỳ này',
  'Tổng doanh thu', 'Tổng hoa hồng', 'Hoa hồng đã chi', 'Ghi chú gửi partner', 'Ghi chú nội bộ',
  'Xem Portal', 'Link xem Portal',
  'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân',
  'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản', 'Ảnh CCCD mặt trước', 'Ảnh CCCD mặt sau', 'Ảnh cá nhân', 'Cập nhật hồ sơ',
  'Mật khẩu (mã hóa)', 'Salt', 'Phải đổi mật khẩu', 'Đăng nhập lần cuối'];

const LEAD_HEADERS = ['Mã lead', 'Thời gian', 'Mã partner', 'Partner ID (Base)', 'Email partner', 'Tên partner',
  'Công ty khách hàng', 'MST khách hàng', 'Người liên hệ', 'Chức vụ', 'SĐT khách hàng', 'Email khách hàng',
  'Tỉnh/Thành phố', 'Quy mô KH', 'Sản phẩm quan tâm', 'Nhu cầu / ghi chú',
  'Tên deal trên Base', 'Cảnh báo trùng', 'Kiểm tra lead', 'BC phụ trách', 'Email BC', '% hoa hồng',
  'Giai đoạn', 'Giá trị deal (VNĐ)', 'Ngày ký HĐ', 'DT dịch vụ', 'DT triển khai', 'DT up/cross', 'DT gia hạn',
  'Hoa hồng ghi nhận', 'Ghi chú gửi partner', 'Cập nhật lần cuối',
  'ID job Workflow', 'Giai đoạn Workflow', 'Link deal CRM', 'Mã tạm'];

const RES_HEADERS = ['Nhóm', 'Tiêu đề', 'Mô tả', 'Link', 'Hiển thị'];
const SHEET_REV = 'Doanh thu';
const REV_HEADERS = ['Thời gian ghi nhận', 'Mã lead', 'Email partner', 'Mã partner', 'Chương trình', 'Công ty khách hàng',
  'Loại doanh thu', 'Doanh thu (VNĐ)', 'Tính tích luỹ', 'Cấp bậc áp dụng', '% hoa hồng', 'Hoa hồng (VNĐ)',
  'Kỳ tích luỹ', 'Trạng thái chi trả', 'Ghi chú'];
const PROGRAMS = ['Affiliate', 'Consulting'];
const PAY_STATUS = ['Chờ đối soát', 'Đã chi', 'Không chi'];

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
  damBaoSheet_(ss, SHEET_REV, REV_HEADERS);
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
  dropdown_(p, 'Chương trình', PROGRAMS);
  dropdown_(l, 'Kiểm tra lead', LEAD_CHECK);
  dropdown_(l, 'Giai đoạn', STAGES);
  dropdown_(sheet_(SHEET_REV), 'Trạng thái chi trả', PAY_STATUS);
  dropdown_(sheet_(SHEET_REV), 'Loại doanh thu', Object.keys(LOAI_DT).map(k => LOAI_DT[k]));
  ['Mật khẩu (mã hóa)', 'Salt'].forEach(h => { const c = cot_(p)[h]; if (c) p.hideColumns(c); });
  { const c = cot_(p)['Xem Portal']; if (c) p.getRange(2, c, 2000, 1).insertCheckboxes(); }

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('xuLyChinhSua').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('dongBoWorkflow').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('tinhLaiTatCaPartner').timeBased().everyDays(1).atHour(1).create();

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
      case 'me': return json_(withAuth_(d, email => ({ ok: true, profile: hoSo_(email), viewOnly: chiXem_(d) })));
      case 'saveProfile': return json_(chanGhi_(d, email => luuHoSo_(email, d.profile || {})));
      case 'changePassword': return json_(chanGhi_(d, email => doiMatKhau_(email, d.oldPassword, d.newPassword)));
      case 'uploadAnh': return json_(chanGhi_(d, email => taiAnh_(email, d.loai, d.data)));
      case 'myPhoto': return json_(withAuth_(d, email => anhCaNhan_(email)));
      case 'resources': return json_(withAuth_(d, () => ({ ok: true, items: taiNguyen_() })));
      case 'submitLead': return json_(chanGhi_(d, email => guiLead_(email, d.lead || {})));
      case 'myDeals': return json_(withAuth_(d, email => ({ ok: true, deals: dealCuaToi_(email), tongQuan: tongQuanChoPortal_(email) })));
      case 'logout': if (d.token) CacheService.getScriptCache().removeAll(['s_' + d.token, 'ro_' + d.token]); return json_({ ok: true });
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
  return json_({ ok: true, service: 'Base Affiliate Partner API', version: CODE_VERSION, sheet: CONFIG.SHEET_ID });
}

function withAuth_(d, fn) {
  const cache = CacheService.getScriptCache();
  const email = d.token ? cache.get('s_' + d.token) : null;
  if (!email) return { ok: false, auth: false, error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
  if (!cache.get('ro_' + d.token)) cache.put('s_' + d.token, email, 21600);
  return fn(email);
}
// Admin dang xem Portal cua partner (link tu cot "Xem Portal"): chi xem, khong duoc ghi
function chiXem_(d) { return !!(d.token && CacheService.getScriptCache().get('ro_' + d.token)); }
function chanGhi_(d, fn) {
  if (chiXem_(d)) return { ok: false, error: 'Bạn đang xem Portal với quyền admin (chỉ xem), không thể thay đổi dữ liệu của partner.' };
  return withAuth_(d, fn);
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
    'Chương trình': 'Affiliate',
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
const PROFILE_VIEW = ['Mã partner', 'Chương trình', 'Cấp bậc', 'Họ và tên', 'Email', 'Số điện thoại', 'Tên công ty', 'Vị trí công việc', 'Khu vực',
  'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân', 'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản', 'Cập nhật hồ sơ'];
const PROFILE_EDIT = ['Số điện thoại', 'Ngày sinh', 'Địa chỉ thường trú', 'Địa chỉ tạm trú', 'Số CMND/CCCD', 'MST cá nhân',
  'Số tài khoản', 'Ngân hàng', 'Chủ tài khoản'];

function hoSo_(email) {
  const p = timPartner_(email); if (!p) return {};
  const o = {};
  PROFILE_VIEW.forEach(k => o[k] = p[k] instanceof Date ? Utilities.formatDate(p[k], 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm') : String(p[k] === undefined ? '' : p[k]));
  o.anh = {}; Object.keys(ANH).forEach(k => o.anh[k] = !!p[ANH[k]]);   // chi bao da co anh hay chua, khong lo link Drive
  return o;
}

/* ---------- 3b) Anh CCCD / anh ca nhan -> thu muc Drive (Script Property DRIVE_FOLDER_ID) ---------- */
const ANH = { cccd_truoc: 'Ảnh CCCD mặt trước', cccd_sau: 'Ảnh CCCD mặt sau', chan_dung: 'Ảnh cá nhân' };
function idTuLink_(u) { const m = /[-\w]{25,}/.exec(String(u || '')); return m ? m[0] : ''; }
function taiAnh_(email, loai, data) {
  if (!ANH[loai]) return { ok: false, error: 'Loại ảnh không hợp lệ.' };
  const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) return { ok: false, error: 'Base chưa cấu hình nơi lưu ảnh. Vui lòng liên hệ ' + CONFIG.HOTLINE + '.' };
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+\/=]+)$/.exec(String(data || ''));
  if (!m) return { ok: false, error: 'Vui lòng chọn ảnh định dạng JPG hoặc PNG.' };
  if (m[2].length > 7000000) return { ok: false, error: 'Ảnh quá lớn (tối đa khoảng 5MB).' };
  const sh = sheet_(SHEET_PARTNER), c = cot_(sh), r = timDongPartner_(email);
  if (!r || !c[ANH[loai]]) return { ok: false, error: 'Không tìm thấy hồ sơ. Vui lòng liên hệ Base.' };
  const p = docDong_(sh, r, c), ma = p['Mã partner'] || email;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const goc = DriveApp.getFolderById(folderId), ten = ma + ' - ' + p['Họ và tên'];
    const it = goc.getFoldersByName(ten), thuMuc = it.hasNext() ? it.next() : goc.createFolder(ten);
    const cu = idTuLink_(p[ANH[loai]]);
    if (cu) { try { DriveApp.getFileById(cu).setTrashed(true); } catch (e) {} }
    const tg = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmm');
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1], ma + '_' + loai + '_' + tg + (m[1] === 'png' ? '.png' : '.jpg'));
    const f = thuMuc.createFile(blob);
    sh.getRange(r, c[ANH[loai]]).setValue(f.getUrl());
    sh.getRange(r, c['Cập nhật hồ sơ']).setValue(new Date());
  } finally { lock.releaseLock(); }
  return { ok: true, profile: hoSo_(email) };
}
function anhCaNhan_(email) {
  const p = timPartner_(email), id = p ? idTuLink_(p[ANH.chan_dung]) : '';
  if (!id) return { ok: true, data: '' };
  try { const b = DriveApp.getFileById(id).getBlob(); return { ok: true, data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) }; }
  catch (e) { return { ok: true, data: '' }; }
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
  const need = ['Partner ID', 'Họ và tên', 'Sản phẩm quan tâm', 'Email', 'Số điện thoại', 'Vị trí công việc', 'Tên công ty', 'Mã số thuế', 'Tỉnh/Thành phố', 'Quy mô nhân sự'];
  const mst = String(L['Mã số thuế'] || '').replace(/\s/g, '');
  if (!/^\d{10}(-?\d{3})?$/.test(mst)) return { ok: false, error: 'Mã số thuế gồm 10 hoặc 13 chữ số.' };
  for (const k of need) if (!String(L[k] || '').trim()) return { ok: false, error: 'Vui lòng điền: ' + k };
  const partner = timPartner_(email);
  if (!partner || partner['Trạng thái duyệt'] !== 'Đã duyệt') return { ok: false, error: 'Tài khoản chưa được duyệt.' };

  const sh = sheet_(SHEET_LEAD), lock = LockService.getScriptLock();
  if (!cot_(sh)['Partner ID (Base)'] || !cot_(sh)['MST khách hàng']) damBaoSheet_(ss_(), SHEET_LEAD, LEAD_HEADERS);
  lock.waitLock(20000);
  let row;
  try {
    const props = PropertiesService.getScriptProperties();
    const seq = Math.max(Number(props.getProperty('LEAD_SEQ') || 0), sh.getLastRow()) + 1;
    props.setProperty('LEAD_SEQ', String(seq));
    const maLead = 'L' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMdd') + '-' + String(seq).padStart(3, '0');
    const congTy = String(L['Tên công ty']).trim();
    row = {
      'Mã lead': maLead, 'Thời gian': new Date(), 'Mã partner': partner['Mã partner'], 'Email partner': email,
      'Tên partner': partner['Họ và tên'], 'Công ty khách hàng': congTy, 'Người liên hệ': String(L['Họ và tên']).trim(),
      'Chức vụ': L['Vị trí công việc'], 'SĐT khách hàng': "'" + String(L['Số điện thoại']).trim(),
      'Email khách hàng': String(L['Email']).trim(), 'Quy mô KH': L['Quy mô nhân sự'],
      'Nhu cầu / ghi chú': String(L['Ghi chú'] || '').trim().slice(0, 2000),
      'Tên deal trên Base': `[Partner ${partner['Họ và tên']}] ${congTy}`,
      'Cảnh báo trùng': kiemTraTrung_(sh, congTy, L['Số điện thoại'], mst),
      'Kiểm tra lead': 'Chờ kiểm tra', 'Sản phẩm quan tâm': L['Sản phẩm quan tâm'], 'Tỉnh/Thành phố': L['Tỉnh/Thành phố'],
      'Partner ID (Base)': String(L['Partner ID']).trim().slice(0, 100), 'MST khách hàng': "'" + mst,
    };
    ghiDong_(sh, row);
  } finally { lock.releaseLock(); }

  let jobId = '';
  try { jobId = taoJobWorkflow_(row); } catch (err) { console.error('Workflow', err); }
  if (jobId) capNhatLead_(row['Mã lead'], { 'ID job Workflow': /^\d+$/.test(jobId) ? jobId : '', 'Giai đoạn Workflow': 'Lead' });
  if (/^\d+$/.test(jobId)) { doiMaLeadTheoId_(row['Mã lead'], jobId); row['Mã lead'] = jobId; }

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
    ngayKy: f(v, 'Ngày ký HĐ').slice(0, 10),
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
      `SĐT: ${sdt} | Email: ${row['Email khách hàng']} | MST: ${String(row['MST khách hàng'] || '').replace(/^'/, '')}\n` +
      `Sản phẩm: ${row['Sản phẩm quan tâm']} | Quy mô: ${row['Quy mô KH']} | Khu vực: ${row['Tỉnh/Thành phố']}\n` +
      (row['Nhu cầu / ghi chú'] ? `Ghi chú: ${row['Nhu cầu / ghi chú']}\n` : '') +
      (row['Cảnh báo trùng'] ? `CẢNH BÁO: ${row['Cảnh báo trùng']}` : ''),
  };
  Object.keys(CONFIG.WF_CREATE_FIELDS).forEach(code => {
    const cfg = CONFIG.WF_CREATE_FIELDS[code], v = giaTriO_(cfg[1], row);
    if (v) params[fields[cfg[0]] !== undefined ? 'custom_' + fields[cfg[0]] : code] = v;
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
  // Chi lay job.job / job.data khi do that su la nhiem vu (webhook cua Base co truong 'data' khong phai nhiem vu)
  const laJob = o => o && typeof o === 'object' && !Array.isArray(o) && (o.name !== undefined || o.stage !== undefined || o.stage_export !== undefined);
  if (laJob(job.job)) job = job.job; else if (!laJob(job) && laJob(job.data)) job = job.data;
  const st = job.stage;
  const se = job.stage_export && typeof job.stage_export === 'object' ? job.stage_export : null;
  let stage = (st && typeof st === 'object' && (st.name || st.title)) || (typeof st === 'string' && isNaN(st) ? st : '') ||
    job.stage_name || job.stage_title || (se && se.name) || (typeof job.stage_export === 'string' ? job.stage_export : '') || '';
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
  // Webhook co the gui theo ma truong (vd: tinh_trang_lead, hoa_hong_partner, bc_cd_phu_trach)
  // -> lam phang toan bo du lieu va do theo ten/ma gan dung
  const slug = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const flat = {};
  const hienThi = v => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(hienThi).filter(String).join(', ');
    if (typeof v === 'object') return v.display_value || v.display || v.name || v.fullname || v.username || v.title || v.label || (v.value !== undefined ? hienThi(v.value) : '');
    return String(v);
  };
  (function walk(o, path) {
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, path)); return; }
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (v === null || typeof v !== 'object' || Array.isArray(v) && v.every(x => typeof x !== 'object')) flat[slug(k)] = hienThi(v);
        else { flat[slug(k)] = flat[slug(k)] || hienThi(v); walk(v, k); }
      });
    }
  })(job, '');
  Object.keys(fields).forEach(k => { flat[slug(k)] = fields[k]; });
  const tim = (label, extra) => {
    if (fields[label]) return fields[label];
    const ks = [slug(label)].concat(extra || []);
    const hit = Object.keys(flat).find(k => ks.some(x => k === x || k.indexOf(x) >= 0) && flat[k] !== '');
    return hit ? flat[hit] : '';
  };
  // id nguoi dung -> username (lay tu chinh du lieu webhook: moves, user_id/username...)
  const users = {};
  (function walkU(o) {
    if (Array.isArray(o)) return o.forEach(walkU);
    if (o && typeof o === 'object') {
      if (o.user_id && o.username) users[String(o.user_id)] = o.username;
      if (o.id && o.username) users[String(o.id)] = o.username;
      Object.keys(o).forEach(k => walkU(o[k]));
    }
  })(job);
  if (job.user_id && job.username) users[String(job.user_id)] = job.username;
  const exact = code => { const v = flat[slug(code)]; return v === undefined ? '' : v; };
  let valid = exact(CONFIG.WF_CODE_VALID) || tim(CONFIG.WF_FIELD_VALID, ['tinh_trang_lead', 'tinh_trang']);
  if (CONFIG.WF_VALID_OPTIONS[valid]) valid = CONFIG.WF_VALID_OPTIONS[valid];
  let bc = exact(CONFIG.WF_CODE_BC) || tim(CONFIG.WF_FIELD_BC, ['bccd_phu_trach', 'bc_cd_phu_trach', 'phu_trach']);
  if (/^\d+$/.test(bc) && users[bc]) bc = users[bc];
  fields[CONFIG.WF_FIELD_VALID] = valid;
  fields[CONFIG.WF_FIELD_PERCENT] = exact(CONFIG.WF_CODE_PERCENT) || tim(CONFIG.WF_FIELD_PERCENT, ['hoa_hong_partner', 'hoa_hong']);
  fields[CONFIG.WF_FIELD_BC] = bc;
  fields[CONFIG.WF_FIELD_CRM] = exact(CONFIG.WF_CODE_CRM) || tim(CONFIG.WF_FIELD_CRM, ['link_deal_crm', 'deal_crm']);
  fields[CONFIG.WF_FIELD_VALUE] = exact(CONFIG.WF_CODE_VALUE) || tim(CONFIG.WF_FIELD_VALUE, ['gia_tri_hop_dong']);
  Object.keys(CONFIG.WF_REV).forEach(k => {
    const f = CONFIG.WF_REV[k];
    fields['rev_' + k] = exact(f.code) || exact('custom_' + f.code) || (k === 'ky_moi' ? fields[CONFIG.WF_FIELD_VALUE] : tim(f.label, [f.code]));
  });
  fields.ngay_ky = exact(CONFIG.WF_DATE_SIGN.code) || exact('custom_' + CONFIG.WF_DATE_SIGN.code) || tim(CONFIG.WF_DATE_SIGN.label, [CONFIG.WF_DATE_SIGN.code]);
  if (!stage) stage = flat['stage_name'] || flat['stage'] && isNaN(flat['stage']) && flat['stage'] || '';
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
function apDungJob_(sh, r, c0, job) {
  let c = c0;
  const v = docDong_(sh, r, c), kiemTra = v['Kiểm tra lead'];
  if (!c['Giai đoạn Workflow'] || !c['Link deal CRM']) { damBaoSheet_(ss_(), SHEET_LEAD, LEAD_HEADERS); c = cot_(sh); }
  if (job.stage && job.stage !== v['Giai đoạn Workflow']) sh.getRange(r, c['Giai đoạn Workflow']).setValue(job.stage);
  const crm = job.fields[CONFIG.WF_FIELD_CRM];
  if (crm && crm !== v['Link deal CRM']) sh.getRange(r, c['Link deal CRM']).setValue(crm);
  // Doanh thu tu Workflow -> cac cot doanh thu + tab 'Doanh thu' (tinh hoa hong)
  ghiNhanDoanhThu_(sh, r, c, job);
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

function giaTriO_(src, row) {
  if (src.charAt(0) === '=') return src.slice(1);
  if (src === '#PIC') return [row['Người liên hệ'], row['Chức vụ']].filter(String).join(' - ');
  if (src === '#NOTE') return `Mã lead: ${row['Mã lead']} | Sản phẩm quan tâm: ${row['Sản phẩm quan tâm'] || ''} | Quy mô: ${row['Quy mô KH'] || ''}` +
    (row['Nhu cầu / ghi chú'] ? ` | Ghi chú: ${row['Nhu cầu / ghi chú']}` : '') + ` | Partner: ${row['Tên partner']} (${row['Email partner']})`;
  return String(row[src] || '').replace(/^'/, '').trim();
}

/* ============ KET NOI BASE WORKFLOW BANG WEBHOOK (khong can token) ============ */
// Tao nhiem vu qua "Diem cuoi Webhook" cua workflow
function taoJobQuaWebhook_(hook, row) {
  const name = row['Tên deal trên Base'] + ' (' + row['Mã lead'] + ')';
  const sdt = String(row['SĐT khách hàng']).replace(/^'/, '');
  const content = `Mã lead: ${row['Mã lead']}\nPartner ID: ${row['Partner ID (Base)'] || ''}\nPartner: ${row['Tên partner']} (${row['Mã partner']}) - ${row['Email partner']}\n` +
    `Khách hàng: ${row['Người liên hệ']} - ${row['Chức vụ']}\nCông ty: ${row['Công ty khách hàng']}\n` +
    `SĐT: ${sdt} | Email: ${row['Email khách hàng']} | MST: ${String(row['MST khách hàng'] || '').replace(/^'/, '')}\n` +
    `Sản phẩm: ${row['Sản phẩm quan tâm']} | Quy mô: ${row['Quy mô KH']} | Khu vực: ${row['Tỉnh/Thành phố']}\n` +
    (row['Nhu cầu / ghi chú'] ? `Ghi chú: ${row['Nhu cầu / ghi chú']}\n` : '') + (row['Cảnh báo trùng'] ? `CẢNH BÁO: ${row['Cảnh báo trùng']}` : '');
  const values = {}, labels = {};
  Object.keys(CONFIG.WF_CREATE_FIELDS).forEach(code => {
    const cfg = CONFIG.WF_CREATE_FIELDS[code], val = giaTriO_(cfg[1], row);
    if (val) { values[code] = val; labels[cfg[0].toLowerCase()] = code; }
  });
  const boQua = [];
  for (let lan = 0; lan < 10; lan++) {
    const payload = Object.assign({ name: name, content: content, description: content }, values);
    const res = UrlFetchApp.fetch(hook, { method: 'post', payload: payload, muteHttpExceptions: true });
    const txt = res.getContentText();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    const loi = j && j.code === 0 ? String(j.message || '') : '';
    const m = loi.match(/custom field\):\s*(.+?)\s*\(/i);
    const code = m && labels[m[1].trim().toLowerCase()];
    if (code && values[code] !== undefined) { boQua.push(m[1] + ' = ' + values[code]); delete values[code]; continue; }
    ghiLogWebhook_(loi ? 'create-error' : 'create-ok', 'HTTP ' + res.getResponseCode() + ' | ' + txt.slice(0, 1500) +
      ' | Đã gửi: ' + Object.keys(values).map(k => k + '=' + String(values[k]).slice(0, 60)).join('; ') +
      (boQua.length ? ' | Base từ chối giá trị: ' + boQua.join('; ') : ''));
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
  const BO_QUA = ['content', 'todos', 'moves', 'collaborators', 'workflow_export', 'followers', 'secret', '__ray', 'access_keys', 'base_blocks', 'progression', 'keyword', 'data', 'time'];
  const tomTat = Object.keys(body).filter(k => BO_QUA.indexOf(k) < 0)
    .map(k => k + '=' + (typeof body[k] === 'object' ? JSON.stringify(body[k]) : String(body[k])).slice(0, 300)).join(' | ');
  ghiLogWebhook_(ev, tomTat.slice(0, 45000));

  const str = JSON.stringify(body), mm = str.match(/L\d{6}-\d{3,}/);
  const jidRaw = body.id || (body.job && body.job.id) || '';
  const sh = sheet_(SHEET_LEAD), c = cot_(sh), n = sh.getLastRow() - 1; if (n < 1) return { ok: true };
  const data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues(), key = x => String(x || '').trim();
  let i = -1;
  if (/^\d+$/.test(String(jidRaw))) i = data.findIndex(v => key(v[c['ID job Workflow'] - 1]) === String(jidRaw) || key(v[c['Mã lead'] - 1]) === String(jidRaw));
  if (i < 0 && mm) i = data.findIndex(v => key(v[c['Mã lead'] - 1]) === mm[0] || (c['Mã tạm'] && key(v[c['Mã tạm'] - 1]) === mm[0]));
  if (i < 0) return { ok: true, note: 'không tìm thấy lead trong Sheet' };
  const m = [mm ? mm[0] : String(jidRaw)];
  const r = i + 2;
  try {
    const job = parseJob_(body);
    if (ev === 'failed' && !job.stage) job.stage = CONFIG.WF_STAGE_FAILED;
    const jid = body.id || (body.job && body.job.id);
    if (jid && /^\d+$/.test(String(jid)) && c['ID job Workflow']) {
      sh.getRange(r, c['ID job Workflow']).setValue(String(jid));
      doiMaLeadTheoId_(sh.getRange(r, c['Mã lead']).getValue(), String(jid));
    }
    const truoc = sh.getRange(r, c['Kiểm tra lead']).getValue();
    apDungJob_(sh, r, c, job);
    const sau = sh.getRange(r, c['Kiểm tra lead']).getValue();
    ghiLogWebhook_('ket-qua', m[0] + ' | giai đoạn: ' + job.stage + ' | đọc được: Tình trạng=' + job.fields[CONFIG.WF_FIELD_VALID] +
      ', %=' + job.fields[CONFIG.WF_FIELD_PERCENT] + ', BC=' + job.fields[CONFIG.WF_FIELD_BC] + ', Giá trị HĐ=' + (job.fields[CONFIG.WF_FIELD_VALUE] || '') + ' | Kiểm tra lead: ' + truoc + ' → ' + sau);
    return { ok: true, lead: m[0], stage: job.stage };
  } catch (err) {
    ghiLogWebhook_('loi-xu-ly', m[0] + ' | ' + (err && err.stack || err));
    return { ok: false, error: String(err) };
  }
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
  if (name === SHEET_REV) { suaTabDoanhThu_(e); return; }
  if (name !== SHEET_PARTNER && name !== SHEET_LEAD) return;
  const c = cot_(sh), c0 = e.range.getColumn(), c1 = c0 + e.range.getNumColumns() - 1;
  for (let r = Math.max(2, e.range.getRow()); r < e.range.getRow() + e.range.getNumRows(); r++) {
    for (let col = c0; col <= c1; col++) {
      const h = Object.keys(c).find(k => c[k] === col);
      if (name === SHEET_PARTNER && h === 'Trạng thái duyệt') xuLyDuyetPartner_(sh, r, c);
      if (name === SHEET_PARTNER && h === 'Xem Portal' && sh.getRange(r, col).getValue() === true) taoLinkXemPortal_(sh, r, c);
      if (name === SHEET_PARTNER && (h === 'Chương trình' || h === 'Ngày bắt đầu kỳ')) tinhTongHopPartner_(String(sh.getRange(r, c['Email']).getValue()).trim().toLowerCase(), false);
      if (name === SHEET_LEAD && ['Kiểm tra lead', 'BC phụ trách', '% hoa hồng'].includes(h)) xuLyKiemTraLead_(sh, r, c);
      if (name === SHEET_LEAD && h === 'Giai đoạn') xuLyGiaiDoan_(sh, r, c);
    }
  }
}

// Tick o "Xem Portal" -> tao link xem Portal cua partner do (chi xem, het han sau 30 phut)
function taoLinkXemPortal_(sh, r, c) {
  const email = String(sh.getRange(r, c['Email']).getValue()).trim().toLowerCase();
  const st = sh.getRange(r, c['Trạng thái duyệt']).getValue();
  sh.getRange(r, c['Xem Portal']).setValue(false);
  const o = sh.getRange(r, c['Link xem Portal']);
  if (!email || st !== 'Đã duyệt') { o.setValue('Chỉ xem được partner đã duyệt'); return; }
  const token = 'v' + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().putAll({ ['s_' + token]: email, ['ro_' + token]: '1' }, 1800);
  const het = Utilities.formatDate(new Date(Date.now() + 1800000), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM');
  o.setValue(CONFIG.PORTAL_URL + '#xem=' + token).setNote('Chỉ xem, hết hạn lúc ' + het + '. Tick lại ô Xem Portal để tạo link mới.');
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
       ${dongHoaHongTheoCT_(l)}</ul>
       <p style="font-size:13px;color:#64748B">Hoa hồng tính theo Chính sách Affiliate Partner 2026, căn cứ trạng thái khách hàng trên Base CRM tại thời điểm đăng ký cơ hội. Doanh thu triển khai không được tính hoa hồng trong mọi trường hợp.</p>
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
  if (gd === 'THÀNH CÔNG') {   // Email won deal: chi bao gia tri HD, chi tiet gui trong bien ban doi soat
    const gt = Number(String(l['Giá trị deal (VNĐ)']).replace(/[^\d]/g, '')) || 0;
    guiEmail_('giaidoan|' + l['Mã lead'] + '|' + gd, l['Email partner'], `Won deal ${l['Công ty khách hàng']} (${l['Mã lead']})`,
      `<p>Chào ${esc_(l['Tên partner'])},</p>
       <p>Deal <b>${esc_(l['Công ty khách hàng'])}</b> (${l['Mã lead']}) đã <b>won</b>.</p>
       <p>Giá trị hợp đồng: <b>${gt ? gt.toLocaleString('vi-VN') + ' đ' : 'đang cập nhật'}</b></p>
       <p>Chi tiết sẽ được gửi trong <b>Biên bản đối soát</b> trước ngày 15 tháng sau.</p>
       <p>Cảm ơn bạn đã đồng hành cùng Base.</p>`, l['Email BC']);
    sh.getRange(r, c['Cập nhật lần cuối']).setValue(new Date());
    return;
  }
  const them = '';
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
// Phan loai theo bang chinh sach: 15% = KH moi (up/cross 10%), 7% = KH tai kich hoat (up/cross 5%)
function phanLoaiHH_(v) {
  const n = Number(String(v).replace(',', '.').replace('%', '')), p = Math.round((n > 0 && n < 1 ? n * 100 : n) * 100) / 100;
  if (p === 15) return { loai: 'Khách hàng mới', moi: '15%', up: '10%' };
  if (p === 7) return { loai: 'Khách hàng tái kích hoạt', moi: '7%', up: '5%' };
  if (p === 0) return { loai: 'Khách hàng đang được Base chăm sóc', moi: '0%', up: '0%' };
  return { loai: '', moi: isNaN(p) ? String(v) : p + '%', up: '' };
}
function dongHoaHong_(v) {
  const h = phanLoaiHH_(v);
  return (h.loai ? `<li>Phân loại: <b>${h.loai}</b></li>` : '') +
    `<li>Hoa hồng bán mới: <b>${h.moi}</b></li>` +
    (h.up ? `<li>Hoa hồng up-sell/cross-sell &amp; dịch vụ: <b>${h.up}</b> (ghi nhận trong 06 tháng)</li>` : '');
}
function tenGD_(gd) { return ({ 'THÀNH CÔNG': 'Thành công', 'THẤT BẠI': 'Thất bại' })[gd] || gd; }
function phanTram_(v) { const n = Number(String(v).replace(',', '.').replace('%', '')); return isNaN(n) ? esc_(v) : Math.round((n > 0 && n < 1 ? n * 100 : n) * 100) / 100 + '%'; }

function kiemTraTrung_(sh, congTy, sdt, mst) {
  if (sh.getLastRow() < 2) return '';
  const c = cot_(sh), data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const chuan = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(), so = s => String(s || '').replace(/\D/g, '').slice(-9);
  const mstOf = d => c['MST khách hàng'] ? String(d[c['MST khách hàng'] - 1] || '').replace(/\D/g, '') : '';
  const hit = data.find(d => (mst && mstOf(d) && mstOf(d) === String(mst).replace(/\D/g, '')) || (congTy && chuan(d[c['Công ty khách hàng'] - 1]) === chuan(congTy)) ||
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
// A) Sap lai thu tu cot theo LEAD_HEADERS / PARTNER_HEADERS - GIU NGUYEN du lieu
function sapXepLaiCot() {
  dungLaiSheet_(SHEET_LEAD, LEAD_HEADERS, true);
  dungLaiSheet_(SHEET_PARTNER, PARTNER_HEADERS, true);
  dungLaiSheet_(SHEET_REV, REV_HEADERS, true);
  caiDinhDang_();
  thongBao_('Đã sắp lại thứ tự cột tab Lead và Partner. Dữ liệu giữ nguyên.');
}
// B) Xoa du lieu LEAD (giu partner + tai khoan), lam lai tu dau
function lamMoiLead() {
  dungLaiSheet_(SHEET_LEAD, LEAD_HEADERS, false);
  xoaNoiDung_('Webhook log'); xoaNoiDung_(SHEET_REV);
  caiDinhDang_();
  thongBao_('Đã xóa toàn bộ lead và Webhook log. Partner và tài khoản giữ nguyên.');
}
// C) Xoa SACH du lieu test: partner, lead, nhat ky email, webhook log. Ma partner dem lai tu P0001.
function lamMoiTatCa() {
  dungLaiSheet_(SHEET_LEAD, LEAD_HEADERS, false);
  dungLaiSheet_(SHEET_PARTNER, PARTNER_HEADERS, false);
  xoaNoiDung_(SHEET_LOG); xoaNoiDung_('Webhook log'); xoaNoiDung_(SHEET_REV);
  PropertiesService.getScriptProperties().deleteProperty('PARTNER_SEQ');
  caiDinhDang_();
  thongBao_('Đã xóa sạch dữ liệu test. Mã partner sẽ bắt đầu lại từ P0001.');
}
function dungLaiSheet_(name, headers, giuDuLieu) {
  const ss = ss_(), sh = ss.getSheetByName(name) || ss.insertSheet(name);
  let rows = [];
  if (giuDuLieu && sh.getLastRow() > 1) {
    const c = cot_(sh), data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    const extra = Object.keys(c).filter(h => headers.indexOf(h) < 0);   // cot tu them: dua ve cuoi, khong mat
    headers = headers.concat(extra);
    rows = data.filter(v => v.some(x => x !== '')).map(v => headers.map(h => c[h] ? v[c[h] - 1] : ''));
  }
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.showColumns(1, Math.max(sh.getMaxColumns(), 1));
  sh.clear();
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E9EFF8');
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
function xoaNoiDung_(name) { const sh = ss_().getSheetByName(name); if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1); }
function caiDinhDang_() {
  const p = sheet_(SHEET_PARTNER), l = sheet_(SHEET_LEAD);
  if (!sheet_(SHEET_REV)) damBaoSheet_(ss_(), SHEET_REV, REV_HEADERS);
  dropdown_(p, 'Trạng thái duyệt', PARTNER_STATUS);
  dropdown_(p, 'Chương trình', PROGRAMS);
  dropdown_(l, 'Kiểm tra lead', LEAD_CHECK);
  dropdown_(l, 'Giai đoạn', STAGES);
  dropdown_(sheet_(SHEET_REV), 'Trạng thái chi trả', PAY_STATUS);
  dropdown_(sheet_(SHEET_REV), 'Loại doanh thu', Object.keys(LOAI_DT).map(k => LOAI_DT[k]));
  ['Mật khẩu (mã hóa)', 'Salt'].forEach(h => { const c = cot_(p)[h]; if (c) p.hideColumns(c); });
  { const c = cot_(p)['Xem Portal']; if (c) p.getRange(2, c, 2000, 1).insertCheckboxes(); }
  ['MST khách hàng', 'SĐT khách hàng'].forEach(h => { const c = cot_(l)[h]; if (c) l.getRange(2, c, 2000, 1).setNumberFormat('@'); });
}

// 0) Chuyen du lieu tu file Sheet cu (NGUON_CU) sang file moi CONFIG.SHEET_ID
//    Chay 1 lan SAU khi chay caiDat. Chi chep cac dong chua co (theo Email / Ma lead).
// Doi NGUON_CU thanh ID file muon chep du lieu sang (de trong = file dang gan voi Apps Script)
const NGUON_CU = '1PmC0IxpfZx1EHd3KkFVNLYNI9wUU6QDpLP5gkvfr-WY';
function chuyenDuLieuCu() {
  const oldSs = NGUON_CU ? SpreadsheetApp.openById(NGUON_CU) : SpreadsheetApp.getActive(), newSs = ss_();
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


/* =====================================================================
 * DOANH THU, HOA HONG, CONSULTING PARTNER
 * ===================================================================== */
const LOAI_DT = { ky_moi: 'Ký mới phần mềm', up_cross: 'Up/Cross-sell', dich_vu: 'Dịch vụ ngoài PM', trien_khai: 'Triển khai', gia_han: 'Gia hạn' };
const COT_DT = { ky_moi: 'Giá trị deal (VNĐ)', dich_vu: 'DT dịch vụ', trien_khai: 'DT triển khai', up_cross: 'DT up/cross', gia_han: 'DT gia hạn' };
// Consulting: nguong doanh thu tich luy trong ky 12 thang
const CAP_BAC = [
  { ten: 'Ambassador', tu: 0,          ban: 18, sau: 2,  dv: 10 },
  { ten: 'Silver',     tu: 100000000,  ban: 20, sau: 4,  dv: 15 },
  { ten: 'Gold',       tu: 500000000,  ban: 25, sau: 6,  dv: 15 },
  { ten: 'Platinum',   tu: 1500000000, ban: 30, sau: 8,  dv: 20 },
  { ten: 'Diamond',    tu: 3000000000, ban: 35, sau: 10, dv: 20 },
];
function capTheoDT_(dt) { let i = 0; CAP_BAC.forEach((cb, k) => { if (dt >= cb.tu) i = k; }); return i; }
function themThang_(d, n) { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; }
function ngayVN_(d) { return d ? Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy') : ''; }
function docNgay_(v) {
  if (v instanceof Date) return v;
  const t = String(v || '').trim(); if (!t) return null;
  if (/^\d{9,13}$/.test(t)) return new Date(Number(t) * (t.length <= 10 ? 1000 : 1));
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const m2 = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return null;
}
// Ky tich luy chua ngay d, tinh tu ngay bat dau S (ngay ky hop dong hop tac)
function kyCua_(S, d) {
  let k = 0; while (themThang_(S, 12 * (k + 1)) <= d) k++;
  const from = themThang_(S, 12 * k), to = new Date(themThang_(S, 12 * (k + 1)).getTime() - 86400000);
  return { k: k, from: from, to: to, nhan: ngayVN_(from) + ' – ' + ngayVN_(to) };
}
function ngayBatDauKy_(p) { return docNgay_(p['Ngày bắt đầu kỳ']) || docNgay_(p['Thời gian']) || new Date(); }
function laConsulting_(p) { return String(p && p['Chương trình'] || '').trim().toLowerCase() === 'consulting'; }

function sheetDT_() { return sheet_(SHEET_REV) || damBaoSheet_(ss_(), SHEET_REV, REV_HEADERS); }
function cacDongDT_(email) {
  const sh = sheetDT_(); if (sh.getLastRow() < 2) return [];
  const c = cot_(sh), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return rows.map((v, i) => { const o = { _r: i + 2 }; Object.keys(c).forEach(k => o[k] = v[c[k] - 1]); return o; })
    .filter(o => !email || String(o['Email partner']).trim().toLowerCase() === email);
}

// Tinh % hoa hong cho 1 khoan doanh thu moi
function tinhHH_(p, loai, ngay, lead, dongCu) {
  const ngayKy = docNgay_(lead['Ngày ký HĐ']) || ngay;
  const thang = (ngay - ngayKy) / (86400000 * 30.4375);
  if (!laConsulting_(p)) {                                   // ---- AFFILIATE (bang 15/7, 10/5) ----
    const h = phanLoaiHH_(lead['% hoa hồng']);
    const ban = parseFloat(h.moi) || 0, up = parseFloat(h.up) || 0;
    let pct = 0, ghiChu = '';
    if (loai === 'ky_moi') pct = ban;
    else if (loai === 'up_cross' || loai === 'dich_vu') { if (thang <= 6) pct = up; else ghiChu = 'Quá 6 tháng kể từ ngày ký'; }
    else ghiChu = loai === 'trien_khai' ? 'Doanh thu triển khai không tính hoa hồng' : 'Gia hạn không tính hoa hồng (Affiliate)';
    return { pct: pct, cap: h.loai || '', tichLuy: false, ghiChu: ghiChu };
  }
  // ---- CONSULTING ----
  const S = ngayBatDauKy_(p), ky = kyCua_(S, ngay);
  const daCo = dongCu.filter(o => o['Tính tích luỹ'] === 'Có' && docNgay_(o['Thời gian ghi nhận']) >= ky.from && docNgay_(o['Thời gian ghi nhận']) <= themThang_(ky.to, 0))
    .reduce((t, o) => t + (Number(o['Doanh thu (VNĐ)']) || 0), 0);
  const cb = CAP_BAC[capTheoDT_(daCo)];                       // cap tai thoi diem ghi nhan (truoc khoan nay)
  const coDTKyNay = daCo > 0;
  let pct = 0, tichLuy = true, ghiChu = '', capAD = cb.ten;
  if (loai === 'ky_moi') pct = cb.ban;
  else if (loai === 'up_cross') {
    if (thang <= 9) pct = cb.ban;
    else { pct = (ky.k >= 1 && !coDTKyNay) ? 0 : cb.sau; ghiChu = 'Sau 9 tháng kể từ ngày ký' + (pct ? '' : ' · chưa có doanh thu trong kỳ hiện tại'); }
  }
  else if (loai === 'dich_vu') pct = cb.dv;
  else if (loai === 'trien_khai') { pct = 0; ghiChu = 'Tính vào tích luỹ, không tính hoa hồng'; }
  else if (loai === 'gia_han') {
    tichLuy = false;
    const kyTruoc = ky.k >= 1 ? kyCua_(S, new Date(ky.from.getTime() - 86400000)) : null;
    const dtTruoc = kyTruoc ? dongCu.filter(o => o['Tính tích luỹ'] === 'Có' && docNgay_(o['Thời gian ghi nhận']) >= kyTruoc.from && docNgay_(o['Thời gian ghi nhận']) <= kyTruoc.to)
      .reduce((t, o) => t + (Number(o['Doanh thu (VNĐ)']) || 0), 0) : daCo;
    const cbTruoc = CAP_BAC[capTheoDT_(dtTruoc)]; capAD = cbTruoc.ten + (kyTruoc ? ' (cấp cuối kỳ trước)' : ' (kỳ đầu, theo cấp hiện tại)');
    pct = (ky.k >= 1 && !coDTKyNay) ? 0 : cbTruoc.sau;
    if (!pct) ghiChu = 'Chưa có doanh thu trong kỳ tích luỹ hiện tại';
  }
  return { pct: pct, cap: capAD, tichLuy: tichLuy, ghiChu: ghiChu, ky: ky.nhan };
}

// Doc doanh thu tu Workflow, so voi so da luu tren dong lead, ghi phan chenh lech vao tab Doanh thu
function ghiNhanDoanhThu_(sh, r, c0, job) {
  let c = c0;
  if (!c['Mã tạm'] || !c['DT dịch vụ']) { damBaoSheet_(ss_(), SHEET_LEAD, LEAD_HEADERS); c = cot_(sh); }
  const lead = docDong_(sh, r, c), email = String(lead['Email partner'] || '').trim().toLowerCase();
  const p = timPartner_(email) || {};
  const now = new Date(); let doi = false;
  const ngayKyWF = docNgay_(job.fields.ngay_ky);
  if (ngayKyWF && ngayVN_(ngayKyWF) !== ngayVN_(docNgay_(lead['Ngày ký HĐ']))) { sh.getRange(r, c['Ngày ký HĐ']).setValue(ngayKyWF).setNumberFormat('dd/MM/yyyy'); lead['Ngày ký HĐ'] = ngayKyWF; doi = true; }
  Object.keys(COT_DT).forEach(loai => {
    const moi = soTien_(job.fields['rev_' + loai]); if (!moi) return;
    const cu = soTien_(lead[COT_DT[loai]]); if (moi === cu) return;
    if (loai === 'ky_moi' && !lead['Ngày ký HĐ']) { sh.getRange(r, c['Ngày ký HĐ']).setValue(now).setNumberFormat('dd/MM/yyyy'); lead['Ngày ký HĐ'] = now; }
    const delta = moi - cu, dongCu = cacDongDT_(email);
    const t = tinhHH_(p, loai, now, lead, dongCu);
    const hh = Math.round(delta * t.pct / 100);
    ghiDong_(sheetDT_(), {
      'Thời gian ghi nhận': now, 'Mã lead': lead['Mã lead'], 'Email partner': email, 'Mã partner': lead['Mã partner'],
      'Chương trình': laConsulting_(p) ? 'Consulting' : 'Affiliate', 'Công ty khách hàng': lead['Công ty khách hàng'],
      'Loại doanh thu': LOAI_DT[loai], 'Doanh thu (VNĐ)': delta, 'Tính tích luỹ': t.tichLuy ? 'Có' : 'Không',
      'Cấp bậc áp dụng': t.cap, '% hoa hồng': t.pct, 'Hoa hồng (VNĐ)': hh, 'Kỳ tích luỹ': t.ky || '',
      'Trạng thái chi trả': 'Chờ đối soát', 'Ghi chú': (cu ? 'Điều chỉnh từ ' + cu.toLocaleString('vi-VN') + ' lên ' + moi.toLocaleString('vi-VN') + '. ' : '') + t.ghiChu,
    });
    sh.getRange(r, c[COT_DT[loai]]).setValue(moi).setNumberFormat('#,##0');
    lead[COT_DT[loai]] = moi; doi = true;
  });
  if (doi) {
    const ma = String(lead['Mã lead']);
    const tong = cacDongDT_(email).filter(o => String(o['Mã lead']) === ma || String(o['Mã lead']) === String(lead['Mã tạm']))
      .reduce((t, o) => t + (Number(o['Hoa hồng (VNĐ)']) || 0), 0);
    sh.getRange(r, c['Hoa hồng ghi nhận']).setValue(tong).setNumberFormat('#,##0');
    sh.getRange(r, c['Cập nhật lần cuối']).setValue(now);
    if (email) tinhTongHopPartner_(email, true);
  }
}

// Cap nhat cac cot tong hop tren tab Partner; bao email khi Consulting len cap
function tinhTongHopPartner_(email, baoLenCap) {
  if (!email) return null;
  const sh = sheet_(SHEET_PARTNER), r = timDongPartner_(email); if (!r) return null;
  const c = cot_(sh); if (!c['Chương trình']) { damBaoSheet_(ss_(), SHEET_PARTNER, PARTNER_HEADERS); return tinhTongHopPartner_(email, baoLenCap); }
  const p = docDong_(sh, r, c), q = tongQuanTuDong_(p, cacDongDT_(email));
  if (!p['Chương trình']) sh.getRange(r, c['Chương trình']).setValue('Affiliate');
  const capCu = String(p['Cấp bậc'] || '');
  sh.getRange(r, c['Cấp bậc']).setValue(q.consulting ? q.cap : '');
  sh.getRange(r, c['DT tích luỹ kỳ này']).setValue(q.consulting ? q.dtKy : '').setNumberFormat('#,##0');
  sh.getRange(r, c['Tổng doanh thu']).setValue(q.tongDT).setNumberFormat('#,##0');
  sh.getRange(r, c['Tổng hoa hồng']).setValue(q.tongHH).setNumberFormat('#,##0');
  sh.getRange(r, c['Hoa hồng đã chi']).setValue(q.daChi).setNumberFormat('#,##0');
  if (q.consulting && baoLenCap && capCu && capCu !== q.cap &&
      CAP_BAC.findIndex(x => x.ten === q.cap) > CAP_BAC.findIndex(x => x.ten === capCu)) {
    guiEmail_('lencap|' + email + '|' + q.ky + '|' + q.cap, email, `Chúc mừng bạn đạt cấp ${q.cap} – Base Consulting Partner`,
      `<p>Chào ${esc_(p['Họ và tên'])},</p><p>Doanh thu tích luỹ kỳ ${q.ky} của bạn đạt <b>${q.dtKy.toLocaleString('vi-VN')} đ</b>. Bạn đã lên cấp <b>${q.cap}</b>.</p>
       <ul><li>Hoa hồng bán mới phần mềm và up/cross (9 tháng): <b>${q.mucBan}%</b></li><li>Hoa hồng dịch vụ ngoài phần mềm: <b>${q.mucDV}%</b></li>
       <li>Hoa hồng gia hạn/up/cross sau thời hạn ghi nhận: <b>${q.mucSau}%</b></li></ul>
       <p>Mức mới áp dụng cho các khoản doanh thu ghi nhận từ thời điểm này.</p>`);
  }
  return q;
}
function tongQuanTuDong_(p, rows) {
  const consulting = laConsulting_(p), now = new Date();
  const tongDT = rows.reduce((t, o) => t + (Number(o['Doanh thu (VNĐ)']) || 0), 0);
  const tongHH = rows.reduce((t, o) => t + (Number(o['Hoa hồng (VNĐ)']) || 0), 0);
  const daChi = rows.filter(o => o['Trạng thái chi trả'] === 'Đã chi').reduce((t, o) => t + (Number(o['Hoa hồng (VNĐ)']) || 0), 0);
  const khongChi = rows.filter(o => o['Trạng thái chi trả'] === 'Không chi').reduce((t, o) => t + (Number(o['Hoa hồng (VNĐ)']) || 0), 0);
  const q = { consulting: consulting, chuongTrinh: consulting ? 'Consulting' : 'Affiliate', tongDT: tongDT, tongHH: tongHH - khongChi, daChi: daChi, choChi: tongHH - khongChi - daChi };
  if (consulting) {
    const ky = kyCua_(ngayBatDauKy_(p), now);
    const dtKy = rows.filter(o => o['Tính tích luỹ'] === 'Có' && docNgay_(o['Thời gian ghi nhận']) >= ky.from && docNgay_(o['Thời gian ghi nhận']) <= ky.to)
      .reduce((t, o) => t + (Number(o['Doanh thu (VNĐ)']) || 0), 0);
    const i = capTheoDT_(dtKy), cb = CAP_BAC[i], tiep = CAP_BAC[i + 1];
    Object.assign(q, { ky: ky.nhan, kyThu: ky.k + 1, dtKy: dtKy, cap: cb.ten, mucBan: cb.ban, mucDV: cb.dv, mucSau: cb.sau,
      capTiep: tiep ? tiep.ten : '', nguongTiep: tiep ? tiep.tu : 0, conThieu: tiep ? tiep.tu - dtKy : 0, nguongHienTai: cb.tu });
  }
  return q;
}
// Portal chi hien cap bac / tich luy; so tien hoa hong gui partner qua doi soat rieng
function tongQuanChoPortal_(email) {
  const q = Object.assign({}, tongQuanPartner_(email));
  delete q.tongHH; delete q.daChi; delete q.choChi;
  return q;
}
function tongQuanPartner_(email) { const p = timPartner_(email); return p ? tongQuanTuDong_(p, cacDongDT_(email)) : {}; }
function dongDoanhThu_(email, ma, maTam) {
  return cacDongDT_(email).filter(o => String(o['Mã lead']) === String(ma) || (maTam && String(o['Mã lead']) === String(maTam))).map(o => ({
    ngay: ngayVN_(docNgay_(o['Thời gian ghi nhận'])), loai: String(o['Loại doanh thu'] || ''), dt: Number(o['Doanh thu (VNĐ)']) || 0,
    pct: o['% hoa hồng'], hh: Number(o['Hoa hồng (VNĐ)']) || 0, tt: String(o['Trạng thái chi trả'] || ''), ghiChu: String(o['Ghi chú'] || ''),
  }));
}
function tinhLaiTatCaPartner() {
  const sh = sheet_(SHEET_PARTNER); if (!sh || sh.getLastRow() < 2) return;
  const c = cot_(sh), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  rows.forEach(v => { if (v[c['Trạng thái duyệt'] - 1] === 'Đã duyệt') tinhTongHopPartner_(String(v[c['Email'] - 1]).trim().toLowerCase(), false); });
}
// Admin nhap tay 1 dong (vd: Gia han ghi nhan o he thong khac): chi can Mã lead + Loại doanh thu + Doanh thu (VNĐ).
// He thong tu dien partner, cap bac, %, hoa hong; cot 'Hoa hồng (VNĐ)' con trong thi moi tinh.
function suaTabDoanhThu_(e) {
  const sh = e.range.getSheet(), c = cot_(sh), r0 = Math.max(2, e.range.getRow());
  const daTinh = {};
  for (let r = r0; r < e.range.getRow() + e.range.getNumRows(); r++) {
    const o = docDong_(sh, r, c);
    if (o['Mã lead'] && o['Loại doanh thu'] && soTien_(o['Doanh thu (VNĐ)']) && o['Hoa hồng (VNĐ)'] === '') tinhDongNhapTay_(sh, r, c, o);
    const em = String(sh.getRange(r, c['Email partner']).getValue()).trim().toLowerCase();
    if (em && !daTinh[em]) { daTinh[em] = 1; tinhTongHopPartner_(em, true); }
  }
}
function tinhDongNhapTay_(sh, r, c, o) {
  const lsh = sheet_(SHEET_LEAD), lc = cot_(lsh), n = lsh.getLastRow() - 1; if (n < 1) return;
  const data = lsh.getRange(2, 1, n, lsh.getLastColumn()).getValues(), ma = String(o['Mã lead']).trim();
  const i = data.findIndex(v => String(v[lc['Mã lead'] - 1]).trim() === ma || (lc['Mã tạm'] && String(v[lc['Mã tạm'] - 1]).trim() === ma));
  if (i < 0) { sh.getRange(r, c['Ghi chú']).setValue('Không tìm thấy Mã lead ' + ma + ' trong tab Lead'); return; }
  const lead = {}; Object.keys(lc).forEach(k => lead[k] = data[i][lc[k] - 1]);
  const email = String(lead['Email partner'] || '').trim().toLowerCase(), p = timPartner_(email) || {};
  const loai = Object.keys(LOAI_DT).find(k => LOAI_DT[k] === String(o['Loại doanh thu']).trim()) || 'gia_han';
  const ngay = docNgay_(o['Thời gian ghi nhận']) || new Date(), dt = soTien_(o['Doanh thu (VNĐ)']);
  const dongCu = cacDongDT_(email).filter(x => x._r !== r);
  const t = tinhHH_(p, loai, ngay, lead, dongCu), hh = Math.round(dt * t.pct / 100);
  const set = (k, v) => { if (c[k]) sh.getRange(r, c[k]).setValue(v); };
  set('Mã lead', String(lead['Mã lead'])); set('Thời gian ghi nhận', ngay); set('Email partner', email); set('Mã partner', lead['Mã partner']);
  set('Chương trình', laConsulting_(p) ? 'Consulting' : 'Affiliate'); set('Công ty khách hàng', lead['Công ty khách hàng']);
  set('Doanh thu (VNĐ)', dt); set('Tính tích luỹ', t.tichLuy ? 'Có' : 'Không'); set('Cấp bậc áp dụng', t.cap); set('% hoa hồng', t.pct);
  set('Hoa hồng (VNĐ)', hh); set('Kỳ tích luỹ', t.ky || ''); if (!o['Trạng thái chi trả']) set('Trạng thái chi trả', 'Chờ đối soát');
  set('Ghi chú', ['Nhập tay', t.ghiChu, o['Ghi chú']].filter(String).join('. '));
  // cap nhat cot tong tren dong lead (vd DT gia han) va hoa hong ghi nhan
  const lr = i + 2, cot = COT_DT[loai];
  if (cot && lc[cot] && loai !== 'ky_moi') lsh.getRange(lr, lc[cot]).setValue(soTien_(lead[cot]) + dt).setNumberFormat('#,##0');
  const tong = cacDongDT_(email).filter(x => String(x['Mã lead']) === String(lead['Mã lead'])).reduce((a, x) => a + (Number(x['Hoa hồng (VNĐ)']) || 0), 0);
  if (lc['Hoa hồng ghi nhận']) lsh.getRange(lr, lc['Hoa hồng ghi nhận']).setValue(tong).setNumberFormat('#,##0');
}
// Doi Ma lead tam (L......) thanh ID nhiem vu Workflow, giu ma cu o cot 'Mã tạm'
function doiMaLeadTheoId_(maCu, jid) {
  if (!jid || !/^\d+$/.test(String(jid)) || String(maCu) === String(jid)) return;
  const sh = sheet_(SHEET_LEAD); let c = cot_(sh);
  if (!c['Mã tạm']) { damBaoSheet_(ss_(), SHEET_LEAD, LEAD_HEADERS); c = cot_(sh); }
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const i = sh.getRange(2, c['Mã lead'], n, 1).getValues().flat().map(String).indexOf(String(maCu)); if (i < 0) return;
  if (!/^L\d{6}-/.test(String(maCu))) return;
  sh.getRange(i + 2, c['Mã tạm']).setValue(maCu);
  sh.getRange(i + 2, c['Mã lead']).setValue(String(jid));
  const rv = sheetDT_(), cr = cot_(rv);                       // doi ma tren tab Doanh thu (neu co)
  if (rv.getLastRow() > 1) rv.getRange(2, cr['Mã lead'], rv.getLastRow() - 1, 1).getValues().forEach((x, k) => { if (String(x[0]) === String(maCu)) rv.getRange(k + 2, cr['Mã lead']).setValue(String(jid)); });
}
// Dong hoa hong trong email 'Lead hop le' theo chuong trinh cua partner
function dongHoaHongTheoCT_(l) {
  const p = timPartner_(String(l['Email partner'] || '').trim().toLowerCase());
  if (!laConsulting_(p)) return dongHoaHong_(l['% hoa hồng']);
  return `<li>Chương trình: <b>Consulting Partner</b></li><li>% hoa hồng partner: <b>${phanTram_(l['% hoa hồng'])}</b></li>`;
}
// "123,456,789" | "123.456.789" | 123456789 | "123456789.00" -> 123456789
function soTien_(v) {
  if (typeof v === 'number') return Math.round(v);
  let t = String(v === undefined || v === null ? '' : v).trim();
  if (!t) return 0;
  if (/^\d+[.,]\d{1,2}$/.test(t)) t = t.split(/[.,]/)[0];
  return Number(t.replace(/[^\d]/g, '')) || 0;
}
