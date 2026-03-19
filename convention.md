# Cosign FE — Code Convention

> Tài liệu này là **nguồn sự thật duy nhất** về coding convention của dự án.
> Mọi PR không tuân thủ sẽ bị reject. Khi có thắc mắc, hỏi tech lead trước khi tự diễn giải.

---

## 1. Cấu trúc thư mục

```
src/
├── api/                  # Axios instances + API service functions
│   ├── callApi.ts        # Cấu hình axios (interceptors, base URL)
│   └── {feature}/        # API calls theo feature
├── app/
│   └── hooks.ts          # Pre-typed Redux hooks (useAppDispatch, useAppSelector)
├── assets/               # Font, hình ảnh tĩnh
├── components/           # Shared/reusable components
├── hooks/                # Custom React hooks dùng chung
├── layouts/              # Layout wrappers (AppLayout, AuthLayout)
├── pages/                # Page components theo route
├── routes/               # Cấu hình routing
├── store/
│   ├── configureStore.ts
│   ├── rootReducer.ts
│   └── modules/          # Redux slices theo feature
├── types/
│   └── index.ts          # Toàn bộ TypeScript types tập trung tại đây
└── utils/                # Utility functions thuần túy
```

**Quy tắc:**
- Không tạo file ở root `src/` ngoài `App.tsx`, `main.tsx`, `index.css`
- Mỗi feature mới phải có thư mục riêng, không nhét chung vào folder khác
- Không để file "orphan" — mọi file phải thuộc một module rõ ràng

---

## 2. Đặt tên

### Files & Folders

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Component | `PascalCase/` + `PascalCase.tsx` | `CourseCard/CourseCard.tsx` |
| Page | `PascalCase/` + `PascalCase.tsx` | `DictionaryPage/DictionaryPage.tsx` |
| Hook | `camelCase.ts` | `useForm.ts` |
| Utility | `camelCase.ts` | `localStorage.ts` |
| Redux slice | `camelCase/index.tsx` | `course/index.tsx` |
| CSS Module | `PascalCase.module.css` | `CourseCard.module.css` |
| Type file | `index.ts` | `types/index.ts` |

### Variables & Functions

```ts
// Boolean — luôn dùng prefix "is", "has", "can", "should"
const isLoading = true;
const hasPermission = false;

// Event handlers — luôn prefix "handle"
const handleSubmit = () => {};
const handleChange = (e: ChangeEvent<HTMLInputElement>) => {};

// Async thunks — luôn prefix "fetch"
const fetchAllCourses = createAsyncThunk(...);
const fetchLogin = createAsyncThunk(...);

// State setters (local state) — luôn prefix "set"
const [isOpen, setIsOpen] = useState(false);
```

### Types

```ts
// Component props
type CourseCardProps = { ... }

// Redux state
type CourseState = { ... }

// API response shape
type CourseListResponse = { ... }

// Domain data
type CourseData = { ... }
```

---

## 3. Components

### Cấu trúc folder

Mỗi component **phải** có cấu trúc:

```
ComponentName/
├── index.tsx         ← chỉ re-export, không chứa logic
└── ComponentName.tsx ← toàn bộ implementation
```

```tsx
// index.tsx — KHÔNG được viết thêm gì ngoài dòng này
export { default } from './ComponentName';
```

### Viết component

```tsx
// ✅ Đúng
import type { CourseCardProps } from '~/types';
import styles from './CourseCard.module.css';

export default function CourseCard({ title, imageUrl, onClick }: CourseCardProps) {
    return (
        <div className={styles.wrapper} onClick={onClick}>
            <img src={imageUrl} alt={title} />
            <span>{title}</span>
        </div>
    );
}

// ❌ Sai — arrow function cho component export default
export default const CourseCard = () => {};

// ❌ Sai — không có type cho props
export default function CourseCard({ title, imageUrl }) {}
```

**Quy tắc:**
- Luôn dùng `function` declaration cho component, không dùng arrow function với `export default`
- Props **phải** có type, không dùng `any`, không bỏ trống
- Không inline style, dùng CSS Module hoặc Tailwind classes
- Không dùng `React.FC` — verbose và ẩn return type

---

## 4. TypeScript

### Tập trung types

- **Tất cả shared types** (component props, API types, domain models) đặt trong `src/types/index.ts`
- Types chỉ dùng nội bộ trong 1 file thì khai báo tại chỗ, không export

### type vs interface

Dự án dùng **`type`**, không dùng `interface` (enforce bởi ESLint):

```ts
// ✅
type CourseData = {
    id: string;
    title: string;
    duration: number;
};

// ❌
interface CourseData {
    id: string;
    title: string;
}
```

### Import types

```ts
// ✅ — tách type import
import type { CourseData, CourseState } from '~/types';
import { fetchAllCourses } from '~/store/modules/course';

// ❌ — gộp chung
import { CourseData, fetchAllCourses } from '~/store/modules/course';
```

### Cấm `any`

```ts
// ❌ Cấm tuyệt đối
const data: any = response;
catch (error: any) {}

// ✅ Dùng unknown rồi narrow type
catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
}
```

---

## 5. Redux Toolkit

### Cấu trúc slice

Mỗi slice trong `src/store/modules/{feature}/index.tsx` theo thứ tự:

```ts
// 1. Imports
// 2. Types (State shape, API response types)
// 3. Initial state
// 4. Async thunks (createAsyncThunk)
// 5. Slice definition (createSlice)
// 6. Export reducer (default)
// 7. Export actions & thunks (named)
```

### Async thunk pattern

```ts
export const fetchAllCourses = createAsyncThunk<
    CourseListResponse,  // return type khi fulfilled
    void,                // argument type
    { rejectValue: string }
>('course/fetchAllCourses', async (_, { rejectWithValue }) => {
    try {
        const response = await getAllCourse();
        return response as unknown as CourseListResponse;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Không thể tải danh sách khóa học';
        return rejectWithValue(message);
    }
});
```

### Hooks

```ts
// ✅ Luôn dùng pre-typed hooks từ ~/app/hooks
import { useAppDispatch, useAppSelector } from '~/app/hooks';

// ❌ Cấm import trực tiếp từ react-redux
import { useSelector, useDispatch } from 'react-redux';
```

### Extra reducers pattern

```ts
extraReducers: (builder) => {
    builder
        .addCase(fetchAllCourses.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        })
        .addCase(fetchAllCourses.fulfilled, (state, action) => {
            state.isLoading = false;
            state.listCourses = action.payload.data;
        })
        .addCase(fetchAllCourses.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload ?? 'Lỗi không xác định';
        });
},
```

---

## 6. API Layer

### Cấu trúc

```ts
// src/api/{feature}/index.ts

import { beApi } from '~/api/callApi';
import type { CourseListResponse } from '~/types';

export const getAllCourse = () => {
    return beApi.get<CourseListResponse>('general-course/course');
};
```

**Quy tắc:**
- API functions **không** xử lý error — để thunk xử lý
- API functions **không** transform data — axios interceptor đã làm
- Đặt tên theo REST semantics: `get*`, `create*`, `update*`, `delete*`
- Có generic type cho response khi có thể

---

## 7. Styling

### Thứ tự ưu tiên

1. **Tailwind CSS** (prefix `tw:`) — cho layout, spacing, typography nhanh
2. **CSS Module** — cho styles phức tạp, hover effects, animations
3. **Ant Design ConfigProvider** — customize Antd theme tokens ở cấp global

```tsx
// ✅ Kết hợp Tailwind + CSS Module
<div className={`${styles.wrapper} tw:flex tw:items-center tw:gap-4`}>
```

### Cấm

```tsx
// ❌ Inline style — trừ khi giá trị dynamic không thể làm bằng class
<div style={{ marginTop: 16 }}>  // ❌

// ✅ Dùng Tailwind
<div className="tw:mt-4">
```

### CSS variables (theme colors)

Dùng CSS variables đã định nghĩa trong `GlobalStyles.css`, không hardcode màu:

```css
/* ✅ */
color: var(--color-primary);
background: var(--color-secondary);

/* ❌ */
color: #143ec0;
```

---

## 8. Import & Path aliases

```ts
// ✅ Luôn dùng alias ~ thay vì relative path
import { useAppDispatch } from '~/app/hooks';
import type { CourseData } from '~/types';
import CourseCard from '~/components/CourseCard';

// ❌ Cấm relative path quá 1 cấp
import CourseCard from '../../../components/CourseCard';
```

### Thứ tự import (từ trên xuống)

```ts
// 1. React & React core
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { Card, Button } from 'antd';

// 3. Internal — store/redux
import { useAppDispatch, useAppSelector } from '~/app/hooks';
import { fetchAllCourses } from '~/store/modules/course';

// 4. Internal — components
import CourseCard from '~/components/CourseCard';

// 5. Internal — types (dùng import type)
import type { CourseData } from '~/types';

// 6. Local assets & styles
import styles from './CoursesPage.module.css';
```

---

## 9. Custom Hooks

```ts
// src/hooks/useForm.ts

// ✅ Tên hook bắt đầu bằng "use"
// ✅ Generic để tái sử dụng cho nhiều form
// ✅ Trả về object, không phải array (dễ đặt tên khi destructure)

export function useForm<T extends Record<string, unknown>>({
    initialValues,
    validate,
}: UseFormConfig<T>) {
    // ...
    return { values, errors, handleChange, validateForm, reset, isValid };
}
```

**Quy tắc:**
- Hooks tái sử dụng nhiều nơi → `src/hooks/`
- Hooks chỉ dùng trong 1 component → đặt trong folder component đó

---

## 10. Routing

```ts
// src/routes/index.tsx

// Luôn dùng RouteConfig type, không dùng RouteObject trực tiếp
export const routes: RouteConfig[] = [
    {
        path: '/login',
        element: <PublicRoute><LoginPage /></PublicRoute>,
    },
    {
        path: '/',
        element: <PrivateRoute><AppLayout /></PrivateRoute>,
        children: [
            {
                path: 'dashboard',
                element: <DashboardPage />,
                name: 'Trang chủ',      // dùng cho breadcrumb/nav
                icon: <HomeIcon />,
                sidebar: true,
            },
        ],
    },
];
```

---

## 11. Error Handling

```ts
// ✅ Trong async thunk
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return rejectWithValue(message);
}

// ✅ Hiển thị lỗi trong component
const error = useAppSelector((state) => state.course.error);
if (error) return <Alert type="error" message={error} />;
```

**Quy tắc:**
- Không dùng `console.log` trong production code (chỉ dùng khi debug, xóa trước khi commit)
- Error messages phải là tiếng Việt, user-friendly
- Loading states phải được handle — không để blank screen

---

## 12. Quy trình làm việc

### Branch naming

```
feature/{ticket-id}-{short-description}
fix/{ticket-id}-{short-description}
refactor/{short-description}
```

### Commit message

Dùng [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: thêm trang từ điển ký hiệu
fix: sửa lỗi không hiển thị kết quả tìm kiếm
refactor: tách CourseCard thành component riêng
chore: cập nhật dependencies
```

### Checklist trước khi tạo PR

- [ ] Không có lỗi TypeScript (`tsc --noEmit`)
- [ ] Không có ESLint warnings/errors
- [ ] Không có `any`, `console.log`, comment code thừa
- [ ] Tên biến/hàm có ý nghĩa, không dùng `temp`, `test`, `abc`
- [ ] Không import trực tiếp từ `react-redux`
- [ ] Mọi type dùng `type` keyword, không dùng `interface`
- [ ] Import paths dùng alias `~`

---

## 13. Những điều tuyệt đối KHÔNG làm

```ts
// ❌ Không dùng any
const data: any = {};

// ❌ Không import trực tiếp useSelector/useDispatch
import { useSelector } from 'react-redux';

// ❌ Không dùng interface
interface Foo {}

// ❌ Không relative import quá 1 cấp
import X from '../../../something';

// ❌ Không hardcode màu sắc
style={{ color: '#143ec0' }}

// ❌ Không commit console.log
console.log('debug data:', data);

// ❌ Không để unused variables/imports (TypeScript sẽ báo lỗi)
import { unusedThing } from '~/somewhere';
```

---

*Cập nhật lần cuối: 2026-03-18 — Tech Lead review*
