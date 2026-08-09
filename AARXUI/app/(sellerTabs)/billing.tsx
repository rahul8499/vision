import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

const THEME = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  background: '#F4F8FA',
  lightTealCard: '#E8F4F5',
  borderTeal: '#B9DDE0',
  whiteCard: '#FFFFFF',
  mainText: '#102A43',
  secondaryText: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#F59E0B',
  errorRed: '#DC2626',
};

export default function BillingScreen() {
  const router = useRouter();
  const dispatch = useDispatch<any>();
  const { token, user: storeData } = useSelector((state: RootState) => state.user);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPlanForSwitch, setSelectedPlanForSwitch] = useState<any>(null);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes, historyRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/subscriptions/plans/`),
        axios.get(`${BASE_URL}/api/subscriptions/my-subscription/`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/subscriptions/history/`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPlans(plansRes.data.plans || []);
      setCurrentSub(subRes.data.subscription_id ? subRes.data : null);
      setHistory(historyRes.data.history || []);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load',
        text2: 'Could not fetch billing details.',
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!currentSub?.subscription_id) return;
    try {
      setSyncing(true);
      await axios.post(
        `${BASE_URL}/api/subscriptions/sync/`,
        { subscription_id: currentSub.subscription_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchData();
      Toast.show({
        type: 'success',
        text1: 'Synced',
        text2: 'Subscription status updated from Razorpay.',
        position: 'bottom'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Sync Failed',
        text2: 'Could not sync with Razorpay.',
        position: 'bottom'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePlanAction = (plan: any, isCurrentActive: boolean) => {
    if (isCurrentActive) {
      Toast.show({
        type: 'info',
        text1: 'Current Plan Active ✅',
        text2: `You are currently subscribed to ${plan.name}.`,
        position: 'bottom'
      });
      return;
    }

    if (isActive) {
      setSelectedPlanForSwitch(plan);
      setSwitchModalOpen(true);
      return;
    }

    handleSubscribe(plan);
  };

  const confirmPlanSwitch = () => {
    if (selectedPlanForSwitch) {
      const planToSub = selectedPlanForSwitch;
      setSwitchModalOpen(false);
      setSelectedPlanForSwitch(null);
      handleSubscribe(planToSub);
    }
  };

  const handleSubscribe = async (plan: any) => {
    try {
      setSubscribing(plan.id);
      const createRes = await axios.post(
        `${BASE_URL}/api/subscriptions/create/`,
        { plan_id: plan.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const subscription_id = createRes.data.subscription_id;

      if (createRes.data.message === 'Resuming existing checkout.') {
        Toast.show({
          type: 'info',
          text1: 'Resuming Checkout',
          text2: 'You already have a pending subscription.',
          position: 'bottom'
        });
      }

      const options = {
        description: `Subscription to ${plan.name}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3011/3011270.png',
        currency: 'INR',
        key: 'rzp_test_TBsXlkpYDYR8Xj',
        subscription_id: subscription_id,
        name: 'AARX Pharmacy Platform',
        theme: { color: THEME.primaryNavy }
      };

      try {
        const data = await RazorpayCheckout.open(options);
        handlePaymentSuccess(data.razorpay_subscription_id, data.razorpay_payment_id, data.razorpay_signature);
      } catch (error: any) {
        setSubscribing(null);
        if (error?.code !== 0) {
          Toast.show({
            type: 'error',
            text1: 'Payment Failed',
            text2: error?.description || 'Payment could not be completed.',
            position: 'bottom'
          });
        }
      }

    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '';

      if (errorMsg.includes('already have an active subscription')) {
        await fetchData();
        dispatch(fetchUserProfile());
        Toast.show({
          type: 'success',
          text1: 'Already Active ✅',
          text2: 'Your premium plan is active!',
          position: 'bottom'
        });
        setSubscribing(null);
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Subscription Failed',
        text2: errorMsg || 'Could not initiate subscription.',
        position: 'bottom'
      });
      setSubscribing(null);
    }
  };

  const handlePaymentSuccess = async (sub_id: string, pay_id: string, signature: string) => {
    try {
      await axios.post(
        `${BASE_URL}/api/subscriptions/verify/`,
        {
          razorpay_subscription_id: sub_id,
          razorpay_payment_id: pay_id,
          razorpay_signature: signature
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchData();
      dispatch(fetchUserProfile());

      Toast.show({
        type: 'success',
        text1: 'Subscription Active',
        text2: 'Welcome to Premium Partner Tier!',
        position: 'bottom'
      });

    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Payment made but verification pending.',
        position: 'bottom'
      });
    } finally {
      setSubscribing(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
        <ActivityIndicator size="large" color={THEME.secondaryTeal} />
      </View>
    );
  }

  const isActive = currentSub && currentSub.status === 'active';

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header Card with side margins ── */}
        <View style={styles.heroHeaderWrapper}>
          <ImageBackground
            source={require('../../assets/images/storesubscription.png')}
            style={styles.heroHeader}
            imageStyle={{ borderRadius: 22, resizeMode: 'cover' }}
          >
            {/* Top Nav Bar with Back Arrow and Top-Right Refresh Button */}
            <View style={styles.topNavRow}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.76} style={styles.navIconButton}>
                <MaterialCommunityIcons name="arrow-left" size={20} color={THEME.whiteCard} />
              </TouchableOpacity>

              <TouchableOpacity onPress={fetchData} activeOpacity={0.76} style={styles.navIconButton}>
                <Feather name="refresh-cw" size={16} color="#4ADE80" />
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>

        {/* ── Scroll Content ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Enterprise Current Status Card ── */}
          <View style={[styles.sectionCard, styles.enterpriseStatusCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderIcon}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color={THEME.primaryNavy} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Account Subscription Status</Text>
                  <View style={styles.liveStatusDot} />
                </View>
                <Text style={styles.sectionSubtitle}>Verified Pharmacy Enterprise Tier</Text>
              </View>

              {isActive ? (
                <TouchableOpacity
                  onPress={handleSync}
                  disabled={syncing}
                  style={styles.syncButton}
                >
                  <Ionicons name="sync" size={12} color={THEME.primaryNavy} />
                  <Text style={styles.syncButtonText}>
                    {syncing ? 'Syncing...' : 'Sync Status'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isActive ? (
              <View style={styles.activePlanContainer}>
                <LinearGradient
                  colors={['#E8F4F5', '#F4F8FA', '#FFFFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activePlanBanner}
                >
                  <View style={styles.activePlanTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.activePlanTitle}>{currentSub.plan_name || 'Enterprise Premium Tier'}</Text>
                        <MaterialCommunityIcons name="decagram-check" size={18} color={THEME.secondaryTeal} />
                      </View>
                      <Text style={styles.activePlanSubtitle}>Auto-renewing via Razorpay Billing Engine</Text>
                    </View>

                    <View style={styles.activePill}>
                      <View style={styles.glowingDot} />
                      <Text style={styles.activePillText}>ACTIVE TIER</Text>
                    </View>
                  </View>

                  <View style={styles.activePlanDetailsRow}>
                    <View style={styles.metaCell}>
                      <Text style={styles.detailMetaLabel}>RENEWAL DATE</Text>
                      <Text style={styles.detailMetaValue}>{formatDate(currentSub.current_end)}</Text>
                    </View>

                    <View style={styles.metaCellDivider} />

                    <View style={[styles.metaCell, { alignItems: 'flex-end' }]}>
                      <Text style={styles.detailMetaLabel}>BILLING CYCLE</Text>
                      <Text style={styles.detailMetaValue}>Monthly Auto-Renew</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.emptyPlanBox}>
                <View style={styles.emptyPlanIconBox}>
                  <MaterialCommunityIcons name="store-alert-outline" size={28} color={THEME.warningAmber} />
                </View>
                <Text style={styles.emptyPlanTitle}>Standard Tier Account</Text>
                <Text style={styles.emptyPlanSubtitle}>
                  You are currently on the basic free plan. Upgrade below to activate priority order routing, AI tools, and verified badges.
                </Text>
              </View>
            )}

            {/* Payment History Action Button inside Current Status Card */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setHistoryModalOpen(true)}
              style={styles.historyTriggerButton}
            >
              <View style={styles.historyIconCircle}>
                <MaterialCommunityIcons name="receipt" size={16} color={THEME.primaryNavy} />
              </View>
              <Text style={styles.historyTriggerText}>View Payment History ({history.length} Invoices)</Text>
              <Feather name="chevron-right" size={16} color={THEME.primaryNavy} />
            </TouchableOpacity>
          </View>

          {/* Available Plans */}
          <View style={{ marginBottom: 16 }}>
            <View style={styles.sectionHeaderTitleRow}>
              <Text style={styles.sectionGroupTitle}>AVAILABLE PLANS</Text>
            </View>

            {plans.map((plan) => {
              const isCurrentActive = isActive && (currentSub?.plan === plan.id || currentSub?.plan_name === plan.name);

              return (
                <View key={plan.id} style={[styles.planCard, isCurrentActive && styles.activePlanCardBorder]}>
                  {isCurrentActive ? (
                    <View style={[styles.planBadge, { backgroundColor: THEME.successGreen }]}>
                      <Text style={styles.planBadgeText}>ACTIVE PLAN</Text>
                    </View>
                  ) : (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>RECOMMENDED</Text>
                    </View>
                  )}

                  <View style={styles.planCardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planNameText}>{plan.name}</Text>
                      <Text style={styles.planDescText}>{plan.description}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                      <Text style={styles.planPriceText}>₹{plan.price}</Text>
                      <Text style={styles.planFreqText}>/ month</Text>
                    </View>
                  </View>

                  <View style={styles.planDivider} />

                  <View style={styles.featuresList}>
                    {plan.features?.length > 0 ? (
                      plan.features.map((feat: string, idx: number) => (
                        <View key={idx} style={styles.featureItem}>
                          <MaterialCommunityIcons name="check-circle" size={16} color={THEME.successGreen} />
                          <Text style={styles.featureItemText}>{feat}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noFeaturesText}>Includes standard partner features & support.</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handlePlanAction(plan, isCurrentActive)}
                    disabled={subscribing !== null}
                    style={[styles.subscribeButton, isCurrentActive && styles.currentActiveButton]}
                  >
                    {isCurrentActive ? (
                      <View style={styles.currentActiveButtonInner}>
                        <MaterialCommunityIcons name="check-decagram" size={18} color={THEME.successGreen} />
                        <Text style={styles.currentActiveButtonText}>Current Active Plan</Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={[THEME.primaryNavy, THEME.secondaryTeal]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.subscribeGradient}
                      >
                        {subscribing === plan.id ? (
                          <ActivityIndicator color={THEME.whiteCard} size="small" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#F59E0B" />
                            <Text style={styles.subscribeButtonText}>Upgrade To Premium</Text>
                          </>
                        )}
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {plans.length === 0 && (
              <View style={styles.noPlansCard}>
                <Text style={styles.noPlansText}>No active subscription plans available at the moment.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Payment History Bottom Sheet Modal ── */}
      <Modal
        visible={historyModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropPressable}
            activeOpacity={1}
            onPress={() => setHistoryModalOpen(false)}
          />

          <View style={styles.sheetContainer}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandleBar} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderIcon}>
                <MaterialCommunityIcons name="receipt" size={22} color={THEME.primaryNavy} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.sheetTitle}>Payment History</Text>
                <Text style={styles.sheetSubtitle}>All past subscription charges & receipts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHistoryModalOpen(false)}
                style={styles.sheetCloseButton}
              >
                <MaterialCommunityIcons name="close" size={18} color={THEME.mainText} />
              </TouchableOpacity>
            </View>

            {/* Sheet Content List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
              {history.length > 0 ? (
                history.map((item, idx) => {
                  const isCaptured = item.status === 'captured' || item.status === 'paid';
                  return (
                    <View key={item.id || idx} style={[styles.historyRow, idx !== history.length - 1 && styles.historyRowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyPlanTitle}>{item.subscription__plan__name || 'Premium Subscription'}</Text>
                        <Text style={styles.historyMetaText}>
                          {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {item.razorpay_payment_id || 'RZP-PAY'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={styles.historyAmountText}>₹{item.amount}</Text>
                        <View style={[styles.statusBadgePill, isCaptured ? styles.statusBadgeCaptured : styles.statusBadgeFailed]}>
                          <Text style={[styles.statusBadgeText, { color: isCaptured ? THEME.successGreen : THEME.errorRed }]}>
                            {item.status ? item.status.toUpperCase() : 'PAID'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyHistoryBox}>
                  <MaterialCommunityIcons name="receipt" size={36} color={THEME.secondaryText} />
                  <Text style={styles.emptyHistoryText}>No payment history records found.</Text>
                </View>
              )}
            </ScrollView>

            {/* Sheet Footer Button */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setHistoryModalOpen(false)}
                style={styles.sheetDoneButton}
              >
                <Text style={styles.sheetDoneText}>Close Sheet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Custom Plan Upgrade / Downgrade Modal ── */}
      <Modal
        visible={switchModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSwitchModalOpen(false)}
      >
        {(() => {
          const currentPrice = Number(currentSub?.plan_price || currentSub?.price || 0);
          const targetPrice = Number(selectedPlanForSwitch?.price || 0);
          const isDowngrade = Boolean(
            isActive && (
              (currentPrice > 0 && targetPrice < currentPrice) ||
              selectedPlanForSwitch?.name?.toLowerCase().includes('basic') ||
              selectedPlanForSwitch?.name?.toLowerCase().includes('free')
            )
          );

          return (
            <View style={styles.customModalOverlay}>
              <TouchableOpacity
                style={styles.modalBackdropPressable}
                activeOpacity={1}
                onPress={() => setSwitchModalOpen(false)}
              />

              <View style={styles.confirmModalCard}>
                {isDowngrade ? (
                  /* ── DOWNGRADE VIEW ── */
                  <>
                    <View style={[styles.confirmModalHeaderIcon, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                      <MaterialCommunityIcons name="trending-down" size={34} color={THEME.errorRed} />
                    </View>

                    <Text style={styles.confirmModalTitle}>Downgrade Plan Warning!</Text>
                    <Text style={styles.confirmModalSubtitle}>
                      Are you sure you want to downgrade to <Text style={{ fontWeight: '900', color: THEME.mainText }}>{selectedPlanForSwitch?.name}</Text> (₹{selectedPlanForSwitch?.price}/mo)?
                    </Text>

                    <View style={styles.confirmModalWarningBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <MaterialCommunityIcons name="alert-octagon" size={18} color={THEME.errorRed} />
                        <Text style={styles.warningBoxTitle}>Benefits You Will Lose Immediately:</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="close-circle" size={15} color={THEME.errorRed} />
                        <Text style={styles.lostBenefitText}>Priority Order Routing & Instant Lead Alerts</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="close-circle" size={15} color={THEME.errorRed} />
                        <Text style={styles.lostBenefitText}>Verified Pharmacy Enterprise Tier Badge</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="close-circle" size={15} color={THEME.errorRed} />
                        <Text style={styles.lostBenefitText}>AI Inventory Search & Auto-Sync Superpowers</Text>
                      </View>
                    </View>

                    <View style={styles.confirmModalActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSwitchModalOpen(false)}
                        style={styles.keepPremiumButton}
                      >
                        <LinearGradient
                          colors={[THEME.primaryNavy, THEME.secondaryTeal]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.proceedModalGradient}
                        >
                          <MaterialCommunityIcons name="shield-check" size={18} color={THEME.whiteCard} />
                          <Text style={styles.proceedModalButtonText}>Keep My Premium Benefits</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={confirmPlanSwitch}
                        style={styles.cancelModalButton}
                      >
                        <Text style={[styles.cancelModalButtonText, { color: THEME.errorRed }]}>
                          Proceed to Downgrade Plan
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* ── UPGRADE ADVANTAGE VIEW ── */
                  <>
                    <View style={[styles.confirmModalHeaderIcon, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <MaterialCommunityIcons name="crown-outline" size={34} color="#D97706" />
                    </View>

                    <Text style={styles.confirmModalTitle}>Unlock Premium Advantages!</Text>
                    <Text style={styles.confirmModalSubtitle}>
                      Upgrade your pharmacy store to <Text style={{ fontWeight: '900', color: THEME.primaryNavy }}>{selectedPlanForSwitch?.name}</Text> for ₹{selectedPlanForSwitch?.price}/mo.
                    </Text>

                    <View style={[styles.confirmModalWarningBox, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <MaterialCommunityIcons name="star-circle" size={18} color={THEME.successGreen} />
                        <Text style={[styles.warningBoxTitle, { color: '#166534' }]}>Exclusive Advantages Included:</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="check-circle" size={15} color={THEME.successGreen} />
                        <Text style={[styles.lostBenefitText, { color: '#14532D' }]}>Priority Order Routing & Instant Lead Alerts</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="check-circle" size={15} color={THEME.successGreen} />
                        <Text style={[styles.lostBenefitText, { color: '#14532D' }]}>Verified Pharmacy Enterprise Tier Badge</Text>
                      </View>

                      <View style={styles.lostBenefitRow}>
                        <MaterialCommunityIcons name="check-circle" size={15} color={THEME.successGreen} />
                        <Text style={[styles.lostBenefitText, { color: '#14532D' }]}>AI Inventory Search & Auto-Sync Superpowers</Text>
                      </View>
                    </View>

                    <View style={styles.confirmModalActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={confirmPlanSwitch}
                        style={styles.keepPremiumButton}
                      >
                        <LinearGradient
                          colors={[THEME.primaryNavy, THEME.secondaryTeal]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.proceedModalGradient}
                        >
                          <MaterialCommunityIcons name="lightning-bolt" size={18} color="#F59E0B" />
                          <Text style={styles.proceedModalButtonText}>Proceed to Pay & Upgrade</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSwitchModalOpen(false)}
                        style={styles.cancelModalButton}
                      >
                        <Text style={styles.cancelModalButtonText}>Maybe Later</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderWrapper: {
    marginHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 12 : 6,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: {
    height: 175,
    paddingHorizontal: 14,
    paddingTop: 12,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navIconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navHeaderTitleBox: { alignItems: 'center' },
  navHeaderTitle: { color: THEME.whiteCard, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  heroIdentityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  avatarGradient: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  identityMetaBox: { flex: 1, marginLeft: 12 },
  storeNameText: { color: THEME.whiteCard, fontSize: 15, fontWeight: '900' },
  ownerTitleText: { color: 'rgba(255, 255, 255, 0.76)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  scrollContainer: { padding: 16, paddingBottom: 40 },

  sectionGroupTitle: {
    color: THEME.secondaryText,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  sectionCard: {
    backgroundColor: THEME.whiteCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  enterpriseStatusCard: {
    borderColor: THEME.borderTeal,
  },
  liveStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: THEME.successGreen,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.lightTealCard },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: THEME.mainText, fontSize: 15, fontWeight: '900' },
  sectionSubtitle: { color: THEME.secondaryText, fontSize: 10.5, fontWeight: '600', marginTop: 1 },

  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
  },
  syncButtonText: { color: THEME.primaryNavy, fontSize: 10.5, fontWeight: '800' },

  activePlanContainer: { paddingTop: 2 },
  activePlanBanner: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
  },
  activePlanTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  activePlanTitle: { color: THEME.mainText, fontSize: 17.5, fontWeight: '900' },
  activePlanSubtitle: { color: THEME.secondaryText, fontSize: 11, fontWeight: '600', marginTop: 2 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 99,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  glowingDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: THEME.successGreen,
  },
  activePillText: { color: THEME.successGreen, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },

  activePlanDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.borderTeal,
  },
  metaCell: { flex: 1 },
  metaCellDivider: { width: 1, height: 26, backgroundColor: THEME.borderTeal, marginHorizontal: 12 },
  detailMetaLabel: { color: THEME.secondaryText, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailMetaValue: { color: THEME.mainText, fontSize: 13, fontWeight: '800', marginTop: 2 },

  emptyPlanBox: { alignItems: 'center', paddingVertical: 16 },
  emptyPlanIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.lightTealCard, borderWidth: 1, borderColor: THEME.borderTeal, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyPlanTitle: { color: THEME.mainText, fontSize: 15, fontWeight: '900' },
  emptyPlanSubtitle: { color: THEME.secondaryText, fontSize: 11.5, fontWeight: '600', textAlign: 'center', marginTop: 4, paddingHorizontal: 14 },

  historyTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.lightTealCard,
  },
  historyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTriggerText: {
    flex: 1,
    marginLeft: 10,
    color: THEME.primaryNavy,
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Plan Cards */
  planCard: {
    backgroundColor: THEME.whiteCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    marginBottom: 12,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  planBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: THEME.secondaryTeal,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 12,
  },
  planBadgeText: { color: THEME.whiteCard, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  planCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 },
  planNameText: { color: THEME.mainText, fontSize: 18, fontWeight: '900' },
  planDescText: { color: THEME.secondaryText, fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  planPriceText: { color: THEME.secondaryTeal, fontSize: 20, fontWeight: '900' },
  planFreqText: { color: THEME.secondaryText, fontSize: 10, fontWeight: '700' },

  planDivider: { height: 1, backgroundColor: THEME.lightTealCard, marginVertical: 12 },
  featuresList: { gap: 6, marginBottom: 14 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureItemText: { color: THEME.mainText, fontSize: 12.5, fontWeight: '700' },
  noFeaturesText: { color: THEME.secondaryText, fontSize: 12, fontStyle: 'italic' },

  activePlanCardBorder: {
    borderColor: THEME.successGreen,
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  subscribeButton: { borderRadius: 14, overflow: 'hidden', elevation: 2 },
  currentActiveButton: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    elevation: 0,
  },
  currentActiveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  currentActiveButtonText: { color: THEME.successGreen, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  subscribeButtonText: { color: THEME.whiteCard, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  noPlansCard: { padding: 16, backgroundColor: THEME.whiteCard, borderRadius: 14, alignItems: 'center' },
  noPlansText: { color: THEME.secondaryText, fontSize: 12, fontWeight: '600' },

  /* Payment History */
  historyList: { gap: 2 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  historyRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.borderTeal },
  historyPlanTitle: { color: THEME.mainText, fontSize: 13, fontWeight: '800' },
  historyMetaText: { color: THEME.secondaryText, fontSize: 10, fontWeight: '600', marginTop: 2 },
  historyAmountText: { color: THEME.primaryNavy, fontSize: 13.5, fontWeight: '900' },

  statusBadgePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, borderWidth: 1, marginTop: 2 },
  statusBadgeCaptured: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  statusBadgeFailed: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  statusBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },

  emptyHistoryBox: { alignItems: 'center', paddingVertical: 16 },
  emptyHistoryText: { color: THEME.secondaryText, fontSize: 11.5, fontWeight: '600', marginTop: 6 },

  /* Sheet Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: THEME.whiteCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    minHeight: 360,
    paddingTop: 10,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.borderTeal,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightTealCard,
  },
  sheetHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { color: THEME.mainText, fontSize: 16, fontWeight: '900' },
  sheetSubtitle: { color: THEME.secondaryText, fontSize: 11, fontWeight: '600', marginTop: 1 },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.lightTealCard,
    backgroundColor: THEME.whiteCard,
  },
  sheetDoneButton: {
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: THEME.primaryNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDoneText: { color: THEME.whiteCard, fontSize: 13.5, fontWeight: '900' },

  /* Custom Switch Modal Styles */
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.whiteCard,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmModalHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmModalTitle: {
    color: THEME.mainText,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmModalSubtitle: {
    color: THEME.secondaryText,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  confirmModalWarningBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    marginBottom: 20,
  },
  warningBoxTitle: {
    color: '#991B1B',
    fontSize: 12.5,
    fontWeight: '900',
  },
  lostBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
  },
  lostBenefitText: {
    color: '#7F1D1D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  confirmModalActions: {
    width: '100%',
    gap: 10,
  },
  cancelModalButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  cancelModalButtonText: {
    color: THEME.primaryNavy,
    fontSize: 13,
    fontWeight: '800',
  },
  proceedModalButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  keepPremiumButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  proceedModalGradient: {
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proceedModalButtonText: {
    color: THEME.whiteCard,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
