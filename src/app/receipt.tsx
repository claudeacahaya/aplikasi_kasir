import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { receiptStyles as styles } from '../styles/receipt.styles';

interface ReceiptLineItem {
  name: string;
  price: number;
  qty: number;
  subtotal: number;
}

interface ReceiptPayload {
  transactionId: string | number;
  createdAt: string;
  paymentMethod: 'Tunai' | 'Non-Tunai';
  note: string | null;
  totalAmount: number;
  cashReceived: number | null;
  changeAmount: number | null;
  items: ReceiptLineItem[];
}

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receiptJson?: string }>();

  const receipt = useMemo<ReceiptPayload | null>(() => {
    try {
      if (!params.receiptJson) return null;
      return JSON.parse(String(params.receiptJson)) as ReceiptPayload;
    } catch {
      return null;
    }
  }, [params.receiptJson]);

  const formattedDate = useMemo(() => {
    if (!receipt?.createdAt) return '-';
    const d = new Date(receipt.createdAt);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [receipt?.createdAt]);

  const handleShareReceipt = async () => {
    if (!receipt) return;

    const itemLines = receipt.items
      .map(
        (it) =>
          `- ${it.name} (${it.qty} x Rp ${it.price.toLocaleString('id-ID')}) = Rp ${it.subtotal.toLocaleString('id-ID')}`
      )
      .join('\n');

    const paymentLines =
      receipt.paymentMethod === 'Tunai'
        ? `Tunai     : Rp ${(receipt.cashReceived ?? 0).toLocaleString('id-ID')}\nKembalian : Rp ${(receipt.changeAmount ?? 0).toLocaleString('id-ID')}`
        : `Metode    : Non-Tunai${receipt.note ? ` (${receipt.note})` : ''}`;

    const text = [
      '=== NOTA PEMBAYARAN ===',
      `No. Nota  : #TRX-${receipt.transactionId}`,
      `Tanggal   : ${formattedDate}`,
      '-----------------------',
      itemLines,
      '-----------------------',
      `TOTAL     : Rp ${receipt.totalAmount.toLocaleString('id-ID')}`,
      paymentLines,
      '=======================',
      'Terima kasih telah berbelanja!',
    ].join('\n');

    await Share.share({ message: text });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Nota Transaksi</Text>
        <Text style={styles.topBarSub}>Bukti pembayaran penjualan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.paperCard}>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>PEMBAYARAN BERHASIL</Text>
          </View>

          <Text style={styles.storeTitle}>Kasir UMKM</Text>
          <Text style={styles.receiptSubtitle}>Struk Pembelian Pelanggan</Text>

          <View style={styles.dashedDivider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>No. Transaksi</Text>
            <Text style={styles.metaValue}>
              #TRX-{receipt?.transactionId ?? '-'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Waktu</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Metode Bayar</Text>
            <Text style={styles.metaValue}>
              {receipt?.paymentMethod ?? '-'}
            </Text>
          </View>

          {receipt?.paymentMethod === 'Non-Tunai' && receipt?.note ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Keterangan</Text>
              <Text style={styles.metaValue}>{receipt.note}</Text>
            </View>
          ) : null}

          <View style={styles.dashedDivider} />

          <Text style={styles.itemHeader}>Rincian Item</Text>
          {(receipt?.items ?? []).map((item, idx) => (
            <View key={`${item.name}-${idx}`} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQtyPrice}>
                  {item.qty} x Rp {item.price.toLocaleString('id-ID')}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </Text>
            </View>
          ))}

          <View style={styles.dashedDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Belanja</Text>
            <Text style={styles.totalValue}>
              Rp {(receipt?.totalAmount ?? 0).toLocaleString('id-ID')}
            </Text>
          </View>

          {receipt?.paymentMethod === 'Tunai' ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.payDetailLabel}>Uang Bayar</Text>
                <Text style={styles.payDetailValue}>
                  Rp {(receipt.cashReceived ?? 0).toLocaleString('id-ID')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.payDetailLabel}>Kembalian</Text>
                <Text style={styles.changeValue}>
                  Rp {(receipt.changeAmount ?? 0).toLocaleString('id-ID')}
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.dashedDivider} />

          <Text style={styles.footerNote}>
            Terima kasih atas kunjungan Anda!
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareReceipt}>
            <Text style={styles.shareBtnText}>Bagikan / Kirim Nota</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace('/products' as never)}
          >
            <Text style={styles.doneBtnText}>Selesai & Kembali ke Produk</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}