// Database row types — sesuai schema.sql

export interface Tenant {
  id: string;
  name: string;
  waNumber: string;
  plan: "MULA" | "TUMBUH" | "JUARA";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  aiPersonaConfig: Record<string, unknown>;
  checkoutMethods: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  permissions: Record<string, unknown>;
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string | null;
  price: number;
  costPrice: number;
  stock: number;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  waNumber: string;
  name: string | null;
  address: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  customerId: string;
  channel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  status: "ACTIVE" | "CLOSED" | "ESCALATED";
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "CUSTOMER" | "AI" | "STAFF";
  content: string;
  toolCalls: unknown;
  createdAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  status: "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DONE" | "CANCELLED";
  totalAmount: number;
  checkoutMethod: string;
  phone_number: string | null;
  assignedToId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  midtransToken: string | null;
  midtransOrderId: string | null;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  paidAt: string | null;
  createdAt: string;
}
