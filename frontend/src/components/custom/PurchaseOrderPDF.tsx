import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
    color: '#111827',
  },
  table: {
    width: '100%',
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'dashed',
    alignItems: 'center',
    minHeight: 36,
  },
  rowLast: {
    borderBottomWidth: 0,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'dashed',
  },
  cellLabel: {
    width: '25%',
    fontSize: 12,
    color: '#6b7280',
    paddingVertical: 8,
    paddingRight: 12,
  },
  cellValue: {
    width: '75%',
    fontSize: 12,
    color: '#111827',
    paddingVertical: 8,
  },
  signatureBox: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    minHeight: 80,
    width: '100%',
    alignSelf: 'center',
  },
})

interface Order {
  date: string
  customerName: string
  fleetCardNumber: string
  driverName: string
  description: string
  poNumber: string
  quantity: number
  amount: number
  vehicleMakeModel: string
  signature: string
  receipt: string
}

const formatFleetCardNumber = (number: string) => {
  return (number || '').replace(/(.{4})/g, '$1 ').trim()
}

const PurchaseOrderPDF = ({ order }: { order: Order }) => (
  <Document>
    <Page style={styles.page}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <Text style={[styles.title, { textAlign: 'left', marginBottom: 0 }]}>
          Fuel Purchase Order
        </Text>
        <Image src="/logo.png" style={{ height: 64 }} />
      </View>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Date</Text>
          <Text style={styles.cellValue}>{order.date.split('T')[0]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Customer Name</Text>
          <Text style={styles.cellValue}>{order.customerName}</Text>
        </View>
        {order.fleetCardNumber ? (
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Fleet Card Number</Text>
            <Text style={styles.cellValue}>
              {formatFleetCardNumber(order.fleetCardNumber)}
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.cellLabel}>PO Number</Text>
            <Text style={styles.cellValue}>{order.poNumber}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Driver</Text>
          <Text style={styles.cellValue}>{order.driverName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Item</Text>
          <Text style={styles.cellValue}>{order.description}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Quantity</Text>
          <Text style={styles.cellValue}>{order.quantity} litres</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Price</Text>
          <Text style={styles.cellValue}>${order.amount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Price/Litre</Text>
          <Text style={styles.cellValue}>
            $
            {order.quantity > 0
              ? (order.amount / order.quantity).toFixed(3)
              : '0.000'}
          </Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.cellLabel}>Description</Text>
          <Text style={styles.cellValue}>{order.vehicleMakeModel}</Text>
        </View>
      </View>
    </Page>

    {order.receipt && (
      <Page style={styles.page}>
        <View
          style={{
            marginTop: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, marginBottom: 16 }}>Receipt</Text>
          <Image
            src={`https://app.gen7fuel.com/cdn/download/${order.receipt}`}
            style={{ width: 400, height: 500, objectFit: 'contain' }}
          />
        </View>
      </Page>
    )}
  </Document>
)

export default PurchaseOrderPDF
