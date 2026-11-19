import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiRequest, ProductItem, setAuthToken } from '../services/api';
import { productStyles as styles } from '../styles/products.styles';

const isPositiveInteger = (raw: string) =>
  /^\d+$/.test(raw.trim()) && Number(raw.trim()) > 0;

const isNonNegativeInteger = (raw: string) =>
  /^\d+$/.test(raw.trim()) && Number(raw.trim()) >= 0;

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [stockText, setStockText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = async () => {
    const res = await apiRequest<ProductItem[]>('/products');
    if (res.ok && Array.isArray(res.data)) {
      setProducts(res.data);
      setCart((prev) => {
        const validMap = new Map(res.data!.map((p) => [p.id, p.stock]));
        const next: Record<string, number> = {};
        for (const [prodId, qty] of Object.entries(prev)) {
          const maxStock = validMap.get(prodId) ?? 0;
          if (qty > 0 && maxStock > 0) {
            next[prodId] = Math.min(qty, maxStock);
          }
        }
        return next;
      });
    } else if (!res.ok) {
      Alert.alert('Info', res.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const totalQty = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart]
  );

  const totalAmount = useMemo(() => {
    return products.reduce((sum, item) => {
      const qty = cart[item.id] || 0;
      return sum + item.price * qty;
    }, 0);
  }, [products, cart]);

  const handleIncreaseQty = (item: ProductItem) => {
    const currentQty = cart[item.id] || 0;
    const nextQty = currentQty + 1;

    if (nextQty > item.stock) {
      Alert.alert('Stok tidak cukup', `Stok "${item.name}" tersisa ${item.stock}.`);
      return;
    }

    setCart((prev) => ({ ...prev, [item.id]: nextQty }));
  };

  const handleDecreaseQty = (item: ProductItem) => {
    const currentQty = cart[item.id] || 0;
    if (currentQty <= 0) return;

    setCart((prev) => {
      const next = { ...prev };
      if (currentQty === 1) {
        delete next[item.id];
      } else {
        next[item.id] = currentQty - 1;
      }
      return next;
    });
  };

  const handleGoCheckout = () => {
    const selectedItems = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));

    if (selectedItems.length === 0) return;

    router.push({
      pathname: '/checkout' as never,
      params: { itemsJson: JSON.stringify(selectedItems) },
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPriceText('');
    setStockText('');
    setImageUri(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setEditingId(null);
    setName('');
    setPriceText('');
    setStockText('');
    setImageUri(null);
    setShowForm(true);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin Galeri', 'Izinkan akses galeri untuk memilih foto produk.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (pickerResult.canceled || !pickerResult.assets[0]?.uri) return;

    const asset = pickerResult.assets[0];
    const baseDir = FileSystem.documentDirectory;

    if (!baseDir) {
      setImageUri(asset.uri);
      return;
    }

    try {
      const folderDir = `${baseDir}product_images/`;
      const rawExtension =
        asset.fileName?.split('.').pop()?.toLowerCase() ??
        asset.uri.split('.').pop()?.toLowerCase() ??
        'jpg';
      const extension = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(
        rawExtension
      )
        ? rawExtension
        : 'jpg';
      const destUri = `${folderDir}prod_${Date.now()}.${extension}`;
      await FileSystem.makeDirectoryAsync(folderDir, { intermediates: true });
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });
      setImageUri(destUri);
    } catch {
      Alert.alert('Gagal', 'Foto produk tidak dapat disimpan. Coba lagi.');
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Validasi', 'Nama produk tidak boleh kosong.');
      return;
    }
    if (!isPositiveInteger(priceText)) {
      Alert.alert('Validasi', 'Harga jual harus berupa bilangan bulat lebih dari 0.');
      return;
    }
    if (!isNonNegativeInteger(stockText)) {
      Alert.alert('Validasi', 'Stok harus berupa bilangan bulat minimal 0.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: cleanName,
      price: Number(priceText.trim()),
      stock: Number(stockText.trim()),
      imageUri,
    };

    const res = editingId
      ? await apiRequest(`/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

    setSubmitting(false);

    if (!res.ok) {
      Alert.alert('Gagal', res.message);
      return;
    }

    Alert.alert('Berhasil', res.message);
    resetForm();
    loadProducts();
  };

  const handleEdit = (item: ProductItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPriceText(String(item.price));
    setStockText(String(item.stock));
    setImageUri(item.imageUri ?? null);
    setShowForm(true);
  };

  const handleDelete = (item: ProductItem) => {
    if (item.hasTransaction) {
      Alert.alert(
        'Tidak Dapat Dihapus',
        'Produk yang sudah pernah ada di transaksi tidak dapat dihapus.'
      );
      return;
    }

    Alert.alert('Hapus Produk', `Yakin ingin menghapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const res = await apiRequest(`/products/${item.id}`, {
            method: 'DELETE',
          });
          if (!res.ok) {
            Alert.alert('Gagal', res.message);
            return;
          }
          Alert.alert('Berhasil', res.message);
          loadProducts();
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Keluar Akun', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          setAuthToken(null);
          router.replace('/' as never);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Produk Toko</Text>
          <Text style={styles.topBarSub}>Kelola produk & keranjang</Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.navPill}
            onPress={() => router.push('/history' as never)}
          >
            <Text style={styles.navPillText}>Riwayat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutPill} onPress={handleLogout}>
            <Text style={styles.logoutPillText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!showForm ? (
        <TouchableOpacity style={styles.addBannerBtn} onPress={openAddForm}>
          <View style={styles.addBannerLeft}>
            <View style={styles.plusCircle}>
              <Text style={styles.plusCircleText}>+</Text>
            </View>
            <View>
              <Text style={styles.addBannerTitle}>Tambah Produk Baru</Text>
              <Text style={styles.addBannerSub}>
                Isi foto, nama, harga jual, dan stok awal
              </Text>
            </View>
          </View>
          <Text style={styles.addBannerArrow}>Tambah &gt;</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingId ? 'Ubah Produk & Stok' : 'Tambah Produk Baru'}
            </Text>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.closeFormText}>Tutup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.imagePickerRow}>
            <View style={styles.previewBox}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <Text style={styles.previewPlaceholder}>Belum ada foto</Text>
              )}
            </View>

            <View style={styles.imageActionCol}>
              <TouchableOpacity
                style={styles.pickImageBtn}
                onPress={handlePickImage}
              >
                <Text style={styles.pickImageBtnText}>
                  {imageUri ? 'Ganti Foto Produk' : 'Pilih Foto Produk'}
                </Text>
              </TouchableOpacity>

              {imageUri && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setImageUri(null)}
                >
                  <Text style={styles.removeImageText}>Hapus Foto</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.label}>Nama Produk</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Kopi Susu Gula Aren"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.rowInput}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>Harga Jual (Rp)</Text>
              <TextInput
                style={styles.input}
                placeholder="5000"
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.label}>Stok</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={stockText}
                onChangeText={setStockText}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.rowBtn}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSave}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>
                {submitting
                  ? 'Menyimpan...'
                  : editingId
                  ? 'Simpan Perubahan'
                  : 'Simpan Produk'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Daftar Produk</Text>
        <Text style={styles.sectionCount}>{products.length} item</Text>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridList}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Belum Ada Produk</Text>
            <Text style={styles.emptyText}>
              {'Ketuk "Tambah Produk Baru" di atas untuk mulai mengisi katalog.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const qtyInCart = cart[item.id] || 0;
          return (
            <View style={styles.productCard}>
              <View style={styles.cardTopVisual}>
                {item.imageUri ? (
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.productInitial}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                )}

                <View
                  style={[
                    styles.stockTag,
                    item.stock === 0 && styles.stockTagEmpty,
                  ]}
                >
                  <Text style={styles.stockTagText}>Stok: {item.stock}</Text>
                </View>

                {item.hasTransaction && (
                  <View style={styles.txBadge}>
                    <Text style={styles.txBadgeText}>Terjual</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.currencyText}>Rp</Text>
                  <Text style={styles.priceText}>
                    {item.price.toLocaleString('id-ID')}
                  </Text>
                </View>

                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={[
                      styles.qtyStepBtn,
                      qtyInCart === 0 && styles.qtyStepBtnDisabled,
                    ]}
                    onPress={() => handleDecreaseQty(item)}
                    disabled={qtyInCart === 0}
                  >
                    <Text style={styles.qtyStepText}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.qtyValueText}>{qtyInCart}</Text>

                  <TouchableOpacity
                    style={[
                      styles.qtyStepBtn,
                      item.stock === 0 && styles.qtyStepBtnDisabled,
                    ]}
                    onPress={() => handleIncreaseQty(item)}
                    disabled={item.stock === 0}
                  >
                    <Text style={styles.qtyStepText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleEdit(item)}
                  >
                    <Text style={styles.editBtnText}>Ubah</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.cartBar}>
        <View>
          <Text style={styles.cartSummaryLabel}>{totalQty} item dipilih</Text>
          <Text style={styles.cartSummaryTotal}>
            Rp {totalAmount.toLocaleString('id-ID')}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            totalQty === 0 && styles.checkoutBtnDisabled,
          ]}
          onPress={handleGoCheckout}
          disabled={totalQty === 0}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}