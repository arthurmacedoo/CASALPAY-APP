# Memory Index & Business Rules — CasalPay

This file records the current status, business rules, and technical conventions of the CasalPay SaaS multi-group application.

---

## 📌 Project Status
- **Current Architecture:** 100% migrated to Multi-Group SaaS. The legacy `couples/` collections are locked, and the app reads/writes exclusively to `/groups/{groupId}/`.
- **Primary Group ID:** `arthur-namorada-2026` (Arthur & Zara).
- **Core Stack:** React (Vite), TypeScript, Tailwind CSS, Firestore, Firebase Auth, FCM (Firebase Cloud Messaging), Vercel Serverless Functions.

---

## 🎯 Core Business Rules (Regras de Negócio)

### 1. Multi-Group SaaS Model
- Each user profile resides in `/users/{userId}`.
- Users can belong to up to **4 groups** simultaneously.
- A user's active session is bound to `activeGroupId` saved in their user profile and cached locally.
- Group members and their roles (`admin` or `member`) are stored in the `/groups/{groupId}/members` subcollection.

### 2. Expense Life Cycle & Status
- **Life Cycle Status:** Transactions can be `"pending"` or `"confirmed"`.
- **Pending Transactions:** Injected by external inputs (e.g., Apple Pay webhook). They are saved with `status: "pending"`, `paidByUserId: null`, and `personalOwnerUserId: null`. They must be manually reviewed and approved in the frontend.
- **Confirmed Transactions:** Normal user entries or approved pending entries. They appear on active balance calculations.

### 3. Split Modes & Visibilities
- **Split Mode:**
  - `"equal"`: Divided equally among all selected users in `splitBetweenUserIds`.
  - `"personal"`: Charged 100% to a single owner (`personalOwnerUserId`).
- **Visibility:**
  - `"shared"`: Normal daily expenses.
  - `"personal"`: Individual credit card bills or personal expenses.

### 4. Installments Rule (Trava de Parcelamento)
- **Rule:** Shared installment expenses are forbidden to avoid complex math when members enter/leave groups.
- **Behavior:** Checking "Compra Parcelada?" forces `splitMode` to `"personal"` and `visibility` to `"personal"`. The user must designate a single member (`personalOwnerUserId`) responsible for all installments.

### 5. Settlements (Acertos Pix)
- **Fields:** `fromUserId` (payer), `toUserId` (recipient), and `visibility` (`"shared"` or `"personal"`).
- **Validation:** Payer and recipient cannot be the same (`fromUserId !== toUserId`).
- **Destination:**
  - Daily expenses settlement (`visibility: "shared"`): Abates standard shared debts.
  - Invoice payoff (`visibility: "personal"`): Directly pays off someone's personal invoice.

### 6. FCM Device Registration & Notifications
- FCM tokens are registered under `/groups/{groupId}/fcm_tokens`.
- Push notifications are sent via `/api/send-notification` to notify users about settlements, group alerts, and Apple Pay errors.

---

## 🔒 Security Conventions
- Firestore subcollection security relies on checking if `request.auth.uid` is present in `/groups/{groupId}.memberIds` (cached or via `get/exists` lookups).
- External endpoints (`/api/webhook-apple-pay`, `/api/sync-apple-pay-outbox`) authenticate clients using Bearer tokens against the server-side environment variable `WEBHOOK_SECRET`.

---

## 🔄 Technical Decisions & Conventions
- **Monetary Values:** Always represented in **cents** (`amount` as integer) to avoid floating-point math issues.
- **Date Format:** Strict ISO string `YYYY-MM-DD`.
- **Month Partitioning:** Transactions are queried and grouped by `monthKey` (`YYYY-MM`).
- **Active Group Cache Recovery:** If an `onSnapshot` listener triggers `permission-denied`, the cached `activeGroupId` is instantly evicted, routing the user to the onboarding `GroupHub` rather than freezing the UI.
