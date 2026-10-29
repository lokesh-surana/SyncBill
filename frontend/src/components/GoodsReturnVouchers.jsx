import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, RotateCw, Receipt, ShoppingCart, Search, Plus, 
  Trash2, Printer, CheckCircle, AlertCircle, FileText, ArrowLeft, 
  ChevronDown, ExternalLink, Calendar, CheckSquare, Square, 
  UserCheck, X, RefreshCw, BookOpen, AlertTriangle, ShieldCheck
} from 'lucide-react';
import * as api from '../api';

const RETURN_REASONS = [
  'Defective / Damaged Piece',
  'Size / Fit Issue',
  'Color / Design Dislike',
  'Customer Dissatisfied / Returned',
  'Excess Stock / Unsold Return',
  'Rate Difference / Discount Adjustment',
  'Wrong Item Dispatched',
  'Other Reason',
];

export default function GoodsReturnVouchers({
  firmId = 2,
  firms = [],
  customers = [],
  items = [],
  notify = () => {},
  onOpenLedger = () => {},
  initialType = 'credit_note', // 'credit_note' | 'debit_note'
  onBackToDesk = () => {},
}) {
  // Mode: 'credit_note' (Sales Return) vs 'debit_note' (Purchase Return)
  const [returnType, setReturnType] = useState(initialType);
  const isCredit = returnType === 'credit_note'; // true = Sales Return, false = Purchase Return

  // View Mode: 'create' | 'list'
  const [viewMode, setViewMode] = useState('create');

  // Form State
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyOutstanding, setPartyOutstanding] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  // Bill Linking State
  const [linkMode, setLinkMode] = useState('bill'); // 'bill' | 'manual'
  const [partyInvoices, setPartyInvoices] = useState([]);
  const [loadingPartyInvoices, setLoadingPartyInvoices] = useState(false);
  const [selectedOriginalInvoiceId, setSelectedOriginalInvoiceId] = useState('');
  const [originalInvoiceData, setOriginalInvoiceData] = useState(null);
  const [loadingOriginalInvoice, setLoadingOriginalInvoice] = useState(false);

  // Manual Bill Reference (if linkMode === 'manual')
  const [manualBillNo, setManualBillNo] = useState('');
  const [manualBillDate, setManualBillDate] = useState('');

  // Return Details
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('credit'); // 'credit' (Adjust in ledger) | 'cash' (Refund cash)
  const [notes, setNotes] = useState('');

  // Return Line Items
  const [returnLines, setReturnLines] = useState([]);

  // Search Filter for party dropdown
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Return Invoices Register / History
  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  // Synchronize when initialType changes from outside (e.g. via sidebar or F12)
  useEffect(() => {
    if (initialType) setReturnType(initialType);
  }, [initialType]);

  // Reset form when switching mode
  const handleSwitchMode = (newMode) => {
    setReturnType(newMode);
    setSelectedPartyId('');
    setPartyOutstanding(null);
    setSelectedOriginalInvoiceId('');
    setOriginalInvoiceData(null);
    setReturnLines([]);
    setManualBillNo('');
    setManualBillDate('');
    setPartySearch('');
  };

  // Filter parties based on return type (Credit Note = Customers, Debit Note = Vendors)
  const filteredParties = useMemo(() => {
    return customers.filter(c => {
      const pType = String(c.party_type || '').toLowerCase();
      const matchType = isCredit ? (pType !== 'vendor') : (pType === 'vendor' || pType === 'supplier');
      if (!partySearch.trim()) return matchType;
      const q = partySearch.toLowerCase();
      return matchType && (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [customers, isCredit, partySearch]);

  const selectedParty = useMemo(() => {
    return customers.find(c => String(c.id) === String(selectedPartyId)) || null;
  }, [customers, selectedPartyId]);

  // Load party outstanding & recent invoices when party changes
  useEffect(() => {
    if (!selectedPartyId) {
      setPartyOutstanding(null);
      setPartyInvoices([]);
      setSelectedOriginalInvoiceId('');
      setOriginalInvoiceData(null);
      setReturnLines([]);
      return;
    }

    // Load Live Outstanding
    setLoadingOutstanding(true);
    api.getCustomerOutstanding(selectedPartyId, firmId)
      .then(res => setPartyOutstanding(res))
      .catch(err => console.error("Error loading party outstanding:", err))
      .finally(() => setLoadingOutstanding(false));

    // Load Party Past Invoices (Sales for Credit Note, Purchases for Debit Note)
    setLoadingPartyInvoices(true);
    const targetInvType = isCredit ? 'sales' : 'purchase';
    api.getInvoices(firmId, targetInvType, null, null, selectedPartyId)
      .then(res => {
        setPartyInvoices(Array.isArray(res) ? res : []);
      })
      .catch(err => {
        console.error("Error loading party invoices:", err);
        setPartyInvoices([]);
      })
      .finally(() => setLoadingPartyInvoices(false));
  }, [selectedPartyId, firmId, isCredit]);

  // Load returnable items when original invoice is selected
  useEffect(() => {
    if (!selectedOriginalInvoiceId) {
      setOriginalInvoiceData(null);
      if (linkMode === 'bill') setReturnLines([]);
      return;
    }

    setLoadingOriginalInvoice(true);
    api.getReturnableInvoice(selectedOriginalInvoiceId)
      .then(data => {
        setOriginalInvoiceData(data);
        if (data.items && data.items.length > 0) {
          const initLines = data.items.map(it => ({
            item_id: it.item_id,
            item_name: it.item_name,
            hsn_code: it.hsn_code || '',
            size: it.size || '',
            color: it.color || '',
            mrp: it.mrp || 0,
            original_quantity: it.original_quantity,
            already_returned_quantity: it.already_returned_quantity,
            returnable_quantity: it.returnable_quantity,
            quantity: 0,
            rate: it.rate,
            cd1_percent: it.cd1_percent || 0,
            cd2_percent: it.cd2_percent || 0,
            cd3_percent: it.cd3_percent || 0,
            discount_percent: it.discount_percent || 0,
            gst_rate: it.gst_rate || 5.0,
            uom: it.uom || 'Pcs',
          }));
          setReturnLines(initLines);
        }
      })
      .catch(err => {
        console.error("Error loading returnable items:", err);
        notify(err.message || "Failed to load original invoice items", "error");
      })
      .finally(() => setLoadingOriginalInvoice(false));
  }, [selectedOriginalInvoiceId, linkMode]);

  // Load History / Registers
  const loadHistory = () => {
    setLoadingHistory(true);
    api.getInvoices(firmId, returnType)
      .then(res => setHistoryInvoices(Array.isArray(res) ? res : []))
      .catch(err => console.error("Error loading returns history:", err))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (viewMode === 'list') {
      loadHistory();
    }
  }, [viewMode, returnType, firmId]);

  // Quantity Adjusters for Linked Bill Items
  const handleUpdateLineQty = (index, delta) => {
    setReturnLines(prev => {
      const next = [...prev];
      const line = { ...next[index] };
      const maxQty = line.returnable_quantity !== undefined ? line.returnable_quantity : 9999;
      const newQty = Math.max(0, Math.min(maxQty, (Number(line.quantity) || 0) + delta));
      line.quantity = newQty;
      next[index] = line;
      return next;
    });
  };

  const handleSetLineQty = (index, val) => {
    setReturnLines(prev => {
      const next = [...prev];
      const line = { ...next[index] };
      const maxQty = line.returnable_quantity !== undefined ? line.returnable_quantity : 9999;
      const numVal = parseFloat(val) || 0;
      line.quantity = Math.max(0, Math.min(maxQty, numVal));
      next[index] = line;
      return next;
    });
  };

  const handleReturnAll = () => {
    setReturnLines(prev => prev.map(line => ({
      ...line,
      quantity: line.returnable_quantity || 0,
    })));
    notify("Set all items to maximum returnable quantity", "info");
  };

  const handleClearReturnQty = () => {
    setReturnLines(prev => prev.map(line => ({
      ...line,
      quantity: 0,
    })));
  };

  // Manual Items handling (if direct return without bill)
  const handleAddManualLine = () => {
    setReturnLines(prev => [
      ...prev,
      {
        item_id: null,
        item_name: '',
        hsn_code: '6203',
        size: '',
        color: '',
        mrp: 0,
        original_quantity: 0,
        already_returned_quantity: 0,
        returnable_quantity: 9999,
        quantity: 1,
        rate: 0,
        cd1_percent: 0,
        cd2_percent: 0,
        cd3_percent: 0,
        discount_percent: 0,
        gst_rate: 5.0,
        uom: 'Pcs',
      }
    ]);
  };

  const handleRemoveManualLine = (index) => {
    setReturnLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualLineChange = (index, field, value) => {
    setReturnLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Calculations for active return lines (only those with quantity > 0)
  const activeReturnLines = useMemo(() => {
    return returnLines.filter(l => (Number(l.quantity) || 0) > 0 && (l.item_name || '').trim());
  }, [returnLines]);

  const summary = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalPieces = 0;

    activeReturnLines.forEach(line => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const gross = qty * rate;

      // Discounts
      const cd1 = Number(line.cd1_percent) || 0;
      const cd2 = Number(line.cd2_percent) || 0;
      const cd3 = Number(line.cd3_percent) || 0;
      const disc = Number(line.discount_percent) || 0;

      let afterDisc = gross;
      if (cd1 > 0) afterDisc *= (1 - cd1 / 100);
      if (cd2 > 0) afterDisc *= (1 - cd2 / 100);
      if (cd3 > 0) afterDisc *= (1 - cd3 / 100);
      if (disc > 0 && cd1 === 0 && cd2 === 0 && cd3 === 0) afterDisc *= (1 - disc / 100);

      const discAmount = Math.round((gross - afterDisc) * 100) / 100;
      const taxable = gross - discAmount;
      const gstRate = Number(line.gst_rate) || 5.0;
      const taxAmount = Math.round(taxable * (gstRate / 100) * 100) / 100;

      subtotal += taxable;
      totalTax += taxAmount;
      totalDiscount += discAmount;
      totalPieces += qty;
    });

    const rawTotal = subtotal + totalTax;
    const grandTotal = Math.round(rawTotal);
    const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      roundOff,
      grandTotal,
      totalPieces,
    };
  }, [activeReturnLines]);

  // Save Return Voucher
  const handleSaveReturnVoucher = async (andPrint = false) => {
    if (!selectedPartyId) {
      notify(`Please select a ${isCredit ? 'Customer' : 'Supplier / Vendor'}`, 'error');
      return;
    }

    if (activeReturnLines.length === 0) {
      notify('Please specify at least 1 item with return quantity > 0', 'error');
      return;
    }

    const effectiveReason = returnReason === 'Other Reason' && customReason.trim()
      ? customReason.trim()
      : returnReason;

    const originalBillNum = linkMode === 'bill'
      ? (originalInvoiceData?.invoice_number || '')
      : manualBillNo.trim();

    const originalBillId = linkMode === 'bill' && originalInvoiceData
      ? originalInvoiceData.invoice_id
      : null;

    const payload = {
      firm_id: Number(firmId),
      customer_id: Number(selectedPartyId),
      invoice_type: returnType,
      invoice_date: returnDate,
      original_invoice_id: originalBillId,
      original_invoice_number: originalBillNum,
      return_reason: effectiveReason,
      notes: notes.trim() || `Goods Return Voucher (${effectiveReason})`,
      place_of_supply: selectedParty?.state_code || originalInvoiceData?.place_of_supply || '27',
      rate_type: originalInvoiceData?.rate_type || 'retail',
      cash_amount: settlementMethod === 'cash' ? summary.grandTotal : 0,
      paid_amount: settlementMethod === 'cash' ? summary.grandTotal : 0,
      credit_amount: settlementMethod === 'credit' ? summary.grandTotal : 0,
      items: activeReturnLines.map(line => ({
        item_id: line.item_id || null,
        item_name: line.item_name,
        hsn_code: line.hsn_code || '6203',
        size: line.size || null,
        color: line.color || null,
        mrp: line.mrp ? Number(line.mrp) : null,
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        cd1_percent: Number(line.cd1_percent || 0),
        cd2_percent: Number(line.cd2_percent || 0),
        cd3_percent: Number(line.cd3_percent || 0),
        discount_percent: Number(line.discount_percent || 0),
        gst_rate: Number(line.gst_rate || 5.0),
        uom: line.uom || 'Pcs',
      })),
    };

    setSavingReturn(true);
    try {
      const created = await api.createInvoice(payload);
      const voucherLabel = isCredit ? 'Credit Note (Sales Return)' : 'Debit Note (Purchase Return)';
      notify(`✅ ${voucherLabel} #${created.invoice_number} saved! Stock updated & Party Ledger adjusted.`, 'success');

      if (andPrint && created.id) {
        window.open(api.getInvoicePrintUrl(created.id), '_blank', 'width=900,height=800');
      }

      // Reset form
      setSelectedOriginalInvoiceId('');
      setOriginalInvoiceData(null);
      setReturnLines([]);
      setManualBillNo('');
      setNotes('');
      setViewMode('list');
    } catch (err) {
      console.error("Save Return Error:", err);
      notify(err.message || 'Failed to save return voucher', 'error');
    } finally {
      setSavingReturn(false);
    }
  };

  return (
    <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ═════════ TOP HERO HEADER & CONTROLS ═════════ */}
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
        {/* Left: Title & Mode Toggle Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isCredit ? (
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={22} color="#e11d48" />
              </div>
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCw size={22} color="#ea580c" />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {isCredit ? 'Sales Goods Return (Credit Note)' : 'Purchase Goods Return (Debit Note)'}
                </h2>
                <span className={isCredit ? 'badge badge-return-credit' : 'badge badge-return-debit'} style={{ padding: '3px 9px', fontSize: '11.5px' }}>
                  {isCredit ? 'HOTKEY: F12' : 'SUPPLIER RETURN'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {isCredit 
                  ? 'Customer returns garments. Auto-restores warehouse stock & deducts customer udhaari.'
                  : 'Return defective or unsold items to supplier. Auto-decrements stock & reduces payable.'}
              </div>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            <button
              onClick={() => handleSwitchMode('credit_note')}
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
                background: isCredit ? '#ffffff' : 'transparent',
                color: isCredit ? '#e11d48' : '#64748b',
                boxShadow: isCredit ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={14} /> Sales Return (F12)
            </button>
            <button
              onClick={() => handleSwitchMode('debit_note')}
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
                background: !isCredit ? '#ffffff' : 'transparent',
                color: !isCredit ? '#ea580c' : '#64748b',
                boxShadow: !isCredit ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCw size={14} /> Purchase Return
            </button>
          </div>
        </div>

        {/* Right: View Toggle ("+ New Return" vs "Register History") */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn ${viewMode === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('create')}
            style={{ fontSize: '13px', padding: '7px 14px' }}
          >
            <Plus size={15} /> + New Return Voucher
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('list')}
            style={{ fontSize: '13px', padding: '7px 14px' }}
          >
            <FileText size={15} /> Returns Register
          </button>
        </div>
      </div>

      {/* ═════════ VIEW 1: CREATE RETURN VOUCHER FORM ═════════ */}
      {viewMode === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '16px', alignItems: 'start' }}>
          
          {/* Main Return Voucher Workspace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Header Card: Party Picker, Date, Return Link Options */}
            <div className={`return-hero-card ${!isCredit ? 'debit-mode' : ''}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                
                {/* Voucher Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} /> Return Voucher Date
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                {/* Party Selector (Customer or Vendor) */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    <UserCheck size={13} style={{ display: 'inline', marginRight: '4px' }} /> 
                    {isCredit ? 'Select Customer (Billed Party)' : 'Select Supplier / Vendor'} *
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
                      {selectedParty ? `${selectedParty.name} ${selectedParty.phone ? `(${selectedParty.phone})` : ''}` : `Search ${isCredit ? 'Customer' : 'Vendor'}...`}
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
                          placeholder={`Type party name, phone, or GSTIN...`}
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
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = String(selectedPartyId) === String(p.id) ? '#f1f5f9' : 'transparent'}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{p.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {p.phone || 'No Phone'} • {p.city || 'Local'} {p.gstin ? `• ${p.gstin}` : ''}
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

                {/* Reason for Return */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Return Reason
                  </label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
                  >
                    {RETURN_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* If "Other Reason", show custom input */}
              {returnReason === 'Other Reason' && (
                <div style={{ marginBottom: '14px' }}>
                  <input
                    type="text"
                    placeholder="Specify custom reason for return..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              )}

              {/* Party Outstanding Strip (When Party is Selected) */}
              {selectedParty && (
                <div style={{
                  background: isCredit ? '#fff1f2' : '#fff7ed',
                  border: `1px solid ${isCredit ? '#fda4af' : '#fed7aa'}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '13.5px',
                      color: isCredit ? '#be123c' : '#c2410c'
                    }}>
                      {selectedParty.name}
                    </div>
                    {selectedParty.gstin && (
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        GSTIN: {selectedParty.gstin}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {loadingOutstanding ? (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Calculating balance...</span>
                    ) : partyOutstanding ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          Current {partyOutstanding.balance_label}:
                        </span>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: partyOutstanding.is_debit ? '#dc2626' : '#16a34a'
                        }}>
                          {partyOutstanding.balance_formatted}
                        </span>
                      </div>
                    ) : null}

                    <button
                      onClick={() => onOpenLedger(selectedParty.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0284c7',
                        cursor: 'pointer'
                      }}
                      title="Open full ledger statement for this party"
                    >
                      <BookOpen size={12} /> View Ledger
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Original Bill Link Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={17} color={isCredit ? '#e11d48' : '#ea580c'} />
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Step 2: Link with Original {isCredit ? 'Sale Bill' : 'Purchase Bill'}
                  </h3>
                </div>

                {/* Switch between "Link Past Bill" vs "Direct Offline Return" */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setLinkMode('bill'); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid #cbd5e1',
                      background: linkMode === 'bill' ? (isCredit ? '#ffe4e6' : '#ffedd5') : '#ffffff',
                      color: linkMode === 'bill' ? (isCredit ? '#be123c' : '#c2410c') : '#64748b',
                    }}
                  >
                    Select Past Bill (Recommended)
                  </button>
                  <button
                    onClick={() => { setLinkMode('manual'); setSelectedOriginalInvoiceId(''); setOriginalInvoiceData(null); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid #cbd5e1',
                      background: linkMode === 'manual' ? (isCredit ? '#ffe4e6' : '#ffedd5') : '#ffffff',
                      color: linkMode === 'manual' ? (isCredit ? '#be123c' : '#c2410c') : '#64748b',
                    }}
                  >
                    Direct / Offline Bill Entry
                  </button>
                </div>
              </div>

              {/* Mode A: Select from party past bills */}
              {linkMode === 'bill' ? (
                <div>
                  {!selectedPartyId ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                      👆 Please select a {isCredit ? 'customer' : 'supplier'} above to view their past bills
                    </div>
                  ) : loadingPartyInvoices ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                      Loading past bills for {selectedParty?.name}...
                    </div>
                  ) : partyInvoices.length === 0 ? (
                    <div style={{ padding: '16px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>No previous {isCredit ? 'sales bills' : 'purchase bills'} found on record for this party.</span>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setLinkMode('manual')}
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      >
                        Use Direct Return Mode
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <select
                          value={selectedOriginalInvoiceId}
                          onChange={e => setSelectedOriginalInvoiceId(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            background: '#ffffff',
                            fontWeight: 600,
                            color: '#0f172a'
                          }}
                        >
                          <option value="">-- Select Original Bill ({partyInvoices.length} Available) --</option>
                          {partyInvoices.map(inv => (
                            <option key={inv.id} value={inv.id}>
                              Bill #{inv.invoice_number} • Date: {inv.invoice_date} • Total: ₹{Number(inv.grand_total).toLocaleString('en-IN')} ({inv.payment_status?.toUpperCase() || 'UNPAID'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {loadingOriginalInvoice && (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                          <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                          Fetching bill items and return history...
                        </div>
                      )}

                      {/* Display Selected Invoice Summary */}
                      {originalInvoiceData && (
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Original Invoice: <strong>#{originalInvoiceData.invoice_number}</strong>
                            </span>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Date: <strong>{originalInvoiceData.invoice_date}</strong>
                            </span>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Billed Amount: <strong>₹{Number(originalInvoiceData.grand_total).toLocaleString('en-IN')}</strong>
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleReturnAll}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: '#0f766e',
                                cursor: 'pointer'
                              }}
                            >
                              ⚡ Return All Items
                            </button>
                            <button
                              onClick={handleClearReturnQty}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              Clear Counts
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Mode B: Manual Reference */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Original Bill / Invoice Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2025-0891 or Cash Memo 42"
                      value={manualBillNo}
                      onChange={e => setManualBillNo(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Original Bill Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={manualBillDate}
                      onChange={e => setManualBillDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Items to Return Table */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Step 3: Pick Items & Enter Return Quantity
                  </h3>
                  <span className="badge badge-indigo" style={{ padding: '2px 8px', fontSize: '11px' }}>
                    {activeReturnLines.length} Selected
                  </span>
                </div>

                {linkMode === 'manual' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddManualLine}
                    style={{ fontSize: '12px', padding: '5px 10px' }}
                  >
                    <Plus size={14} /> + Add Item Row
                  </button>
                )}
              </div>

              {/* Items List or Table */}
              {returnLines.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#64748b' }}>
                  {linkMode === 'bill' 
                    ? 'Select an original bill above to populate returnable items automatically.'
                    : 'Click "+ Add Item Row" to manually add garments being returned.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                        <th style={{ padding: '8px 10px' }}>Item Description</th>
                        <th style={{ padding: '8px 10px', width: '80px' }}>HSN</th>
                        <th style={{ padding: '8px 10px', width: '70px' }}>Size</th>
                        {linkMode === 'bill' && (
                          <>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>Billed</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>Already Ret.</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '85px' }}>Max Ret.</th>
                          </>
                        )}
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '130px' }}>Return Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Unit Rate</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>GST %</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Line Total</th>
                        {linkMode === 'manual' && <th style={{ padding: '8px 10px', width: '40px' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {returnLines.map((line, idx) => {
                        const qty = Number(line.quantity) || 0;
                        const isSelected = qty > 0;
                        const maxAllowed = line.returnable_quantity !== undefined ? line.returnable_quantity : 9999;
                        const isExceeded = qty > maxAllowed;

                        // Calculate item line total
                        const rate = Number(line.rate) || 0;
                        const gross = qty * rate;
                        const cd1 = Number(line.cd1_percent) || 0;
                        const cd2 = Number(line.cd2_percent) || 0;
                        const cd3 = Number(line.cd3_percent) || 0;
                        const disc = Number(line.discount_percent) || 0;
                        let afterDisc = gross;
                        if (cd1 > 0) afterDisc *= (1 - cd1 / 100);
                        if (cd2 > 0) afterDisc *= (1 - cd2 / 100);
                        if (cd3 > 0) afterDisc *= (1 - cd3 / 100);
                        if (disc > 0 && cd1 === 0 && cd2 === 0 && cd3 === 0) afterDisc *= (1 - disc / 100);
                        const taxable = afterDisc;
                        const tax = taxable * ((Number(line.gst_rate) || 5.0) / 100);
                        const total = taxable + tax;

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              background: isSelected 
                                ? (isCredit ? '#fff5f6' : '#fffaf0')
                                : (idx % 2 === 0 ? '#ffffff' : '#fcfcfc'),
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8' }}>
                              {idx + 1}
                            </td>

                            {/* Item Name */}
                            <td style={{ padding: '8px 10px' }}>
                              {linkMode === 'bill' ? (
                                <div>
                                  <div style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f172a' : '#334155' }}>
                                    {line.item_name}
                                  </div>
                                  {line.color && (
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>Color: {line.color}</div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Enter Garment / Item Name..."
                                  value={line.item_name}
                                  onChange={e => handleManualLineChange(idx, 'item_name', e.target.value)}
                                  style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                              )}
                            </td>

                            {/* HSN */}
                            <td style={{ padding: '8px 10px' }}>
                              {linkMode === 'bill' ? (
                                <span style={{ fontFamily: 'monospace', color: '#475569' }}>{line.hsn_code || '-'}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={line.hsn_code}
                                  onChange={e => handleManualLineChange(idx, 'hsn_code', e.target.value)}
                                  style={{ width: '100%', padding: '5px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }}
                                />
                              )}
                            </td>

                            {/* Size */}
                            <td style={{ padding: '8px 10px' }}>
                              {linkMode === 'bill' ? (
                                <span style={{ fontWeight: 600, color: '#475569' }}>{line.size || '-'}</span>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="M / 32"
                                  value={line.size}
                                  onChange={e => handleManualLineChange(idx, 'size', e.target.value)}
                                  style={{ width: '100%', padding: '5px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                              )}
                            </td>

                            {/* Linked Bill Original Stats */}
                            {linkMode === 'bill' && (
                              <>
                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>
                                  {line.original_quantity}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', color: line.already_returned_quantity > 0 ? '#e11d48' : '#94a3b8' }}>
                                  {line.already_returned_quantity > 0 ? line.already_returned_quantity : '0'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: line.returnable_quantity > 0 ? '#047857' : '#94a3b8' }}>
                                  {line.returnable_quantity}
                                </td>
                              </>
                            )}

                            {/* Return Quantity Stepper */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                  type="button"
                                  className="qty-stepper-btn"
                                  onClick={() => handleUpdateLineQty(idx, -1)}
                                  disabled={qty <= 0}
                                  title="Reduce 1"
                                >
                                  -
                                </button>
                                
                                <input
                                  type="number"
                                  min="0"
                                  max={maxAllowed}
                                  value={line.quantity}
                                  onChange={e => handleSetLineQty(idx, e.target.value)}
                                  style={{
                                    width: '52px',
                                    textAlign: 'center',
                                    padding: '5px 2px',
                                    borderRadius: '5px',
                                    border: `1px solid ${isExceeded ? '#ef4444' : (isSelected ? (isCredit ? '#f43f5e' : '#f97316') : '#cbd5e1')}`,
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    background: isSelected ? '#ffffff' : '#f8fafc',
                                    color: isExceeded ? '#dc2626' : (isSelected ? '#0f172a' : '#64748b')
                                  }}
                                />

                                <button
                                  type="button"
                                  className="qty-stepper-btn"
                                  onClick={() => handleUpdateLineQty(idx, 1)}
                                  disabled={qty >= maxAllowed}
                                  title="Add 1"
                                >
                                  +
                                </button>
                              </div>
                              {isExceeded && (
                                <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
                                  Max: {maxAllowed}
                                </div>
                              )}
                            </td>

                            {/* Rate */}
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              {linkMode === 'bill' ? (
                                <span style={{ fontWeight: 600 }}>₹{Number(line.rate).toFixed(2)}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.rate}
                                  onChange={e => handleManualLineChange(idx, 'rate', e.target.value)}
                                  style={{ width: '80px', textAlign: 'right', padding: '5px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                              )}
                            </td>

                            {/* GST Rate */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {linkMode === 'bill' ? (
                                <span style={{ color: '#475569' }}>{line.gst_rate}%</span>
                              ) : (
                                <select
                                  value={line.gst_rate}
                                  onChange={e => handleManualLineChange(idx, 'gst_rate', e.target.value)}
                                  style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                                >
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="0">0%</option>
                                </select>
                              )}
                            </td>

                            {/* Line Total */}
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: isSelected ? 700 : 500, color: isSelected ? (isCredit ? '#be123c' : '#c2410c') : '#94a3b8' }}>
                              ₹{total.toFixed(2)}
                            </td>

                            {/* Remove Row in Manual Mode */}
                            {linkMode === 'manual' && (
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManualLine(idx)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                  title="Delete item row"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Summary & Settlement Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Calculation & Settlement Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '18px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                Return Financial Summary
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Total Garments (Qty):</span>
                  <strong>{summary.totalPieces} Pcs</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Taxable Subtotal:</span>
                  <span>₹{summary.subtotal.toFixed(2)}</span>
                </div>

                {summary.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                    <span>Discounts Deducted:</span>
                    <span>-₹{summary.totalDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>GST Tax Breakdown:</span>
                  <span>₹{summary.totalTax.toFixed(2)}</span>
                </div>

                {summary.roundOff !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Round Off:</span>
                    <span>{summary.roundOff > 0 ? `+₹${summary.roundOff.toFixed(2)}` : `-₹${Math.abs(summary.roundOff).toFixed(2)}`}</span>
                  </div>
                )}

                <div style={{
                  borderTop: '2px solid #0f172a',
                  paddingTop: '10px',
                  marginTop: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    {isCredit ? 'Credit Note Total:' : 'Debit Note Total:'}
                  </span>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: isCredit ? '#e11d48' : '#ea580c'
                  }}>
                    ₹{summary.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Settlement Choice */}
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Settlement Method
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${settlementMethod === 'credit' ? (isCredit ? '#f43f5e' : '#f97316') : '#e2e8f0'}`,
                    background: settlementMethod === 'credit' ? (isCredit ? '#fff5f6' : '#fffaf0') : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    <input
                      type="radio"
                      name="settlement"
                      value="credit"
                      checked={settlementMethod === 'credit'}
                      onChange={() => setSettlementMethod('credit')}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {isCredit ? 'Credit to Customer Account (Udhaari Cut)' : 'Debit to Supplier Account (Reduce Payable)'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Adjusts party balance automatically in Ledger
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${settlementMethod === 'cash' ? (isCredit ? '#f43f5e' : '#f97316') : '#e2e8f0'}`,
                    background: settlementMethod === 'cash' ? (isCredit ? '#fff5f6' : '#fffaf0') : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    <input
                      type="radio"
                      name="settlement"
                      value="cash"
                      checked={settlementMethod === 'cash'}
                      onChange={() => setSettlementMethod('cash')}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {isCredit ? 'Immediate Cash Refund to Customer' : 'Cash Received from Supplier'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Paid out on counter right now
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notes / Remarks */}
              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Internal Notes / Narration (Optional)
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Returned 2 pcs due to stitching defect..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveReturnVoucher(true)}
                  disabled={savingReturn || activeReturnLines.length === 0}
                  style={{
                    padding: '10px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    background: isCredit ? '#e11d48' : '#ea580c',
                    borderColor: isCredit ? '#be123c' : '#c2410c'
                  }}
                >
                  <Printer size={16} /> Save & Print Voucher
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleSaveReturnVoucher(false)}
                  disabled={savingReturn || activeReturnLines.length === 0}
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

            {/* Warehouse Stock Alert Notice */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#475569',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Accurate ERP Stock Safety:</strong>
                <div style={{ marginTop: '2px', color: '#64748b' }}>
                  {isCredit 
                    ? 'Saving this Credit Note will automatically add returned pieces back into inventory stock.'
                    : 'Saving this Debit Note will safely remove returned pieces from inventory stock.'}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ═════════ VIEW 2: RETURN REGISTERS / HISTORY ═════════ */}
      {viewMode === 'list' && (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isCredit ? 'Sales Returns (Credit Notes) Register' : 'Purchase Returns (Debit Notes) Register'}
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Showing all recorded {isCredit ? 'Credit Notes' : 'Debit Notes'} with original bill references & stock impact
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

          {/* Table */}
          {loadingHistory ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
              Loading return vouchers...
            </div>
          ) : historyInvoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#64748b' }}>
              No {isCredit ? 'Credit Notes' : 'Debit Notes'} have been created yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Voucher No</th>
                    <th style={{ padding: '10px 12px', width: '100px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Party Name</th>
                    <th style={{ padding: '10px 12px', width: '140px' }}>Original Bill Ref</th>
                    <th style={{ padding: '10px 12px' }}>Return Reason</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Stock Impact</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyInvoices
                    .filter(inv => {
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase();
                      const num = (inv.invoice_number || '').toLowerCase();
                      const party = (inv.customer?.name || '').toLowerCase();
                      return num.includes(q) || party.includes(q);
                    })
                    .map(inv => (
                      <tr 
                        key={inv.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          opacity: inv.is_cancelled ? 0.6 : 1,
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {inv.invoice_number}
                          {inv.is_cancelled && (
                            <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '6px', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                              CANCELLED
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {inv.invoice_date}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                          {inv.customer?.name || 'Walk-in'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#0284c7', fontFamily: 'monospace' }}>
                          {inv.original_invoice_number ? `#${inv.original_invoice_number}` : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {inv.return_reason || inv.notes || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: isCredit ? '#d1fae5' : '#fee2e2',
                            color: isCredit ? '#065f46' : '#991b1b',
                          }}>
                            {isCredit ? 'Stock In (+)' : 'Stock Out (-)'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: isCredit ? '#e11d48' : '#ea580c' }}>
                          ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => window.open(api.getInvoicePrintUrl(inv.id), '_blank', 'width=900,height=800')}
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
                            title="Print A4 GST Voucher"
                          >
                            <Printer size={12} /> Print
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
