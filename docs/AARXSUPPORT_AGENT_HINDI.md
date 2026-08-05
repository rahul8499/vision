# AARX सपोर्ट वेब - सपोर्ट एजेंट गाइड (हिंदी)

यह गाइड AARX सपोर्ट वेब डैशबोर्ड के **सपोर्ट एजेंट** (Agent) रोल के लिए है।

---

## 1. Login करना

1. ब्राउज़र खोलें और AARX Support Web URL खोलें
2. अपना **email** और **password** डालें
3. "Login" पर click करें

> **नोट:** अगर password भूल गए → "Forgot Password" पर click → email आएगा → नई password सेट करें

---

## 2. डैशबोर्ड (Dashboard)

Login करने के बाद Dashboard खुलेगा। इसमें देख सकते हैं:

| Card | क्या है |
|------|--------|
| **Today's Tickets** | आज कितने नए टिकट मिले |
| **Pending Complaints** | कितने complaints अभी tak resolve नहीं हुए |
| **Avg Response Time** | आपका average reply time |
| **Resolved Today** | आज कितने टिकट resolve हुए |

### Recent Activity:
- नीचे scroll करके पिछले 24 घंटे की activity देख सकते हैं
- Click करके detail में जा सकते हैं

---

## 3. Support Tickets (सपोर्ट टिकट)

"Tickets" मेन्यू (बाएँ sidebar) पर click करें।

### Ticket List देखना:
- सारे open/pending टिकट यहाँ list होंगे
- Filters use कर सकते हैं:

| Filter | कब use करें |
|--------|------------|
| **Status** | Open / In Progress / Resolved / Closed |
| **Priority** | Low / Medium / High / Critical |
| **Category** | User App / Store / Payment / Delivery / Account |
| **Assigned** | Mere saabase assigned tickets |
| **Search** | Name, email, order ID से search |

### Ticket Detail खोलना:
1. Ticket name पर click करें
2. Full conversation (user + आपका reply) दिखेगा
3. Order details, user info, screenshots दिखेगा

### Ticket Reply करना (Step by Step):

#### Step 1: Ticket खोलें
- Ticket list से unresolved ticket select करें (सुझाव: priority कम highest/urgent पहले)

#### Step 2: Details check करें
- User का सवाल/समस्या पढ़ें
- Order ID, payment info, error screenshot देखें
- अगर ज़रूरत है → user lookup या order system में जाकर more context निकालें

#### Step 3: Reply लिखें
- नीचे "Reply" box में type करें
- Clear, simple भाषा में लिखें (Hindi/English)
- अगर steps बताने हैं → numbered list use करें
- Template se help ले सकते हैं

#### Step 4: Status update करें
| Action | कब use करें |
|--------|------------|
| **Send Reply** | जवाब भेज दिया → status "In Progress" रहेगा |
| **Resolve** | Problem solved → mark as "Resolved" |
| **Close** | Customer ne confirmation मिल गई → "Closed" |
| **Reopen** | अगर customer ने फिर से issue raise किया |

---

## 4. Common Ticket Templates

### Login/Signup Issue:
> "नमस्ते, आपका account verified करने में मदद चाहिए। कृपया अपना mobile number verify करें। अगर आपको OTP नहीं मिल रहा है, तो MSG91 की checking करें या 10 मिनट इंतज़ार करें।"

### Order Not Found:
> "आपका order abhi system में update हो रहा है। कृपया 5-10 मिनट इंतज़ार करें। अगर अभी भी दिखाई न दे तो order ID बताएं — हम manually check करेंगे।"

### Payment Failed:
> "Payment fail हो गई है। कृपया री-ट्राय करें या दूसरे payment method से try करें। अगर problem continue रहता है → screenshot भेजें।"

### Emergency Access:
> "Emergency broadcast के लिए first broadcast free है। अगर आपका previous emergency incomplete है, तो पहले उसे resolve करें।"

### App Crash:
> "आपका app crash कर रहा है। कृपया cache clear करें → app force close → latest version update करें। अगर problem बनी रहती है → device model और error message बताएं।"

---

## 5. Complaints (शिकायतें)

"Complaints" मेन्यू पर click करें।

### Complaint Types:
| Type | क्या मतलब |
|------|----------|
| **Filed by User** | User ने kisi store/delivery के khilaf complaint भेजा |
| **Against Store** | Store के khilaf official complaint आया |

### Complaint Handle करना:
1. Complaint list से "Open" complaints देखें
2. Priority (High/Critical) वाले पहले handle करें
3. Complaint detail खोलें → evidence, chat, proof images देखें
4. जरूरत अनुसार "Awaiting Info" mark करके user/store से जानकारी मांगें
5. Investigation complete → "Resolved" या escalate करें

---

## 6. User Lookup (यूज़र खोज)

> **Agent भी access कर सकते हैं अगर permission हो**

"User Lookup" मेन्यू पर click करें:

### Search कर सकते हैं:
- **Mobile number** (10-digit)
- **Email address**
- **Order ID**

### जब use करें:
- User का order history देखना हो
- User के साथ पिछले complaints देखना हो
- Suspicious user check करना हो

---

## 7. Emergency Requests (इमरजेंसी)

"Emergency Monitoring" मेन्यू पर click करें:

### जब check करें:
- Live emergency requests देखें
- अगर कोई request "stuck" है (ज्यादा देर हो गई है)
- Store को manually alert करना हो

### Actions (Agent level):
- Emergency request details देखें
- Store को reminder भेजें
- Agar needed → escalate to supervisor

---

## 8. Refunds (रिफंड)

"Refunds" मेन्यू पर click करें:

### जब handle करें:
- New refund request मिलता है → "Pending" status
- Details check karo → reason, amount, order
- Verify करें कि customer genuinely refund eligible hai
- Decision: **Approve** या **Reject**

### Refund States:
| State | क्या matlab |
|-------|------------|
| **Pending** | Aapka review का इंतज़ार |
| **Approved** | Refund initiate हो चुका |
| **Rejected** | Customer को reason बताया गया |
| **Processing** | Bank में transfer in progress |
| **Completed** | Refund complete हो गया |
| **Failed** | Refund fail हुआ → retry करें |

---

## 9. नोटिफ़िकेशन्स

### Header नोटिफ़िकेशन:
- नोटिफ़िकेशन bell आइकन — new tickets/complaints का count
- Click करके पूरा panel खुलेगा

### Notification Types:
| Type | क्या करें |
|------|---------|
| **New Ticket** | मौजूदा ticket list refresh karo, new assign हो सकता है |
| **Ticket Update** | Kisi customer ne reply किया → check karo |
| **Complaint Alert** | Urgent complaint → priority handle karo |
| **Emergency** | Live emergency → immediately check करें |
| **System Alert** | Server maintenance → users को inform करें |

---

## 10. Internal Notes कैसे जोड़ें

हर Ticket / Complaint / Order detail में:

1. नीचे "Add Internal Note" खंद पर click करें
2. Apni observation/कार्रवाई type करें
3. "Save" → यह note केवल staff (तुम और supervisor) को दिखेगा
4. User को नहीं दिखेगा

### Internal Notes कब जोड़ें:
- Ticket को resolve/assign करते समय
- Agar second opinion lena/poocha ho to
- Action लेते समय (refund initiate, store warn)
- जब कोई doubt हो — team consult करने के लिए note रख दें

---

## 11. Bulk Actions (एक साथ कई टिकट)

### कब use करें:
- बहुत सारे tickets एक ही category/issue वाले हैं
- Assignment या status update ek sath karna ho

### Steps:
1. Tickets list में checkboxes select karo
2. "Bulk Actions" dropdown खोलें
3. Action चुनें:
   - Assign to (specific agent)
   - Change Priority
   - Mark Resolved
   - Close Tickets
4. Confirm click करें

---

## 12. Agent के लिए Daily Checklist

### Morning Routine (शुक्रवार/Somvar/Pt):
1. **Login** → Dashboard खोलें
2. **Tickets** → High priority tickets assign/check karo
3. **Emergency** → कोई stuck emergency requests?
4. **Complaints** → Urgent complaints देखें
5. **Refunds** → Pending refunds review karo

### End of Day:
1. अपने assigned सभी tickets resolve/close karo
2. Internal notes update karo (क्या kiya, kya pending)
3. Unresolved tickets escalate to team lead
4. Logout करना मत भूलें

---

## 13. Communication Best Practices

### Reply करते समय याद रखें:
✅ **Hindi ya English** dono ok hai — जैसे customer ने पूछा
✅ Clear steps दें (numbered list use karo)
✅ जानकारी verify करके बताएं
✅ Templates use कर सकते हैं (जल्दी है)
✅ Agra apologizeकरें अगर app/company की mistake हो

❌ Customer को blame mat karo
❌ Technical jargon mat likho (simple words use karo)
❌ Kisi bhi reply se pehle verify mat karna — poocho to achha
❌ Internal notes public nahi hai isliye unhein customer message mein mat daalna

---

## 14. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Global search |
| `Ctrl/Cmd + T` | New ticket जोड़ें (अगर assign कर सकते हैं) |
| `Ctrl/Cmd + N` | New internal note |
| `Ctrl/Cmd + S` | Save current form |
| `Esc` | Modal बंद करें |
| `Ctrl/Cmd + Shift + U` | User lookup खोलें |

---

## 15. Agar Kuch Problem Ho To?

| Problem | Kya karein |
|---------|-----------|
| **Login नहीं हो रहा** | Password reset → agar fir bhi nahi → IT team se contact |
| **Ticket assign नहीं ho raha** | Team lead ko batao |
| **Customer abusive hai** | Ticket escalate करके "Harassment" tag lagao |
| **Knowledge नहीं है** | Internal notes/search/docs check karo → agar nahi pata → supervisor se pucho |
| **System slow/hang** | Refresh karo, agar problem banti → IT support ko report karo |

---
*यह गाइड AARX सपोर्ट वेब डैशबोर्ड के सपोर्ट एजेंट रोल के लिए है। Admin या Supervisor के लिए अलग गाइड है।*
