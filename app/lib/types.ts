export interface Merchant {
  id: string;
  slug: string;
  name: string;
  email: string;
  color: string;
  windowDays: number;
  shippingFee: number;
  evidenceRequired: boolean;
  provider: string;
}
export interface Variant {
  id: string;
  size: string;
  color: string;
  price: number;
  stock: number;
  productId: string;
}
export interface Product {
  id: string;
  name: string;
  nameAr: string;
  image: string;
  excluded: boolean;
  variants: Variant[];
}
export interface Item {
  id: string;
  variantId: string;
  quantity: number;
  committed: number;
  paidPrice: number;
  variant: Variant & { product: Product };
}
export interface Order {
  id: string;
  number: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  deliveredAt: string | null;
  items: Item[];
  requests: { reference: string; status: string; createdAt: string }[];
}
export interface Snapshot {
  name: string;
  nameAr: string;
  image: string;
  size: string;
  color: string;
  price: number;
}
export interface Exchange {
  item?: { variant: { productId: string } };
  id: string;
  reference: string;
  merchantId: string;
  orderId: string;
  itemId: string;
  quantity: number;
  status: string;
  reason: string;
  notes: string;
  fee: number;
  feeStatus: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  exception: string | null;
  previousStatus: string | null;
  itemSnapshot: string;
  replacementSnapshot: string;
  policySnapshot: string;
  version: number;
  returnedRestocked: boolean;
  stockReserved: boolean;
  order: Order;
  events: {
    id: string;
    actor: string;
    type: string;
    message: string;
    createdAt: string;
  }[];
  attachments: { id: string }[];
  shipments: {
    id: string;
    direction: string;
    tracking: string | null;
    status: string;
    provider: string;
  }[];
}
export interface Notification {
  id: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}
export interface Dashboard {
  merchant: Merchant;
  staff: { name: string; role: string };
  requests: Exchange[];
  notifications: Notification[];
  demo: boolean;
}
