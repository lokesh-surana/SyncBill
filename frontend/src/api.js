// Relative path '/api/v1' routes through Vite's built-in proxy (zero CORS, zero IPv6 collision)
const API_BASE = (typeof window !== 'undefined' && window.location.port === '5173')
  ? '/api/v1'
  : `http://${(typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') ? window.location.hostname : '127.0.0.1'}:8000/api/v1`;

export async function getDashboard(firmId = 1, startDate = null, endDate = null) {
  let url = `${API_BASE}/reports/dashboard?firm_id=${firmId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load dashboard KPIs");
  return res.json();
}

export async function getItems(search = "", category = "", limit = 10000) {
  let url = `${API_BASE}/items/?limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (category && category !== "all" && category !== "ALL SECTIONS") {
    url += `&category=${encodeURIComponent(category)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function getItemCategories() {
  const res = await fetch(`${API_BASE}/items/categories`);
  if (!res.ok) throw new Error("Failed to fetch item categories");
  return res.json();
}

export async function createItem(item) {
  const res = await fetch(`${API_BASE}/items/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create item");
  }
  return res.json();
}

export async function getCustomers(search = "", partyType = null) {
  let url = `${API_BASE}/customers/?limit=2000`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (partyType) url += `&party_type=${encodeURIComponent(partyType)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export async function getCustomerOutstanding(customerId, firmId = null) {
  const url = firmId 
    ? `${API_BASE}/customers/${customerId}/outstanding?firm_id=${firmId}`
    : `${API_BASE}/customers/${customerId}/outstanding`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch customer outstanding");
  return res.json();
}

export async function createCustomer(customer) {
  const res = await fetch(`${API_BASE}/customers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create customer");
  }
  return res.json();
}

export async function updateCustomer(customerId, customer) {
  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update customer");
  }
  return res.json();
}

export async function getFirms() {
  const res = await fetch(`${API_BASE}/firms/`);
  if (!res.ok) throw new Error("Failed to fetch firms");
  return res.json();
}

export async function getInvoices(firmId = null, invoiceType = null, startDate = null, endDate = null, customerId = null) {
  let url = `${API_BASE}/invoices/?limit=2000`;
  if (firmId && firmId !== 'all') url += `&firm_id=${firmId}`;
  if (invoiceType) url += `&invoice_type=${invoiceType}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  if (customerId) url += `&customer_id=${customerId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch invoices");
  return res.json();
}

export async function getReturnableInvoice(invoiceId) {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/returnable-items`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to fetch returnable items for invoice");
  }
  return res.json();
}

export async function createInvoice(invoice) {
  const res = await fetch(`${API_BASE}/invoices/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create invoice");
  }
  return res.json();
}

export async function recordPayment(payment) {
  const res = await fetch(`${API_BASE}/payments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payment),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to record payment");
  }
  return res.json();
}

export async function getPayments(firmId = null, customerId = null, paymentType = null, limit = 100) {
  let url = `${API_BASE}/payments/?limit=${limit}`;
  if (firmId && firmId !== 'all') url += `&firm_id=${firmId}`;
  if (customerId) url += `&customer_id=${customerId}`;
  if (paymentType) url += `&payment_type=${paymentType}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
}

export function getPaymentPrintUrl(paymentId) {
  return `${API_BASE}/payments/${paymentId}/print`;
}

export async function getGstr1(firmId = 1, startDate = null, endDate = null) {
  let url = `${API_BASE}/reports/gstr1?firm_id=${firmId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch GSTR-1");
  return res.json();
}

export async function getGstr3b(firmId = 1, startDate = null, endDate = null) {
  let url = `${API_BASE}/reports/gstr3b?firm_id=${firmId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch GSTR-3B");
  return res.json();
}

export async function getStockSummary() {
  const res = await fetch(`${API_BASE}/reports/stock-summary`);
  if (!res.ok) throw new Error("Failed to fetch Stock Summary");
  return res.json();
}

export function getInvoicePrintUrl(invoiceId) {
  return `${API_BASE}/invoices/${invoiceId}/print`;
}

export function getDeliveryChallanPrintUrl(invoiceId) {
  return `${API_BASE}/invoices/${invoiceId}/delivery-challan`;
}

// 📖 Party Ledger & Statement of Account
export async function getLedger(customerId, firmId = null, startDate = null, endDate = null) {
  let url = `${API_BASE}/reports/ledger?customer_id=${customerId}`;
  if (firmId && firmId !== 'all') url += `&firm_id=${firmId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load party ledger");
  }
  return res.json();
}

// 🖥️ Accurate Old PC Sync Bridge Status
export async function getSyncStatus() {
  const res = await fetch(`${API_BASE}/sync/status`);
  if (!res.ok) throw new Error("Failed to fetch sync status");
  return res.json();
}

// 💰 Pending Receivables (Market Udhaari)
export async function getReceivables(firmId = null) {
  let url = `${API_BASE}/reports/receivables`;
  if (firmId && firmId !== 'all') url += `?firm_id=${firmId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load receivables");
  return res.json();
}

// 📅 Daybook & Cash Register
export async function getDaybook(firmId = null, targetDate = null) {
  let url = `${API_BASE}/reports/daybook?`;
  if (firmId && firmId !== 'all') url += `&firm_id=${firmId}`;
  if (targetDate) url += `&target_date=${targetDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load daybook");
  return res.json();
}

// 📦 Tally XML Export Download URL
export function getTallyXmlUrl(firmId = null, startDate = null, endDate = null) {
  let url = `${API_BASE}/reports/tally-xml?`;
  if (firmId && firmId !== 'all') url += `&firm_id=${firmId}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  return url;
}

// 💬 100% Free WhatsApp Web Bridge Automation
export async function getWhatsAppStatus() {
  const res = await fetch(`${API_BASE}/whatsapp/status`);
  if (!res.ok) throw new Error("Failed to query WhatsApp status");
  return res.json();
}

export async function sendInvoiceWhatsApp(invoiceId, customPhone = null) {
  let url = `${API_BASE}/whatsapp/send-invoice/${invoiceId}`;
  if (customPhone) url += `?custom_phone=${encodeURIComponent(customPhone)}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to send invoice via WhatsApp");
  return data;
}

export async function sendPaymentWhatsApp(paymentId, customPhone = null) {
  let url = `${API_BASE}/whatsapp/send-payment/${paymentId}`;
  if (customPhone) url += `?custom_phone=${encodeURIComponent(customPhone)}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to send payment receipt via WhatsApp");
  return data;
}

export async function sendCustomWhatsApp(phone, message) {
  const res = await fetch(`${API_BASE}/whatsapp/send-custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to send custom WhatsApp message");
  return data;
}

export async function getCustomerOfficialPdf(customerId) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/official-pdf`);
  if (!res.ok) throw new Error("Failed to fetch official PDF link");
  return res.json();
}

export async function getInvoiceOfficialPdf(invoiceId) {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/official-pdf`);
  if (!res.ok) throw new Error("Failed to fetch invoice official PDF link");
  return res.json();
}

export async function pullCloudUpdates(payload = null) {
  const res = await fetch(`${API_BASE}/sync/pull-cloud`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : "{}",
  });
  if (!res.ok) throw new Error("Failed to pull cloud updates");
  return res.json();
}







