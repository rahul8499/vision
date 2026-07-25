import DeliveryDestinationModal from "@/components/DeliveryDestinationModal";
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from "@/components/Language/LocalizedPrimitives";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

type JobStage = "offered" | "accepted" | "picked_up" | "reached" | "completed" | "returning" | "received" | "disputed";
type Job = {
  id: number;
  stage: JobStage;
  customer_name: string;
  customer_mobile?: string;
  customer_address: string;
  latitude: number;
  longitude: number;
  store_name: string;
  store_address: string;
  store_mobile?: string;
  completion_otp_requested?: boolean;
  delivery_issue_code?: string;
  delivery_issue_note?: string;
  completed_at?: string;
  delivery_return?: {
    id: number; reason: string; reason_label: string; note?: string;
    package_condition: string; package_condition_label: string;
    status: "returning" | "received" | "disputed"; status_label: string;
    store_note?: string;
    requested_at?: string;
    received_at?: string;
  } | null;
};
type Partner = {
  id: number;
  login_id: string;
  name: string;
  mobile: string;
  store_name: string;
  store_mobile: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_available: boolean;
  current_order_count: number;
};
type DeliveryIssue = {
  id: number;
  order_id: number;
  issue_code: string;
  issue_label: string;
  note?: string;
  status: "open" | "resolved";
  resolution_note?: string;
  store_name: string;
  store_address: string;
  store_mobile?: string;
  customer_name: string;
  customer_mobile?: string;
  customer_address: string;
  order_status: string;
  delivery_stage: string;
  resolution_source?: string;
  reported_at: string;
  resolved_at?: string;
};

const PROBLEMS = [
  ["customer_unreachable", "Customer फोन नहीं उठा रहा"],
  ["wrong_address", "Address गलत है"],
  ["customer_unavailable", "Customer उपलब्ध नहीं है"],
  ["order_not_ready", "Order store पर तैयार नहीं है"],
  ["vehicle_problem", "Vehicle problem"],
] as const;
const RETURN_REASONS = [
  ["customer_unreachable", "Customer से संपर्क नहीं हुआ"],
  ["wrong_address", "Address गलत था"],
  ["customer_refused", "Customer ने order लेने से मना किया"],
  ["otp_unavailable", "OTP उपलब्ध नहीं था"],
  ["unsafe_location", "Location सुरक्षित नहीं थी"],
  ["other", "अन्य कारण"],
] as const;

export default function DeliveryHomeScreen() {
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL || "";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [issues, setIssues] = useState<DeliveryIssue[]>([]);
  const [jobTab, setJobTab] = useState<
    "active" | "completed" | "issues" | "profile"
  >("active");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapJob, setMapJob] = useState<Job | null>(null);
  const [otpJob, setOtpJob] = useState<Job | null>(null);
  const [problemJob, setProblemJob] = useState<Job | null>(null);
  const [returnJob, setReturnJob] = useState<Job | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnCondition, setReturnCondition] = useState("sealed");
  const [returnNote, setReturnNote] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<DeliveryIssue | null>(
    null
  );
  const [issueResolutionNote, setIssueResolutionNote] = useState("");
  const [resolvingIssueId, setResolvingIssueId] = useState<number | null>(null);
  const [problemNote, setProblemNote] = useState("");
  const [otp, setOtp] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const auth = async () => ({
    Authorization: `Bearer ${await SecureStore.getItemAsync(
      "deliveryAuthToken"
    )}`,
  });
  const fetchDashboard = useCallback(
    async (showError = true) => {
      try {
        const headers = await auth();
        const [jobsResponse, historyResponse, issuesResponse, meResponse] =
          await Promise.all([
            fetch(`${baseUrl}/api/delivery/jobs/`, { headers }),
            fetch(`${baseUrl}/api/delivery/jobs/?scope=completed`, { headers }),
            fetch(`${baseUrl}/api/delivery/issues/`, { headers }),
            fetch(`${baseUrl}/api/delivery/me/`, { headers }),
          ]);
        if (
          jobsResponse.status === 401 ||
          historyResponse.status === 401 ||
          issuesResponse.status === 401 ||
          meResponse.status === 401
        ) {
          router.replace("/delivery/login");
          return;
        }
        const jobsData = await jobsResponse.json();
        const historyData = await historyResponse.json();
        const issuesData = await issuesResponse.json();
        const meData = await meResponse.json();
        if (
          !jobsResponse.ok ||
          !historyResponse.ok ||
          !issuesResponse.ok ||
          !meResponse.ok
        )
          throw new Error(
            jobsData.error ||
              historyData.error ||
              issuesData.error ||
              meData.error ||
              "Could not load dashboard."
          );
        setJobs(jobsData.results || []);
        setCompletedJobs(historyData.results || []);
        setIssues(issuesData.results || []);
        setPartner(meData);
      } catch (error: any) {
        if (showError)
          Toast.show({
            type: "error",
            text1: "Could not load deliveries",
            text2: error.message,
          });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [baseUrl]
  );
  useEffect(() => {
    let mounted = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      const token = await SecureStore.getItemAsync("deliveryAuthToken");
      if (!mounted || !token) return;
      socket = new WebSocket(
        `${baseUrl.replace(
          /^http/,
          "ws"
        )}/ws/delivery-partner/?token=${encodeURIComponent(token)}`
      );
      socket.onopen = () => fetchDashboard(false);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "delivery_jobs_changed") {
            if (message.action === "delivery_assignment_requested") {
              Toast.show({
                type: "info",
                text1: "New delivery request",
                text2: "Accept या Reject करने के लिए request खोलें।",
              });
            }
            fetchDashboard(false);
          }
        } catch {
          // A periodic API sync below safely recovers from malformed/missed events.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (mounted) reconnectTimer = setTimeout(connect, 3000);
      };
    };

    fetchDashboard();
    connect();
    const safetySync = setInterval(() => fetchDashboard(false), 15000);
    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(safetySync);
      socket?.close();
    };
  }, [baseUrl, fetchDashboard]);

  const post = async (job: Job, path: string, body: object = {}) => {
    setBusyId(job.id);
    try {
      const response = await fetch(
        `${baseUrl}/api/delivery/jobs/${job.id}/${path}/`,
        {
          method: "POST",
          headers: { ...(await auth()), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      Toast.show({
        type: "success",
        text1: data.message || "Delivery updated",
      });
      await fetchDashboard();
      return true;
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: error.message,
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };
  const toggleShift = async () => {
    if (!partner) return;
    try {
      const response = await fetch(`${baseUrl}/api/delivery/me/`, {
        method: "PATCH",
        headers: { ...(await auth()), "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !partner.is_available }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not update shift.");
      setPartner(data);
      Toast.show({
        type: "success",
        text1: data.is_available ? "You are Online" : "You are Offline",
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Shift update failed",
        text2: error.message,
      });
    }
  };
  const resolveIssue = async () => {
    if (!selectedIssue || issueResolutionNote.trim().length < 3) {
      Toast.show({
        type: "error",
        text1: "Resolution लिखें",
        text2: "समस्या कैसे ठीक हुई, briefly बताएं।",
      });
      return;
    }
    setResolvingIssueId(selectedIssue.id);
    try {
      const response = await fetch(
        `${baseUrl}/api/delivery/issues/${selectedIssue.id}/resolve/`,
        {
          method: "POST",
          headers: { ...(await auth()), "Content-Type": "application/json" },
          body: JSON.stringify({ resolution_note: issueResolutionNote.trim() }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not resolve issue.");
      Toast.show({
        type: "success",
        text1: "Issue resolved",
        text2: "Pharmacy और customer को update भेज दिया गया।",
      });
      setSelectedIssue(null);
      setIssueResolutionNote("");
      await fetchDashboard(false);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: error.message,
      });
    } finally {
      setResolvingIssueId(null);
    }
  };
  const call = (number?: string) =>
    number
      ? Linking.openURL(`tel:${number}`)
      : Toast.show({ type: "info", text1: "Phone number unavailable" });
  const navigate = (job: Job) =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}&travelmode=driving`
    );
  const logout = async () => {
    await SecureStore.deleteItemAsync("deliveryAuthToken");
    await SecureStore.deleteItemAsync("deliveryPartner");
    router.replace("/delivery/login");
  };
  const displayedJobs =
    jobTab === "active" ? jobs : jobTab === "completed" ? completedJobs : [];

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-[#f7faf9]">
        <ActivityIndicator size="large" color="#ea580c" />
        <Text className="mt-3 font-bold text-slate-500">
          Loading deliveries…
        </Text>
      </View>
    );
  return (
    <SafeAreaView className="flex-1 bg-[#f7faf9]">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboard();
            }}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      >
        <View className="mb-4 rounded-[1.7rem] bg-slate-950 p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-[9px] font-black uppercase tracking-[2px] text-orange-400">
                {partner?.store_name || "Partner dashboard"}
              </Text>
              <Text className="mt-1 text-2xl font-black text-white">
                Hi, {partner?.name || "Partner"}
              </Text>
              <Text className="mt-1 text-xs font-semibold text-slate-400">
                {jobs.length} job{jobs.length === 1 ? "" : "s"} ·{" "}
                {partner?.current_order_count || 0} active
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setJobTab("profile")}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10"
            >
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={23}
                color="white"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={toggleShift}
            className={`mt-4 flex-row items-center rounded-2xl p-3.5 ${
              partner?.is_available ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <MaterialCommunityIcons
                name={
                  partner?.is_available
                    ? "toggle-switch"
                    : "toggle-switch-off-outline"
                }
                size={25}
                color="white"
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-black text-white">
                {partner?.is_available
                  ? "Online — नई delivery ले सकते हैं"
                  : "Offline — नई delivery नहीं मिलेगी"}
              </Text>
              <Text className="mt-0.5 text-[9px] font-bold text-white/70">
                स्थिति बदलने के लिए tap करें
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        {jobTab === "issues" ? (
          <View>
            <View className="mb-4 rounded-[1.6rem] bg-slate-950 p-5">
              <Text className="text-[9px] font-black uppercase tracking-[2px] text-orange-400">
                Issue Centre
              </Text>
              <Text className="mt-1 text-2xl font-black text-white">
                Reported Problems
              </Text>
              <Text className="mt-2 text-xs font-semibold text-slate-400">
                हर report का permanent record और resolution status।
              </Text>
              <View className="mt-4 flex-row gap-2">
                <View className="flex-1 rounded-2xl bg-white/10 p-3">
                  <Text className="text-2xl font-black text-white">
                    {issues.filter((issue) => issue.status === "open").length}
                  </Text>
                  <Text className="mt-1 text-[8px] font-black uppercase text-amber-300">
                    Open
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white/10 p-3">
                  <Text className="text-2xl font-black text-white">
                    {
                      issues.filter((issue) => issue.status === "resolved")
                        .length
                    }
                  </Text>
                  <Text className="mt-1 text-[8px] font-black uppercase text-emerald-300">
                    Resolved
                  </Text>
                </View>
              </View>
            </View>
            {!issues.length ? (
              <View className="mt-16 items-center">
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={56}
                  color="#cbd5e1"
                />
                <Text className="mt-4 text-lg font-black text-slate-800">
                  No reported problems
                </Text>
                <Text className="mt-2 text-center text-xs font-semibold text-slate-400">
                  आपकी issue history यहां दिखाई देगी।
                </Text>
              </View>
            ) : (
              issues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedIssue(issue);
                    setIssueResolutionNote("");
                  }}
                  className="mb-3 rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-md shadow-slate-200/50"
                >
                  <View className="flex-row items-start">
                    <View
                      className={`h-11 w-11 items-center justify-center rounded-2xl ${
                        issue.status === "open"
                          ? "bg-amber-50"
                          : "bg-emerald-50"
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={
                          issue.status === "open"
                            ? "alert-outline"
                            : "check-circle-outline"
                        }
                        size={22}
                        color={issue.status === "open" ? "#d97706" : "#059669"}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[9px] font-black uppercase tracking-[1.2px] text-orange-600">
                          Order #{issue.order_id}
                        </Text>
                        <View
                          className={`rounded-full px-2.5 py-1 ${
                            issue.status === "open"
                              ? "bg-amber-50"
                              : "bg-emerald-50"
                          }`}
                        >
                          <Text
                            className={`text-[7px] font-black uppercase ${
                              issue.status === "open"
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {issue.status}
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-sm font-black text-slate-900">
                        {issue.issue_label}
                      </Text>
                      <Text className="mt-1 text-[9px] font-semibold text-slate-500">
                        {issue.store_name} ·{" "}
                        {new Date(issue.reported_at).toLocaleString("en-IN")}
                      </Text>
                      {!!issue.note && (
                        <Text className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[10px] font-semibold leading-4 text-slate-600">
                          {issue.note}
                        </Text>
                      )}
                      {issue.status === "resolved" && (
                        <View className="mt-2 rounded-xl bg-emerald-50 p-2.5">
                          <Text className="text-[9px] font-bold text-emerald-700">
                            {issue.resolution_note || "Resolved successfully"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="mt-3 flex-row items-center justify-end">
                    <Text className="text-[8px] font-black uppercase text-slate-400">
                      View full details
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color="#94a3b8"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : jobTab === "profile" ? (
          <View>
            <View className="mb-4 rounded-[1.7rem] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
              <View className="flex-row items-center">
                <View className="h-16 w-16 items-center justify-center rounded-[1.4rem] bg-orange-50">
                  <MaterialCommunityIcons
                    name="account-circle-outline"
                    size={32}
                    color="#ea580c"
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-950">
                    {partner?.name}
                  </Text>
                  <Text className="mt-1 text-[10px] font-bold uppercase tracking-[1.2px] text-slate-400">
                    AARX Delivery Partner
                  </Text>
                  <View
                    className={`mt-2 self-start rounded-full px-2.5 py-1 ${
                      partner?.is_available ? "bg-emerald-50" : "bg-slate-100"
                    }`}
                  >
                    <Text
                      className={`text-[8px] font-black uppercase ${
                        partner?.is_available
                          ? "text-emerald-700"
                          : "text-slate-500"
                      }`}
                    >
                      {partner?.is_available ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View className="mb-4 rounded-[1.7rem] border border-slate-100 bg-white p-5">
              <Text className="mb-3 text-[9px] font-black uppercase tracking-[1.8px] text-slate-400">
                Partner Account
              </Text>
              {[
                ["identifier", "Partner ID", partner?.login_id || "—"],
                [
                  "storefront-outline",
                  "Linked Pharmacy",
                  partner?.store_name || "—",
                ],
                ["phone-outline", "Mobile Number", partner?.mobile || "—"],
                [
                  "motorbike",
                  "Vehicle",
                  `${partner?.vehicle_type || "Not set"}${
                    partner?.vehicle_number
                      ? ` · ${partner.vehicle_number}`
                      : ""
                  }`,
                ],
              ].map(([icon, label, value]) => (
                <View
                  key={label}
                  className="mb-2 flex-row items-center rounded-2xl bg-slate-50 p-3.5"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
                    <MaterialCommunityIcons
                      name={icon as any}
                      size={19}
                      color="#475569"
                    />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[8px] font-black uppercase tracking-[1px] text-slate-400">
                      {label}
                    </Text>
                    <Text
                      selectable
                      className="mt-1 text-[11px] font-black text-slate-800"
                    >
                      {value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View className="mb-4 rounded-[1.7rem] border border-slate-100 bg-white p-5">
              <Text className="mb-3 text-[9px] font-black uppercase tracking-[1.8px] text-slate-400">
                Work & Safety
              </Text>
              <TouchableOpacity
                onPress={toggleShift}
                className="mb-2 flex-row items-center rounded-2xl bg-emerald-50 p-4"
              >
                <MaterialCommunityIcons
                  name="clock-check-outline"
                  size={21}
                  color="#059669"
                />
                <View className="ml-3 flex-1">
                  <Text className="font-black text-slate-900">
                    Delivery availability
                  </Text>
                  <Text className="mt-1 text-[9px] font-semibold text-slate-500">
                    Tap to go {partner?.is_available ? "Offline" : "Online"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#059669"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => call(partner?.store_mobile)}
                className="mb-2 flex-row items-center rounded-2xl bg-slate-50 p-4"
              >
                <MaterialCommunityIcons
                  name="lifebuoy"
                  size={21}
                  color="#475569"
                />
                <View className="ml-3 flex-1">
                  <Text className="font-black text-slate-900">
                    Contact pharmacy
                  </Text>
                  <Text className="mt-1 text-[9px] font-semibold text-slate-500">
                    Help with assignments, PIN or vehicle details
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#94a3b8"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Safety first",
                    "Emergency में सुरक्षित जगह रुकें और pharmacy या local emergency service से संपर्क करें।"
                  )
                }
                className="flex-row items-center rounded-2xl bg-rose-50 p-4"
              >
                <MaterialCommunityIcons
                  name="shield-alert-outline"
                  size={21}
                  color="#e11d48"
                />
                <View className="ml-3 flex-1">
                  <Text className="font-black text-slate-900">
                    Safety & emergency
                  </Text>
                  <Text className="mt-1 text-[9px] font-semibold text-slate-500">
                    View emergency guidance
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#e11d48"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Logout?",
                  "इस device से delivery partner account logout होगा।",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Logout", style: "destructive", onPress: logout },
                  ]
                )
              }
              className="h-14 flex-row items-center justify-center rounded-2xl border border-rose-100 bg-rose-50"
            >
              <MaterialCommunityIcons name="logout" size={20} color="#e11d48" />
              <Text className="ml-2 font-black text-rose-600">
                LOGOUT FROM THIS DEVICE
              </Text>
            </TouchableOpacity>
          </View>
        ) : !displayedJobs.length ? (
          <View className="mt-20 items-center">
            <MaterialCommunityIcons
              name={
                jobTab === "active" ? "bike-fast" : "clipboard-check-outline"
              }
              size={60}
              color="#cbd5e1"
            />
            <Text className="mt-5 text-lg font-black text-slate-800">
              {jobTab === "active"
                ? "No delivery jobs"
                : "No completed deliveries"}
            </Text>
            <Text className="mt-2 text-center text-xs font-semibold text-slate-400">
              {jobTab === "active"
                ? "Pharmacy से नई request मिलने पर यहां दिखाई देगी।"
                : "पूरी की गई deliveries यहां दिखाई देंगी।"}
            </Text>
          </View>
        ) : (
          displayedJobs.map((job) => (
            <View
              key={job.id}
              className="mb-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200"
            >
              <View className="flex-row justify-between">
                <View className="flex-1">
                  <Text className="text-[9px] font-black uppercase text-orange-600">
                    Order #{job.id}
                  </Text>
                  <Text className="mt-1 text-lg font-black text-slate-950">
                    {job.customer_name}
                  </Text>
                  <Text className="mt-1 text-[10px] font-bold text-slate-400">
                    Pickup: {job.store_name}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-3 py-2 ${
                    job.stage === "offered" ? "bg-amber-50" : job.delivery_return ? "bg-orange-50" : "bg-emerald-50"
                  }`}
                >
                  <Text
                    className={`text-[8px] font-black uppercase ${
                      job.stage === "offered"
                        ? "text-amber-700"
                        : job.delivery_return ? "text-orange-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {job.stage === "offered"
                      ? "New request"
                      : job.delivery_return ? job.delivery_return.status_label : job.stage.replace("_", " ")}
                  </Text>
                </View>
              </View>
              {job.stage === "completed" || !!job.delivery_return && jobTab === "completed" ? (
                <View className={`mt-4 rounded-2xl border p-4 ${job.delivery_return ? "border-orange-200 bg-orange-50" : "border-emerald-100 bg-emerald-50"}`}>
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name={job.delivery_return ? "package-variant-closed" : "check-decagram"}
                      size={23}
                      color={job.delivery_return ? "#ea580c" : "#059669"}
                    />
                    <View className="ml-3 flex-1">
                      <Text className={`font-black ${job.delivery_return ? "text-orange-900" : "text-emerald-900"}`}>
                        {job.delivery_return?.status === "received" ? "Return completed" : job.delivery_return?.status === "disputed" ? "Return verification issue" : job.delivery_return ? "Returning to pharmacy" : "Delivery completed"}
                      </Text>
                      <Text className={`mt-1 text-[10px] font-semibold ${job.delivery_return ? "text-orange-700" : "text-emerald-700"}`}>
                        {job.delivery_return ? (job.delivery_return.status === "received" ? (job.delivery_return.received_at ? `Pharmacy confirmed · ${new Date(job.delivery_return.received_at).toLocaleString("en-IN")}` : "Medicines handed back to pharmacy") : job.delivery_return.status === "disputed" ? "Contact pharmacy and resolve verification" : "Waiting for pharmacy receipt confirmation") : job.completed_at
                          ? new Date(job.completed_at).toLocaleString("en-IN")
                          : "Successfully handed over with OTP"}
                      </Text>
                    </View>
                  </View>
                  {job.delivery_return && <View className="mt-3 rounded-xl border border-orange-200 bg-white/70 p-3">
                    <Text className="text-[8px] font-black uppercase tracking-[1.2px] text-orange-600">Return record</Text>
                    <Text className="mt-1 text-[11px] font-black text-slate-900">{job.delivery_return.reason_label}</Text>
                    <Text className="mt-1 text-[10px] font-semibold text-slate-600">Package: {job.delivery_return.package_condition_label}</Text>
                    {job.delivery_return.note ? <Text className="mt-1 text-[10px] text-slate-500">Your note: {job.delivery_return.note}</Text> : null}
                    {job.delivery_return.store_note ? <Text className="mt-1 text-[10px] font-bold text-slate-600">Pharmacy note: {job.delivery_return.store_note}</Text> : null}
                  </View>}
                  <View className={`mt-3 border-t pt-3 ${job.delivery_return ? "border-orange-200" : "border-emerald-100"}`}>
                    <Text className={`text-[8px] font-black uppercase tracking-[1.3px] ${job.delivery_return ? "text-orange-600" : "text-emerald-600"}`}>
                      {job.delivery_return ? "Original destination" : "Delivered to"}
                    </Text>
                    <Text
                      className="mt-1 text-[10px] font-bold leading-4 text-slate-600"
                      numberOfLines={2}
                    >
                      {job.customer_address}
                    </Text>
                    <Text className="mt-2 text-[9px] font-semibold text-slate-400">
                      Customer contact hidden after completion
                    </Text>
                  </View>
                </View>
              ) : job.stage === "offered" ? (
                <View className="mt-4">
                  <View className="rounded-2xl bg-amber-50 p-3">
                    <Text className="text-xs font-black text-amber-900">
                      क्या आप यह delivery कर सकते हैं?
                    </Text>
                    <Text className="mt-1 text-[10px] font-semibold text-amber-700">
                      Accept करने के बाद ही order Out for Delivery होगा।
                    </Text>
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      disabled={busyId === job.id}
                      onPress={() =>
                        post(job, "decision", { decision: "accept" })
                      }
                      className="h-12 flex-[1.4] items-center justify-center rounded-2xl bg-emerald-600"
                    >
                      <Text className="font-black text-white">ACCEPT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyId === job.id}
                      onPress={() =>
                        Alert.alert(
                          "Reject delivery?",
                          "यह order pharmacy को वापस assignment के लिए भेज दिया जाएगा।",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Reject",
                              style: "destructive",
                              onPress: () =>
                                post(job, "decision", {
                                  decision: "reject",
                                  reason: "Partner is unavailable.",
                                }),
                            },
                          ]
                        )
                      }
                      className="h-12 flex-1 items-center justify-center rounded-2xl bg-rose-50"
                    >
                      <Text className="font-black text-rose-600">REJECT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setMapJob(job)}
                    className="mt-4 flex-row items-center rounded-2xl border border-emerald-100 bg-emerald-50 p-3"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
                      <MaterialCommunityIcons
                        name="map-marker-path"
                        size={20}
                        color="white"
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-[8px] font-black uppercase text-emerald-700">
                        Customer location
                      </Text>
                      <Text
                        className="mt-1 text-[11px] font-bold leading-4 text-slate-700"
                        numberOfLines={2}
                      >
                        {job.customer_address}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color="#047857"
                    />
                  </TouchableOpacity>
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => call(job.store_mobile)}
                      className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-slate-100"
                    >
                      <MaterialCommunityIcons
                        name="phone-in-talk-outline"
                        size={17}
                        color="#334155"
                      />
                      <Text className="ml-1.5 text-[10px] font-black text-slate-700">
                        STORE
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => call(job.customer_mobile)}
                      className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-slate-100"
                    >
                      <MaterialCommunityIcons
                        name="phone-outline"
                        size={17}
                        color="#334155"
                      />
                      <Text className="ml-1.5 text-[10px] font-black text-slate-700">
                        CUSTOMER
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigate(job)}
                      className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-blue-50"
                    >
                      <MaterialCommunityIcons
                        name="navigation-variant-outline"
                        size={17}
                        color="#2563eb"
                      />
                      <Text className="ml-1.5 text-[10px] font-black text-blue-700">
                        NAVIGATE
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {!!job.delivery_issue_code && (
                    <View className="mt-3 rounded-xl bg-rose-50 p-3">
                      <Text className="text-[9px] font-black text-rose-700">
                        Problem reported ·{" "}
                        {job.delivery_issue_note ||
                          job.delivery_issue_code.replaceAll("_", " ")}
                      </Text>
                    </View>
                  )}
                  {!!job.delivery_return && (
                    <View className={`mt-3 rounded-2xl border p-4 ${job.delivery_return.status === "disputed" ? "border-rose-200 bg-rose-50" : "border-orange-200 bg-orange-50"}`}>
                      <View className="flex-row items-center"><MaterialCommunityIcons name="package-variant-closed" size={20} color={job.delivery_return.status === "disputed" ? "#e11d48" : "#ea580c"}/><Text className="ml-2 font-black text-slate-900">Return to pharmacy</Text></View>
                      <Text className="mt-2 text-[11px] font-bold leading-4 text-slate-700">{job.delivery_return.reason_label}</Text>
                      <Text className="mt-1 text-[10px] font-semibold text-slate-500">Package: {job.delivery_return.package_condition_label}</Text>
                      {job.delivery_return.note ? <Text className="mt-1 text-[10px] text-slate-500">Note: {job.delivery_return.note}</Text> : null}
                      {job.delivery_return.status === "disputed" ? <Text className="mt-2 text-[10px] font-bold text-rose-700">Pharmacy needs clarification: {job.delivery_return.store_note || "Call the pharmacy."}</Text> : <Text className="mt-2 text-[10px] font-bold text-orange-700">Medicines pharmacy पर वापस लेकर जाएं और handover कराएं।</Text>}
                    </View>
                  )}
                  {!job.delivery_return && <View className="mt-3 flex-row gap-2">
                    {job.stage === "accepted" && (
                      <TouchableOpacity
                        disabled={busyId === job.id}
                        onPress={() =>
                          post(job, "status", { action: "picked_up" })
                        }
                        className="h-12 flex-1 items-center justify-center rounded-2xl bg-orange-600"
                      >
                        <Text className="font-black text-white">
                          ORDER PICKED UP
                        </Text>
                      </TouchableOpacity>
                    )}
                    {job.stage === "picked_up" && (
                      <TouchableOpacity
                        disabled={busyId === job.id}
                        onPress={() =>
                          post(job, "status", { action: "reached" })
                        }
                        className="h-12 flex-1 items-center justify-center rounded-2xl bg-blue-600"
                      >
                        <Text className="font-black text-white">
                          REACHED CUSTOMER
                        </Text>
                      </TouchableOpacity>
                    )}
                    {job.stage === "reached" &&
                      !job.completion_otp_requested && (
                        <TouchableOpacity
                          disabled={busyId === job.id}
                          onPress={() => post(job, "request-otp")}
                          className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-950"
                        >
                          <Text className="font-black text-white">
                            REQUEST OTP
                          </Text>
                        </TouchableOpacity>
                      )}
                    {job.stage === "reached" &&
                      job.completion_otp_requested && (
                        <TouchableOpacity
                          onPress={() => {
                            setOtpJob(job);
                            setOtp("");
                          }}
                          className="h-12 flex-1 items-center justify-center rounded-2xl bg-emerald-600"
                        >
                          <Text className="font-black text-white">
                            VERIFY OTP
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>}
                  {!job.delivery_return && <TouchableOpacity
                    onPress={() => {
                      setProblemJob(job);
                      setProblemNote("");
                    }}
                    className="mt-2 h-11 flex-row items-center justify-center rounded-xl border border-rose-100 bg-rose-50"
                  >
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={17}
                      color="#e11d48"
                    />
                    <Text className="ml-2 text-[10px] font-black text-rose-600">
                      REPORT DELIVERY PROBLEM
                    </Text>
                  </TouchableOpacity>}
                  {!job.delivery_return && <TouchableOpacity
                    onPress={() => { setReturnJob(job); setReturnReason(""); setReturnCondition("sealed"); setReturnNote(""); }}
                    className="mt-2 h-11 flex-row items-center justify-center rounded-xl border border-orange-200 bg-orange-50"
                  >
                    <MaterialCommunityIcons name="package-variant-closed" size={17} color="#ea580c" />
                    <Text className="ml-2 text-[10px] font-black text-orange-700">RETURN MEDICINES TO PHARMACY</Text>
                  </TouchableOpacity>}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
      <View className="absolute bottom-3 left-4 right-4 flex-row rounded-[1.6rem] border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-400">
        {[
          {
            key: "active" as const,
            label: "Deliveries",
            icon: "bike-fast",
            count: jobs.length,
          },
          {
            key: "completed" as const,
            label: "History",
            icon: "history",
            count: completedJobs.length,
          },
          {
            key: "issues" as const,
            label: "Issues",
            icon: "alert-circle-outline",
            count: issues.filter((issue) => issue.status === "open").length,
          },
          {
            key: "profile" as const,
            label: "Profile",
            icon: "account-circle-outline",
            count: 0,
          },
        ].map((tab) => {
          const selected = jobTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setJobTab(tab.key)}
              className={`h-14 flex-1 items-center justify-center rounded-[1.15rem] ${
                selected ? "bg-slate-950" : "bg-white"
              }`}
            >
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={20}
                  color={selected ? "#fb923c" : "#64748b"}
                />
                {tab.count > 0 && tab.key !== "profile" ? (
                  <View
                    className={`ml-1 min-w-[18px] items-center rounded-full px-1 py-0.5 ${
                      selected ? "bg-white/15" : "bg-slate-100"
                    }`}
                  >
                    <Text
                      className={`text-[7px] font-black ${
                        selected ? "text-white" : "text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`mt-1 text-[8px] font-black uppercase tracking-[0.8px] ${
                  selected ? "text-white" : "text-slate-500"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <DeliveryDestinationModal
        destination={
          mapJob
            ? {
                user_name: mapJob.customer_name,
                user_address: mapJob.customer_address,
                latitude: mapJob.latitude,
                longitude: mapJob.longitude,
              }
            : null
        }
        onClose={() => setMapJob(null)}
      />
      <Modal
        visible={!!selectedIssue}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedIssue(null)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="max-h-[88%] rounded-t-[2rem] bg-white px-5 pb-8 pt-4">
            <View className="items-center">
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </View>
            <View className="mt-4 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[9px] font-black uppercase tracking-[1.8px] text-orange-600">
                  Order #{selectedIssue?.order_id} ·{" "}
                  {selectedIssue?.delivery_stage}
                </Text>
                <Text className="mt-1 text-2xl font-black text-slate-950">
                  {selectedIssue?.issue_label}
                </Text>
                <Text className="mt-1 text-[10px] font-semibold text-slate-500">
                  Reported{" "}
                  {selectedIssue?.reported_at
                    ? new Date(selectedIssue.reported_at).toLocaleString(
                        "en-IN"
                      )
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedIssue(null)}
                className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#334155"
                />
              </TouchableOpacity>
            </View>
            <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
              <View
                className={`rounded-2xl p-4 ${
                  selectedIssue?.status === "open"
                    ? "bg-amber-50"
                    : "bg-emerald-50"
                }`}
              >
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name={
                      selectedIssue?.status === "open"
                        ? "alert-circle-outline"
                        : "check-circle-outline"
                    }
                    size={21}
                    color={
                      selectedIssue?.status === "open" ? "#d97706" : "#059669"
                    }
                  />
                  <Text
                    className={`ml-2 font-black uppercase ${
                      selectedIssue?.status === "open"
                        ? "text-amber-800"
                        : "text-emerald-800"
                    }`}
                  >
                    {selectedIssue?.status}
                  </Text>
                </View>
                <Text className="mt-2 text-[10px] font-semibold leading-4 text-slate-600">
                  {selectedIssue?.status === "open"
                    ? "Problem अभी active है। ठीक होने पर नीचे resolution लिखकर close करें।"
                    : selectedIssue?.resolution_note || "Issue resolved."}
                </Text>
                {selectedIssue?.resolved_at && (
                  <Text className="mt-2 text-[8px] font-bold uppercase text-slate-400">
                    Resolved{" "}
                    {new Date(selectedIssue.resolved_at).toLocaleString(
                      "en-IN"
                    )}
                  </Text>
                )}
              </View>
              <Text className="mb-2 mt-5 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                Customer & Order
              </Text>
              <View className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <Text className="font-black text-slate-900">
                  {selectedIssue?.customer_name}
                </Text>
                <Text className="mt-2 text-[10px] font-semibold leading-4 text-slate-600">
                  {selectedIssue?.customer_address}
                </Text>
                <Text className="mt-2 text-[9px] font-bold uppercase text-slate-400">
                  Order status · {selectedIssue?.order_status}
                </Text>
                {selectedIssue?.customer_mobile && (
                  <TouchableOpacity
                    onPress={() => call(selectedIssue.customer_mobile)}
                    className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-white"
                  >
                    <MaterialCommunityIcons
                      name="phone-outline"
                      size={17}
                      color="#2563eb"
                    />
                    <Text className="ml-2 text-[10px] font-black text-blue-700">
                      CALL CUSTOMER
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="mb-2 mt-5 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                Pharmacy
              </Text>
              <View className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <Text className="font-black text-slate-900">
                  {selectedIssue?.store_name}
                </Text>
                <Text className="mt-2 text-[10px] font-semibold leading-4 text-slate-600">
                  {selectedIssue?.store_address}
                </Text>
                {selectedIssue?.store_mobile && (
                  <TouchableOpacity
                    onPress={() => call(selectedIssue.store_mobile)}
                    className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-white"
                  >
                    <MaterialCommunityIcons
                      name="phone-in-talk-outline"
                      size={17}
                      color="#059669"
                    />
                    <Text className="ml-2 text-[10px] font-black text-emerald-700">
                      CALL PHARMACY
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="mb-2 mt-5 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                Partner Report
              </Text>
              <View className="rounded-2xl bg-slate-950 p-4">
                <Text className="font-black text-white">
                  {selectedIssue?.issue_label}
                </Text>
                <Text className="mt-2 text-[10px] font-semibold leading-4 text-slate-300">
                  {selectedIssue?.note || "No additional note was added."}
                </Text>
              </View>
              {selectedIssue?.status === "open" && (
                <View className="mt-5">
                  <Text className="mb-2 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                    How was it resolved?
                  </Text>
                  <TextInput
                    value={issueResolutionNote}
                    onChangeText={setIssueResolutionNote}
                    placeholder="Example: Customer answered and confirmed the address"
                    multiline
                    maxLength={240}
                    className="min-h-[92px] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] font-semibold text-slate-900"
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    disabled={resolvingIssueId === selectedIssue.id}
                    onPress={resolveIssue}
                    className="mb-3 mt-3 h-14 flex-row items-center justify-center rounded-2xl bg-emerald-600"
                  >
                    {resolvingIssueId === selectedIssue.id ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="check-decagram-outline"
                          size={20}
                          color="white"
                        />
                        <Text className="ml-2 font-black text-white">
                          MARK ISSUE RESOLVED
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!problemJob}
        transparent
        animationType="slide"
        onRequestClose={() => setProblemJob(null)}
      >
        <View className="flex-1 justify-end bg-slate-950/60">
          <View className="rounded-t-[2rem] bg-white p-5">
            <Text className="text-xl font-black text-slate-950">
              Delivery में क्या problem है?
            </Text>
            <Text className="mt-1 text-xs font-semibold text-slate-500">
              Seller को यह update तुरंत दिखाई देगी।
            </Text>
            <View className="mt-4">
              {PROBLEMS.map(([code, label]) => (
                <TouchableOpacity
                  key={code}
                  onPress={async () => {
                    if (
                      problemJob &&
                      (await post(problemJob, "problem", {
                        code,
                        note: problemNote,
                      }))
                    ) {
                      setProblemJob(null);
                    }
                  }}
                  className="mb-2 rounded-2xl border border-slate-200 p-3.5"
                >
                  <Text className="font-bold text-slate-800">{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={problemNote}
              onChangeText={setProblemNote}
              placeholder="Extra note (optional)"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            />
            <TouchableOpacity
              onPress={() => setProblemJob(null)}
              className="mt-3 h-12 items-center justify-center rounded-2xl bg-slate-100"
            >
              <Text className="font-black text-slate-600">CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={!!returnJob} transparent animationType="slide" onRequestClose={() => setReturnJob(null)}>
        <View className="flex-1 justify-end bg-slate-950/60">
          <ScrollView className="max-h-[88%] rounded-t-[2rem] bg-white p-5">
            <Text className="text-xl font-black text-slate-950">Return medicines</Text>
            <Text className="mt-1 text-xs font-semibold text-slate-500">यह failed delivery बंद नहीं करेगा। Pharmacy medicines receive करके order close करेगी।</Text>
            <Text className="mb-2 mt-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Failure reason</Text>
            {RETURN_REASONS.map(([code, label]) => <TouchableOpacity key={code} onPress={() => setReturnReason(code)} className={`mb-2 flex-row items-center rounded-2xl border p-3.5 ${returnReason === code ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}><MaterialCommunityIcons name={returnReason === code ? "radiobox-marked" : "radiobox-blank"} size={19} color={returnReason === code ? "#ea580c" : "#94a3b8"}/><Text className="ml-3 flex-1 font-bold text-slate-800">{label}</Text></TouchableOpacity>)}
            <Text className="mb-2 mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Package condition</Text>
            <View className="flex-row gap-2">{[["sealed","Sealed"],["opened","Opened"],["damaged","Damaged"]].map(([code,label]) => <TouchableOpacity key={code} onPress={() => setReturnCondition(code)} className={`flex-1 items-center rounded-xl border py-3 ${returnCondition === code ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}><Text className={`text-[10px] font-black ${returnCondition === code ? "text-orange-700" : "text-slate-500"}`}>{label}</Text></TouchableOpacity>)}</View>
            <TextInput value={returnNote} onChangeText={setReturnNote} placeholder="Handover note (optional)" className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" />
            <TouchableOpacity disabled={!returnReason || busyId === returnJob?.id} onPress={async () => { if (returnJob && await post(returnJob, "return", { reason: returnReason, package_condition: returnCondition, note: returnNote })) setReturnJob(null); }} className={`mt-4 h-13 items-center justify-center rounded-2xl ${returnReason ? "bg-orange-600" : "bg-slate-200"}`}><Text className="font-black text-white">START RETURN TO PHARMACY</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setReturnJob(null)} className="mb-8 mt-2 h-12 items-center justify-center rounded-2xl bg-slate-100"><Text className="font-black text-slate-600">CANCEL</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      {otpJob && (
        <View className="absolute inset-0 items-center justify-center bg-slate-950/70 px-6">
          <View className="w-full rounded-[2rem] bg-white p-6">
            <Text className="text-xl font-black text-slate-950">
              Customer OTP
            </Text>
            <Text className="mt-1 text-xs font-semibold text-slate-500">
              Customer को भेजा गया 6-digit code डालें।
            </Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-2xl font-black tracking-[8px]"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setOtpJob(null)}
                className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-100"
              >
                <Text className="font-black text-slate-600">CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (await post(otpJob, "verify-otp", { otp })) {
                    setOtpJob(null);
                  }
                }}
                className="h-12 flex-[1.4] items-center justify-center rounded-2xl bg-emerald-600"
              >
                <Text className="font-black text-white">COMPLETE DELIVERY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
