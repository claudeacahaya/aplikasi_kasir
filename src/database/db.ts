import * as SQLite from 'expo-sqlite';

export interface ApiResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  hasTransaction: boolean;
  imageUri?: string | null;
}

export interface DashboardSummary {
  totalSalesToday: number;
  totalTransactionsToday: number;
  productCount: number;
}

export interface TransactionDetailItem {
  id: string;
  productName: string;
  productPrice: number;
  qty: number;
  subtotal: number;
}

export interface TransactionRecord {
  id: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: 'Tunai' | 'Non-Tunai';
  note: string | null;
  cashReceived: number | null;
  changeAmount: number | null;
  items: TransactionDetailItem[];
}

export const SECURITY_QUESTIONS = [
  'Nama hewan peliharaan pertama?',
  'Kota kelahiran?',
  'Makanan favorit?',
] as const;

function normalizeSecurityAnswer(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let activeUserEmail: string | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('kasir_umkm.db');
    await initTables(dbInstance);
  }
  return dbInstance;
}

async function initTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      security_question TEXT,
      security_answer TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL,
      image_uri TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      note TEXT,
      cash_received INTEGER,
      change_amount INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      product_price_snapshot INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );
  `);

  const userColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(users)'
  );
  const hasSecurityQuestionColumn = userColumns.some(
    (column) => column.name === 'security_question'
  );
  const hasSecurityAnswerColumn = userColumns.some(
    (column) => column.name === 'security_answer'
  );

  if (!hasSecurityQuestionColumn) {
    await db.execAsync('ALTER TABLE users ADD COLUMN security_question TEXT;');
  }
  if (!hasSecurityAnswerColumn) {
    await db.execAsync('ALTER TABLE users ADD COLUMN security_answer TEXT;');
  }

  const productColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(products)'
  );
  const hasImageUriColumn = productColumns.some(
    (column) => column.name === 'image_uri'
  );

  if (!hasImageUriColumn) {
    await db.execAsync('ALTER TABLE products ADD COLUMN image_uri TEXT;');
  }
}

export function setAuthToken(tokenOrEmail: string | null) {
  activeUserEmail = tokenOrEmail ? tokenOrEmail.trim().toLowerCase() : null;
}

export function getAuthToken(): string | null {
  return activeUserEmail;
}

function normalizeImageUri(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getStartOfTodayIso(): string {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  return start.toISOString();
}

export function getPeriodRangeIso(period: 'today' | '7days' | 'month'): {
  startIso: string;
  endIso: string;
} {
  const now = new Date();
  const endIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();

  if (period === 'today') {
    const startIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).toISOString();
    return { startIso, endIso };
  }

  if (period === '7days') {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0
    );
    return { startIso: start.toISOString(), endIso };
  }

  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { startIso: startMonth.toISOString(), endIso };
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const db = await getDb();
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(String(options.body)) : {};

    if (endpoint === '/auth/register' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const securityQuestion = String(body.securityQuestion || '').trim();
      const securityAnswer = normalizeSecurityAnswer(body.securityAnswer);

      if (!securityQuestion) {
        return { ok: false, message: 'Pertanyaan keamanan wajib dipilih.' };
      }
      if (!(SECURITY_QUESTIONS as readonly string[]).includes(securityQuestion)) {
        return { ok: false, message: 'Pilihan pertanyaan keamanan tidak valid.' };
      }
      if (!securityAnswer) {
        return { ok: false, message: 'Jawaban keamanan wajib diisi.' };
      }

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (existing) {
        return { ok: false, message: 'Email sudah terdaftar.' };
      }

      await db.runAsync(
        `INSERT INTO users
          (email, password, security_question, security_answer, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          email,
          password,
          securityQuestion,
          securityAnswer,
          new Date().toISOString(),
        ]
      );
      activeUserEmail = email;

      return {
        ok: true,
        message: 'Registrasi berhasil.',
        data: { token: email, email } as T,
      };
    }

    if (endpoint === '/auth/login' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      const user = await db.getFirstAsync<{ email: string; password: string }>(
        'SELECT email, password FROM users WHERE email = ?',
        [email]
      );

      if (!user || user.password !== password) {
        return { ok: false, message: 'Email atau sandi salah.' };
      }

      activeUserEmail = user.email;
      return {
        ok: true,
        message: 'Login berhasil.',
        data: { token: user.email, email: user.email } as T,
      };
    }

    if (endpoint === '/auth/reset-password' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const securityQuestion = String(body.securityQuestion || '').trim();
      const securityAnswer = normalizeSecurityAnswer(body.securityAnswer);
      const newPassword = String(body.newPassword || '');

      if (!email || !securityQuestion || !securityAnswer || newPassword.length < 6) {
        return {
          ok: false,
          message:
            'Lengkapi email, pertanyaan, jawaban keamanan, dan sandi baru (min. 6 karakter).',
        };
      }

      const user = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM users
         WHERE email = ? AND security_question = ? AND security_answer = ?`,
        [email, securityQuestion, securityAnswer]
      );

      if (!user) {
        return {
          ok: false,
          message: 'Email, pertanyaan, atau jawaban keamanan tidak sesuai.',
        };
      }

      await db.runAsync('UPDATE users SET password = ? WHERE id = ?', [
        newPassword,
        user.id,
      ]);

      return {
        ok: true,
        message: 'Sandi berhasil diubah. Silakan login dengan sandi baru.',
      };
    }

    const ownerEmail = activeUserEmail || 'default@umkm.local';

    if (endpoint === '/dashboard/summary' && method === 'GET') {
      const startToday = getStartOfTodayIso();
      const nowIso = new Date().toISOString();

      const salesRow = await db.getFirstAsync<{
        totalSales: number | null;
        totalTx: number | null;
      }>(
        `SELECT
          COALESCE(SUM(total_amount), 0) AS totalSales,
          COUNT(*) AS totalTx
         FROM transactions
         WHERE user_email = ? AND created_at >= ? AND created_at <= ?`,
        [ownerEmail, startToday, nowIso]
      );

      const prodRow = await db.getFirstAsync<{ cnt: number | null }>(
        'SELECT COUNT(*) AS cnt FROM products WHERE user_email = ?',
        [ownerEmail]
      );

      return {
        ok: true,
        message: 'Ringkasan dimuat.',
        data: {
          totalSalesToday: Number(salesRow?.totalSales || 0),
          totalTransactionsToday: Number(salesRow?.totalTx || 0),
          productCount: Number(prodRow?.cnt || 0),
        } as T,
      };
    }

    if (endpoint === '/products' && method === 'GET') {
      const rows = await db.getAllAsync<{
        id: number;
        name: string;
        price: number;
        stock: number;
        image_uri: string | null;
        txCount: number;
      }>(
        `SELECT
          p.id,
          p.name,
          p.price,
          p.stock,
          p.image_uri,
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.product_id = p.id) AS txCount
         FROM products p
         WHERE p.user_email = ?
         ORDER BY p.id DESC`,
        [ownerEmail]
      );

      const mapped: ProductItem[] = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        price: Number(r.price),
        stock: Number(r.stock),
        hasTransaction: Number(r.txCount) > 0,
        imageUri: r.image_uri ?? null,
      }));

      return {
        ok: true,
        message: 'Berhasil memuat produk.',
        data: mapped as T,
      };
    }

    if (endpoint === '/products' && method === 'POST') {
      const imageUri = normalizeImageUri(body.imageUri);
      const result = await db.runAsync(
        `INSERT INTO products (user_email, name, price, stock, image_uri, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ownerEmail,
          String(body.name).trim(),
          Number(body.price),
          Number(body.stock),
          imageUri,
          new Date().toISOString(),
        ]
      );

      return {
        ok: true,
        message: 'Produk berhasil ditambahkan.',
        data: {
          id: String(result.lastInsertRowId),
          name: String(body.name).trim(),
          price: Number(body.price),
          stock: Number(body.stock),
          hasTransaction: false,
          imageUri,
        } as T,
      };
    }

    if (endpoint.startsWith('/products/') && method === 'PUT') {
      const id = Number(endpoint.replace('/products/', ''));
      await db.runAsync(
        `UPDATE products
         SET name = ?, price = ?, stock = ?, image_uri = ?
         WHERE id = ? AND user_email = ?`,
        [
          String(body.name).trim(),
          Number(body.price),
          Number(body.stock),
          normalizeImageUri(body.imageUri),
          id,
          ownerEmail,
        ]
      );

      return {
        ok: true,
        message: 'Produk berhasil diperbarui.',
      };
    }

    if (endpoint.startsWith('/products/') && method === 'DELETE') {
      const id = Number(endpoint.replace('/products/', ''));
      const used = await db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM transaction_items WHERE product_id = ?',
        [id]
      );

      if (Number(used?.cnt || 0) > 0) {
        return {
          ok: false,
          message:
            'Produk yang sudah pernah ada di transaksi tidak dapat dihapus.',
        };
      }

      await db.runAsync('DELETE FROM products WHERE id = ? AND user_email = ?', [
        id,
        ownerEmail,
      ]);

      return {
        ok: true,
        message: 'Produk berhasil dihapus.',
      };
    }

    if (endpoint === '/transactions' && method === 'POST') {
      const items: { productId: string; qty: number }[] = Array.isArray(body.items)
        ? body.items
        : [];
      const paymentMethod: 'Tunai' | 'Non-Tunai' =
        body.paymentMethod === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai';
      const note =
        paymentMethod === 'Non-Tunai' && body.note
          ? String(body.note).trim().slice(0, 100)
          : null;
      const cashReceived =
        paymentMethod === 'Tunai' ? Number(body.cashReceived || 0) : null;

      if (items.length === 0) {
        return { ok: false, message: 'Keranjang masih kosong.' };
      }

      let computedTotal = 0;
      const checkedItems: {
        productId: number;
        name: string;
        price: number;
        stock: number;
        qty: number;
        subtotal: number;
      }[] = [];

      for (const reqItem of items) {
        const prodId = Number(reqItem.productId);
        const qty = Number(reqItem.qty);
        const prod = await db.getFirstAsync<{
          id: number;
          name: string;
          price: number;
          stock: number;
        }>(
          'SELECT id, name, price, stock FROM products WHERE id = ? AND user_email = ?',
          [prodId, ownerEmail]
        );

        if (!prod) {
          return { ok: false, message: 'Produk tidak ditemukan.' };
        }
        if (qty > Number(prod.stock)) {
          return {
            ok: false,
            message: `Stok tidak cukup untuk ${prod.name}.`,
          };
        }

        const subtotal = Number(prod.price) * qty;
        computedTotal += subtotal;
        checkedItems.push({
          productId: prod.id,
          name: prod.name,
          price: Number(prod.price),
          stock: Number(prod.stock),
          qty,
          subtotal,
        });
      }

      let changeAmount: number | null = null;
      if (paymentMethod === 'Tunai') {
        if ((cashReceived ?? 0) < computedTotal) {
          return {
            ok: false,
            message: 'Uang bayar kurang dari total belanja.',
          };
        }
        changeAmount = (cashReceived ?? 0) - computedTotal;
      }

      const createdAt = new Date().toISOString();
      const txInsert = await db.runAsync(
        `INSERT INTO transactions
          (user_email, total_amount, payment_method, note, cash_received, change_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerEmail,
          computedTotal,
          paymentMethod,
          note,
          cashReceived,
          changeAmount,
          createdAt,
        ]
      );

      const txId = Number(txInsert.lastInsertRowId);

      for (const item of checkedItems) {
        await db.runAsync(
          `INSERT INTO transaction_items
            (transaction_id, product_id, product_name_snapshot, product_price_snapshot, qty, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [txId, item.productId, item.name, item.price, item.qty, item.subtotal]
        );

        await db.runAsync(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND user_email = ?',
          [item.qty, item.productId, ownerEmail]
        );
      }

      return {
        ok: true,
        message: 'Transaksi berhasil disimpan.',
        data: {
          transactionId: txId,
          totalAmount: computedTotal,
          changeAmount: changeAmount ?? 0,
        } as T,
      };
    }

    if (endpoint.startsWith('/transactions') && method === 'GET') {
      const queryPart = endpoint.includes('?') ? endpoint.split('?')[1] : '';
      const params = new URLSearchParams(queryPart);
      const periodParam = params.get('period');
      const period: 'today' | '7days' | 'month' =
        periodParam === '7days' || periodParam === 'month' ? periodParam : 'today';

      const { startIso, endIso } = getPeriodRangeIso(period);

      const txRows = await db.getAllAsync<{
        id: number;
        created_at: string;
        total_amount: number;
        payment_method: 'Tunai' | 'Non-Tunai';
        note: string | null;
        cash_received: number | null;
        change_amount: number | null;
      }>(
        `SELECT
          id, created_at, total_amount, payment_method, note, cash_received, change_amount
         FROM transactions
         WHERE user_email = ? AND created_at >= ? AND created_at <= ?
         ORDER BY id DESC`,
        [ownerEmail, startIso, endIso]
      );

      const records: TransactionRecord[] = [];
      for (const tx of txRows) {
        const detailRows = await db.getAllAsync<{
          id: number;
          product_name_snapshot: string;
          product_price_snapshot: number;
          qty: number;
          subtotal: number;
        }>(
          `SELECT
            id, product_name_snapshot, product_price_snapshot, qty, subtotal
           FROM transaction_items
           WHERE transaction_id = ?
           ORDER BY id ASC`,
          [tx.id]
        );

        records.push({
          id: String(tx.id),
          createdAt: tx.created_at,
          totalAmount: Number(tx.total_amount),
          paymentMethod: tx.payment_method,
          note: tx.note,
          cashReceived: tx.cash_received !== null ? Number(tx.cash_received) : null,
          changeAmount: tx.change_amount !== null ? Number(tx.change_amount) : null,
          items: detailRows.map((d) => ({
            id: String(d.id),
            productName: d.product_name_snapshot,
            productPrice: Number(d.product_price_snapshot),
            qty: Number(d.qty),
            subtotal: Number(d.subtotal),
          })),
        });
      }

      return {
        ok: true,
        message: 'Riwayat transaksi dimuat.',
        data: records as T,
      };
    }

    return { ok: true, message: 'OK' };
  } catch {
    return {
      ok: false,
      message: 'Terjadi kesalahan saat mengakses database lokal.',
    };
  }
}