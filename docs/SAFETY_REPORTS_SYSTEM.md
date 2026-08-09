# 🛡️ AARX Platform — Safety Reports & Fraud Protection System Documentation

## 1. Overview & Objective
The **Safety & Reports System** is an enterprise-grade moderation and dispute handling hub for both Sellers (Pharmacies) and Buyers (Patients). It operates independently from generic customer support tickets to ensure private, high-security handling of fraudulent orders, prescription tampering, payment disputes, and abusive behavior.

---

## 2. Enterprise UI & Design System

### 🎨 Color Palette Tokens
- **Primary Navy**: `#123B5D` (Header Gradient & Active Tab Base)
- **Secondary Teal**: `#0F8B8D` (Icons, Borders & Highlighting)
- **Background Light**: `#F4F8FA` (Canvas Background)
- **Light Teal Card**: `#E8F4F5` (Info Banners & Badges)
- **Border Teal**: `#B9DDE0` (Clean Structural Boundaries)
- **Card White**: `#FFFFFF` (High Density Content Cards)
- **Status Green**: `#16A34A` (Action Taken & Verified State)
- **Status Amber**: `#F59E0B` (Under Review & Pending State)
- **Status Red**: `#DC2626` (Abuse & Error Alerts)

### 💎 Key UI Highlights
1. **3D Floating Header Card**:
   - Features 14px horizontal floating margins, 22px border radius, subtle white glassmorphism border (`rgba(255,255,255,0.25)`), and 3D depth shadow (`elevation: 8`, `shadowColor: '#123B5D'`).
2. **Realtime Refresh Button**:
   - Top-right header icon button (`refresh-cw`) triggering immediate API re-fetching with rotational feedback.
3. **Dual Direction Tab Bar**:
   - Segmented control splitting reports into:
     - 📄 **All Reports** (Combined list with badge count)
     - 🙋‍♂️ **Raised By You** (Reports filed by current Store/User)
     - 🛡️ **Against You** (Reports filed by counterparty against Store/User)
4. **Status Filter Sub-Bar**:
   - Instant filtering across: `All Cases`, `Under Review`, `Action Taken`, and `Closed / Resolved`.

---

## 3. Reference ID Resolution & Submission Workflow

### 🆔 How Reference IDs Work (Store Dashboard)
Sellers can file safety reports against specific orders or enquiries using the `#` reference ID on their dashboard:
- **Enquiry ID**: `#` number on cards under the **Enquiries** tab (e.g., `48`).
- **Order ID**: `#` number on cards under **Orders / Quoted / History** tabs (e.g., `102`).

### 🔒 Backend Validation (`django/prescription/views.py`)
- The `_get_store_context(reference_id, store)` method verifies association across:
  1. `PrescriptionResponse` (Matching Response ID or Prescription ID)
  2. `PrescriptionTargetStore` (Matching Target Store assignment)
  3. `Prescription` (Direct store association or completed response)
- If an invalid ID is provided, the API returns a helpful error message:
  `"Order or Enquiry #XYZ was not found in your store records."`

---

## 4. Moderation & Support Team Lifecycle

Safety reports progress through 3 core lifecycle stages managed strictly by the **AARX Moderation & Support Team**:

| Status | Code | Triggered By | Action Taken |
| :--- | :--- | :--- | :--- |
| **Under Review** | `under_review` | Automatic / Support Staff | Triggered when support staff inspects the report. |
| **Action Taken** | `action_taken` | Support Officer / Admin | Triggered when moderation action is executed:<br>• ⚠️ **Warning Sent**<br>• ⛔ **Account Suspended**<br>• 🔄 **Account Restored** |
| **Closed / Resolved** | `closed` | Support Officer / Admin | Triggered when investigation completes and an official **Resolution Note** is saved. |

---

## 5. Admin Panel Management

AARX Admins can manage all safety reports from the Django Admin Panel at:
`http://<domain>/admin/prescription/safetyreport/`

### Features available to Admins:
- **Batch Actions**:
  - `Mark selected reports as Under Review`
  - `Mark selected reports as Action Taken`
  - `Mark selected reports as Closed / Resolved`
- **Resolution Note Editor**:
  - Enter custom resolution text that syncs instantly to user/seller mobile cards.
