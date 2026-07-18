# AARX Request Monitoring and Multi-City Operations Guide

## 1. Is system ka purpose

Request Monitoring ka goal support team ko har prescription manually watch karwana nahi hai. System stores ko request bhejta hai, response track karta hai, automatic reminders bhejta hai aur sirf delayed cases support team ke attention mein lata hai.

Ye system do request types handle karta hai:

| Request type | First reminder | Second reminder | Support escalation |
|---|---:|---:|---:|
| Emergency | 1 minute | 2 minutes | 3 minutes |
| Normal | 3 minutes | 5 minutes | 7 minutes |

Timings dynamic hain. Support admin Monitoring page se global ya selected-city policy change kar sakta hai.

## 2. Complete request lifecycle

### 2.1 Initial dispatch

1. User normal ya emergency prescription request create karta hai.
2. Backend nearby eligible stores select karta hai.
3. Har selected store ke liye dispatch tracking record create hota hai.
4. Store ko WebSocket update, in-app notification aur available hone par push notification milti hai.
5. Monitoring timer dispatch ke `notified_at` time se start hota hai.

### 2.2 Store response milne par

Store quote/reject/dismiss response submit karta hai to:

- Dispatch `Responded` ho jata hai.
- `responded_at` save hota hai.
- Pending reminder tasks response dobara verify karke skip karte hain.
- Record active Awaiting list se remove hota hai.
- Record history/audit ke liye available rehta hai.

### 2.3 Store response nahi deta

Configured timings ke according:

1. First automatic reminder.
2. Second automatic reminder.
3. Support escalation.

Escalation automatic punishment, complaint, cancellation ya refund nahi hai. Iska matlab sirf support team ko actionable alert dena hai.

### 2.4 Request close hone par

Request complete, cancel ya dispatch-exhausted hone par:

- Active Monitoring se remove hoti hai.
- Pending reminders safely skip hote hain.
- Manual reminder allowed nahi hona chahiye.
- Record History mein final state ke saath available rehta hai.

## 3. Emergency Monitoring page overview

Sidebar mein `Emergency Monitoring` open karo. Page normal aur emergency dono prescription requests monitor karta hai.

### 3.1 Header

Header mein:

- Page title
- Short operational description
- City selector

City selector mein support staff ko sirf authorized cities dikhti hain. `All permitted cities` staff ki sab assigned cities ka combined data dikhata hai.

### 3.2 Summary cards

#### Awaiting

Active targeted stores jinhone abhi response nahi diya.

#### Responded

Targeted stores jinhone quote ya recognized response submit kiya.

#### Escalated

Response deadline cross hone ke baad support attention mein aaye unresolved dispatches.

#### Push unavailable

Targeted stores jinke paas usable Expo push token nahi hai. In stores ko in-app/WebSocket update mil sakti hai, lekin push delivery guaranteed nahi.

Summary cards selected request type, mode aur city scope ko represent karti hain.

## 4. Request-type tabs

### 4.1 Emergency requests

Emergency prescriptions ke store dispatches dikhata hai.

Default policy:

- First reminder: 60 seconds
- Second reminder: 120 seconds
- Escalation: 180 seconds

Emergency reminder stronger/urgent wording aur high-priority data use karta hai.

### 4.2 Normal requests

Normal prescription dispatches dikhata hai.

Default policy:

- First reminder: 180 seconds
- Second reminder: 300 seconds
- Escalation: 420 seconds

Normal reminder standard operational wording use karta hai.

## 5. Active Now aur History

### 5.1 Active Now

Sirf currently active prescription dispatches.

Daily support operations ke liye ye default view use karo. Historical records ko active queue mein mix nahi karna chahiye.

### 5.2 History

Non-active/closed dispatches.

Use cases:

- Past response verify karna
- Audit/investigation
- Store response pattern samajhna
- Closed request ka outcome check karna

History record par reminder bhejna generally required nahi hai.

## 6. State filters

### Awaiting

Store notified hai, lekin response pending hai.

### Escalated

Support escalation timestamp set hai aur response abhi pending hai.

### Responded

Store response submit kar chuka hai.

### All

Selected mode aur request type ke sab applicable records.

## 7. Search and filters

### 7.1 Search

Search field support karta hai:

- Store name
- Store mobile
- Prescription/request ID

Request ID number directly enter kar sakte ho.

### 7.2 Push filter

#### All push states

Push availability ke bina filtering.

#### Push available

Sirf stores jinke paas Expo push token hai.

#### No push token

Stores jinko support call/manual follow-up ki zarurat ho sakti hai.

### 7.3 Waiting-time filter

- Any waiting time
- Over 3 minutes
- Over 5 minutes
- Over 10 minutes

Waiting time `notified_at` se current time tak calculate hota hai.

### 7.4 City filter

Selected city ke records. Access backend par enforce hota hai; frontend filter security boundary nahi hai.

### 7.5 Server-side pagination

Default page size 20 records hai. Backend sirf requested page return karta hai, isliye hundreds/thousands of records browser mein ek saath load nahi hote.

Priority order:

1. Escalated emergency
2. Other emergency awaiting
3. Escalated normal
4. Longest-waiting records

## 8. Table columns

### Store

Store name aur assigned city/service zone.

### Request

Prescription ID aur `EMERGENCY`/`NORMAL` type.

### Distance

User request aur store ke beech calculated distance.

### Waiting

Store ko request bhejne ke baad elapsed duration. Escalated waiting red/highlighted ho sakti hai.

### Engagement

#### Opened

Store ne request UI open ki.

#### Not opened

Request dispatch hui, lekin open evidence nahi mila.

#### Push ready

Store ke paas push token hai.

#### No push

Push token missing hai.

### Reminders

Automatic aur manual reminders separately:

```text
2 auto · 1 manual
```

`Suppressed` label ka matlab future automatic/manual reminders intentionally stop kiye gaye hain.

### Contact

Store mobile link. Supported device/browser par click karne se call application open ho sakti hai.

## 9. Every action button

### 9.1 Remind

Store ko manual reminder queue karta hai.

Before sending, backend dobara verify karta hai:

- Store already responded to nahi
- Request active hai
- Request cancelled/closed/exhausted nahi
- Reminders suppressed nahi
- Manual cooldown complete hai
- Store ka daily manual-reminder limit complete nahi hua
- Support staff ko city access hai

Successful reminder:

- Push available ho to push
- In-app notification
- Manual reminder count update
- Last manual reminder time update
- Support audit log

### 9.2 Cooldown countdown

Manual reminder bhejne ke baad button temporarily disabled hota hai aur remaining seconds show kar sakta hai.

Default cooldown: 120 seconds.

Purpose:

- Double click se duplicate push rokna
- Multiple agents ke simultaneous reminders control karna
- Store notification spam prevent karna

Cooldown backend par bhi enforce hota hai; page refresh/API direct call se bypass nahi ho sakta.

### 9.3 Contacted

Support agent store ko call/contact karne ke baad `Contacted` click karta hai.

System:

- Contact timestamp save karta hai
- Acting support staff ID save karta hai
- Audit log create karta hai

Button call khud initiate nahi karta; phone link call initiate karta hai. `Contacted` operational evidence record karta hai.

### 9.4 Suppress

Selected dispatch ke future reminders stop karta hai.

Use cases:

- Store temporarily unavailable hai
- Store ne phone par confirm kiya ki request fulfil nahi kar sakta
- Push issue investigation chal rahi hai
- Repeated reminder inappropriate hai

Suppress ke baad:

- Automatic reminders skip
- Manual reminders block
- Record monitoring mein visible rehta hai
- Suppression timestamp/staff ID save hota hai
- Audit log create hota hai

Suppress store account ko block nahi karta. Ye sirf ek specific request-store dispatch ke reminders stop karta hai.

### 9.5 Resume

Previously suppressed dispatch ke reminders allow karta hai.

Resume ke baad:

- Manual reminder dobara possible ho sakta hai
- Future scheduled automatic task agar abhi pending hai to current state/policy ke according run kar sakta hai
- Existing missed reminder automatically replay hona guaranteed nahi
- Audit log create hota hai

Resume tab use karo jab suppression ka reason resolve ho gaya ho aur request abhi active ho.

## 10. Automatic versus manual reminders

### Automatic reminder

System policy timing ke according Celery task bhejta hai.

Maximum default automatic reminders: 2.

### Manual reminder

Support agent Remind button se bhejta hai.

Safeguards:

- Default cooldown: 120 seconds
- Default daily limit per store: 10
- Response/closed/suppression guards
- City permission check
- Audit log

Automatic aur manual counts separate rakhe jate hain.

## 11. Support escalation

Escalation ke baad:

- Correct city support staff ko notification
- Record `Escalated` filter mein
- Store/request/timing evidence visible

Support team actions:

1. Engagement check karo.
2. Push unavailable ho to call karo.
3. Appropriate ho to manual reminder.
4. Call ke baad Contacted mark karo.
5. Store unavailable ho to Suppress.
6. Other stores ke responses monitor karo.
7. Emergency mein eventual refund flow separately monitor karo.

Escalation store ko automatically penalize nahi karti.

## 12. Response Policy section

Current selected request type ki effective policy dikhata hai.

### First reminder

Initial dispatch ke kitne seconds baad first automatic reminder.

### Second reminder

Initial dispatch ke kitne seconds baad second automatic reminder.

### Support escalation

Initial dispatch ke kitne seconds baad support attention.

### Maximum reminders

Automatic reminders ki maximum count.

### Manual cooldown

Do manual reminders ke beech minimum interval.

### Manual daily limit/store

Ek store ko ek din mein support kitne manual reminders bhej sakta hai.

### Automatic store reminders checkbox

Automatic reminder scheduling enable/disable.

### Support escalation checkbox

Automatic support escalation enable/disable.

### Save Policy

Selected scope ki policy save karta hai.

Validation:

- Timing minimum 30 seconds
- Second reminder first se later
- Escalation second reminder se pehle nahi
- Daily manual limit at least 1

New policy naye dispatch snapshots par apply hoti hai. Already-running dispatch apna saved policy snapshot use karta hai.

## 13. Multi-city models

### 13.1 City

High-level operational city/service market.

Examples:

- Pune
- Mumbai
- Nagpur

City use:

- Correct stores target karna
- Support data access scope
- City-wise monitoring
- City policy override
- Reporting

### 13.2 Service Zone

City ka smaller operational area.

Example:

```text
Pune
├── Wakad
├── Baner
├── Kothrud
└── Hadapsar
```

Zone use:

- Large city ko smaller coverage areas mein manage karna
- More precise monitoring
- Future zone-specific response policy
- Store/request assignment

Service zones optional hain.

### 13.3 City Emergency Policy

Global policy ka city/zone override.

Despite legacy name, policy emergency aur normal request timings dono store kar sakti hai.

Inheritance:

```text
Global default
    ↓
City override
    ↓
Service-zone override
```

Override missing ho to parent/global value use hoti hai.

### 13.4 Support Staff City Access

Support staff ko authorized city scope deta hai.

Example:

```text
Pune Agent → Pune
Mumbai Agent → Mumbai
Regional Supervisor → Pune + Mumbai
National Admin → All cities
```

Security backend par enforce hoti hai.

## 14. Default Service Area

Fresh installation par system automatically:

- `Default Service Area` create karta hai
- Stores assign karta hai
- Prescriptions assign karta hai
- Dispatches assign karta hai
- Emergency charges assign karta hai

Single-city launch ke liye manual GIS configuration mandatory nahi.

Global policies immediately work karti hain.

## 15. Future mein second city add karna

Example: application currently default/Pune operation mein hai aur Mumbai launch karna hai.

### Step 1: City create

Django Admin:

```text
Emergency Broadcast Services → Cities → Add
```

Fill:

- Name: Mumbai
- State: Maharashtra
- Timezone: Asia/Kolkata
- Active: Yes
- Default: No
- Boundary mode: Automatic radius
- Center latitude: Mumbai center, for example `19.0760`
- Center longitude: Mumbai center, for example `72.8777`
- Service radius: for example `40 km`

Save karne par system circular geographic boundary automatically generate karta hai. Map par polygon manually draw karna required nahi.

Manual polygon sirf advanced case ke liye hai:

1. Boundary mode ko `Advanced manual polygon` karo.
2. `Advanced manual boundary` section expand karo.
3. Custom shape draw karo.

Generated ya manual boundary save hone par matching existing location records automatically re-scope hote hain.

### Step 2: Optional service zones

Create:

- Andheri
- Bandra
- Borivali
- Powai

Har zone ko Mumbai city aur correct boundary assign karo.

Simple zone setup:

- Boundary mode: Automatic radius
- Zone center latitude/longitude
- Radius: normally `3–7 km`

Save karne par zone boundary bhi automatically generate hoti hai.

### Service radius ka meaning

`Service radius` center location se kitne kilometer ke around automatic circular boundary banani hai, ye define karta hai.

Example:

```text
Zone: Wakad
Center latitude: 18.5975
Center longitude: 73.7898
Service radius: 5 km
```

System Wakad center ke around approximately 5 km ka service-zone boundary generate karega.

Service radius use:

- Store kis zone mein located hai, ye identify karna
- User request ka service zone identify karna
- Support Monitoring mein exact city/zone dikhana
- Future zone-specific response policy apply karna
- Area-wise response performance calculate karna

Recommended starting values:

| Area type | Suggested radius |
|---|---:|
| Small locality | 2–3 km |
| Normal service zone | 5 km |
| Large zone | 7–10 km |
| Complete city | 30–50 km |

Important: service-zone radius store dispatch ki final maximum distance nahi hai. Current dispatch engine actual user-store distance aur expansion batches use karta hai. Zarurat par request adjacent/nearby zones ke eligible stores tak expand ho sakti hai.

Single-city setup mein service zones optional hain. Sirf city center aur approximately 30–40 km city radius configure karna enough ho sakta hai.

### Step 3: Support staff access

Django Admin:

```text
Support Admin → Support Staff
```

Mumbai agents:

- `All cities access`: Off
- Cities: Mumbai

National admin:

- `All cities access`: On

### Step 4: Optional Mumbai policy

Support Monitoring:

1. City selector: Mumbai
2. Emergency ya Normal tab
3. Timings set
4. Save Policy

City override nahi doge to global defaults automatically work karenge.

### Step 5: Verify

- Test user location Mumbai
- Nearby Mumbai stores
- Monitoring city filter
- Store notification
- Reminder timing
- Support escalation recipients

## 16. What is automatic and what is manual

### Automatic

- Default service area creation
- Unmatched/new records ka default assignment
- Boundary save hone par matching records ka re-scope
- Store dispatch tracking
- Automatic reminders
- Response guards
- Support escalation
- Cooldown/daily-limit enforcement
- Audit timestamps

### Manual only when needed

- Real second city create karna
- Accurate city boundary draw/import
- Optional zones create karna
- City-specific support staff assignment
- Optional city-specific timing override
- Support call/contact decision
- Suppress/Resume decision

## 17. Important safeguards

- Store response send se immediately pehle verify hota hai.
- Closed/cancelled/exhausted request reminder block karti hai.
- Suppressed dispatch reminder block karta hai.
- Automatic reminder maximum enforced hai.
- Manual cooldown backend-enforced hai.
- Daily manual limit backend-enforced hai.
- City permission backend-enforced hai.
- Actions audit logged hain.
- Policy snapshot running request ko later config changes se protect karta hai.
- Push missing/error monitoring mein visible hota hai.
- Pagination large datasets protect karti hai.

## 18. Recommended support SOP

### Emergency

1. Escalated emergency first.
2. Not-opened/push-unavailable stores inspect.
3. Call store.
4. Contacted mark.
5. Appropriate ho to one manual reminder.
6. Store unavailable ho to Suppress.
7. Other store quotes and refund outcome monitor.

### Normal

1. Longest waiting first.
2. Reminder count check.
3. Repeated push avoid.
4. Contact needed ho to call.
5. Contacted mark.
6. Unavailable store dispatch suppress.

## 19. Common questions

### Suppress karne se store block hota hai?

Nahi. Sirf selected request-store dispatch ke reminders stop hote hain.

### Resume missed reminders immediately bhejta hai?

Nahi. Resume reminder permission restore karta hai. Manual reminder separately bhej sakte ho; future scheduled task current state check karega.

### Remind button ko repeatedly click kar sakte hain?

Nahi. Cooldown, daily limit aur backend locking protect karte hain.

### Response ke baad reminder jayega?

Nahi. Task response existence dobara verify karta hai.

### City configure nahi ki to app rukegi?

Nahi. Default Service Area automatically use hota hai.

### New city add karne ke baad code change chahiye?

Nahi. City/boundary/access/policy configuration enough hai.

### Policy change current running request ko badlegi?

Nahi. Existing dispatch saved snapshot use karta hai. New dispatch new policy use karega.

## 20. Operational meaning summary

```text
Request created
    ↓
Nearby eligible stores targeted
    ↓
Notification + dispatch evidence
    ↓
No response
    ↓
Automatic reminders
    ↓
Still no response
    ↓
Correct city support escalation
    ↓
Call / manual reminder / contacted / suppress
    ↓
Store responds OR request closes
    ↓
History and audit retained
```
