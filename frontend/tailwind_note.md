1. Cấu trúc Configuration (CSS-first)
Đây là thay đổi lớn nhất. Tailwind v4 không còn ưu tiên file .js mà chuyển sang dùng trực tiếp trong file CSS.

V3: AI thường tạo tailwind.config.js với module.exports = { content: [...], theme: { extend: {...} } }.

V4: Sử dụng directive @theme ngay trong file CSS chính.

Prompt Tip: "Use Tailwind v4 CSS-first configuration. Define custom theme variables inside the @theme block in the CSS file, not in a JavaScript config file."

2. Thay đổi cú pháp Import & Directives
V3: @tailwind base; @tailwind components; @tailwind utilities;

V4: Chỉ cần một dòng duy nhất: @import "tailwindcss";

Prompt Tip: "Ensure you use the new @import 'tailwindcss'; syntax instead of the legacy @tailwind directives."

3. Tự động nhận diện nội dung (Content Detection)
Ở v4, Tailwind tự động quét các file trong project mà không cần khai báo mảng content: [...] thủ công (trừ trường hợp đặc biệt).

Prompt Tip: "Do not include a 'content' array configuration as Tailwind v4 handles automatic content detection by default."

4. Các Utility Classes bị thay đổi hoặc xóa bỏ
AI rất hay nhầm lẫn các class cũ. Bạn cần nhắc nó kiểm tra các class sau:

Opacity: Không còn dùng bg-opacity-50, hãy dùng cú pháp gạch chéo: bg-black/50.

Ring: ring ở v4 mặc định là 1px (thay vì 3px như v3). Nếu muốn giống v3, AI phải dùng ring-3.

Border/Outline: outline-none nay được thay bằng outline-hidden trong một số trường hợp cụ thể để tối ưu SEO/Accessibility.

Flex: Một số class như flex-grow được rút gọn thành grow, flex-shrink thành shrink.

5. Sử dụng biến CSS trực tiếp (Theme Variables)
Trong v4, mọi token trong @theme đều tự động trở thành biến CSS (--color-primary, v.v.). AI có thể tận dụng var(--...) ngay trong class nếu cần.

Prompt Tip: "Leverage CSS variables defined in the theme. For example, use bg-(--color-primary) for custom theme colors."