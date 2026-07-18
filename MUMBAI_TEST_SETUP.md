# Mumbai Test Setup

> Ye records sirf local development/testing ke liye hain. Production mein in test
> credentials, mobile numbers aur pharmacy licence values ko use mat karna.

## 1. Created configuration

### Mumbai city

- Database ID: `4`
- Name: `Mumbai`
- State: `Maharashtra`
- Timezone: `Asia/Kolkata`
- Boundary mode: Automatic radius
- Center: `19.0760, 72.8777`
- Service radius: `35 km`
- Active: Yes
- Default city: No
- Geographic boundary: Automatically generated

Mumbai boundary ke andar save hone wale stores aur prescriptions ko system
automatically `city_id = 4` assign karta hai.

### Mumbai response policy

Emergency:

- First reminder: 60 seconds
- Second reminder: 120 seconds
- Support escalation: 180 seconds

Normal:

- First reminder: 180 seconds
- Second reminder: 300 seconds
- Support escalation: 420 seconds

Common:

- Maximum automatic reminders: 2
- Manual reminder cooldown: 120 seconds
- Manual reminder daily limit/store: 10
- Automatic reminders: Enabled
- Support escalation: Enabled

## 2. Mumbai test customer

- Database ID: `12`
- Name: `Mumbai Test Customer`
- Email: `mumbai.customer@aarx.test`
- Mobile: `9000000001`
- Password: `MumbaiUser@2026`
- Address: Andheri East, Mumbai, Maharashtra
- Pincode: `400069`
- Active/verified: Yes

Customer account permanently Mumbai-locked nahi hai. Request ke confirmed
coordinates city decide karte hain.

## 3. Mumbai test pharmacy

- Database ID: `514`
- Name: `Mumbai Test Pharmacy`
- Email: `mumbai.store@aarx.test`
- Mobile: `9000000002`
- Password: `MumbaiStore@2026`
- Address: Bandra West, Mumbai, Maharashtra
- Pincode: `400050`
- Coordinates: `19.0596, 72.8295`
- City: Mumbai (`4`)
- Active: Yes
- Verified: Yes
- Pharmacist available/verified: Yes

### Push notification note

Fake Expo push token intentionally add nahi kiya gaya. Store app ko real Android
device par is account se login karne ke baad device ka genuine Expo token register
hoga. Tab OS-level push notification test karna.

Backend in-app notification aur dispatch target successfully create ho chuke hain.

## 4. Mumbai support agent

- Support staff ID: `5`
- Username: `mumbai_support_agent`
- Email/login: `mumbai.agent@aarx.test`
- Password: `MumbaiSupport@2026`
- Employee ID: `MUM-AGENT-001`
- Role: Agent
- Department: Mumbai Operations
- Phone: `9000000003`
- All cities access: No
- Assigned cities: Mumbai only

Support web login page par email aur password use karo.

Expected access:

- Mumbai monitoring: Allowed
- Mumbai complaints/tickets/payments/refunds: Allowed
- Global platform tickets: Allowed
- Pune operational data: Denied
- Policy/staff administration: Agent role ke liye denied

## 5. Created end-to-end test request

- Prescription ID: `811`
- Type: Normal, text-only test request
- Medicine: `Paracetamol 500mg - TEST ONLY`
- Description: `[MUMBAI SETUP TEST] Normal medicine availability request`
- User coordinates: `19.1136, 72.8697` (Andheri)
- Assigned city: Mumbai (`4`)
- Dispatch status after test: Active
- Batch: 1

Created dispatch:

- Target row ID: `263`
- Store: Mumbai Test Pharmacy (`514`)
- Distance: approximately `7.32 km`
- Status: Notified
- Target city: Mumbai (`4`)
- In-app notification type: `NEW_PRESCRIPTION`

No Pune/default-area store was included in this dispatch.

## 6. Verified API behavior

Mumbai agent ke JWT se:

| Check | Result |
|---|---:|
| Permitted city list | 200, Mumbai only |
| Mumbai normal monitoring | 200, test dispatch visible |
| Mumbai complaints | 200 |
| Mumbai tickets | 200; global ticket also visible |
| Mumbai payments | 200 |
| Mumbai refunds | 200 |
| Pune monitoring access | 403 Forbidden |

## 7. Manual app test

### Store device

1. AARXUI store login kholo.
2. Mobile/email: `9000000002` / `mumbai.store@aarx.test`
3. Password: `MumbaiStore@2026`
4. Notification permission allow karo.
5. Backend store record mein real Expo push token register hua hai, verify karo.

### Customer device

1. Customer login:
   - Mobile: `9000000001`
   - Password: `MumbaiUser@2026`
2. Mumbai location confirm karo.
3. Normal prescription/medicine request upload karo.
4. Store device par immediate push aur store inbox entry verify karo.

### Support web

1. Login: `mumbai.agent@aarx.test`
2. Password: `MumbaiSupport@2026`
3. Navbar city selector mein sirf permitted Mumbai scope available hoga.
4. Emergency Monitoring → Normal requests kholo.
5. Store response, reminder and escalation live updates verify karo.
6. Pune URL/filter manually send karne par backend `403` return karega.

## 8. Important expected behavior

```text
Customer confirms Mumbai location
        ↓
Request city snapshot = Mumbai
        ↓
Only active/verified Mumbai stores ranked
        ↓
Mumbai store target + notification
        ↓
Mumbai support monitoring
        ↓
No response → normal reminder policy
        ↓
Still no response → Mumbai support escalation
```

## 9. Cleanup (only when test data is no longer needed)

Dependencies ki wajah se directly city delete karna recommended nahi hai. Pehle:

1. Prescription `811` close/delete karo.
2. Mumbai test customer/store records remove karo.
3. Mumbai support staff and auth user remove karo.
4. Mumbai-related complaints/tickets/payments/refunds verify karo.
5. Last mein Mumbai city delete karo.

Production Mumbai rollout ke liye test records remove karke real verified pharmacies,
real support staff accounts aur approved city boundary use karo.
