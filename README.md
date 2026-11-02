# Chùa Linh Ứng Online - Bản đã sửa multiplayer

## Lỗi đã sửa
- Trước đây: Client chủ yếu dùng BroadcastChannel → chỉ thấy nhau khi mở nhiều tab **cùng một máy**.
- Khi 2 máy (hoặc 2 điện thoại) khác nhau vào → không thấy nhau, số người luôn hiện 1/200.

## Cách chạy
```bash
cd dichua_fixed
npm install
node server.js
```
Mở trình duyệt: http://localhost:3000

## Deploy lên host
1. Upload toàn bộ thư mục (sau khi `npm install`) lên VPS / host hỗ trợ Node.js.
2. Chạy: `node server.js` hoặc dùng PM2: `pm2 start server.js --name chua`
3. Mở port 3000 (hoặc set biến môi trường PORT).
4. Nếu dùng Nginx reverse proxy, nhớ cấu hình WebSocket:
```
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Kiểm tra
- Mở 2 trình duyệt khác nhau (hoặc máy khác nhau / ẩn danh) → vào chùa với tên khác nhau.
- Hai người phải thấy nhau di chuyển, ngồi thiền, cầu nguyện.
- Số người online phải tăng đúng (2/200, 3/200...).
