# Base Affiliate Partner Program 2026

Trang giới thiệu chương trình và form đăng ký Partner của Base.vn, kèm hệ thống quản lý partner/lead trên Google Sheets.

## Cấu trúc

| File | Dùng để |
|---|---|
| `index.html` | Trang web chạy trên GitHub Pages |
| `unbounce/unbounce-partner.html` | Code dán vào khối Custom HTML trên Unbounce |
| `apps-script/Code.gs` | Apps Script gắn với Google Sheet "Base Partner": nhận đăng ký, gửi email, xử lý lead |

## Luồng hoạt động

1. Partner đăng ký trên trang (GitHub Pages hoặc Unbounce) → dữ liệu vào tab **Partner** của Google Sheet, gửi email xác nhận.
2. Admin chọn **Đã duyệt** → hệ thống cấp mã partner, gửi email kèm link Partner Portal (Google Sites).
3. Partner gửi lead qua Google Form → tab **Lead**, cảnh báo trùng, email xác nhận.
4. Admin cập nhật **Kiểm tra lead / Giai đoạn** → email tự động cho partner theo từng bước.
5. Partner xem deal của mình trên Looker Studio (lọc theo email).

## Cập nhật trang

Sửa `index.html` → vào repo bấm **Add file → Upload files** → kéo file mới vào (trùng tên sẽ ghi đè) → **Commit changes**. GitHub Pages tự cập nhật sau khoảng 1 phút.

## Lưu ý bảo mật

- Không đưa access token Base hay mật khẩu vào repo. Token được lưu trong **Script Properties** của Apps Script.
- Link Web App (`SCRIPT_URL`) trong trang là công khai theo thiết kế, chỉ dùng để nhận form.

Liên hệ: Hoàng Hương Giang – Phát triển Đối tác Base.vn – 0943 860 401 – giang.hoang03@base.vn
