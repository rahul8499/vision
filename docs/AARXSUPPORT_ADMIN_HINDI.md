# AARX सपोर्ट वेब - एडमिन गाइड (हिंदी)

यह गाइड AARX सपोर्ट वेब डैशबोर्ड के **एडमिन** रोल के लिए है।

---

## 1. Login करना

1. ब्राउज़र खोलें और AARX Support Web URL खोलें
2. Email और Password डालें
3. "Login" पर click करें

> **नोट:** अगर password भूल गए → "Forgot Password" पर click → email आएगा → नई password सेट करें

---

## 2. डैशबोर्ड (Dashboard)

Login करने के बाद सबसे पहले Dashboard खुलेगा।

### क्या दिखेगा:
| Section | क्या है |
|---------|---------|
| **Overview Cards** | आज के orders, revenue, users, stores की तस्वीर |
| **Trend Charts** | हफ्ते/महीने का performance trend |
| **Recent Activity** | Latest orders, complaints, tickets |
| **Emergency Alerts** | Active emergency requests (live) |

### Filters:
- Date range (Today, 7 Days, 30 Days, Custom)
- Location-wise breakup
- Service-wise stats

---

## 3. Operations (ऑपरेशन्स)

"Operations" मेन्यू पर click करें:

### क्या कर सकते हैं एडमिन:
| Feature | क्या काम आता है |
|---------|----------------|
| **Real-time Orders** | Live orders देख सकते हैं कि कहाँ पहुंचे |
| **Order Assignment** | Orders को specific stores पर assign kar sakte hain |
| **Status Override** | अगर order stuck है तो manually status change kar sakte hain |
| **Dispatch Control** | Emergency या normal orders का dispatch manage karo |
| **Inventory Sync** | Store की stock real-time sync karo |
| **Bulk Actions** | Multiple orders select → bulk assign/cancel/update |

### Order Operations:
- Order पर click → full detail खुलेगा
- Status बदलें: New → Billing → Packed → Ready → Delivery → Completed
- Internal note जोड़ें (visible only to staff)
- Customer को message भेजें

---

## 4. Admin Monitoring (एडमिन मॉनिटरिंग)

> **केवल एडमिन ही एक्सेस कर सकते हैं**

"Admin Monitoring" पर click करें:

### Features:
| Feature | क्या करता है |
|---------|-------------|
| **System Health** | Django, Celery, Redis, Nginx server का status |
| **Error Rates** | API errors का % display होता है |
| **Slow Queries** | जो database queries ज़्यादा देर ले रहे हैं |
| **Worker Status** | Celery workers active/ offline दिखाएगा |
| **Queue Length** | Background tasks कितनी pending हैं |
| **Alerts** | अगर कोई server issue हो तो alert मिलेगा |

### कब use करें:
- अगर app slow लग रहा है
- Orders stuck हैं
- Server errors ज्यादा हो रहे हैं

---

## 5. Emergency Monitoring (इमरजेंसी मॉनिटरिंग)

"Emergency Monitoring" पर click करें:

### क्या दिखेगा:
- सारे live emergency requests
- कितनी stores respond kiye
- Quote receiving status
- Delivery tracking

### Actions:
- Emergency request pause कर सकते हैं (अगर spam/misuse)
- Store blacklist कर सकते हैं (जो consistently respond nahi karte)
- Manual dispatch assign kar sakte hain
- Emergency broadcast fee manage kar sakte hain

---

## 6. Complaints (शिकायतें)

"Complaints" মেন्यू पर click करें:

### दो प्रकार:
| Type | कब आता है |
|------|-----------|
| **Filed by User** | User ने store या delivery के khilaf complaint किया |
| **Against Store** | Store के khilaf official complaint |

### क्या कर सकते हैं:
- Complaint देखें → status update करें (Open, In Review, Resolved, Escalated)
- Internal notes जोड़ें
- Evidence (photos, chat) देखें
- Refund initiate करें (अगर applicable हो)
- Escalate करें (जैसे legal team या police को)
- किसी दूसरे agent को assign करें

### Complaint Resolution Steps:
1. Complaint खोलें
2. User chat history देखें
3. Store की response check karo
4. Evidence/photos verify karo
5. Decision लेें (refund, penalty, warning, escalate)
6. Status update करके close karo

---

## 7. Support Tickets (सपोर्ट टिकट)

"Tickets" मेन्यू पर click करें:

### Ticket Types:
| Type | कब raise होता है |
|------|-----------------|
| **User App Issue** | App crash, login problem, feature broken |
| **Store Issue** | Store dashboard, API, inventory problem |
| **Payment Issue** | Payment failed, refund stuck |
| **Delivery Issue** | Delivery delayed, partner problem |
| **Account Issue** | Profile update, verification |

### Ticket Management:
- Priority set karo (Low, Medium, High, Critical)
- Status update karo (Open, In Progress, Awaiting Reply, Resolved, Closed)
- Customer को reply दें (template use कर सकते हैं)
- Internal notes जोड़ें
- Escalation की ज़रूरत हो तो escalate करें
- Ticket close करें (अंतिम resolution के साथ)

### Reply करते समय:
- Professional tone रखें
- Clear steps दें
- Agra template use karo (अकेले reply न लिखें)

---

## 8. Payments (पेमेंट)

"Payments" मेन्यू पर click करें:

### क्या दिखेगा:
- सारे transactions की list
- Payment status (Success, Failed, Pending, Refunded)
- Date, amount, method (Razorpay, Cash, etc.)
- Related order ID

### Filters:
- Date range
- Status (success/failure)
- Payment method
- Store/User specific

### Actions:
- Payment detail देखें
- Refund initiate करें
- Failed payments retry/send to customer

---

## 9. Refunds (रिफंड)

"Refunds" मेन्यू पर click करें:

### Refund Process:
1. Refund request मिलता है → status "Pending"
2. Details check karo (order, amount, reason)
3. Verify करें कि customer genuinely refund eligible hai
4. "Approve" या "Reject" decision दें
5. Agar approve → refund initiate करें Razorpay या original method पर
6. Status update होगा automatically

### Refund States:
| State | क्या matlab |
|-------|------------|
| **Pending** | Review का इंतज़ार |
| **Approved** | Refund confirmed, processing |
| **Rejected** | Customer को reason बताएं |
| **Processing** | Bank/money transfer in progress |
| **Completed** | Money vapis गया |
| **Failed** | Refund fail हुआ, retry करें |

---

## 10. Safety Reports (सुरक्षा रिपोर्टें)

"Safety Reports" मेन्यू पर click करें:

### क्या है:
- User या store ने medicine safety related report किया है
- Fake/spurious medicine complaints
- Side effects reports
- Packaging issues

### Actions:
- Report verify karo
- Agar serious है → immediate escalation to medical team/pharmacovigilance
- Store को warning/penalty दें
- Medicine को blacklist करें
- Status update karo (Under Review, Verified, Action Taken, Closed)

---

## 11. User Lookup (यूज़र खोज)

> **केवल Supervisor और Admin**

"User Lookup" मेन्यू पर click करें:

### क्या search कर सकते हैं:
- Mobile number
- Email address
- Order history
- Complaint history
- Chat history
- Profile details

### कब use करें:
- जब customer support को user का full history देखना हो
- Complaint verify करने के लिए
- Suspicious activity check करने के लिए

---

## 12. Store Lookup (स्टोर खोज)

> **केवल Supervisor और Admin**

"Store Lookup" मेन्यू पर click करें:

### क्या देख सकते हैं:
- Store name
- Owner details
- Registration info
- License documents
- Order performance
- Ratings/reviews
- Complaint history
- Emergency response stats

### Actions:
- Store temporarily block/unblock कर सकते हैं
- Rating adjust कर सकते हैं
- Verification documents approve/reject कर सकते हैं
- Penalty/notice जारी कर सकते हैं

---

## 13. Staff Management (स्टाफ प्रबंधन)

> **केवल एडमिन**

"Staff" मेन्यू पर click करें:

### Features:
- नए staff member जोड़ें (name, email, role, password)
- Existing staff की details edit करें
- Role change करें (Agent, Supervisor, Admin)
- Staff को deactive करें (जब कोई निकल जाए)
- Performance देखें (tickets resolved, response time)

### Roles:
| Role | Permissions |
|------|------------|
| **Admin** | सब कुछ — full access |
| **Supervisor** | Tickets, complaints, store/user lookup, staff |
| **Agent** | Tickets, complaints — day-to-day support |

---

## 14. Audit Logs (ऑडिट लॉग)

> **केवल Supervisor और Admin**

"Audit Logs" पर click करें:

### क्या दिखेगा:
- हर action का log (who did what, when)
- कौन login किया, क्या modify किया
- Sensitive actions (refund approve, store block) का record

### कब use करें:
- Internal audit के लिए
- Grievance investigation के लिए
- Suspicious activity track करने के लिए

---

## 15. Activity Logs (एक्टिविटी लॉग)

> **केवल Supervisor और Admin**

"Activity Logs" पर click करें:

### क्या दिखेगा:
- App usage stats
- Login/logout times
- Feature usage
- Error/failure logs
- System events

---

## 16. Settings (सेटिंग्स)

"Settings" मेन्यू पर click करें:

### Sections:
| Section | क्या set कर सकते हैं |
|---------|---------------------|
| **General** | App name, logo, contact info |
| **Email/SMS** | Notification templates, sender config |
| **Payments** | Razorpay keys, payment methods, fees |
| **Roles & Permissions** | Custom role create/edit करें |
| **System** | Maintenance mode ON/OFF, rate limits |
| **Integrations** | Third-party service configs |

### Maintenance Mode:
- अगर server maintenance चल रहा है
- ON कर दें → users को maintenance message दिखेगा
- OFF कर दें जब repair complete हो

---

## 17. नॉटिफ़िकेशन्स

### Header में:
- Notification bell आइकन — unread notifications count दिखाता है
- Click करके पूरा notification panel खुलता है
- Notification clear/mark-as-read कर सकते हैं

### Notification Types:
- **New Ticket** — नई support ticket मिली
- **Complaint Update** — complaint में update आया
- **System Alert** — server issue, downtime
- **Refund Request** — new refund pending
- **Emergency** — live emergency request

---

## 18. एडमिन के लिए Important Tips

### Daily Routine:
1. **Dashboard** खोलें → कोई emergency/alert तो नहीं
2. **Emergency Monitoring** → जल्दी respond वाले stores की जाँच
3. **Tickets** → pending tickets assign/karo
4. **Complaints** → urgent complaints review karo
5. **Payments/Refunds** → कोई disputed refunds न हों
6. **Admin Monitoring** → server health ठीक है या नहीं check karo

### Escalation Guidelines:
| Issue Type | जब escalate करें | किसे escalate करें |
|------------|----------------|-------------------|
| **Legal/Police** | Crime, fraud, fake medicine | Legal team या authorities |
| **Medical Emergency** | Life-threatening medicine issue | Medical team / pharmacovigilance |
| **Data Breach** | User data leak suspected | Security team + legal |
| **System Outage** | Server down, app not working | DevOps team |
| **Payment Dispute** | High-value, bank involves | Finance team |

### Best Practices:
- हमेशा internal notes उपयोग करें (ग्राहक को न दिखे)
- Customer को professional tone में reply दें
- Screenshots/template use करें
- Kisi भी action से पहले second confirmation लें
- Log out जब कोई दूसरा उपयोगकर्ता है

---

## 19. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Global search (यूज़र/स्टोर/टिकट) |
| `Ctrl/Cmd + 1` | Dashboard |
| `Ctrl/Cmd + 2` | Operations |
| `Ctrl/Cmd + 3` | Emergency Monitoring |
| `Ctrl/Cmd + 4` | Complaints |
| `Ctrl/Cmd + 5` | Support Tickets |
| `Ctrl/Cmd + Shift + N` | नई notification check करें |
| `Esc` | Modal/popup बंद करें |

---
*यह गाइड AARX सपोर्ट वेब डैशबोर्ड के एडमिन रोल के लिए है। Agent या Supervisor के लिए अलग गाइड है।*
