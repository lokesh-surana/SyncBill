import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, ShoppingCart, Search, Plus, Trash2, Printer, 
  CheckCircle, AlertCircle, FileText, ArrowLeft, ChevronDown, 
  Calendar, CheckSquare, Square, UserCheck, X, RefreshCw, 
  BookOpen, AlertTriangle, ShieldCheck, CreditCard, Share2, 
  Send, DollarSign, Wallet, Building2, Check, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import * as api from '../api';

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash (नकद)', icon: '💵' },
  { id: 'upi', label: 'UPI / GPay / PhonePe', icon: '📱' },
  { id: 'bank_transfer', label: 'Bank Transfer / NEFT / RTGS', icon: '🏦' },
  { id: 'cheque', label: 'Cheque (चेक)', icon: '📜' },
  { id: 'card', label: 'Debit / Credit Card', icon: '💳' },
];

export default function AccountsVouchers({
  firmId = 2,
  firms = [],
  customers = [],
  notify = () => {},
  onOpenLedger = () => {},
  initialType = 'receipt', // 'receipt' (Customer Collection) | 'payment' (Supplier Payment)
  onBackToDesk = () => {},
}) {
  // Mode: 'receipt' (Customer Collection) vs 'payment' (Supplier Payment)
  const [voucherType, setVoucherType] = useState(initialType);
  const isReceipt = voucherType === 'receipt';

  // View: 'create' | 'list'
  const [viewMode, setViewMode] = useState('create');

  // Form State
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyOutstanding, setPartyOutstanding] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  // Unpaid Invoices for Bill-by-Bill Allocation
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  // Allocations map: { [invoice_id]: allocated_amount }
  const [allocations, setAllocations] = useState({});

  // Payment Details
  const [paymentMode, setPaymentMode] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLumpsumOnAccount, setIsLumpsumOnAccount] = useState(false);

  // Search Filter for party dropdown
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // History / Register State
  const [historyPayments, setHistoryPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (initialType) setVoucherType(initialType);
  }, [initialType]);

  const handleSwitchMode = (newMode) => {
    setVoucherType(newMode);
    setSelectedPartyId('');
    setPartyOutstanding(null);
    setUnpaidInvoices([]);
    setAllocations({});
    setTotalAmount('');
    setReferenceNumber('');
    setNotes('');
    setPartySearch('');
    setIsLumpsumOnAccount(false);
  };

  // Filter parties based on voucher type (Receipt = Customers, Payment = Vendors)
  const filteredParties = useMemo(() => {
    return customers.filter(c => {
      const pType = String(c.party_type || '').toLowerCase();
      const matchType = isReceipt ? (pType !== 'vendor') : (pType === 'vendor' || pType === 'supplier');
      if (!partySearch.trim()) return matchType;
      const q = partySearch.toLowerCase();
      return matchType && (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.billing_address && c.billing_address.toLowerCase().includes(q))
      );
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [customers, isReceipt, partySearch]);

  const selectedParty = useMemo(() => {
    return customers.find(c => String(c.id) === String(selectedPartyId)) || null;
  }, [customers, selectedPartyId]);

  const currentFirm = useMemo(() => {
    return firms.find(f => Number(f.id) === Number(firmId)) || firms[0] || { name: 'Firm' };
  }, [firms, firmId]);

  // Load party outstanding & unpaid bills when party changes
  useEffect(() => {
    if (!selectedPartyId) {
      setPartyOutstanding(null);
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }

    // Load Live Outstanding
    setLoadingOutstanding(true);
    api.getCustomerOutstanding(selectedPartyId, firmId)
      .then(res => setPartyOutstanding(res))
      .catch(err => console.error("Error loading party outstanding:", err))
      .finally(() => setLoadingOutstanding(false));

    // Load Unpaid Invoices
    setLoadingInvoices(true);
    const targetInvType = isReceipt ? 'sales' : 'purchase';
    api.getInvoices(firmId, targetInvType, null, null, selectedPartyId)
      .then(res => {
        const bills = Array.isArray(res) ? res : [];
        // Keep only bills with pending balance > 0
        const pending = bills.filter(b => Number(b.balance_amount) > 0 && !b.is_cancelled);
        setUnpaidInvoices(pending);
      })
      .catch(err => {
        console.error("Error loading unpaid bills:", err);
        setUnpaidInvoices([]);
      })
      .finally(() => setLoadingInvoices(false));
  }, [selectedPartyId, firmId, isReceipt]);

  // Load History / Register
  const loadHistory = () => {
    setLoadingHistory(true);
    api.getPayments(firmId, null, voucherType)
      .then(res => setHistoryPayments(Array.isArray(res) ? res : []))
      .catch(err => console.error("Error loading payments history:", err))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (viewMode === 'list') {
      loadHistory();
    }
  }, [viewMode, voucherType, firmId]);

  // Handle Bill Allocation toggling / typing
  const handleToggleBill = (inv) => {
    const invId = inv.id;
    setAllocations(prev => {
      const next = { ...prev };
      if (next[invId]) {
        delete next[invId];
      } else {
        next[invId] = Number(inv.balance_amount);
      }
      // Recompute total amount as sum of allocations
      const sum = Object.values(next).reduce((acc, v) => acc + (Number(v) || 0), 0);
      setTotalAmount(sum > 0 ? String(sum) : '');
      return next;
    });
  };

  const handleAllocationAmountChange = (invId, val, maxDue) => {
    const num = Math.max(0, Math.min(maxDue, parseFloat(val) || 0));
    setAllocations(prev => {
      const next = { ...prev };
      if (num > 0) {
        next[invId] = num;
      } else {
        delete next[invId];
      }
      const sum = Object.values(next).reduce((acc, v) => acc + (Number(v) || 0), 0);
      setTotalAmount(sum > 0 ? String(sum) : '');
      return next;
    });
  };

  // Auto-allocate lumpsum amount FIFO across unpaid bills
  const handleAutoAllocateFIFO = () => {
    const entered = parseFloat(totalAmount) || 0;
    if (entered <= 0) {
      notify("Please enter an amount first to auto-allocate", "warning");
      return;
    }

    let remaining = entered;
    const newAlloc = {};
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const due = Number(inv.balance_amount);
      const take = Math.min(remaining, due);
      newAlloc[inv.id] = take;
      remaining -= take;
    }
    setAllocations(newAlloc);
    notify(`Allocated ₹${entered.toLocaleString('en-IN')} across oldest unpaid bills`, "info");
  };

  const handleClearAllocations = () => {
    setAllocations({});
    setTotalAmount('');
  };

  // Save Voucher
  const handleSavePayment = async (andPrint = false) => {
    if (!selectedPartyId) {
      notify(`Please select a ${isReceipt ? 'Customer' : 'Supplier / Vendor'}`, 'error');
      return;
    }

    const payAmt = parseFloat(totalAmount) || 0;
    if (payAmt <= 0) {
      notify('Please enter a valid payment amount greater than ₹0', 'error');
      return;
    }

    // Build allocations payload if any
    const allocList = Object.entries(allocations).map(([invId, amt]) => ({
      invoice_id: Number(invId),
      amount: Number(amt),
    })).filter(a => a.amount > 0);

    const payload = {
      firm_id: Number(firmId),
      customer_id: Number(selectedPartyId),
      payment_type: voucherType,
      payment_mode: paymentMode,
      amount: payAmt,
      payment_date: voucherDate,
      reference_number: referenceNumber.trim() || null,
      notes: notes.trim() || (isReceipt ? 'Customer Collection Receipt' : 'Supplier Payment Voucher'),
      allocations: isLumpsumOnAccount ? null : (allocList.length > 0 ? allocList : null),
    };

    setSavingPayment(true);
    try {
      const created = await api.recordPayment(payload);
      const label = isReceipt ? 'Receipt (Jama)' : 'Payment (Bhugtan)';
      notify(`✅ ${label} #${created.payment_number} of ₹${payAmt.toLocaleString('en-IN')} saved successfully!`, 'success');

      if (andPrint && created.id) {
        window.open(api.getPaymentPrintUrl(created.id), '_blank', 'width=850,height=600');
      }

      // Reset
      setTotalAmount('');
      setAllocations({});
      setReferenceNumber('');
      setNotes('');
      setViewMode('list');
    } catch (err) {
      console.error("Save Payment Error:", err);
      notify(err.message || 'Failed to record voucher', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  // WhatsApp Outstanding Sender
  const handleSendWhatsAppReminder = async () => {
    if (!selectedParty) return;
    const rawPhone = (selectedParty.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    if (!cleanPhone || cleanPhone.length < 10) {
      notify("Selected party does not have a valid mobile number.", "error");
      return;
    }
    const balFormatted = partyOutstanding?.balance_formatted || `₹${Math.abs(partyOutstanding?.net_balance || 0).toLocaleString('en-IN')}`;
    const firmTitle = currentFirm?.name || 'our shop';

    const msg = `Namaste ${selectedParty.name},\n\nThis is a friendly payment reminder from *${firmTitle}*.\nYour current outstanding balance is *${balFormatted}* (${partyOutstanding?.unpaid_bills_count || 0} pending bill(s)).\n\nKindly arrange the payment at your earliest convenience via UPI or Bank Transfer.\n\nThank you,\n*${firmTitle}*`;

    try {
      await api.sendCustomWhatsApp(cleanPhone, msg);
      notify(`✅ Payment reminder sent to ${selectedParty.name} (${cleanPhone}) via WhatsApp Bridge!`, 'success');
    } catch (err) {
      console.warn("WhatsApp Bridge send failed, opening web fallback:", err);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    }
  };

  return (
    <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ═════════ TOP HERO BAR ═════════ */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Title & Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isReceipt ? (
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowDownLeft size={22} color="#059669" />
              </div>
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={22} color="#7c3aed" />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {isReceipt ? 'Customer Collection Voucher (Receipt / जमा)' : 'Supplier Payment Voucher (भुगतान)'}
                </h2>
                <span className={isReceipt ? 'badge badge-emerald' : 'badge badge-indigo'} style={{ padding: '3px 9px', fontSize: '11.5px' }}>
                  {isReceipt ? 'HOTKEY: F10' : 'SUPPLIER OUTWARD'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {isReceipt 
                  ? 'Record money received from customers. Settle specific bills or receive on-account payment.'
                  : 'Record payments made to suppliers/vendors. Settle purchase invoices with cheque or bank ref.'}
              </div>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            <button
              onClick={() => handleSwitchMode('receipt')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                background: isReceipt ? '#ffffff' : 'transparent',
                color: isReceipt ? '#059669' : '#64748b',
                boxShadow: isReceipt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowDownLeft size={14} /> Receipt (F10)
            </button>
            <button
              onClick={() => handleSwitchMode('payment')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                background: !isReceipt ? '#ffffff' : 'transparent',
                color: !isReceipt ? '#7c3aed' : '#64748b',
                boxShadow: !isReceipt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowUpRight size={14} /> Supplier Payment
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn ${viewMode === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('create')}
            style={{ fontSize: '13px', padding: '7px 14px' }}
          >
            <Plus size={15} /> + New Voucher
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('list')}
            style={{ fontSize: '13px', padding: '7px 14px' }}
          >
            <FileText size={15} /> Voucher Register
          </button>
        </div>
      </div>

      {/* ═════════ VIEW 1: CREATE VOUCHER ═════════ */}
      {viewMode === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', alignItems: 'start' }}>
          
          {/* Main Left Workspace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Party Selector & Date Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '18px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                
                {/* Voucher Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} /> Voucher Date
                  </label>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                {/* Party Selector */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    <UserCheck size={13} style={{ display: 'inline', marginRight: '4px' }} /> 
                    {isReceipt ? 'Select Customer (Received From)' : 'Select Supplier / Vendor (Paid To)'} *
                  </label>
                  
                  <div 
                    onClick={() => setShowPartyDropdown(!showPartyDropdown)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: selectedParty ? 600 : 400,
                      color: selectedParty ? '#0f172a' : '#94a3b8'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedParty ? `${selectedParty.name} ${selectedParty.phone ? `(${selectedParty.phone})` : ''}` : `Search ${isReceipt ? 'Customer' : 'Vendor'}...`}
                    </span>
                    <ChevronDown size={14} color="#64748b" />
                  </div>

                  {/* Dropdown Menu */}
                  {showPartyDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)',
                      marginTop: '4px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      padding: '8px'
                    }}>
                      <div style={{ position: 'relative', marginBottom: '6px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Type party name, phone, or GSTIN..."
                          value={partySearch}
                          onChange={e => setPartySearch(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 10px 6px 30px',
                            borderRadius: '5px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px'
                          }}
                        />
                      </div>

                      {filteredParties.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                          No matching parties found
                        </div>
                      ) : (
                        filteredParties.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPartyId(p.id);
                              setShowPartyDropdown(false);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f8fafc',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: String(selectedPartyId) === String(p.id) ? '#f1f5f9' : 'transparent',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{p.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {p.billing_address ? `📍 ${p.billing_address} • ` : ''}{p.phone || 'No Phone'} • {p.city || 'Local'} {p.gstin ? `• ${p.gstin}` : ''}
                              </div>
                            </div>
                            <span style={{ fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                              {p.party_type || 'Customer'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
                  >
                    {PAYMENT_MODES.map(m => (
                      <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Reference / UTR Input if not Cash */}
              {paymentMode !== 'cash' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    {paymentMode === 'cheque' ? 'Cheque No & Bank Details' : 'UPI UTR / Transaction ID / Bank Reference'}
                  </label>
                  <input
                    type="text"
                    placeholder={paymentMode === 'cheque' ? 'e.g. Cheque #492011 HDFC Bank Dated 28/10' : 'e.g. UPI Ref 329104812391 / NEFT UTR'}
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              )}

              {/* Party Live Outstanding Card */}
              {selectedParty && (
                <div style={{
                  background: isReceipt ? '#f0fdf4' : '#faf5ff',
                  border: `1px solid ${isReceipt ? '#bbf7d0' : '#e9d5ff'}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                      {selectedParty.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                      {selectedParty.billing_address || 'Walk-in Address'} {selectedParty.phone ? `• 📞 ${selectedParty.phone}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    {loadingOutstanding ? (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Calculating balance...</span>
                    ) : partyOutstanding ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 600 }}>
                          {partyOutstanding.balance_label}
                        </div>
                        <div style={{
                          fontWeight: 900,
                          fontSize: '17px',
                          color: partyOutstanding.is_debit ? '#dc2626' : '#16a34a'
                        }}>
                          {partyOutstanding.balance_formatted}
                        </div>
                      </div>
                    ) : null}

                    {/* Quick WhatsApp Reminder */}
                    <button
                      onClick={handleSendWhatsAppReminder}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(37, 211, 102, 0.3)'
                      }}
                      title="Send WhatsApp payment reminder to this party"
                    >
                      <Share2 size={13} /> WhatsApp Due
                    </button>

                    <button
                      onClick={() => onOpenLedger(selectedParty.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: '#0284c7',
                        cursor: 'pointer'
                      }}
                    >
                      <BookOpen size={13} /> View Ledger
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Bill-by-Bill Allocation Table */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '18px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Bill-by-Bill Allocation (बिल अनुसार समायोजन)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Select specific unpaid bills to clear or use auto-allocate FIFO
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleAutoAllocateFIFO}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      padding: '5px 12px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#047857',
                      cursor: 'pointer'
                    }}
                    title="Distribute entered lumpsum amount across oldest bills"
                  >
                    ⚡ Auto-Allocate FIFO
                  </button>

                  <button
                    onClick={handleClearAllocations}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {!selectedPartyId ? (
                <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                  👆 Select a {isReceipt ? 'customer' : 'supplier'} above to view outstanding bills
                </div>
              ) : loadingInvoices ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                  Loading pending invoices...
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <div style={{ padding: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#065f46', fontSize: '13px', textAlign: 'center' }}>
                  🎉 No pending unpaid bills for this party! Any payment entered will be credited On-Account (Advance).
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', width: '35px' }}></th>
                        <th style={{ padding: '8px 10px' }}>Bill Number</th>
                        <th style={{ padding: '8px 10px', width: '95px' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Bill Total</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Paid So Far</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Balance Due</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>Settle Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidInvoices.map((inv) => {
                        const isAllocated = allocations[inv.id] !== undefined;
                        const allocAmt = allocations[inv.id] || 0;
                        const due = Number(inv.balance_amount);

                        return (
                          <tr
                            key={inv.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isAllocated ? (isReceipt ? '#ecfdf5' : '#f5f3ff') : '#ffffff',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isAllocated}
                                onChange={() => handleToggleBill(inv)}
                                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                              />
                            </td>

                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>
                              #{inv.invoice_number}
                            </td>

                            <td style={{ padding: '8px 10px', color: '#64748b' }}>
                              {inv.invoice_date}
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                              ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>
                              ₹{Number(inv.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                              ₹{due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                max={due}
                                step="0.01"
                                placeholder="0.00"
                                value={isAllocated ? allocAmt : ''}
                                onChange={e => handleAllocationAmountChange(inv.id, e.target.value, due)}
                                style={{
                                  width: '95px',
                                  textAlign: 'right',
                                  padding: '5px 8px',
                                  borderRadius: '5px',
                                  border: `1px solid ${isAllocated ? (isReceipt ? '#10b981' : '#8b5cf6') : '#cbd5e1'}`,
                                  fontWeight: 700,
                                  fontSize: '12.5px',
                                  background: isAllocated ? '#ffffff' : '#f8fafc',
                                  color: isAllocated ? '#0f172a' : '#94a3b8'
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Summary & Save Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '18px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                {isReceipt ? 'Collection Summary' : 'Payment Summary'}
              </h4>

              {/* Total Amount Input */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Total {isReceipt ? 'Received Amount (₹)' : 'Paid Amount (₹)'} *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 800, fontSize: '16px', color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={e => setTotalAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 28px',
                      borderRadius: '6px',
                      border: `2px solid ${isReceipt ? '#10b981' : '#8b5cf6'}`,
                      fontSize: '18px',
                      fontWeight: 800,
                      color: isReceipt ? '#047857' : '#6d28d9',
                    }}
                  />
                </div>
              </div>

              {/* Lumpsum on account toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#475569',
                cursor: 'pointer',
                marginBottom: '14px',
                padding: '6px 8px',
                background: '#f8fafc',
                borderRadius: '5px'
              }}>
                <input
                  type="checkbox"
                  checked={isLumpsumOnAccount}
                  onChange={e => setIsLumpsumOnAccount(e.target.checked)}
                />
                <span>On-Account Lumpsum (Do not tie to specific bills)</span>
              </label>

              {/* Allocations breakdown */}
              {!isLumpsumOnAccount && Object.keys(allocations).length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '12px', marginBottom: '14px' }}>
                  <div style={{ color: '#64748b', marginBottom: '4px' }}>Allocated across:</div>
                  <strong style={{ color: '#0f172a' }}>{Object.keys(allocations).length} Bill(s)</strong>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Remarks / Narration
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Cleared Diwali season balance..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              {/* Save Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSavePayment(true)}
                  disabled={savingPayment || !(parseFloat(totalAmount) > 0)}
                  style={{
                    padding: '10px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    background: isReceipt ? '#059669' : '#7c3aed',
                    borderColor: isReceipt ? '#047857' : '#6d28d9'
                  }}
                >
                  <Printer size={16} /> Save & Print Receipt
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleSavePayment(false)}
                  disabled={savingPayment || !(parseFloat(totalAmount) > 0)}
                  style={{ padding: '8px', fontSize: '13px', fontWeight: 600 }}
                >
                  <CheckCircle size={15} /> Save Voucher Only
                </button>

                <button
                  onClick={onBackToDesk}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '12px',
                    padding: '6px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Cancel / Return to Desk (F2)
                </button>
              </div>

            </div>

            {/* Quick Helper Info */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#475569'
            }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                💡 Accurate Accounting Rule:
              </div>
              <div style={{ color: '#64748b' }}>
                {isReceipt 
                  ? 'Saving this Receipt automatically marks the selected invoices as Paid or Partial, and lowers customer debt in the Party Ledger.'
                  : 'Saving this Payment automatically marks purchase bills as Settled and lowers supplier payables in the Ledger.'}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ═════════ VIEW 2: VOUCHER REGISTERS ═════════ */}
      {viewMode === 'list' && (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isReceipt ? 'Receipts / Collection Register (जमा)' : 'Supplier Payments Register (भुगतान)'}
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Complete history of all {isReceipt ? 'collections' : 'payments'} recorded
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter by voucher # or party..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '220px' }}
                />
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={loadHistory}
                title="Refresh list"
              >
                <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
              Loading vouchers...
            </div>
          ) : historyPayments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#64748b' }}>
              No {isReceipt ? 'Receipts' : 'Payments'} have been recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Voucher No</th>
                    <th style={{ padding: '10px 12px', width: '100px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Party Name</th>
                    <th style={{ padding: '10px 12px', width: '100px' }}>Mode</th>
                    <th style={{ padding: '10px 12px', width: '150px' }}>Reference</th>
                    <th style={{ padding: '10px 12px' }}>Narration</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPayments
                    .filter(p => {
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase();
                      const num = (p.payment_number || '').toLowerCase();
                      const ref = (p.reference_number || '').toLowerCase();
                      return num.includes(q) || ref.includes(q);
                    })
                    .map(p => {
                      const modeLabel = (p.payment_mode || '').toUpperCase();
                      return (
                        <tr 
                          key={p.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            opacity: p.is_cancelled ? 0.6 : 1,
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                            {p.payment_number}
                            {p.is_cancelled && (
                              <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '6px', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                                CANCELLED
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            {p.payment_date}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                            {customers.find(c => c.id === p.customer_id)?.name || `Party #${p.customer_id}`}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', fontWeight: 600 }}>
                              {modeLabel}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569', fontFamily: 'monospace', fontSize: '11.5px' }}>
                            {p.reference_number || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {p.notes || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: isReceipt ? '#059669' : '#7c3aed' }}>
                            ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => window.open(api.getPaymentPrintUrl(p.id), '_blank', 'width=850,height=600')}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Print A5 Receipt Slip"
                            >
                              <Printer size={12} /> Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
