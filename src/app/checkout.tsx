import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiRequest, ProductItem } from '../services/api';
import { checkoutStyles as styles } from '../styles/checkout.styles';

interface SelectedParamItem {
  productId: string;
  qty: number;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemsJson?: string }>();

  const [selectedItems, setSelectedItems] = useState<SelectedParamItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Non-Tunai'>('Tunai');
  const [cashInput, setCashInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const parsed = params.itemsJson ? JSON.parse(String(params.itemsJson)) : [];
      if (Array.isArray(parsed)) {
        setSelectedItems(parsed);
      }
    } catch {
      setSelectedItems([]);
    }

    const fetchProducts = async () => {
      const res = await apiRequest<ProductItem[]>('/products');
      if (res.ok && Array.isArray(res.data)) {
        setProducts(res.data);
      }
    };
    fetchProducts();
  }, [params.itemsJson]);

  const lines = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return selectedItems
      .map((entry) => {
        const prod = productMap.get(entry.productId);
        if (!prod || entry.qty <= 0) return null;
        return {
          product: prod,
          qty: entry.qty,
          subtotal: prod.price * entry.qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [products, selectedItems]);

  const totalAmount = useMemo(
    () => lines.reduce((sum, item) => sum + item.subtotal, 0),
    [lines]
  );

  const cashNumber = Number(cashInput.replace(/\D/g, '') || 0);
  const changeAmount = cashNumber >= totalAmount ? cashNumber - totalAmount : 0;

  const handlePay = async () => {
    if (lines.length === 0) {
      Alert.alert('Info', 'Keranjang kosong.');
      return;
    }

    for (const item of lines) {
      if (item.qty > item.product.stock) {
        Alert.alert(
          'Stok tidak cukup',
          `Stok "${item.product.name}" tersisa ${item.product.stock}.`
        );
        return;
      }
    }

    if (paymentMethod === 'Tunai' && cashNumber < totalAmount) {
      Alert.alert('Pembayaran Ditolak', 'Uang bayar kurang dari total belanja.');
      return;
    }

    setSubmitting(true);
    const res = await apiRequest<{
      transactionId: number;
      totalAmount: number;
      changeAmount: number;
    }>('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        items: lines.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
        })),
        paymentMethod,
        cashReceived: paymentMethod === 'Tunai' ? cashNumber : null,
        note:
          paymentMethod === 'Non-Tunai'
            ? noteInput.trim().slice(0, 100)
            : null,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      Alert.alert('Gagal', res.message);
      return;
    }

    const receiptData = {
      transactionId: res.data?.transactionId ?? Date.now(),
      createdAt: new Date().toISOString(),
      paymentMethod,
      note:
        paymentMethod === 'Non-Tunai' && noteInput.trim()
          ? noteInput.trim().slice(0, 100)
          : null,
      totalAmount,
      cashReceived: paymentMethod === 'Tunai' ? cashNumber : null,
      changeAmount: paymentMethod === 'Tunai' ? changeAmount : null,
      items: lines.map((item) => ({
        name: item.product.name,
        price: item.product.price,
        qty: item.qty,
        subtotal: item.subtotal,
      })),
    };

    router.replace({
      pathname: '/receipt' as never,
      params: { receiptJson: JSON.stringify(receiptData) },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Checkout & Pembayaran</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>

          {lines.map((item) => (
            <View key={item.product.id} style={styles.itemRow}>
              <View>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemSubMeta}>
                  {item.qty} x Rp {item.product.price.toLocaleString('id-ID')}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Bayar</Text>
            <Text style={styles.totalAmount}>
              Rp {totalAmount.toLocaleString('id-ID')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>

          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[
                styles.methodBtn,
                paymentMethod === 'Tunai' && styles.methodBtnActive,
              ]}
              onPress={() => setPaymentMethod('Tunai')}
            >
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === 'Tunai' && styles.methodTextActive,
                ]}
              >
                Tunai
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodBtn,
                paymentMethod === 'Non-Tunai' && styles.methodBtnActive,
              ]}
              onPress={() => setPaymentMethod('Non-Tunai')}
            >
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === 'Non-Tunai' && styles.methodTextActive,
                ]}
              >
                Non-Tunai
              </Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'Tunai' ? (
            <>
              <Text style={styles.label}>Uang Bayar (Rp)</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan nominal uang bayar"
                value={cashInput}
                onChangeText={setCashInput}
                keyboardType="number-pad"
              />

              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>Kembalian</Text>
                <Text style={styles.changeValue}>
                  Rp {changeAmount.toLocaleString('id-ID')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Keterangan (Opsional, maks 100)</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: QRIS atau DANA"
                value={noteInput}
                onChangeText={(val) => setNoteInput(val.slice(0, 100))}
                maxLength={100}
              />
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePay}
          disabled={submitting || lines.length === 0}
        >
          <Text style={styles.payBtnText}>
            {submitting ? 'Memproses...' : 'Bayar Sekarang'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}