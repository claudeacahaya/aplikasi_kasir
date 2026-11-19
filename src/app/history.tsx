import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as XLSX from 'xlsx';
import { apiRequest, TransactionRecord } from '../services/api';
import { historyStyles as styles } from '../styles/history.styles';

type PeriodFilter = 'today' | '7days' | 'month';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: 'Hari Ini',
  '7days': '7 Hari Terakhir',
  month: 'Bulan Ini',
};

export default function HistoryScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadTransactions = useCallback(async (selectedPeriod: PeriodFilter) => {
    const res = await apiRequest<TransactionRecord[]>(
      `/transactions?period=${selectedPeriod}`
    );
    if (res.ok && Array.isArray(res.data)) {
      setTransactions(res.data);
    } else if (!res.ok) {
      Alert.alert('Gagal', res.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions(period);
    }, [loadTransactions, period])
  );

  const handleSelectPeriod = (nextPeriod: PeriodFilter) => {
    setPeriod(nextPeriod);
    setExpandedId(null);
  };

  const totalSales = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.totalAmount, 0),
    [transactions]
  );

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      Alert.alert('Info', 'Belum ada data transaksi pada periode ini untuk diekspor.');
      return;
    }

    try {
      setExporting(true);

      const summarySheetData = [
        {
          Periode: PERIOD_LABELS[period],
          'Jumlah Transaksi': transactions.length,
          'Total Penjualan (Rp)': totalSales,
          'Diekspor Pada': formatDateTime(new Date().toISOString()),
        },
      ];

      const detailRows: Record<string, string | number>[] = [];
      for (const tx of transactions) {
        const waktu = formatDateTime(tx.createdAt);
        for (const item of tx.items) {
          detailRows.push({
            'No. Transaksi': `TRX-${tx.id}`,
            Waktu: waktu,
            'Metode Pembayaran': tx.paymentMethod,
            Keterangan: tx.note ?? '-',
            'Nama Produk': item.productName,
            'Harga Satuan (Rp)': item.productPrice,
            Qty: item.qty,
            'Subtotal Item (Rp)': item.subtotal,
            'Total Transaksi (Rp)': tx.totalAmount,
            'Uang Bayar (Rp)': tx.cashReceived ?? 0,
            'Kembalian (Rp)': tx.changeAmount ?? 0,
          });
        }
      }

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Rincian Transaksi');

      const wbBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

      if (!baseDir) {
        Alert.alert('Gagal', 'Direktori penyimpanan perangkat tidak tersedia.');
        setExporting(false);
        return;
      }

      const fileName = `Laporan_Kasir_${period}_${Date.now()}.xlsx`;
      const fileUri = `${baseDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, wbBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setExporting(false);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Berhasil', `File Excel tersimpan di:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Simpan atau Bagikan Laporan Excel',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch {
      setExporting(false);
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuat file Excel.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Riwayat & Laporan</Text>
          <Text style={styles.topBarSub}>Rekap penjualan & ekspor Excel</Text>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['today', '7days', 'month'] as PeriodFilter[]).map((key) => {
          const active = period === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => handleSelectPeriod(key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  active && styles.filterTabTextActive,
                ]}
              >
                {PERIOD_LABELS[key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>
              Total Penjualan ({PERIOD_LABELS[period]})
            </Text>
            <Text style={styles.summarySalesValue}>
              Rp {totalSales.toLocaleString('id-ID')}
            </Text>
          </View>

          <View style={[styles.summaryBox, { alignItems: 'flex-end' }]}>
            <Text style={styles.summaryLabel}>Jumlah Transaksi</Text>
            <Text style={styles.summaryCountValue}>
              {transactions.length} transaksi
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.exportBtn,
            (exporting || transactions.length === 0) && styles.exportBtnDisabled,
          ]}
          onPress={handleExportExcel}
          disabled={exporting || transactions.length === 0}
        >
          <Text style={styles.exportBtnText}>
            {exporting ? 'Menyiapkan Excel...' : 'Ekspor Laporan ke Excel (.xlsx)'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Daftar Transaksi</Text>
        <Text style={styles.sectionHint}>Ketuk kartu untuk rincian</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Belum Ada Transaksi</Text>
            <Text style={styles.emptyText}>
              Belum ada transaksi penjualan pada periode {PERIOD_LABELS[period]}.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;
          const isNonCash = item.paymentMethod === 'Non-Tunai';

          return (
            <TouchableOpacity
              style={styles.txCard}
              activeOpacity={0.85}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <View style={styles.txTopRow}>
                <Text style={styles.txIdText}>#TRX-{item.id}</Text>
                <View
                  style={[
                    styles.methodBadge,
                    isNonCash && styles.methodBadgeNonCash,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodBadgeText,
                      isNonCash && styles.methodBadgeTextNonCash,
                    ]}
                  >
                    {item.paymentMethod}
                  </Text>
                </View>
              </View>

              <Text style={styles.txDateText}>
                {formatDateTime(item.createdAt)}
              </Text>

              {isNonCash && item.note ? (
                <Text style={styles.txNoteText}>Keterangan: {item.note}</Text>
              ) : null}

              <View style={styles.txBottomRow}>
                <Text style={styles.txTotalText}>
                  Rp {item.totalAmount.toLocaleString('id-ID')}
                </Text>
                <Text style={styles.expandHintText}>
                  {isExpanded
                    ? 'Tutup Rincian ▲'
                    : `Lihat ${item.items.length} Item ▼`}
                </Text>
              </View>

              {isExpanded && (
                <View style={styles.detailBox}>
                  {item.items.map((detail) => (
                    <View key={detail.id} style={styles.detailItemRow}>
                      <Text style={styles.detailItemName}>
                        {detail.productName} ({detail.qty} x Rp{' '}
                        {detail.productPrice.toLocaleString('id-ID')})
                      </Text>
                      <Text style={styles.detailItemSub}>
                        Rp {detail.subtotal.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  ))}

                  {!isNonCash && item.cashReceived !== null && (
                    <View style={styles.detailCashRow}>
                      <Text style={styles.detailCashText}>
                        Bayar: Rp {item.cashReceived.toLocaleString('id-ID')}
                      </Text>
                      <Text style={styles.detailCashText}>
                        Kembali: Rp{' '}
                        {(item.changeAmount ?? 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}