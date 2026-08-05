# AARX मोबाइल ऐप - सेलर/फार्मेसी गाइड (हिंदी)

यह गाइड AARX ऐप के **Store/Pharmacy** (seller) यूज़र के लिए है।

---

## 1. Login करना

### Store के तौर पर login:
1. App खोलें
2. अपना **10-digit mobile number** डालें
3. OTP receive करें (MSG91 SMS)
4. OTP verify करें
5. अगर first time है तो **onboarding** complete करना पड़ेगा

### Onboarding Steps (Store):
- Step 1: Store name, address, mobile enter karo
- Step 2: License/distributor details upload karo
- Step 3: Timings set karo (कब open रहता है)
- Step 4: Complete हो जाएगा

> अगर `Needs Onboarding` मैसेज आए तो पूरा करना ज़रूरी है। नहीं तो store active नहीं रहेगा।

---

## 2. Dashboard (Home Screen - Seller)

Seller home screen 5 sections show karta hai:

### A. Store Status Toggle
- **Open/Close switch** है - जब आप busy/बंद हैं तो बंद कर दें
- Customers को real-time पता चल जाता है

### B. Today's Summary Cards
| Card | Kya dikhata hai |
|------|-----------------|
| **Orders** | आज कितने orders मिले |
| **Revenue** | आज का total revenue |
| **Completed** | आज complete हुए orders |
| **Cancelled** | आज कैंसिल हुए orders |

### C. Work Pulse (Workload Tiles)
| Tile | Kya matlab hai | Action |
|------|--------------|--------|
| **New** | नए prescription quotes (जितने आपको मिले) | Click → Active Orders |
| **Billing** | जो order billing का चरण में है | Click → Process |
| **Packed** | जो तैयार (pack कर चुके) | Click → Ready |
| **Ready** | Pickup/delivery के लिए तैयार | Click → Handover |
| **Delivery** | Delivery process हो रहा है | Click → Track |

### D. Replacement Requests
- Click → Replacement requests manage karo
- Customer ने wrong medicine दिया ho ya damage हो तो

### E. Emergency Rewards
- Click → Emergency performance देखो
- अगर आप emergency requests में जल्दी respond करोगे तो points मिलेंगे

---

## 3. Enquiries (New Requests)

"Enquiries" टैब (पहला آइकन) पर click करें:

- नए prescription requests यहाँ आएंगे
- हर request में:
  - User का name, location, distance
  - Prescription image (अगर uploaded है)
  - Medicines list with required quantities
  - Emergency flag (अगर emergency है)

### Quote भेजना:
1. Enquiry खोलें
2. Stock check karo —क्या सभी medicines available हैं?
3. Pricing enter karo (per medicine)
4. Total calculate hoga automatically
5. Pharmacy note (optional) — special instructions
6. "Send Quote" button दबाएं

> **Stock Refresh:** अगर stock नहीं है, तो "Refresh Request" send कर सकते हैं। User 10 मिनट में refresh करेगा।

---

## 4. Active Orders

"Active Orders" टैब दूसरा आइकन) पर click करें:

### Order Lifecycle (क्या क्रम में चलेगा?):

```
New → Billing → Packed → Ready → Out for Delivery → Completed
                                  (या Cancelled)
```

### हर stage पर क्या करना चाहिए?

| Stage | Kya kare? |
|-------|-----------|
| **New (Quotation Accepted)** | Order accept hua. अब billing shuru karo. |
| **Billing** | Invoice banao. Medicine count verify karo. |
| **Packed** | सारे medicines pack karo. Quality check karo. |
| **Ready** | Customer/store के सामने रख दो (walk-in) या delivery के liye tayyar karo |
| **Out for Delivery** | Delivery partner assigned. अगर home delivery है |
| **Completed** | OTP verify करके complete karo |

### Order Accept करना:
1. Active Orders खोलें
2. New order पर click करें
3. Confirm करें कि आप fulfil kar sakte ho
4. Status update → Billing

### Order Complete करना:
1. Medicine deliver हो गई हो या pickup हो गई हो
2. Customer ने OTP दिया → verify कर ले
3. Status → "Completed"

> **Important:** Completion OTP का wait time 10 मिनट होता है। OTP न मिलने पर customer से पूछें।

---

## 5. Billing / Payments

"Billing" टैब पर click करें:

### दिखेगा क्या:
- Daily revenue
- Completed orders count
- Pending payments
- Emergency rewards earned

### Revenue Details:
- Date-wise breakdown
- Cash vs digital payments
- Refund history (agra)

---

## 6. History (Past Orders)

"History" टैब (तीसरा आइकन) पर click करें:

- Past orders की full list
- Date filter (today, 7 days, 30 days, custom)
- Status-wise filter (completed, cancelled, delivered)
- Order details click करके देख सकते हैं

---

## 7. Inbox (Messages)

"Inbox" टैब (चैट आइकन) पर click करें:

- Customer से messages मिलते रहेंगे
- हर order के साथ अलग chat thread
- Real-time notifications

### Message भेजना:
1. Chat खोलें
2. नीचे message type करें
3. Send करें

### Common Messages:
- "Medicine तैयार है, कृपया आएं"
- "Kuchh medicine unavailable है, substitute भेज रहा हूँ"
- "Delivery starting हो रहा है"

---

## 8. Pharmacist Consultations

"Pharmacist" सेक्शन में click करें:

### क्या है:
- कभी कभी customer या user pharmacist से पूछते हैं
- Pharmacy ke through pharmacist consultation hota hai
- आप apne pharmacist ko assign ya manage karo sakte hain

### Features:
- Consultation requests देखें
- Availability set करें
- Messages respond karo

---

## 9. Replacements

"Replacements" टैब पर click करें:

### Kya hota hai:
- Customer ने galat medicine मिली या damaged है
- Customer replacement request भेजता है
- आप approve/reject कर सकते हैं

### Actions:
| Action | Kya kare |
|--------|----------|
| **Approve** | Nayi medicine दें, status update करें |
| **Reject** | Reason दें क्यों reject कर रहे हैं |
| **In Transit** | जब replacement delivery शुरू हो |
| **Complete** | जब replacement complete हो |

---

## 10. Emergency Rewards

"Emergency Rewards" टैब पर click करें:

### क्या देख सकते हैं:
- Emergency points (kitna earned hai)
- Fast responder badges
- Gold status (agar achieve kiya ho)
- Emergency performance stats

### Points कैसे मिलते हैं:
- Emergency quotes fast respond करने पर
- Emergency requests complete करने पर
- High rating emergency orders पर

---

## 11. Support / Platform-Support

### Store के liye Support:
1. "Support" टैब पर click करें
2. "Raise Ticket" पर click करें
3. Issue category select:
   - **Pharmacy Technical** - app/inventory issues
   - **Billing Question** - payment related
   - **Delivery Issue** - delivery partner problems
   - **Account Issue** - profile/store details

### Filed/against tickets:
- "Filed by me" - आपके द्वारा raise किए गए
- "Against me" - आपके pharmacy के khilaf complaints

---

## 12. Settings (Store)

"Settings" टैब (सबसे आखिरी) पर click करें:

| Setting | Kya kare |
|--------|---------|
| **Store Profile** | Name, address, mobile, timings update |
| **Availability** | Open/Closed toggle, holiday set karo |
| **Delivery Settings** | Home delivery available/not, pickup area |
| **Notification Settings** | Kis type ki notifications chahiye |
| **Delivery Persons** | Delivery person add/remove karo |
| **Legal Documents** | License, GST, etc. upload/renew |
| **Logout** | Account se bahar nikal jao |

### Delivery Person Management:
1. Settings → Delivery Persons
2. "+" button दबाकर नए delivery person add करें
3. Name, mobile, vehicle details enter करें

---

## 13. Order Status Guide (Complete Lifecycle)

```
Prescription Upload (User)
        ↓
Auto-dispatch to nearby stores
        ↓
Store sees in "Enquiries" tab
        ↓
Store sends quote
        ↓
User accepts quote
        ↓
Order appears in "Active Orders" as "New"
        ↓
Store: Billing → Packed → Ready
        ↓
Walk-in: Customer picks up
   OR
Home Delivery: Delivery → Out for Delivery → OTP → Completed
```

---

## 14. Store के Liye Important Tips

### Prescription Handling:
- Photo clear honi chahiye (AI scanning ke liye)
- Medicine availability check karo before quoting
- Agarmedicine nahi hai → stock refresh request send karo

### Emergency Requests:
- Emergency पहले show होते हैं (priority)
- जल्दी respond करने पर extra points मिलते हैं
- Customer को wait nahi karne dena

### Ratings:
- Har order ke baad customer rating deta hai
- Rating improve = better visibility in search
- Poor rating = kam orders milenge

### Cancellation:
- Customer order cancel kar sakta hai "Accepted" stage tak
- आप order cancel nahi kar sakte (backend enforced)
- Refund automatically ho jata hai

### Communication:
- Chat में real-time respond karo
- Delay = poor rating
- Apni language mein baat karo (Hindi/English)

---

## 15. Common Store Issues + Solutions

| Problem | Solution |
|---------|----------|
| **App में login नहीं हो रहा** | Credentials check karo, OTP नया request karo |
| **Enquiry नहीं आ रहा** | Store "Open" है या नहीं check karo, location correct hai kya? |
| **Quote भेजने में error** | Medicine pricing check karo, internet check karo |
| **Order status update नहीं ho raha** | App refresh karo, या logout-login karo |
| **Chat notification नहीं aata** | Notification permissions on karo |
| **Payment nahi dikh raha** | Billing tab refresh karo, bank details check karo |
| **Delivery partner assign नहीं ho raha** | Delivery settings check karo, delivery person add karo |

---

## 16. Emergency Rewards Program

### कैसे काम करता है:
- Emergency requests respond करने पर points मिलते हैं
- Points = reputation score
- ज्यादा points = better emergency priority

### Levels:
| Level | Points Required | Benefits |
|-------|-----------------|----------|
| **Bronze** | 0 | Basic emergency access |
| **Silver** | 50 | Priority in dispatch |
| **Gold** | 200 | Top priority, extra rewards |

### Points कब मिलते हैं:
- Emergency quote within 60 seconds → +5 points
- Emergency order complete → +10 points
- High rating → +2 points per order
- No response → -5 points

---

## 17. Contact Support (Seller)

अगर आपको store support chahiye:
1. App में → Support tab → "Raise Ticket"
2. Category: "Pharmacy Technical" select करें
3. Subject + detailed description likho
4. Submit करें

या emergency situations के liye 24x7 helpline app header में available hai।

---
*यह गाइड AARX मोबाइल ऐप के Store/Pharmacy seller के लिए है। User guide अलग फ़ाइल में है।*
