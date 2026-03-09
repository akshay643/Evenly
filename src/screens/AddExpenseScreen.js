// src/screens/AddExpenseScreen.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { Linking, Share } from 'react-native';

// ✅ Import FREE Tesseract scanner
import { 
  scanReceiptWithTesseract, 
  validateReceiptData,
  formatCurrency 
} from '../utils/receiptScanner';

import {
  sendPushNotification,
  NotificationTemplates,
} from "../services/notificationService";
import { haptic } from "../utils/haptics";
import { PremiumContext } from "../context/PremiumContext";
import { usePremiumLimit, LimitIndicator } from "../components/PremiumLimitCheck";
import { useGroupExpenseCount } from "../hooks/useGroupExpenseCount";
import { AuthContext } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase.config";
import SplitMethodPicker from "../components/SplitMethodPicker";

export default function AddExpenseScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { hasFeature, isPremium } = useContext(PremiumContext);
  const { checkLimit } = usePremiumLimit();
  
  // States
  const [scanning, setScanning] = useState(false);
  const [scannedReceipt, setScannedReceipt] = useState(null);
  const [description, setDescription] = useState("");
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState(''); // ✅ For Tesseract progress
  const [amount, setAmount] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [membersData, setMembersData] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const { count: userExpenseCount, loading: countLoading } =
    useGroupExpenseCount(user?.uid, selectedGroup?.id);

  const [splitData, setSplitData] = useState({
    method: "equal",
    splitAmounts: {},
    isValid: true,
  });

  useEffect(() => {
    loadGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup);
    } else {
      setMembersData([]);
      setSelectedMembers([]);
    }
  }, [selectedGroup?.id]);

  // ========================================
  // ✅ TESSERACT RECEIPT SCANNING
  // ========================================
  
  const scanReceipt = async () => {
    if (!hasFeature('receiptScanning')) {
      Alert.alert(
        '🔒 Premium Feature',
        'Receipt scanning with AI is available with Premium.\n\n✓ Auto-detect amount\n✓ Extract merchant name\n✓ Find line items\n✓ Higher accuracy',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '💎 Upgrade for ₹149', onPress: () => navigation.navigate('Premium') },
        ]
      );
      return;
    }

    setScanError(null);
    setScanProgress('');
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo access to scan receipts');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets?.[0]) {
      const imageUri = result.assets[0].uri;
      setScannedReceipt(imageUri);
      setScanning(true);
      setScanProgress('Initializing scanner...');

      try {
        console.log('🔄 Starting Tesseract scan...');
        
        // ✅ Scan with progress callback
        const extractedData = await scanReceiptWithTesseract(imageUri, (progress) => {
          setScanProgress(progress);
        });
        
        console.log('📊 Scan complete:', extractedData);

        // Validate
        const validation = validateReceiptData(extractedData);

        // ✅ Auto-fill form
        if (extractedData.amount > 0) {
          setAmount(extractedData.amount.toString());
        }

        if (extractedData.description && extractedData.description !== 'Receipt Expense') {
          setDescription(extractedData.description);
        }

        setScanning(false);
        setScanProgress('');

        // Show results
        if (validation.errors.length > 0) {
          Alert.alert(
            '⚠️ Partial Scan',
            `${validation.errors.join('\n')}\n\nPlease verify values manually.`,
            [{ text: 'OK' }]
          );
        } else {
          const warningText = validation.warnings.length > 0 
            ? `\n\n⚠️ ${validation.warnings.join('\n')}`
            : '';
          
          Alert.alert(
            '✅ Receipt Scanned!',
            `Amount: ${formatCurrency(extractedData.amount)}\nMerchant: ${extractedData.description}\nConfidence: ${Math.round(extractedData.confidence * 100)}%${warningText}\n\nPlease verify the values.`,
            [
              { text: 'Edit Values', style: 'cancel' },
              { text: 'Looks Good ✓' }
            ]
          );
        }

      } catch (error) {
        console.error('❌ Scan failed:', error);
        setScanning(false);
        setScanProgress('');
        setScanError(error.message);
        
        Alert.alert(
          '❌ Scan Failed',
          `${error.message}\n\nTips:\n• Use good lighting\n• Keep receipt flat\n• Make text readable\n• Avoid shadows`,
          [
            { text: 'Try Again', onPress: () => setScannedReceipt(null) },
            { text: 'Enter Manually' }
          ]
        );
      }
    }
  };

  const takeReceiptPhoto = async () => {
    if (!hasFeature('receiptScanning')) {
      Alert.alert(
        '🔒 Premium Feature',
        'Receipt scanning is a Premium feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '💎 Upgrade for ₹149', onPress: () => navigation.navigate('Premium') },
        ]
      );
      return;
    }

    setScanError(null);
    setScanProgress('');

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets?.[0]) {
      const imageUri = result.assets[0].uri;
      setScannedReceipt(imageUri);
      setScanning(true);
      setScanProgress('Processing photo...');

      try {
        const extractedData = await scanReceiptWithTesseract(imageUri, (progress) => {
          setScanProgress(progress);
        });
        
        const validation = validateReceiptData(extractedData);

        if (extractedData.amount > 0) setAmount(extractedData.amount.toString());
        if (extractedData.description !== 'Receipt Expense') setDescription(extractedData.description);

        setScanning(false);
        setScanProgress('');

        if (validation.isValid) {
          Alert.alert(
            '✅ Receipt Captured!',
            `Amount: ${formatCurrency(extractedData.amount)}\nMerchant: ${extractedData.description}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '⚠️ Partial Detection',
            `${validation.errors.join('\n')}\n\nPlease verify values.`,
            [{ text: 'OK' }]
          );
        }

      } catch (error) {
        setScanning(false);
        setScanProgress('');
        setScanError(error.message);
        Alert.alert('❌ Scan Failed', error.message);
      }
    }
  };

  // ========================================
  // WhatsApp Share
  // ========================================
  
  const shareExpenseToWhatsApp = async (expenseData) => {
    const memberNames = selectedMembers
      .map(id => membersData.find(m => m.id === id)?.name || membersData.find(m => m.id === id)?.email || 'Member')
      .join(', ');
    
    const perPerson = parsedAmount / selectedMembers.length;
    
    const message = `🧾 *New Expense Added*

📝 ${expenseData.description}
💰 Total: ${sym}${parsedAmount.toFixed(2)}
👥 Split between: ${selectedMembers.length} ${selectedMembers.length === 1 ? 'person' : 'people'}
💵 Each pays: ${sym}${perPerson.toFixed(2)}

Track & settle easily with SplitBill 👇
https://play.google.com/store/apps/details?id=com.yourapp.splitbill`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message });
      }
    } catch (e) {
      await Share.share({ message });
    }
  };

  // ========================================
  // Data Loading
  // ========================================

  const loadGroups = async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snapshot = await getDocs(q);
      const groupsData = [];
      snapshot.forEach((d) => {
        groupsData.push({ id: d.id, ...d.data() });
      });
      setGroups(groupsData);

      if (route?.params?.groupId) {
        const pre = groupsData.find((g) => g.id === route.params.groupId);
        if (pre) {
          setSelectedGroup(pre);
          return;
        }
      }
      if (groupsData.length > 0) setSelectedGroup(groupsData[0]);
    } catch (error) {
      Alert.alert("Error", "Failed to load groups");
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupMembers = async (group) => {
    if (!group?.members?.length) return;
    setLoadingMembers(true);
    try {
      const members = await Promise.all(
        group.members.map(async (mid) => {
          const d = await getDoc(doc(db, "users", mid));
          return d.exists()
            ? { id: mid, ...d.data() }
            : { id: mid, name: null, email: "Unknown" };
        })
      );
      setMembersData(members);
      setSelectedMembers(members.map((m) => m.id));
    } catch (e) {
      console.error("Error loading members:", e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getCurrencySymbol = () => {
    const map = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      INR: "₹",
      JPY: "¥",
      AUD: "A$",
      CAD: "C$",
    };
    return map[selectedGroup?.currency] || "₹";
  };

  const sym = getCurrencySymbol();
  const parsedAmount = parseFloat(amount) || 0;

  const isSplitMethodAllowed = (method) => {
    if (method === "equal") return true;
    return hasFeature("advancedSplits");
  };

  // ========================================
  // Handle Add Expense
  // ========================================

  const handleAddExpense = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (!selectedGroup) {
      Alert.alert("Error", "Please select a group");
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert("Error", "Select at least one member to split with");
      return;
    }
    if (!splitData.isValid) {
      Alert.alert(
        "Invalid Split",
        "The split amounts don't add up correctly. Please fix before adding."
      );
      return;
    }

    if (!isSplitMethodAllowed(splitData.method)) {
      const methodNames = {
        exact: "Exact amount",
        percentage: "Percentage",
        shares: "Share ratio",
      };
      const methodName = methodNames[splitData.method] || splitData.method;
      
      Alert.alert(
        "🔒 Premium Feature",
        `${methodName} split is available with Premium. Upgrade to unlock all split methods!`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "💎 Upgrade to Premium", 
            onPress: () => navigation.navigate("Premium") 
          },
        ]
      );
      return;
    }

    if (!checkLimit("maxExpensesPerGroup", userExpenseCount)) {
      return;
    }

    setLoading(true);
    try {
      const expenseDoc = {
        description: description.trim(),
        amount: parsedAmount,
        groupId: selectedGroup.id,
        paidBy: user.uid,
        paidByEmail: user.email,
        splitBetween: selectedMembers,
        splitMethod: splitData.method,
        createdAt: Date.now(),
        settled: false,
        receiptImage: scannedReceipt || null,
      };

      if (splitData.method !== "equal") {
        expenseDoc.splitAmounts = splitData.splitAmounts;
      }

      await addDoc(collection(db, "expenses"), expenseDoc);
      haptic.success();

      // Send push notifications
      const template = NotificationTemplates.newExpense(
        user.email,
        parsedAmount,
        selectedGroup.name,
        sym
      );
      for (const memberId of selectedMembers) {
        if (memberId === user.uid) continue;
        try {
          const mDoc = await getDoc(doc(db, "users", memberId));
          const mData = mDoc.data();
          if (mData?.pushToken) {
            await sendPushNotification(mData.pushToken, {
              ...template,
              data: { ...template.data, groupId: selectedGroup.id },
            });
          }
        } catch (e) {
          console.log("Push to", memberId, "failed:", e.message);
        }
      }

      Alert.alert(
        "✅ Expense Added!",
        `${sym}${parsedAmount.toFixed(2)} split between ${selectedMembers.length} ${selectedMembers.length === 1 ? 'person' : 'people'}`,
        [
          { 
            text: "Share to WhatsApp", 
            onPress: () => {
              shareExpenseToWhatsApp(expenseDoc);
              setTimeout(() => navigation.goBack(), 500);
            }
          },
          { 
            text: "Done", 
            onPress: () => navigation.goBack(),
            style: 'cancel'
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add expense: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={{ width: 24 }} />
        </View>

        {selectedGroup && !countLoading && (
          <LimitIndicator
            limitKey="maxExpensesPerGroup"
            currentCount={userExpenseCount}
            label={`Your expenses in ${selectedGroup.name}`}
          />
        )}

        <View style={styles.form}>
          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{sym}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* ✅ Receipt Scan Button with Progress */}
          {/* <View style={styles.scanSection}>
            <TouchableOpacity
              style={[
                styles.scanBtn,
                !hasFeature('receiptScanning') && styles.scanBtnLocked,
                scanning && styles.scanBtnScanning
              ]}
              onPress={() => {
                Alert.alert(
                  '📸 Scan Receipt',
                  'Choose how to add your receipt',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: '📷 Take Photo', onPress: takeReceiptPhoto },
                    { text: '🖼️ From Gallery', onPress: scanReceipt },
                  ]
                );
              }}
              disabled={scanning}
            >
              {scanning ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.scanBtnText, { fontSize: 13 }]}>
                      Scanning...
                    </Text>
                    {scanProgress && (
                      <Text style={[styles.scanBtnText, { fontSize: 11, opacity: 0.7, marginTop: 2 }]}>
                        {scanProgress}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <>
                  <Ionicons 
                    name={hasFeature('receiptScanning') ? "scan" : "lock-closed"} 
                    size={20} 
                    color={hasFeature('receiptScanning') ? "#6366F1" : "#F59E0B"} 
                  />
                  <Text style={[
                    styles.scanBtnText,
                    !hasFeature('receiptScanning') && { color: '#F59E0B' }
                  ]}>
                    {scannedReceipt ? '✓ Receipt scanned' : 'Scan Receipt'}
                  </Text>
                  {!hasFeature('receiptScanning') && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>

            {scannedReceipt && !scanning && (
              <View style={styles.scannedPreview}>
                <Image 
                  source={{ uri: scannedReceipt }} 
                  style={styles.scannedThumb} 
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.removeScanned}
                  onPress={() => {
                    setScannedReceipt(null);
                    setScanError(null);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}

            {scanError && (
              <View style={styles.scanErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.scanErrorText}>{scanError}</Text>
              </View>
            )}

            {!scannedReceipt && hasFeature('receiptScanning') && !scanning && (
              <View style={styles.scanTips}>
                <Text style={styles.scanTipsTitle}>📸 Tips for best results:</Text>
                <Text style={styles.scanTip}>• Use good lighting (natural light is best)</Text>
                <Text style={styles.scanTip}>• Keep receipt flat & centered</Text>
                <Text style={styles.scanTip}>• Make sure text is clear & readable</Text>
                <Text style={styles.scanTip}>• Avoid shadows and glare</Text>
              </View>
            )}
          </View> */}

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Group */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group</Text>
            {loadingGroups ? (
              <ActivityIndicator
                size="small"
                color="#6366F1"
                style={{ marginVertical: 10 }}
              />
            ) : groups.length === 0 ? (
              <Text style={styles.noGroupsText}>
                No groups available. Create a group first.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupChip,
                      selectedGroup?.id === group.id &&
                        styles.groupChipSelected,
                    ]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text style={styles.groupChipEmoji}>
                      {group.icon || "👥"}
                    </Text>
                    <Text
                      style={[
                        styles.groupChipText,
                        selectedGroup?.id === group.id &&
                          styles.groupChipTextSelected,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Split Method Picker */}
          {selectedGroup && !loadingMembers && membersData.length > 0 && (
            <View style={styles.inputGroup}>
              <SplitMethodPicker
                members={membersData}
                totalAmount={parsedAmount}
                currentUserId={user.uid}
                currencySymbol={sym}
                selectedMembers={selectedMembers}
                onSelectedMembersChange={setSelectedMembers}
                onSplitDataChange={setSplitData}
              />
            </View>
          )}

          {loadingMembers && (
            <ActivityIndicator
              size="small"
              color="#6366F1"
              style={{ marginVertical: 16 }}
            />
          )}

          {/* Paid by info */}
          {selectedGroup && (
            <View style={styles.paidByInfo}>
              <Ionicons name="wallet-outline" size={18} color="#6366F1" />
              <Text style={styles.paidByText}>
                Paid by <Text style={{ fontWeight: "bold" }}>you</Text>
                {selectedMembers.length > 0 &&
                  `, split with ${selectedMembers.length} ${
                    selectedMembers.length === 1 ? "person" : "people"
                  }`}
                {splitData.method !== "equal" && ` (${splitData.method})`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.addButton,
            (loading || !splitData.isValid) && styles.addButtonDisabled,
          ]}
          onPress={handleAddExpense}
          disabled={loading || !splitData.isValid}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="add-circle"
                size={22}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addButtonText}>Add Expense</Text>
              {parsedAmount > 0 &&
                selectedMembers.length > 0 &&
                splitData.method === "equal" && (
                  <Text style={styles.addButtonSub}>
                    {"  •  "}
                    {sym}
                    {(parsedAmount / selectedMembers.length).toFixed(2)}
                    /person
                  </Text>
                )}
            </View>
          )}
        </TouchableOpacity>

        {!splitData.isValid && (
          <View style={styles.footerWarning}>
            <Ionicons
              name="alert-circle"
              size={16}
              color="#EF4444"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.footerWarningTxt}>
              Split amounts don't add up — fix before adding
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1F2937" },
  form: { padding: 20 },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366F1",
    marginRight: 10,
  },
  amountInput: { flex: 1, fontSize: 48, fontWeight: "bold", color: "#1F2937" },
  
  scanSection: {
    marginBottom: 20,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    minHeight: 50,
  },
  scanBtnLocked: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  scanBtnScanning: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    borderStyle: 'solid',
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
  proBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  scannedPreview: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  scannedThumb: {
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  removeScanned: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  scanErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  scanErrorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  scanTips: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  scanTipsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  scanTip: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  groupChipSelected: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  groupChipEmoji: { fontSize: 20, marginRight: 8 },
  groupChipText: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  groupChipTextSelected: { color: "white" },
  noGroupsText: { color: "#6B7280", fontSize: 14, fontStyle: "italic" },
  paidByInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  paidByText: {
    marginLeft: 10,
    color: "#4338CA",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addButton: {
    backgroundColor: "#6366F1",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  addButtonSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
  footerWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  footerWarningTxt: { fontSize: 12, color: "#991B1B", fontWeight: "600" },
});