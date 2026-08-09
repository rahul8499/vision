import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';

type Role = 'user' | 'store';
type DocumentKey = 'privacy' | 'terms' | 'cancellation' | 'delivery' | 'medicine-safety' | 'about';
type Section = { title: string; paragraphs?: string[]; bullets?: string[] };
type LegalDocument = { title: string; eyebrow: string; summary: string; icon: string; sections: Section[] };

const SUPPORT_EMAIL = 'support@aarx.in';
const SUPPORT_PHONE = '+91 77962 16506';
const EFFECTIVE_DATE = '17 July 2026';

const commonPrivacy: Section[] = [
  { title: 'Information we collect', bullets: [
    'Account information such as name, mobile number, email, address, pincode and authentication records.',
    'Prescription images, requested medicines, order details, quotations, invoices, replacement proof and pharmacist-consultation messages. These may contain health-related information.',
    'Location and delivery information when you permit location access or provide an address.',
    'Chats, complaints, support requests, ratings, call-back preferences and files you choose to upload.',
    'Device, app version, notification token, IP address, logs, security events and usage diagnostics.',
  ]},
  { title: 'Why we use information', bullets: [
    'To create and secure accounts, connect customers with pharmacies, process orders, delivery, replacements and support.',
    'To show relevant nearby stores, send transactional notifications and maintain order and complaint records.',
    'To prevent fraud, misuse and unsafe activity, comply with lawful requests, resolve disputes and improve reliability.',
    'We do not sell personal or prescription information. We do not use prescription content for unrelated advertising.',
  ]},
  { title: 'Who receives information', paragraphs: [
    'We share only what is reasonably needed with the selected pharmacy, assigned delivery personnel, payment and cloud providers, communication providers, professional advisers and authorities where required by law. A delivery person should receive delivery details, not unnecessary clinical information. Independent pharmacies and payment providers may have their own legal obligations and privacy practices.',
  ]},
  { title: 'Storage, retention and security', paragraphs: [
    'We use access controls, encrypted transport and operational safeguards. No digital system is completely secure. Records are kept only as long as needed for service, safety, disputes, accounting and legal obligations, after which they may be deleted or de-identified. Account deletion may not erase records that must legally be retained or are needed for an active dispute.',
  ]},
  { title: 'Your choices and rights', bullets: [
    'Review or correct profile information in Settings.',
    'Control device permissions such as location, camera, photos and notifications through your device settings.',
    'Request access, correction, deletion or grievance review through AARX Support, subject to identity verification and lawful retention requirements.',
    'A parent or lawful guardian should manage use by a minor. Do not upload another person’s prescription without authority.',
  ]},
  { title: 'Privacy and grievance contact', paragraphs: [
    `Contact the AARX Privacy & Grievance Desk at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}. Include your registered mobile number and request details, but never email passwords, OTPs or full payment-card information.`,
  ]},
];

const userTerms: Section[] = [
  { title: 'Platform role', paragraphs: ['AARX is a technology platform that helps customers send medicine enquiries to independent pharmacies, compare responses, place orders, arrange delivery or walk-in fulfilment, request replacements and contact the dispensing pharmacy. AARX is not a doctor, hospital or the dispensing pharmacy and does not itself diagnose, prescribe or guarantee medicine availability.'] },
  { title: 'Your account and eligibility', bullets: ['Provide accurate contact, delivery and prescription information and keep your account secure.', 'Use a valid prescription where legally required. Do not alter, forge, reuse unlawfully or upload a prescription without authority.', 'Orders for a minor or dependent must be placed by an authorised adult. You are responsible for activity performed through your account.'] },
  { title: 'Orders, pricing and payment', paragraphs: ['A pharmacy’s quotation, item availability, substitutions, taxes, delivery fee and estimated timing are shown before or during fulfilment. Review medicine name, strength, quantity and price before accepting. An order is subject to pharmacy acceptance, stock, prescription validation and applicable law. Payment authorisation does not by itself guarantee fulfilment.'] },
  { title: 'Delivery and handover', paragraphs: ['Keep delivery details accurate and be available for lawful verification, payment and handover. Delivery estimates are not guarantees and may change due to distance, traffic, stock, weather or safety restrictions. Some medicines may require store pickup, identity checks or may not be deliverable.'] },
  { title: 'Acceptable use', bullets: ['Do not harass stores, delivery personnel or support agents; submit false complaints; manipulate ratings; reverse payments dishonestly; scrape the service; or attempt unauthorised access.', 'Do not use chat or pharmacist consultation for emergencies. Contact appropriate emergency services or a qualified doctor.', 'AARX may restrict an account or transaction to protect users, pharmacies, the platform or comply with law.'] },
  { title: 'Disputes and responsibility', paragraphs: ['Raise order disputes with factual evidence through Help & Complaints. The dispensing pharmacy remains responsible for lawful dispensing, medicine quality and its professional advice. AARX remains responsible for operating its platform with reasonable care. Nothing in these terms excludes rights or remedies that cannot be excluded under applicable consumer law.'] },
];

const storeTerms: Section[] = [
  { title: 'Platform role', paragraphs: ['AARX provides pharmacy enquiry, quotation, order, chat, delivery coordination, replacement, consultation, support and subscription tools. Each seller is an independent pharmacy and remains solely responsible for its premises, registrations, staff, stock, pricing, taxes, dispensing decisions and compliance. AARX does not become the seller of medicines merely by providing the platform.'] },
  { title: 'Seller eligibility and records', bullets: ['Maintain valid pharmacy registration, drug licences, pharmacist details, tax and identity records required for your operations.', 'Keep submitted documents current and promptly update changes. AARX may verify, re-verify, suspend or request additional evidence.', 'Only authorised staff may access the seller account. Protect login credentials and promptly report suspected compromise.'] },
  { title: 'Dispensing and customer safety', bullets: ['A registered pharmacist must review prescriptions and control dispensing wherever required.', 'Do not quote, substitute, dispense or deliver prohibited, expired, recalled, counterfeit or improperly stored medicines.', 'Show accurate medicine name, strength, dosage form, quantity, price, taxes, delivery charges and availability. Obtain any legally required prescription, identity or acknowledgement.', 'Pharmacist consultation is limited to appropriate medicine-use guidance and must not be presented as diagnosis or a new prescription.'] },
  { title: 'Orders, delivery and replacements', paragraphs: ['Respond accurately and update status promptly. Keep proof of supply and invoices where required. Use only suitable active delivery personnel, protect customer data, limit clinical data shared for delivery, and record cancellation reasons. Review eligible wrong, damaged or expired medicine replacement requests fairly and preserve evidence.'] },
  { title: 'Fees, subscriptions and payments', paragraphs: ['Applicable plans, fees and billing terms are shown in Billing & Subscriptions. You authorise collection of selected charges. Taxes and settlement obligations remain subject to the displayed plan and payment-provider terms. Contact support promptly for duplicate or unrecognised charges.'] },
  { title: 'Enforcement and disputes', paragraphs: ['AARX may pause listings, orders or access for expired documents, safety risk, fraud, repeated service failure, unlawful activity or breach. Sellers must cooperate with complaints, recalls, regulatory enquiries and lawful refunds. Nothing in these terms removes obligations imposed by pharmacy, drug, consumer, tax, privacy or other applicable law.'] },
];

const cancellationUser: Section[] = [
  { title: 'Order cancellation', bullets: [
    'Before acceptance or during the first 5 minutes after acceptance, use the in-app cancellation option when available.',
    'While a pharmacy is processing the order, cancellation may remain available but a reason is required.',
    'Once a home-delivery order reaches its locked/dispatch stage, in-app cancellation may be blocked; contact the pharmacy or AARX Support immediately. A walk-in order may still allow a soft cancellation.',
    'Completed orders cannot be cancelled. The app will show the current status and any applicable restriction before accepting a cancellation.',
  ]},
  { title: 'Refunds', paragraphs: ['For a successfully cancelled prepaid order, any amount actually captured and refundable will be returned through the original payment route where practicable. Timing depends on the pharmacy, payment provider and bank. Delivery or processing costs already irreversibly incurred may be treated according to the disclosed order terms and applicable consumer law. Cash payments that were never collected do not require a refund. For a missing or incorrect refund, raise an in-app support ticket with the order and payment reference.'] },
  { title: 'Medicines, returns and replacements', paragraphs: ['Medicines are generally not returnable merely because of a change of mind due to safety, storage and tampering risks. For a completed order containing a wrong, damaged or expired medicine, submit Replace Medicine within 48 hours of completion. Add a clear reason, description and proof image. Keep the medicine, packaging, batch details and invoice until the case closes. Approval depends on verification and applicable law; do not consume a product you believe is unsafe.'] },
  { title: 'Replacement flow', bullets: ['A requested replacement may be cancelled only before the pharmacy acts on it.', 'The pharmacy may approve with pickup instructions or dispatch a replacement with an ETA and delivery-person details.', 'A request may be rejected with a reason when evidence or eligibility is insufficient. Use Help & Complaints if you disagree with the resolution.', 'Refund may be offered instead of replacement when stock, safety or legal restrictions make replacement unsuitable.'] },
];

const cancellationStore: Section[] = [
  { title: 'Seller cancellations', bullets: ['A store may dismiss an unquoted enquiry or cancel an accepted/processing order only for a genuine reason such as stock, prescription, safety, address or operational inability.', 'A reason is mandatory. Completed orders cannot be cancelled. Notify the customer promptly and do not mark an unfulfilled order completed.', 'If payment was captured, cooperate promptly with the applicable refund and reconciliation process.'] },
  { title: 'Customer cancellations', paragraphs: ['Customers may cancel according to the order stage shown in the app. Processing cancellations require a reason; dispatched/locked home-delivery orders may require direct store assistance. Do not pressure a customer to cancel solely to hide seller non-fulfilment. Preserve preparation or dispatch evidence where a charge is disputed.'] },
  { title: 'Replacement obligations', paragraphs: ['Review requests for wrong, damaged or expired medicines submitted within the 48-hour window. Check the original prescription, supplied items, invoice, batch/expiry and customer proof. Approve or reject with a clear note. For home delivery, assign an available delivery person and realistic ETA; for walk-in, provide pickup instructions. Never ask a customer to use a medicine suspected to be unsafe.'] },
  { title: 'Seller subscription cancellation', paragraphs: ['Plan cancellation or renewal controls are available in Billing & Subscriptions where supported. Fees for an already-started billing period are not automatically refundable unless the displayed plan says otherwise, there is a verified duplicate/incorrect charge, service was not provided, or applicable law requires a refund.'] },
];

const safetySections: Section[] = [
  { title: 'Not emergency or diagnostic care', paragraphs: ['AARX search, AI classification, medicine information, chat and pharmacist consultation are assistance tools. They do not diagnose a condition, replace an in-person examination, create a prescription or guarantee that a medicine is appropriate. For severe symptoms, overdose, allergic reaction, breathing difficulty or another emergency, stop using the app and contact local emergency services or a qualified clinician immediately.'] },
  { title: 'Prescription and medicine checks', bullets: ['Use medicines only as directed by the prescriber and dispensing pharmacist.', 'Confirm patient name, medicine, strength, form, quantity, expiry, seal and storage instructions at handover.', 'Do not use a medicine that is expired, damaged, incorrectly labelled, recalled, unusually coloured/smelling or suspected counterfeit.', 'Do not share prescription medicines. Ask a qualified clinician before changing dose, stopping treatment, combining medicines, or using during pregnancy, breastfeeding, childhood or with allergies/chronic illness.'] },
  { title: 'AI and digital limitations', paragraphs: ['Automated confidence scores can be wrong and must not be treated as clinical verification. A pharmacist or clinician must review the original prescription and patient context. Network delays, image quality and incomplete records can affect digital results.'] },
  { title: 'Seller professional duties', paragraphs: ['Sellers must ensure qualified pharmacist oversight, lawful prescription validation, appropriate substitution consent, storage, cold-chain handling, traceability, invoice records and recall response. Platform status updates never replace professional or regulatory duties.'] },
];

function documents(role: Role): Record<DocumentKey, LegalDocument> {
  return {
    privacy: { title: 'Privacy Policy', eyebrow: role === 'store' ? 'Seller data & security' : 'Your data & choices', summary: 'How AARX handles account, prescription, order, location and support information.', icon: 'shield-lock-outline', sections: [
      ...(role === 'store' ? [{ title: 'Seller-specific information', paragraphs: ['For seller accounts, we also process pharmacy name, address, licences, registration and tax details, pharmacist and delivery-person details, bank/billing records, service area, catalogue/quotation activity and compliance history. Relevant verification information may be reviewed by authorised AARX personnel and service providers.'] }] : []),
      ...commonPrivacy,
    ]},
    terms: { title: 'Seller Terms & Conditions', eyebrow: role === 'store' ? 'Seller platform agreement' : 'Customer platform terms', summary: 'Rules for safely and fairly using AARX medicine enquiry, ordering and support services.', icon: 'file-sign', sections: [
      { title: 'Acceptance and updates', paragraphs: [`By creating an account or using AARX, you agree to these terms and the policies linked in Settings. Effective ${EFFECTIVE_DATE}. Material changes may be communicated in the app; continued use after they take effect means you accept the updated terms.`] },
      ...(role === 'store' ? storeTerms : userTerms),
      { title: 'Availability, intellectual property and changes', paragraphs: ['The service may be updated, interrupted or changed for maintenance, safety, law or business reasons. AARX branding, software and original content are protected; no licence is granted except the limited right to use the app for its intended purpose.'] },
      { title: 'Contact', paragraphs: [`Questions or legal notices may be sent to ${SUPPORT_EMAIL}. For account-specific issues, use Contact AARX Support in the app so the request can be authenticated and tracked.`] },
    ]},
    cancellation: { title: 'Cancellation, Refund & Replacement Policy', eyebrow: role === 'store' ? 'Seller fulfilment policy' : 'Orders and medicine issues', summary: 'What happens when an order is cancelled, a payment needs review, or supplied medicine has a problem.', icon: 'cash-refund', sections: role === 'store' ? cancellationStore : cancellationUser },
    delivery: { title: 'Delivery & Fulfilment Policy', eyebrow: role === 'store' ? 'Seller delivery standards' : 'Home delivery and pickup', summary: 'How delivery, walk-in pickup, ETA, handover and failed attempts are handled.', icon: 'truck-delivery-outline', sections: role === 'store' ? [
      { title: 'Serviceability and commitment', paragraphs: ['Accept home-delivery work only when the address is serviceable, stock is available and lawful delivery can be completed. Show delivery charges and a realistic estimate before or during acceptance, then keep order status current.'] },
      { title: 'Delivery personnel', bullets: ['Assign only active, suitable personnel and do not exceed configured active-order limits.', 'Share only the customer information required for handover. Do not expose prescription images or consultation details unless operationally and lawfully necessary.', 'Keep the assigned person’s name and operational contact information current. Reassign promptly if the person becomes unavailable.'] },
      { title: 'Medicine handling and handover', bullets: ['Maintain packaging, temperature, light, moisture, security and chain-of-custody requirements until handover.', 'Do not place restricted, fragile or cold-chain medicines into an unsuitable delivery flow.', 'Perform any required identity, age, prescription, OTP, signature, payment or recipient verification before handover.', 'Record failed attempts and contact the customer without exposing health information in voicemail, messages or at the address.'] },
      { title: 'Delay, failure and incident response', paragraphs: ['Update the customer when stock, traffic, weather, address, safety or personnel problems materially affect fulfilment. Do not mark delivered before actual handover. For loss, damage, temperature excursion, wrong handover or suspected tampering, quarantine affected stock where possible, preserve evidence and coordinate replacement, refund, complaint and regulatory steps as applicable.'] },
    ] : [
      { title: 'Availability and estimates', paragraphs: ['Home delivery depends on the pharmacy’s service area, medicine category, stock, distance, delivery-person availability, weather, traffic and legal restrictions. An ETA is an estimate, not a guarantee. Walk-in orders must be collected during the pharmacy’s communicated availability.'] },
      { title: 'Customer responsibilities', bullets: ['Provide a complete address, pincode, landmark and reachable mobile number, and correct mistakes before dispatch.', 'Be available for payment and any required identity, age, prescription, OTP or recipient verification.', 'Do not ask for unattended delivery where medicine safety or lawful handover requires a recipient.', 'Inspect the package, seal, medicine name, strength, quantity, expiry and storage condition promptly.'] },
      { title: 'Delivery-person information and privacy', paragraphs: ['For an active home delivery, the app may show the assigned person’s name, phone number and ETA to coordinate handover. Use those details only for that delivery. The phone number may be hidden after completion while the delivery name remains in the order record for accountability.'] },
      { title: 'Delays and failed delivery', paragraphs: ['The pharmacy or delivery person may contact you about an address, verification or timing issue. A failed attempt may require rescheduling, pickup or cancellation depending on medicine safety, payment status and the order stage. If status says delivered but you did not receive the order, contact the pharmacy and raise Help & Complaints immediately.'] },
      { title: 'Restricted handling', paragraphs: ['Some prescription, controlled, refrigerated, fragile or high-risk products may require store pickup, special packaging or may be unavailable for delivery. Follow storage instructions immediately after handover and do not use medicine that appears damaged, tampered with or improperly stored.'] },
    ]},
    'medicine-safety': { title: 'Medical Safety & Disclaimer Policy', eyebrow: 'Important health information', summary: 'Understand the limits of the platform, AI scan and pharmacist messaging before relying on them.', icon: 'medical-bag', sections: safetySections },
    about: { title: 'About AARX', eyebrow: role === 'store' ? 'Pharmacy operations platform' : 'Medicine access platform', summary: role === 'store' ? 'Tools for pharmacies to manage enquiries, fulfilment, delivery and customer support.' : 'A technology platform connecting customers with independent nearby pharmacies.', icon: 'information-outline', sections: [
      { title: 'What AARX does', paragraphs: [role === 'store' ? 'AARX helps verified pharmacy teams receive prescription enquiries, send transparent quotations, manage orders and delivery, respond to replacements, offer medicine-use consultations and handle support cases.' : 'AARX helps customers upload a prescription or medicine enquiry, compare pharmacy responses, arrange home delivery or walk-in pickup, track fulfilment, request eligible replacements and ask the dispensing pharmacy medicine-use questions.'] },
      { title: 'Our approach', bullets: ['Safety-conscious medicine access', 'Clear order and delivery status', 'Accountable pharmacy-customer communication', 'Privacy, evidence-based complaints and traceable support'] },
      { title: 'App information', paragraphs: [`App: AARXUI\nVersion: ${Constants.expoConfig?.version || '1.0.0'}\nPolicy effective date: ${EFFECTIVE_DATE}`] },
      { title: 'Contact AARX', paragraphs: [`Email: ${SUPPORT_EMAIL}\nPhone: ${SUPPORT_PHONE}\nFor the fastest account-specific response, open Settings → Help & Support Centre → Contact AARX Support.`] },
    ]},
  };
}

export function LegalDocumentScreen({ role }: { role: Role }) {
  const router = useRouter();
  const { document } = useLocalSearchParams<{ document?: string }>();
  const key = (document || 'about') as DocumentKey;
  const doc = documents(role)[key] || documents(role).about;

  const contact = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${doc.title} question`)}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
    else Alert.alert('Contact AARX', `${SUPPORT_EMAIL}\n${SUPPORT_PHONE}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F8FA' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Enterprise Navy/Teal Header Banner */}
        <LinearGradient
          colors={['#123B5D', '#184C75', '#0F8B8D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
            <MaterialCommunityIcons name={doc.icon as any} size={28} color="#4ADE80" />
          </View>

          <Text style={{ color: '#4ADE80', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginTop: 14 }}>
            {doc.eyebrow}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 4, letterSpacing: 0.3 }}>
            {doc.title}
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 8 }}>
            {doc.summary}
          </Text>
          {key !== 'about' && (
            <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 10, fontWeight: '700', marginTop: 12 }}>
              Effective: {EFFECTIVE_DATE} • Version 1.0
            </Text>
          )}
        </LinearGradient>

        {/* Policy Content Sections */}
        <View style={{ paddingHorizontal: 16, marginTop: -14 }}>
          {doc.sections.map((section, index) => (
            <View
              key={`${section.title}-${index}`}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#B9DDE0',
                padding: 18,
                marginBottom: 14,
                elevation: 3,
                shadowColor: '#123B5D',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.06,
                shadowRadius: 8
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#E8F4F5', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#0F8B8D', fontSize: 12, fontWeight: '900' }}>{index + 1}</Text>
                </View>
                <Text style={{ color: '#102A43', fontSize: 15, fontWeight: '900', flex: 1 }}>{section.title}</Text>
              </View>

              {section.paragraphs?.map((paragraph, i) => (
                <Text key={i} style={{ color: '#627D98', fontSize: 12, fontWeight: '600', lineHeight: 20, marginTop: 10 }}>{paragraph}</Text>
              ))}

              {section.bullets?.map((bullet, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginTop: 7, marginRight: 10 }} />
                  <Text style={{ color: '#627D98', fontSize: 12, fontWeight: '600', lineHeight: 19, flex: 1 }}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}

          {key !== 'about' && (
            <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 18, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#D97706" />
              <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600', lineHeight: 16, flex: 1, marginLeft: 10 }}>
                If a screen-specific order term conflicts with this general policy, the term shown and accepted for that transaction applies, subject to mandatory law.
              </Text>
            </View>
          )}

          {/* Contact Support Card */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={contact}
            style={{
              backgroundColor: '#123B5D',
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#0F8B8D',
              elevation: 4
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="email-outline" size={22} color="#4ADE80" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>Questions about this page?</Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 11, fontWeight: '600', marginTop: 2 }}>Contact {SUPPORT_EMAIL}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#4ADE80" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
