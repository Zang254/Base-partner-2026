# Base Affiliate Partner Program 2026

Website chương trình Partner của Base.vn + Partner Portal, backend chạy trên Google Sheets + Apps Script.

- Trang giới thiệu & đăng ký: https://zang254.github.io/Base-partner-2026/
- Partner Portal (đăng nhập): https://zang254.github.io/Base-partner-2026/portal.html

## Cấu trúc

| File | Dùng để |
|---|---|
| `index.html` | Trang giới thiệu, chính sách, form đăng ký Partner, nút Đăng nhập |
| `portal.html` | Partner Portal: Deal của tôi, Đăng ký lead, Tài nguyên, Thông tin của tôi |
| `apps-script/Code.gs` | Backend: tài khoản, API cho Portal, đồng bộ Base Workflow, webhook Base CRM, email tự động |

## Luồng hoạt động

1. Đăng ký Partner trên website → tab **Partner** (Chờ duyệt) + email xác nhận.
2. Admin chọn **Đã duyệt** → sinh **Mã partner** + **tài khoản** (email + mật khẩu tạm thời) gửi qua email.
3. Partner đăng nhập Portal → bắt buộc đổi mật khẩu lần đầu → bổ sung thông tin Bên B.
4. Partner **đăng ký lead** → tab **Lead** + tạo nhiệm vụ trên **Base Workflow** (API).
5. Mỗi 10 phút hệ thống đọc Workflow: khi có *Tình trạng lead*, *% hoa hồng partner*, *BC/CD phụ trách* → email cho partner.
6. Mỗi lần BC chuyển stage trên **Base CRM** → Base Process gọi webhook → cập nhật **Deal của tôi** + email partner.
7. Partner chỉ thấy dữ liệu gắn với email của mình (kiểm tra ở backend theo phiên đăng nhập).

## Thuộc tính tập lệnh (Apps Script > Cài đặt dự án)

| Tên | Giá trị |
|---|---|
| `BASE_WF_TOKEN` | Access token v2 của Base Workflow |
| `WF_ID` | ID workflow "MKT \| Đăng ký lead - Partner" |
| `WF_CREATOR` | Username tạo nhiệm vụ |
| `WEBHOOK_SECRET` | Chuỗi bí mật cho webhook CRM |

Webhook CRM (GET hoặc POST tới link Web App):
`?action=crm&secret=WEBHOOK_SECRET&lead=MÃ_LEAD&stage=MQL` (hoặc `deal=TÊN_DEAL`, `crm=LINK_DEAL`; tùy chọn `value=`, `note=`)

## Bảo mật

- Không đưa token, mật khẩu vào repo. Mật khẩu partner được băm (SHA-256 + salt), cột mật khẩu bị ẩn trong Sheet.
- Thông tin CMND/CCCD, tài khoản ngân hàng chỉ lưu trong Google Sheet, giới hạn quyền xem Sheet cho đội phụ trách.

Liên hệ: Hoàng Hương Giang – Phát triển Đối tác Base.vn – 0943 860 401 – giang.hoang03@base.vn
