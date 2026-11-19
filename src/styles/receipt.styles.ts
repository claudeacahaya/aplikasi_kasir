import { StyleSheet } from 'react-native';

export const receiptStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topBar: {
    backgroundColor: '#EE4D2D',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
  },
  topBarSub: {
    color: '#FFE6E0',
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  paperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderTopWidth: 5,
    borderTopColor: '#EE4D2D',
    elevation: 3,
  },
  successBadge: {
    alignSelf: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  successBadgeText: {
    color: '#047857',
    fontWeight: 'bold',
    fontSize: 12,
  },
  storeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222222',
    textAlign: 'center',
  },
  receiptSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222222',
    maxWidth: '62%',
    textAlign: 'right',
  },
  itemHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EE4D2D',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222222',
  },
  itemQtyPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222222',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222222',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EE4D2D',
  },
  payDetailLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  payDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  changeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  actionGroup: {
    marginTop: 16,
    gap: 10,
  },
  shareBtn: {
    backgroundColor: '#FFF5F1',
    borderWidth: 1,
    borderColor: '#EE4D2D',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#EE4D2D',
    fontWeight: 'bold',
    fontSize: 14,
  },
  doneBtn: {
    backgroundColor: '#EE4D2D',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});