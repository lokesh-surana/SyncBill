import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Receipt, ShoppingCart, LayoutDashboard, Package, Users, 
  FileText, Plus, Search, Trash2, Printer, CheckCircle, 
  AlertCircle, Building2, Calendar, CreditCard, ArrowLeft,
  Truck, ArrowDownLeft, ArrowUpRight, Filter, ChevronDown,
  FileSpreadsheet, Download, Share2, Check, BookOpen, RefreshCw,
  Home, CheckSquare, Square, Shield, Lock, Clock, ArrowRight,
  ClipboardList, CheckCircle2, ChevronRight, Sparkles, Send,
  HelpCircle, UserCheck, PhoneCall, Coins, AlertTriangle, X, Volume2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, PanelLeftClose, PanelLeftOpen, Menu,
  RotateCcw, RotateCw, Tag, TrendingUp, Smartphone
} from 'lucide-react';
import * as api from './api';
import GoodsReturnVouchers from './components/GoodsReturnVouchers';
import AccountsVouchers from './components/AccountsVouchers';
import BarcodeGenerator from './components/BarcodeGenerator';
import DaybookAnalytics from './components/DaybookAnalytics';
import WhatsAppModal from './components/WhatsAppModal';

const FINANCIAL_YEARS = [
  { id: '2026-2027', label: 'FY 2026-27 (Current Year)', start: '2026-04-01', end: '2027-03-31' },
  { id: '2025-2026', label: 'FY 2025-26 (Previous Year)', start: '2025-04-01', end: '2026-03-31' },
  { id: '2024-2025', label: 'FY 2024-25 (Archived)', start: '2024-04-01', end: '2025-03-31' },
  { id: '2023-2024', label: 'FY 2023-24 (Archived)', start: '2023-04-01', end: '2024-03-31' },
  { id: 'all', label: 'All Financial Years (Complete History)', start: null, end: null },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('desk'); // 'desk' is the new default counter screen (Safe & Private)
  const [returnInitialType, setReturnInitialType] = useState('credit_note'); // 'credit_note' | 'debit_note'
  const [accountsVoucherInitialType, setAccountsVoucherInitialType] = useState('receipt'); // 'receipt' (Customer Collection) | 'payment' (Supplier Payment)
  const [ledgerFirmFilter, setLedgerFirmFilter] = useState('all'); // 'all' (Multi-Firm Combined) | specific firm ID
  const [barcodeInitialItems, setBarcodeInitialItems] = useState([]); // Preloaded items for barcode tag printing
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Minimized left sidebar state
  const sidebarNavRef = useRef(null);
  const [navIndicator, setNavIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const [firms, setFirms] = useState([]);
  const [firmId, setFirmId] = useState(2); // APEX APPARELS & TEXTILES (Accurate Main Company)
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppBridgeStatus, setWhatsAppBridgeStatus] = useState(null);

  // Poll WhatsApp Bridge status
  useEffect(() => {
    const checkWhatsApp = async () => {
      try {
        const data = await api.getWhatsAppStatus();
        setWhatsAppBridgeStatus(data);
      } catch (e) {
        setWhatsAppBridgeStatus({ bridge_online: false, connected: false });
      }
    };
    checkWhatsApp();
    const timer = setInterval(checkWhatsApp, 12000);
    return () => clearInterval(timer);
  }, []);

  // Financial Year Selection
  const [selectedFY, setSelectedFY] = useState('2026-2027');
  const activeFYObj = FINANCIAL_YEARS.find(f => f.id === selectedFY) || FINANCIAL_YEARS[0];

  // Masters
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saleCategoryFilter, setSaleCategoryFilter] = useState('ALL');
  const [purchaseCategoryFilter, setPurchaseCategoryFilter] = useState('ALL');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('ALL');

  // ═════════ SALES VOUCHER (SELL BILL) STATE ═════════
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [saleRateType, setSaleRateType] = useState('retail'); // 'retail' | 'wholesale'
  const [customerOutstanding, setCustomerOutstanding] = useState(null);
  const [vendorOutstanding, setVendorOutstanding] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const [salePlaceOfSupply, setSalePlaceOfSupply] = useState('27');
  const [salePaymentMode, setSalePaymentMode] = useState('credit'); // default to credit/udhaari as in wholesale Accurate ERP
  const [salePaidAmount, setSalePaidAmount] = useState('');
  const [saleTransportCharges, setSaleTransportCharges] = useState('');
  const [saleAdvanceAmount, setSaleAdvanceAmount] = useState('');
  const [saleCardAmount, setSaleCardAmount] = useState('');
  const [saleCashAmount, setSaleCashAmount] = useState('');
  const [saleRemarks, setSaleRemarks] = useState('');
  const [parkedBills, setParkedBills] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('syncbill_parked_bills') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [showParkedBillsModal, setShowParkedBillsModal] = useState(false);

  const [saleTransport, setSaleTransport] = useState({
    transport_name: '',
    vehicle_number: '',
    lr_number: '',
    lr_date: new Date().toISOString().split('T')[0],
    destination: '',
    number_of_parcels: '',
  });
  const [saleLines, setSaleLines] = useState([
    { item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }
  ]);

  // ═════════ QUICK ADD CATEGORY MODAL STATE ═════════
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activeCategoryTarget, setActiveCategoryTarget] = useState(null); // { rowIndex, isPurchase, isNewItem }

  // ═════════ PURCHASE VOUCHER (PURCHASE BILL) STATE ═════════
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseBillNumber, setPurchaseBillNumber] = useState('');
  const [purchaseVendorBillDate, setPurchaseVendorBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseRecdDate, setPurchaseRecdDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [purchasePlaceOfSupply, setPurchasePlaceOfSupply] = useState('27');
  const [purchaseTransportCharges, setPurchaseTransportCharges] = useState('');
  const [purchaseRemarks, setPurchaseRemarks] = useState('');
  const [purchaseLines, setPurchaseLines] = useState([
    { item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }
  ]);

  // Registers & Reports
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [stockSummaryData, setStockSummaryData] = useState(null);
  const [caSubTab, setCaSubTab] = useState('gstr1'); // 'gstr1', 'gstr2b', 'gstr3b', 'stock_valuation', 'share_ca'
  const [showCaDropdown, setShowCaDropdown] = useState(false);

  // ═════════ PARTY LEDGER STATE ═════════
  const [ledgerPartyType, setLedgerPartyType] = useState('customer'); // 'customer' | 'vendor'
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [selectedLedgerCustomerId, setSelectedLedgerCustomerId] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [sendingWhatsAppStatement, setSendingWhatsAppStatement] = useState(false);
  const [showLedgerPaymentModal, setShowLedgerPaymentModal] = useState(false);
  const [ledgerPaymentForm, setLedgerPaymentForm] = useState({
    payment_type: 'receipt', // 'receipt' from customer, 'payment' to vendor
    payment_mode: 'cash',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: '',
  });

  // ═════════ RECEIVABLES / MARKET UDHAARI STATE ═════════
  const [receivablesData, setReceivablesData] = useState({ total_receivables: 0, count: 0, parties: [] });
  const [loadingReceivables, setLoadingReceivables] = useState(false);
  const [receivablesSearch, setReceivablesSearch] = useState('');

  // ═════════ RECEIVABLES EXPANDABLE ACCORDION STATE ═════════
  const [expandedParties, setExpandedParties] = useState({});
  const toggleExpandParty = (partyId) => {
    setExpandedParties(prev => ({ ...prev, [partyId]: !prev[partyId] }));
  };

  // ═════════ USER RESTOCK LIST (NOTES APP - 100% USER MANAGED) ═════════
  // Simple notes for items to reorder. System NEVER auto-generates or adds items.
  const [restockNotes, setRestockNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('syncbill_user_restock_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Remove any previous fake mock items
          return parsed.filter(n => 
            n.id !== 1 && n.id !== 2 && n.id !== 3 &&
            !n.text?.toLowerCase().includes('parryware') &&
            !n.text?.toLowerCase().includes('cotton lycra') &&
            !n.text?.toLowerCase().includes('corrugated packing')
          );
        }
      }
    } catch (e) {
      console.error('Failed to load restock notes from storage', e);
    }
    return [];
  });
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePriority, setNewNotePriority] = useState('Urgent');

  // Save user notes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('syncbill_user_restock_notes', JSON.stringify(restockNotes));
    } catch (e) {
      console.error('Failed to save restock notes', e);
    }
  }, [restockNotes]);

  const handleAddRestockNote = (e) => {
    e?.preventDefault();
    if (!newNoteText.trim()) return;
    const item = {
      id: Date.now(),
      text: newNoteText.trim(),
      priority: newNotePriority,
      done: false,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
    setRestockNotes([item, ...restockNotes]);
    setNewNoteText('');
    notify('Added to Restock List', 'success');
  };

  const handleToggleRestockNote = (id) => {
    setRestockNotes(restockNotes.map(n => n.id === id ? { ...n, done: !n.done } : n));
  };

  const handleDeleteRestockNote = (id) => {
    setRestockNotes(restockNotes.filter(n => n.id !== id));
  };

  const handleClearCompletedNotes = () => {
    setRestockNotes(restockNotes.filter(n => !n.done));
    notify('Cleared completed restock items', 'info');
  };

  const billingActionsRef = useRef({});

  // ═════════ KEYBOARD SHORTCUTS (Ctrl+L, F8, F9, F1 Qty, F2 Hold, F3 Cash, F4 Credit, F6 Rate) ═════════
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + L or Cmd + L: Instant Ledger
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setActiveTab('ledger');
        notify('Party Ledger Opened (Ctrl+L)', 'info');
        return;
      }
      // Ctrl + B: Toggle Left Sidebar Minimize / Expand
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
        return;
      }
      // F8: Instant Sale Bill (Opens create form directly & auto-minimizes sidebar)
      if (e.key === 'F8') {
        e.preventDefault();
        setActiveTab('billing');
        setSaleViewMode('create');
        setSidebarCollapsed(true);
        return;
      }
      // F9: Instant Purchase Bill (Opens create form directly & auto-minimizes sidebar)
      if (e.key === 'F9') {
        e.preventDefault();
        setActiveTab('purchase_entry');
        setPurchaseViewMode('create');
        setSidebarCollapsed(true);
        return;
      }
      // F10: Instant Customer Collection Voucher (Receipt / Jama / F10)
      if (e.key === 'F10') {
        e.preventDefault();
        setAccountsVoucherInitialType('receipt');
        setActiveTab('accounts_vouchers');
        setSidebarCollapsed(true);
        notify('Customer Collection Voucher (Receipt / F10) Opened', 'info');
        return;
      }
      // F12: Instant Sales Return (Credit Note / F12)
      if (e.key === 'F12') {
        e.preventDefault();
        setReturnInitialType('credit_note');
        setActiveTab('returns');
        setSidebarCollapsed(true);
        notify('Sales Return (Credit Note / F12) Opened', 'info');
        return;
      }
      // F1: Focus / Change Qty in Sales or Purchase Voucher
      if (e.key === 'F1') {
        e.preventDefault();
        const activeInput = document.querySelector(':focus');
        const rowIndex = activeInput?.dataset?.row || '0';
        const type = activeInput?.dataset?.type || 'sale';
        const qtyTarget = document.querySelector(`[data-type="${type}"][data-row="${rowIndex}"][data-col="quantity"]`) 
          || document.querySelector('[data-type="sale"][data-col="quantity"]');
        if (qtyTarget) {
          qtyTarget.focus();
          if (qtyTarget.select) qtyTarget.select();
        }
        return;
      }
      // F2: Bill Parking (Hold & Resume) in Sales Voucher, or Counter Daily Desk elsewhere
      if (e.key === 'F2') {
        e.preventDefault();
        const b = billingActionsRef.current;
        if (b.activeTab === 'billing' && b.saleViewMode === 'create') {
          const hasLines = (b.saleLines || []).some(l => l.item_id || l.item_name);
          if (hasLines) {
            b.handleParkCurrentBill?.();
          } else {
            b.setShowParkedBillsModal?.(true);
          }
        } else {
          setActiveTab('desk');
        }
        return;
      }
      // F3: Cash Save in Sales Voucher
      if (e.key === 'F3') {
        const b = billingActionsRef.current;
        if (b.activeTab === 'billing' && b.saleViewMode === 'create') {
          e.preventDefault();
          b.handleSaveSaleInvoice?.('cash');
        }
        return;
      }
      // F4: Credit Save (Full Udhaari) in Sales Voucher
      if (e.key === 'F4') {
        const b = billingActionsRef.current;
        if (b.activeTab === 'billing' && b.saleViewMode === 'create') {
          e.preventDefault();
          b.handleSaveSaleInvoice?.('credit');
        }
        return;
      }
      // F6: Toggle Rate Type (Retail <-> Wholesale) in Sales Voucher
      if (e.key === 'F6') {
        const b = billingActionsRef.current;
        if (b.activeTab === 'billing' && b.saleViewMode === 'create') {
          e.preventDefault();
          b.handleToggleSaleRateType?.(b.saleRateType === 'retail' ? 'wholesale' : 'retail');
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // View Modes & Search Filters
  const [saleViewMode, setSaleViewMode] = useState('list'); // 'list' | 'create'
  const [purchaseViewMode, setPurchaseViewMode] = useState('list'); // 'list' | 'create'

  // Traveling active indicator target key for sidebar navigation
  const activeNavKey = useMemo(() => {
    if (activeTab === 'desk') return 'desk';
    if (activeTab === 'billing' || activeTab === 'daybook') {
      return saleViewMode === 'create' ? 'sale_bill' : 'sales_reg';
    }
    if (activeTab === 'purchase_entry' || activeTab === 'purchases') {
      return purchaseViewMode === 'create' ? 'purchase_bill' : 'purchase_reg';
    }
    if (activeTab === 'returns') {
      return returnInitialType === 'credit_note' ? 'sales_return' : 'purchase_return';
    }
    if (activeTab === 'accounts_vouchers') {
      return accountsVoucherInitialType === 'receipt' ? 'customer_receipt' : 'supplier_payment';
    }
    if (activeTab === 'barcode_generator') return 'barcode_generator';
    if (activeTab === 'daybook_analytics') return 'daybook_analytics';
    if (activeTab === 'ledger') return ledgerPartyType === 'vendor' ? 'vendor_ledger' : 'customer_ledger';
    if (activeTab === 'items') return 'items';
    if (activeTab === 'parties') return 'parties';
    if (activeTab === 'gstr' || activeTab === 'gstr1') return 'gstr';
    if (activeTab === 'dashboard') return 'dashboard';
    return 'desk';
  }, [activeTab, saleViewMode, purchaseViewMode, returnInitialType, accountsVoucherInitialType, ledgerPartyType]);

  // Measure and glide the active indicator pill when tab or view changes
  useEffect(() => {
    const updateIndicator = () => {
      const nav = sidebarNavRef.current;
      if (!nav) return;
      const activeEl = nav.querySelector(`[data-nav="${activeNavKey}"]`);
      if (activeEl) {
        const navRect = nav.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        setNavIndicator({
          top: elRect.top - navRect.top + nav.scrollTop,
          height: elRect.height,
          opacity: 1,
        });
      } else {
        setNavIndicator(prev => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    const timer1 = setTimeout(updateIndicator, 30);
    const timer2 = setTimeout(updateIndicator, 150);
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeNavKey, sidebarCollapsed]);

  const [salesSearch, setSalesSearch] = useState('');
  const [salesDateFilter, setSalesDateFilter] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseDateFilter, setPurchaseDateFilter] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');

  // Items Stock Table Sorting (Size, MRP, Current Stock, Rate, Name, Category)
  const [itemSortConfig, setItemSortConfig] = useState({ key: null, direction: 'asc' });

  // Intelligent Garment Size rank parser (XS, S, M, L, XL, XXL, 20, 22, 24.. 44)
  const parseGarmentSize = (val) => {
    if (!val || val === '-' || val === '') return 999999;
    const s = String(val).trim().toUpperCase();
    const textOrder = {
      'XXS': 1001, '2XS': 1001,
      'XS': 1002, 'EXTRA SMALL': 1002,
      'S': 1003, 'SMALL': 1003,
      'M': 1004, 'MEDIUM': 1004,
      'L': 1005, 'LARGE': 1005,
      'XL': 1006, 'EXTRA LARGE': 1006,
      'XXL': 1007, '2XL': 1007,
      'XXXL': 1008, '3XL': 1008,
      '4XL': 1009, 'XXXXL': 1009,
      '5XL': 1010,
      'FS': 1050, 'FREE': 1050, 'FREE SIZE': 1050
    };
    if (textOrder[s] !== undefined) return textOrder[s];
    const numMatch = s.match(/\d+/);
    if (numMatch) return parseInt(numMatch[0], 10);
    return 5000;
  };

  const handleItemSort = (key) => {
    setItemSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key: null, direction: 'asc' }; // 3rd click resets
      }
      // For MRP, Stock, Rate, default to High to Low (desc) on 1st click
      // For Size, Name, Category, Item Code, default to Low to High (asc) on 1st click
      const defaultDir = ['mrp', 'retail_rate', 'current_stock'].includes(key) ? 'desc' : 'asc';
      return { key, direction: defaultDir };
    });
  };

  // Party Accounts Table Sorting & Filter (Category, Amount Due, Name, GSTIN, State)
  const [partySortConfig, setPartySortConfig] = useState({ key: null, direction: 'asc' });
  const [partyCategoryFilter, setPartyCategoryFilter] = useState('ALL'); // 'ALL' | 'customer' | 'vendor' | 'both'
  const [partyOnlyWithDues, setPartyOnlyWithDues] = useState(false);

  // Helper to calculate exact Amount Due for any customer or vendor
  const getPartyAmountDue = (c) => {
    if ((c.party_type || '').toLowerCase() === 'vendor') {
      const vendorUnpaid = (purchaseInvoices || []).reduce((acc, inv) => {
        if (inv.customer_id === c.id && !inv.is_cancelled && parseFloat(inv.balance_amount || 0) > 0) {
          return acc + parseFloat(inv.balance_amount);
        }
        return acc;
      }, 0);
      const opening = parseFloat(c.opening_balance || 0);
      return vendorUnpaid + (opening > 0 ? opening : 0);
    }
    const rec = (receivablesData.parties || []).find(p => (p.customer_id === c.id || p.party_id === c.id));
    const pendingBills = rec ? parseFloat(rec.balance || rec.total_pending || 0) : 0;
    const opening = parseFloat(c.opening_balance || 0);
    return pendingBills + (opening > 0 ? opening : 0);
  };

  const handlePartySort = (key) => {
    setPartySortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key: null, direction: 'asc' };
      }
      const defaultDir = key === 'amount_due' ? 'desc' : 'asc';
      return { key, direction: defaultDir };
    });
  };

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ 
    item_code: '',
    name: '', 
    description: '',
    item_type: 'Readymade',
    category: 'READYMADE GARMENTS', 
    size: '', 
    mrp: '', 
    hsn_code: '6109', 
    gst_rate: '5.00', 
    primary_uom: 'Pcs', 
    retail_rate: '', 
    purchase_rate: '', 
    current_stock: '100' 
  });

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [newParty, setNewParty] = useState({ name: '', gstin: '', phone: '', state_code: '27', party_type: 'customer' });

  // ═════════ HIGH-VISIBILITY AUDIO & VIBRATION ALERT ENGINE ═════════
  const playAlertSound = (type = 'error') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'error') {
        // High-attention dual-tone error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, ctx.currentTime);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      } else if (type === 'warning') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(460, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Audio feedback failed or muted', e);
    }
  };

  const [mandatoryAlert, setMandatoryAlert] = useState(null);

  const triggerMandatoryAlert = (targetSelectorOrEl, message, title = '⚠️ MANDATORY FIELD MISSING!') => {
    // 1. Play high-attention alert sound
    playAlertSound('error');

    // 2. Hardware vibration for touch screens/tablets
    if (navigator && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate([150, 70, 150]); } catch (e) {}
    }

    // 3. Trigger screen modal pop-up
    setMandatoryAlert({
      title,
      message,
      targetSelectorOrEl,
      id: Date.now()
    });

    // 4. Highlight target box with red boundary and vibrate for 1-2 seconds
    const el = typeof targetSelectorOrEl === 'string'
      ? document.querySelector(targetSelectorOrEl)
      : targetSelectorOrEl;

    if (el) {
      el.classList.add('box-vibrate-error');
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
      setTimeout(() => {
        try {
          el.focus();
          if (el.select) el.select();
        } catch (e) {}
      }, 60);

      // Remove after 1800ms (1-2 seconds)
      setTimeout(() => {
        el.classList.remove('box-vibrate-error');
      }, 1800);
    }
  };

  useEffect(() => {
    if (mandatoryAlert) {
      const timer = setTimeout(() => {
        setMandatoryAlert(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [mandatoryAlert]);

  const notify = (msg, type = 'success') => {
    if (type === 'error') {
      playAlertSound('error');
    } else {
      playAlertSound('success');
    }
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadReceivables = async () => {
    try {
      setLoadingReceivables(true);
      const data = await api.getReceivables(firmId);
      setReceivablesData(data || { total_receivables: 0, count: 0, parties: [] });
    } catch (err) {
      console.error("Failed to load receivables:", err);
    } finally {
      setLoadingReceivables(false);
    }
  };

  const handleQuickCollect = (party) => {
    setSelectedLedgerCustomerId(party.party_id.toString());
    setLedgerPaymentForm({
      payment_type: 'receipt',
      payment_mode: 'cash',
      amount: party.balance ? party.balance.toString() : '',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: `Collection against pending dues ₹${party.balance}`,
    });
    setShowLedgerPaymentModal(true);
  };

  const handleQuickOpenLedger = (partyId) => {
    const party = customers.find(c => String(c.id) === String(partyId));
    if (party) {
      setLedgerPartyType(party.party_type === 'vendor' ? 'vendor' : 'customer');
    }
    setSelectedLedgerCustomerId(partyId.toString());
    setActiveTab('ledger');
    loadLedger(partyId.toString(), ledgerFirmFilter, null, null);
  };

  useEffect(() => {
    loadMasters();
    loadReceivables();
  }, []);

  // Reload data whenever active tab, financial year, or firm changes
  useEffect(() => {
    loadSalesInvoices();
    loadPurchaseInvoices();
    if (activeTab === 'desk' || activeTab === 'parties') loadReceivables();
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'ledger' && selectedLedgerCustomerId) {
      loadLedger(selectedLedgerCustomerId, ledgerFirmFilter);
    }
    if (activeTab === 'gstr1' || activeTab === 'gstr') {
      loadGstr1();
      loadGstr3b();
      loadStockSummary();
    }
  }, [activeTab, selectedFY, firmId, selectedLedgerCustomerId, ledgerStartDate, ledgerEndDate, ledgerFirmFilter, ledgerPartyType]);

  const loadMasters = async () => {
    try {
      setLoading(true);
      const [itList, custList, firmList, catList] = await Promise.all([
        api.getItems(), 
        api.getCustomers(), 
        api.getFirms(),
        api.getItemCategories().catch(() => ['READYMADE GARMENTS', 'T-SHIRTS', 'JACKET', 'BABA SUIT', 'LOWER'])
      ]);
      // Sort master list of parties alphabetically A-Z
      custList.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      setItems(itList);
      setCustomers(custList);
      setFirms(firmList);
      setCategories(catList && catList.length > 0 ? catList : ['READYMADE GARMENTS', 'T-SHIRTS', 'JACKET', 'BABA SUIT', 'LOWER']);
      if (firmList.length > 0 && !firmList.some(f => f.id === firmId)) {
        setFirmId(firmList[0].id);
      }
      if (custList.length > 0 && !selectedCustomerId) {
        const custFirst = custList.find(c => (c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both') || custList[0];
        setSelectedCustomerId(custFirst.id.toString());
      }
      if (custList.length > 0 && !selectedLedgerCustomerId) {
        const targetList = custList.filter(c => ledgerPartyType === 'vendor' ? ((c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both') : ((c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both'));
        const defaultParty = targetList[0] || custList[0];
        setSelectedLedgerCustomerId(defaultParty.id.toString());
      }
      const vendorFirst = custList.find(c => (c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both') || custList[0];
      if (vendorFirst && !selectedVendorId) {
        setSelectedVendorId(vendorFirst.id.toString());
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (customerId = selectedLedgerCustomerId, targetFirm = ledgerFirmFilter, customStart = undefined, customEnd = undefined) => {
    if (!customerId) return;
    try {
      setLoadingLedger(true);
      const sDate = customStart !== undefined ? customStart : (ledgerStartDate || null);
      const eDate = customEnd !== undefined ? customEnd : (ledgerEndDate || null);
      const data = await api.getLedger(customerId, targetFirm, sDate, eDate);
      setLedgerData(data);
    } catch (err) {
      notify(err.message || 'Failed to load party ledger', 'error');
    } finally {
      setLoadingLedger(false);
    }
  };

  const loadSalesInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices(firmId, 'sales', activeFYObj.start, activeFYObj.end);
      setSalesInvoices(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices(firmId, 'purchase', activeFYObj.start, activeFYObj.end);
      setPurchaseInvoices(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard(firmId, activeFYObj.start, activeFYObj.end);
      setDashboard(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGstr1 = async () => {
    try {
      setLoading(true);
      const data = await api.getGstr1(firmId, activeFYObj.start, activeFYObj.end);
      setGstr1Data(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGstr3b = async () => {
    try {
      setLoading(true);
      const data = await api.getGstr3b(firmId, activeFYObj.start, activeFYObj.end);
      setGstr3bData(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStockSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getStockSummary();
      setStockSummaryData(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Live Outstanding Balances (Accurate ERP Red Banner)
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerOutstanding(null);
      return;
    }
    let isMounted = true;
    api.getCustomerOutstanding(selectedCustomerId, firmId)
      .then(data => { if (isMounted) setCustomerOutstanding(data); })
      .catch(() => { if (isMounted) setCustomerOutstanding(null); });
    return () => { isMounted = false; };
  }, [selectedCustomerId, firmId]);

  useEffect(() => {
    if (!selectedVendorId) {
      setVendorOutstanding(null);
      return;
    }
    let isMounted = true;
    api.getCustomerOutstanding(selectedVendorId, firmId)
      .then(data => { if (isMounted) setVendorOutstanding(data); })
      .catch(() => { if (isMounted) setVendorOutstanding(null); });
    return () => { isMounted = false; };
  }, [selectedVendorId, firmId]);

  // ═════════ BILL PARKING (HOLD & RESUME F2) ═════════
  const handleParkCurrentBill = () => {
    const validLines = saleLines.filter(l => l.item_id || l.item_name);
    if (validLines.length === 0 && !selectedCustomerId) {
      notify('Cannot park an empty bill', 'error');
      return;
    }
    const cust = customers.find(c => c.id.toString() === selectedCustomerId.toString());
    const billToPark = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: saleDate,
      customer_id: selectedCustomerId,
      customer_name: cust?.name || 'Cash Buyer',
      customer_city: cust?.city || cust?.state_name || '',
      rate_type: saleRateType,
      lines: saleLines,
      transport: saleTransport,
      transport_charges: saleTransportCharges,
      advance_amount: saleAdvanceAmount,
      card_amount: saleCardAmount,
      cash_amount: saleCashAmount,
      remarks: saleRemarks,
      grand_total: saleTotals.grandTotal,
      items_count: validLines.length,
    };
    const updated = [billToPark, ...parkedBills];
    setParkedBills(updated);
    try {
      localStorage.setItem('syncbill_parked_bills', JSON.stringify(updated));
    } catch (e) {}
    notify(`Bill for ${billToPark.customer_name} parked on hold (F2)`);
    // Clear form for next counter customer
    setSaleLines([{ item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }]);
    setSalePaidAmount('');
    setSaleTransportCharges('');
    setSaleAdvanceAmount('');
    setSaleCardAmount('');
    setSaleCashAmount('');
    setSaleRemarks('');
  };

  const handleResumeParkedBill = (billId) => {
    const bill = parkedBills.find(b => b.id === billId);
    if (!bill) return;
    if (bill.customer_id) setSelectedCustomerId(bill.customer_id.toString());
    if (bill.rate_type) setSaleRateType(bill.rate_type);
    if (bill.lines && bill.lines.length > 0) setSaleLines(bill.lines);
    if (bill.transport) setSaleTransport(bill.transport);
    setSaleTransportCharges(bill.transport_charges || '');
    setSaleAdvanceAmount(bill.advance_amount || '');
    setSaleCardAmount(bill.card_amount || '');
    setSaleCashAmount(bill.cash_amount || '');
    setSaleRemarks(bill.remarks || '');
    const remaining = parkedBills.filter(b => b.id !== billId);
    setParkedBills(remaining);
    try {
      localStorage.setItem('syncbill_parked_bills', JSON.stringify(remaining));
    } catch (e) {}
    setShowParkedBillsModal(false);
    notify(`Resumed parked bill for ${bill.customer_name}`);
  };

  const handleDeleteParkedBill = (billId) => {
    const remaining = parkedBills.filter(b => b.id !== billId);
    setParkedBills(remaining);
    try {
      localStorage.setItem('syncbill_parked_bills', JSON.stringify(remaining));
    } catch (e) {}
    notify('Parked bill discarded');
  };

  // ═════════ RATE TYPE SWITCHER (RETAIL VS WHOLESALE) ═════════
  const handleToggleSaleRateType = (newType) => {
    setSaleRateType(newType);
    setSaleLines(prev => prev.map(line => {
      if (!line.item_id) return line;
      const it = items.find(i => i.id === parseInt(line.item_id));
      if (!it) return line;
      const newRate = newType === 'wholesale' 
        ? (it.wholesale_price || it.purchase_price || line.rate)
        : (it.retail_rate || it.mrp || line.rate);
      return { ...line, rate: newRate };
    }));
    notify(`Switched pricing to ${newType.toUpperCase()}`);
  };

  // ═════════ COPY PURCHASE BILL TO BILLING ═════════
  const handleCopyPurchaseToBilling = (purchaseInv) => {
    if (!purchaseInv || !purchaseInv.items) return;
    const copiedLines = purchaseInv.items.map(it => ({
      item_id: it.item_id ? it.item_id.toString() : '',
      item_name: it.item_name,
      category: 'READYMADE GARMENTS',
      size: it.size || '',
      color: it.color || '',
      hsn_code: it.hsn_code || '6109',
      quantity: it.quantity,
      uom: it.uom || 'Pcs',
      mrp: it.mrp || it.rate,
      rate: it.mrp || it.rate,
      cd1_percent: '',
      cd2_percent: '',
      cd3_percent: '',
      discount_percent: 0,
      gst_rate: it.gst_rate || 5.0,
      remarks: `Inward ${purchaseInv.invoice_number}`,
    }));
    setSaleLines(copiedLines);
    setSaleViewMode('create');
    setActiveTab('billing');
    notify(`Copied ${copiedLines.length} items from Purchase ${purchaseInv.invoice_number} to Sales Voucher!`);
  };

  // ═════════ SALES LINE HANDLERS ═════════
  const handleSaleItemSelect = (index, itemId) => {
    const selected = items.find((it) => it.id === parseInt(itemId));
    const updated = [...saleLines];
    if (selected) {
      const activeRate = saleRateType === 'wholesale'
        ? parseFloat(selected.wholesale_price || selected.purchase_price || selected.retail_rate || selected.mrp || 0)
        : parseFloat(selected.retail_rate || selected.mrp || 0);
      updated[index] = {
        ...updated[index],
        item_id: selected.id,
        item_name: selected.name,
        category: selected.category || 'READYMADE GARMENTS',
        size: selected.size || '',
        color: selected.color || '',
        mrp: selected.mrp ? parseFloat(selected.mrp) : '',
        hsn_code: selected.hsn_code || '6109',
        rate: activeRate,
        uom: selected.primary_uom || 'Pcs',
        gst_rate: parseFloat(selected.gst_rate || 5.0),
      };
    } else {
      updated[index] = { ...updated[index], item_id: '', item_name: '', mrp: '', rate: '' };
    }
    setSaleLines(updated);
    setTimeout(() => {
      // Visual feedback: Flash autofilled price & size fields
      const rowInputs = document.querySelectorAll(`[data-type="sale"][data-row="${index}"]`);
      rowInputs.forEach(el => {
        if (['mrp', 'rate', 'size', 'color'].includes(el.dataset.col)) {
          el.classList.add('anim-autofill');
          setTimeout(() => el.classList.remove('anim-autofill'), 700);
        }
      });

      const nextInput = document.querySelector(`[data-type="sale"][data-row="${index}"][data-col="quantity"]`);
      if (nextInput) {
        nextInput.focus();
        if (nextInput.select) nextInput.select();
      }
    }, 40);
  };

  const updateSaleLine = (index, field, value) => {
    const updated = [...saleLines];
    updated[index][field] = value;
    setSaleLines(updated);
  };

  const addSaleLine = () => {
    setSaleLines(prev => [
      ...prev,
      { item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }
    ]);
  };

  const removeSaleLine = (index) => {
    if (saleLines.length === 1) {
      setSaleLines([{ item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }]);
    } else {
      setSaleLines(saleLines.filter((_, i) => i !== index));
    }
  };

  // ═════════ PURCHASE LINE HANDLERS ═════════
  const handlePurchaseItemSelect = (index, itemId) => {
    const selected = items.find((it) => it.id === parseInt(itemId));
    const updated = [...purchaseLines];
    if (selected) {
      updated[index] = {
        ...updated[index],
        item_id: selected.id,
        item_name: selected.name,
        category: selected.category || 'READYMADE GARMENTS',
        size: selected.size || '',
        color: selected.color || '',
        mrp: selected.mrp ? parseFloat(selected.mrp) : '',
        hsn_code: selected.hsn_code || '6109',
        rate: parseFloat(selected.purchase_rate || selected.retail_rate || selected.mrp || 0),
        uom: selected.primary_uom || 'Pcs',
        gst_rate: parseFloat(selected.gst_rate || 5.0),
      };
    } else {
      updated[index] = { ...updated[index], item_id: '', item_name: '', mrp: '', rate: '' };
    }
    setPurchaseLines(updated);
    setTimeout(() => {
      // Visual feedback: Flash autofilled price & size fields
      const rowInputs = document.querySelectorAll(`[data-type="pur"][data-row="${index}"]`);
      rowInputs.forEach(el => {
        if (['mrp', 'rate', 'size', 'color'].includes(el.dataset.col)) {
          el.classList.add('anim-autofill');
          setTimeout(() => el.classList.remove('anim-autofill'), 700);
        }
      });

      const nextInput = document.querySelector(`[data-type="pur"][data-row="${index}"][data-col="quantity"]`);
      if (nextInput) {
        nextInput.focus();
        if (nextInput.select) nextInput.select();
      }
    }, 40);
  };

  const updatePurchaseLine = (index, field, value) => {
    const updated = [...purchaseLines];
    updated[index][field] = value;
    setPurchaseLines(updated);
  };

  const addPurchaseLine = () => {
    setPurchaseLines(prev => [
      ...prev,
      { item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }
    ]);
  };

  const removePurchaseLine = (index) => {
    if (purchaseLines.length === 1) {
      setPurchaseLines([{ item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }]);
    } else {
      setPurchaseLines(purchaseLines.filter((_, i) => i !== index));
    }
  };

  // Keyboard navigation: Enter key opens pickers, advances fields, and ONLY adds next row at the end of the line!
  const handleTableKeyDown = (e, rowIndex, colName, isPurchase = false) => {
    if (e.key === 'Enter') {
      const cols = ['category', 'item', 'size', 'color', 'quantity', 'mrp', 'rate', 'cd1_percent', 'cd2_percent', 'cd3_percent', 'remarks'];
      const lines = isPurchase ? purchaseLines : saleLines;
      const addLine = isPurchase ? addPurchaseLine : addSaleLine;
      const prefix = isPurchase ? 'pur' : 'sale';
      const line = lines[rowIndex];

      // 1. On Section / Category:
      if (colName === 'category') {
        const selectEl = e.target;
        if (selectEl && selectEl.showPicker && !selectEl.dataset.pickerOpened) {
          try {
            selectEl.dataset.pickerOpened = "true";
            selectEl.showPicker();
            return;
          } catch (err) {}
        }
        if (selectEl) selectEl.dataset.pickerOpened = "";
        e.preventDefault();
        const nextInput = document.querySelector(`[data-type="${prefix}"][data-row="${rowIndex}"][data-col="item"]`);
        if (nextInput) {
          nextInput.focus();
          try { nextInput.showPicker?.(); } catch (err) {}
        }
        return;
      }

      // 2. On Item:
      if (colName === 'item') {
        if (!line.item_id && (!line.item_name || !line.item_name.trim())) {
          if (e.target && e.target.showPicker) {
            try {
              e.target.showPicker();
              return;
            } catch (err) {}
          }
          triggerMandatoryAlert(
            `[data-type="${prefix}"][data-row="${rowIndex}"][data-col="item"]`,
            `Row #${rowIndex + 1}: Please choose a product from the list!`,
            '⚠️ ITEM DESCRIPTION REQUIRED'
          );
          return;
        }
        e.preventDefault();
        const nextInput = document.querySelector(`[data-type="${prefix}"][data-row="${rowIndex}"][data-col="size"]`) ||
                          document.querySelector(`[data-type="${prefix}"][data-row="${rowIndex}"][data-col="quantity"]`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
        return;
      }

      e.preventDefault();

      // 3. Mandatory validation on Quantity
      if (colName === 'quantity' && (!line.quantity || parseFloat(line.quantity) <= 0 || isNaN(parseFloat(line.quantity)))) {
        triggerMandatoryAlert(
          `[data-type="${prefix}"][data-row="${rowIndex}"][data-col="quantity"]`,
          `Row #${rowIndex + 1}: Quantity must be at least 1!`,
          '⚠️ INVALID QUANTITY'
        );
        return;
      }

      // 4. Mandatory validation on MRP
      if (colName === 'mrp' && (!line.mrp || parseFloat(line.mrp) <= 0 || isNaN(parseFloat(line.mrp)))) {
        triggerMandatoryAlert(
          `[data-type="${prefix}"][data-row="${rowIndex}"][data-col="mrp"]`,
          `Row #${rowIndex + 1} (${line.item_name || 'Item'}): MRP cannot be blank or ₹0! Please enter valid MRP.`,
          '⚠️ MRP CANNOT BE BLANK'
        );
        return;
      }

      // 5. End of Row: on remarks (or cd3_percent, or Shift+Enter on valid line) do we add & advance to next row!
      if (colName === 'remarks' || colName === 'cd3_percent' || (e.shiftKey && colName !== 'category' && colName !== 'item')) {
        if (!line.item_id && (!line.item_name || !line.item_name.trim())) {
          triggerMandatoryAlert(
            `[data-type="${prefix}"][data-row="${rowIndex}"][data-col="item"]`,
            `Row #${rowIndex + 1}: Complete Item details before adding the next row!`,
            '⚠️ ITEM REQUIRED'
          );
          return;
        }
        if (!line.mrp || parseFloat(line.mrp) <= 0 || isNaN(parseFloat(line.mrp))) {
          triggerMandatoryAlert(
            `[data-type="${prefix}"][data-row="${rowIndex}"][data-col="mrp"]`,
            `Row #${rowIndex + 1}: Enter valid MRP before adding next row!`,
            '⚠️ MRP REQUIRED'
          );
          return;
        }

        if (rowIndex === lines.length - 1) {
          addLine();
        }
        setTimeout(() => {
          const nextRowCat = document.querySelector(`[data-type="${prefix}"][data-row="${rowIndex + 1}"][data-col="category"]`);
          if (nextRowCat) {
            nextRowCat.focus();
            try { nextRowCat.showPicker?.(); } catch (err) {}
          }
        }, 70);
        return;
      }

      // 6. Regular column progression inside current row
      const currIndex = cols.indexOf(colName);
      if (currIndex !== -1 && currIndex < cols.length - 1) {
        const nextCol = cols[currIndex + 1];
        const nextInput = document.querySelector(`[data-type="${prefix}"][data-row="${rowIndex}"][data-col="${nextCol}"]`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
      }
    }
  };

  // ═════════ CALCULATIONS (WITH CD1, CD2, CD3, MRP, FREIGHT) ═════════
  const calculateTotals = (lines, transportCharges = 0) => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalDiscountAmount = 0;

    const rowCalcs = lines.map((l) => {
      const q = parseFloat(l.quantity) || 0;
      const r = parseFloat(l.rate) || 0;
      const gross = q * r;

      const cd1 = parseFloat(l.cd1_percent) || 0;
      const cd2 = parseFloat(l.cd2_percent) || 0;
      const cd3 = parseFloat(l.cd3_percent) || 0;

      let afterDisc = gross;
      if (cd1 > 0) afterDisc = afterDisc * (1 - (cd1 / 100));
      if (cd2 > 0) afterDisc = afterDisc * (1 - (cd2 / 100));
      if (cd3 > 0) afterDisc = afterDisc * (1 - (cd3 / 100));

      const tradeDisc = gross - afterDisc;
      const disc = (cd1 > 0 || cd2 > 0 || cd3 > 0)
        ? tradeDisc
        : gross * ((parseFloat(l.discount_percent) || 0) / 100);

      const taxable = Math.max(0, gross - disc);
      const gst = parseFloat(l.gst_rate) || 5.0;

      const halfGst = gst / 2;
      const c = taxable * (halfGst / 100);
      const s = taxable * (halfGst / 100);
      const rowTotal = taxable + c + s;

      subtotal += taxable;
      cgst += c;
      sgst += s;
      totalDiscountAmount += disc;

      return { taxable, c, s, total: rowTotal, discAmount: disc };
    });

    const freight = parseFloat(transportCharges || 0);
    const rawGrandTotal = subtotal + cgst + sgst + igst + freight;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = grandTotal - rawGrandTotal;

    return { subtotal, cgst, sgst, igst, grandTotal, roundOff, totalDiscountAmount, rowCalcs, freight };
  };

  const saleTotals = calculateTotals(saleLines, saleTransportCharges);
  const purchaseTotals = calculateTotals(purchaseLines, purchaseTransportCharges);

  // ═════════ SUBMIT ACTIONS WITH STRICT VALIDATION ═════════
  const handleSaveSaleInvoice = async (overrideMode = null) => {
    try {
      if (!selectedCustomerId) {
        triggerMandatoryAlert('#sale-customer-select', 'Please select a Customer / Cash Buyer for this sales invoice.', '⚠️ CUSTOMER REQUIRED');
        return;
      }

      // 1. Strict validation: Item and MRP cannot be blank
      for (let i = 0; i < saleLines.length; i++) {
        const l = saleLines[i];
        if (!l.item_id && (!l.item_name || !l.item_name.trim())) {
          triggerMandatoryAlert(
            `[data-type="sale"][data-row="${i}"][data-col="item"]`,
            `Row #${i + 1}: Item description cannot be blank. Please choose an item from catalog.`,
            '⚠️ ITEM IS MANDATORY'
          );
          return;
        }
        if (!l.mrp || parseFloat(l.mrp) <= 0 || isNaN(parseFloat(l.mrp))) {
          triggerMandatoryAlert(
            `[data-type="sale"][data-row="${i}"][data-col="mrp"]`,
            `Row #${i + 1} (${l.item_name || 'Item'}): MRP is required and cannot be blank or ₹0!`,
            '⚠️ MRP CANNOT BE BLANK'
          );
          return;
        }
        if (!l.quantity || parseFloat(l.quantity) <= 0 || isNaN(parseFloat(l.quantity))) {
          triggerMandatoryAlert(
            `[data-type="sale"][data-row="${i}"][data-col="quantity"]`,
            `Row #${i + 1}: Quantity must be at least 1!`,
            '⚠️ QUANTITY REQUIRED'
          );
          return;
        }
      }

      const validLines = saleLines.filter((l) => (l.item_id || l.item_name) && parseFloat(l.quantity) > 0);
      if (validLines.length === 0) {
        triggerMandatoryAlert(
          '[data-type="sale"][data-row="0"][data-col="item"]',
          'Please add at least one valid item line to the sales invoice.',
          '⚠️ EMPTY INVOICE'
        );
        return;
      }
      setLoading(true);

      let effectivePaidAmount = salePaidAmount !== "" ? parseFloat(salePaidAmount) : saleTotals.grandTotal;
      let effectiveCashAmount = parseFloat(saleCashAmount || 0);
      let effectiveCreditAmount = Math.max(0, saleTotals.grandTotal - (effectivePaidAmount + parseFloat(saleAdvanceAmount || 0) + parseFloat(saleCardAmount || 0)));

      if (overrideMode === 'cash') {
        effectivePaidAmount = saleTotals.grandTotal;
        effectiveCashAmount = saleTotals.grandTotal;
        effectiveCreditAmount = 0;
      } else if (overrideMode === 'credit') {
        effectivePaidAmount = 0;
        effectiveCashAmount = 0;
        effectiveCreditAmount = saleTotals.grandTotal;
      }

      const payload = {
        firm_id: firmId,
        customer_id: parseInt(selectedCustomerId),
        invoice_type: "sales",
        invoice_date: saleDate,
        place_of_supply: salePlaceOfSupply,
        paid_amount: effectivePaidAmount,
        rate_type: saleRateType,
        transport_charges: parseFloat(saleTransportCharges || 0),
        advance_amount: parseFloat(saleAdvanceAmount || 0),
        card_amount: parseFloat(saleCardAmount || 0),
        cash_amount: effectiveCashAmount,
        credit_amount: effectiveCreditAmount,
        notes: saleRemarks || null,
        transport_name: saleTransport.transport_name || null,
        vehicle_number: saleTransport.vehicle_number || null,
        lr_number: saleTransport.lr_number || null,
        lr_date: saleTransport.lr_date || null,
        destination: saleTransport.destination || null,
        number_of_parcels: saleTransport.number_of_parcels || null,
        items: validLines.map((l, idx) => {
          const calc = saleTotals.rowCalcs[idx] || { taxable: 0, discAmount: 0 };
          const gross = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
          const discPct = gross > 0 ? (calc.discAmount / gross) * 100 : 0;
          return {
            item_id: l.item_id ? parseInt(l.item_id) : null,
            item_name: l.item_name,
            hsn_code: l.hsn_code || "6109",
            size: l.size || "",
            color: l.color || "",
            mrp: parseFloat(l.mrp || 0),
            cd1_percent: parseFloat(l.cd1_percent || 0),
            cd2_percent: parseFloat(l.cd2_percent || 0),
            cd3_percent: parseFloat(l.cd3_percent || 0),
            quantity: parseFloat(l.quantity),
            uom: l.uom || "Pcs",
            rate: parseFloat(l.rate || l.mrp || 0),
            discount_percent: parseFloat(discPct.toFixed(2)),
            gst_rate: parseFloat(l.gst_rate || 5.0),
            remarks: l.remarks || "",
          };
        }),
      };

      const created = await api.createInvoice(payload);
      notify(`Sales Invoice ${created.invoice_number} saved successfully! Total: ₹${created.grand_total}`);

      // Reset voucher form
      setSaleLines([{ item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }]);
      setSalePaidAmount('');
      setSaleTransportCharges('');
      setSaleAdvanceAmount('');
      setSaleCardAmount('');
      setSaleCashAmount('');
      setSaleRemarks('');
      setSaleTransport({
        transport_name: '',
        vehicle_number: '',
        lr_number: '',
        lr_date: new Date().toISOString().split('T')[0],
        destination: '',
        number_of_parcels: '',
      });
      loadMasters();
      loadSalesInvoices();
      setSaleViewMode('list');
      setActiveTab('billing');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  billingActionsRef.current = {
    activeTab,
    saleViewMode,
    handleSaveSaleInvoice,
    handleParkCurrentBill,
    setShowParkedBillsModal,
    handleToggleSaleRateType,
    saleRateType,
    saleLines,
    parkedBills,
  };

  const handleSavePurchaseBill = async () => {
    try {
      if (!selectedVendorId) {
        triggerMandatoryAlert('#purchase-vendor-select', 'Please select a Supplier / Vendor for this purchase bill.', '⚠️ SUPPLIER REQUIRED');
        return;
      }

      // 1. Strict validation: Item and MRP cannot be blank
      for (let i = 0; i < purchaseLines.length; i++) {
        const l = purchaseLines[i];
        if (!l.item_id && (!l.item_name || !l.item_name.trim())) {
          triggerMandatoryAlert(
            `[data-type="pur"][data-row="${i}"][data-col="item"]`,
            `Row #${i + 1}: Product / Material name cannot be blank. Please select an item from catalog.`,
            '⚠️ PRODUCT IS MANDATORY'
          );
          return;
        }
        if (!l.mrp || parseFloat(l.mrp) <= 0 || isNaN(parseFloat(l.mrp))) {
          triggerMandatoryAlert(
            `[data-type="pur"][data-row="${i}"][data-col="mrp"]`,
            `Row #${i + 1} (${l.item_name || 'Item'}): MRP is required and cannot be blank or ₹0!`,
            '⚠️ MRP CANNOT BE BLANK'
          );
          return;
        }
        if (!l.quantity || parseFloat(l.quantity) <= 0 || isNaN(parseFloat(l.quantity))) {
          triggerMandatoryAlert(
            `[data-type="pur"][data-row="${i}"][data-col="quantity"]`,
            `Row #${i + 1}: Quantity must be at least 1!`,
            '⚠️ QUANTITY REQUIRED'
          );
          return;
        }
      }

      const validLines = purchaseLines.filter((l) => (l.item_id || l.item_name) && parseFloat(l.quantity) > 0);
      if (validLines.length === 0) {
        triggerMandatoryAlert(
          '[data-type="pur"][data-row="0"][data-col="item"]',
          'Please add at least one valid product line to the purchase bill.',
          '⚠️ EMPTY BILL'
        );
        return;
      }
      setLoading(true);

      const payload = {
        firm_id: firmId,
        customer_id: parseInt(selectedVendorId),
        invoice_type: "purchase",
        invoice_number: purchaseBillNumber ? `PUR-${purchaseBillNumber}` : undefined,
        vendor_bill_number: purchaseBillNumber || null,
        vendor_bill_date: purchaseVendorBillDate || null,
        recd_date: purchaseRecdDate || null,
        invoice_date: purchaseDate,
        place_of_supply: purchasePlaceOfSupply,
        transport_charges: parseFloat(purchaseTransportCharges || 0),
        notes: purchaseRemarks || null,
        paid_amount: 0.0,
        items: validLines.map((l, idx) => {
          const calc = purchaseTotals.rowCalcs[idx] || { taxable: 0, discAmount: 0 };
          const gross = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
          const discPct = gross > 0 ? (calc.discAmount / gross) * 100 : 0;
          return {
            item_id: l.item_id ? parseInt(l.item_id) : null,
            item_name: l.item_name,
            hsn_code: l.hsn_code || "6109",
            size: l.size || "",
            color: l.color || "",
            mrp: parseFloat(l.mrp || 0),
            cd1_percent: parseFloat(l.cd1_percent || 0),
            cd2_percent: parseFloat(l.cd2_percent || 0),
            cd3_percent: parseFloat(l.cd3_percent || 0),
            quantity: parseFloat(l.quantity),
            uom: l.uom || "Pcs",
            rate: parseFloat(l.rate || l.mrp || 0),
            discount_percent: parseFloat(discPct.toFixed(2)),
            gst_rate: parseFloat(l.gst_rate || 5.0),
            remarks: l.remarks || "",
          };
        }),
      };

      const created = await api.createInvoice(payload);
      notify(`Purchase Bill ${created.invoice_number} saved & stock added! Total: ₹${created.grand_total}`);

      // Reset purchase form
      setPurchaseLines([{ item_id: '', item_name: '', category: 'READYMADE GARMENTS', size: '', color: '', hsn_code: '6109', quantity: 1, uom: 'Pcs', mrp: '', rate: '', cd1_percent: '', cd2_percent: '', cd3_percent: '', discount_percent: 0, gst_rate: 5.0, remarks: '' }]);
      setPurchaseBillNumber('');
      setPurchaseTransportCharges('');
      setPurchaseRemarks('');
      loadMasters();
      loadPurchaseInvoices();
      setPurchaseViewMode('list');
      setActiveTab('purchase_entry');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const itemCode = (newItem.item_code || newItem.name || '').trim();
    if (!itemCode) {
      triggerMandatoryAlert('#new-item-code', 'Item Code / Article No. cannot be blank!', '⚠️ ITEM CODE REQUIRED');
      return;
    }
    if (!newItem.mrp || parseFloat(newItem.mrp) <= 0 || isNaN(parseFloat(newItem.mrp))) {
      triggerMandatoryAlert('#new-item-mrp', 'MRP is required and cannot be blank or ₹0!', '⚠️ MRP REQUIRED');
      return;
    }
    try {
      setLoading(true);
      await api.createItem({
        ...newItem,
        name: itemCode,
        item_code: itemCode,
        description: (newItem.description || '').trim(),
        item_type: newItem.item_type || 'Readymade',
        category: newItem.category || 'READYMADE GARMENTS',
        size: newItem.size || '',
        mrp: parseFloat(newItem.mrp || newItem.retail_rate || 0),
        retail_rate: parseFloat(newItem.retail_rate || newItem.mrp || 0),
        wholesale_rate: parseFloat(newItem.wholesale_rate || newItem.retail_rate || newItem.mrp || 0),
        purchase_rate: parseFloat(newItem.purchase_rate || 0),
        current_stock: parseFloat(newItem.current_stock || 0),
        gst_rate: 5.00,
      });
      notify(`Item '${itemCode}' created with 5% GST!`);
      setShowItemModal(false);
      setNewItem({ 
        item_code: '',
        name: '', 
        description: '',
        item_type: 'Readymade',
        category: 'READYMADE GARMENTS', 
        size: '', 
        mrp: '', 
        hsn_code: '6109', 
        gst_rate: '5.00', 
        primary_uom: 'Pcs', 
        retail_rate: '', 
        purchase_rate: '', 
        current_stock: '100' 
      });
      loadMasters();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = async (e) => {
    e.preventDefault();
    if (!newParty.name || !newParty.name.trim()) {
      triggerMandatoryAlert('#new-party-name', 'Customer / Party Firm Name cannot be blank!', '⚠️ PARTY NAME REQUIRED');
      return;
    }
    try {
      setLoading(true);
      await api.createCustomer(newParty);
      notify(`Party '${newParty.name}' added successfully!`);
      setShowPartyModal(false);
      setNewParty({ name: '', gstin: '', phone: '', state_code: '27', party_type: 'customer' });
      loadMasters();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === parseInt(selectedCustomerId));
  const selectedVendor = customers.find((c) => c.id === parseInt(selectedVendorId));
  const activeFirm = firms.find((f) => f.id === parseInt(firmId)) || firms[0];

  const handleExportCaCsv = () => {
    if (!gstr1Data && !gstr3bData) {
      notify('No CA Tax Return data loaded yet', 'error');
      return;
    }
    const b2bInvoices = gstr1Data?.b2b || gstr1Data?.b2b_invoices || [];
    const inwardBills = gstr3bData?.inward_bills || [];

    let csv = `SyncBill ERP - CA Tax Compliance Package\r\n`;
    csv += `Firm: ${activeFirm?.name || 'APEX APPARELS & TEXTILES'}, GSTIN: ${activeFirm?.gstin || ''}\r\n`;
    csv += `Financial Year: ${activeFYObj.label}\r\n\r\n`;

    csv += `--- GSTR-3B CONSOLIDATED TAX SUMMARY ---\r\n`;
    csv += `Section,Taxable Value (INR),CGST 2.5%,SGST 2.5%,IGST 5%,Total Tax (INR)\r\n`;
    if (gstr3bData) {
      const out = gstr3bData.table_3_1_outward;
      const itc = gstr3bData.table_4_itc;
      const net = gstr3bData.net_tax_payable;
      csv += `3.1 Outward Sales Liability,${out.taxable_value},${out.cgst},${out.sgst},${out.igst},${out.total_tax}\r\n`;
      csv += `4. Eligible Purchase ITC,${itc.taxable_value},${itc.cgst},${itc.sgst},${itc.igst},${itc.total_tax}\r\n`;
      csv += `5. NET TAX PAYABLE IN CASH,-,${net.cgst},${net.sgst},${net.igst},${net.total}\r\n\r\n`;
    }

    csv += `--- GSTR-1 B2B REGISTERED SALES (${b2bInvoices.length} Invoices) ---\r\n`;
    csv += `Invoice No,Date,Customer Name,GSTIN,Place Of Supply,Taxable Value,CGST,SGST,IGST,Invoice Total\r\n`;
    b2bInvoices.forEach((inv) => {
      csv += `"${inv.invoice_number}","${inv.invoice_date}","${(inv.customer_name || '').replace(/"/g, '""')}","${inv.customer_gstin || ''}","${inv.place_of_supply || ''}",${inv.taxable_value},${inv.cgst},${inv.sgst},${inv.igst},${inv.grand_total}\r\n`;
    });

    csv += `\r\n--- GSTR-2B INWARD PURCHASES ITC REGISTER (${inwardBills.length} Bills) ---\r\n`;
    csv += `Bill No,Date,Supplier Name,Supplier GSTIN,Taxable Value,CGST,SGST,IGST,Total Tax,Bill Total\r\n`;
    inwardBills.forEach((b) => {
      csv += `"${b.bill_number}","${b.bill_date}","${(b.supplier_name || '').replace(/"/g, '""')}","${b.supplier_gstin || ''}",${b.taxable_value},${b.cgst},${b.sgst},${b.igst},${b.total_tax},${b.grand_total}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CA_Tax_Pack_${activeFYObj.id}_${(activeFirm?.name || 'SyncBill').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('CA Tax Return CSV downloaded successfully!');
  };

  const handleCopyCaSummary = () => {
    if (!gstr3bData) {
      notify('GSTR-3B data not loaded yet', 'error');
      return;
    }
    const out = gstr3bData.table_3_1_outward;
    const itc = gstr3bData.table_4_itc;
    const net = gstr3bData.net_tax_payable;
    const text = `*SyncBill GST Compliance Report for CA*
Firm: ${activeFirm?.name || 'APEX APPARELS & TEXTILES'} (${activeFirm?.gstin || ''})
Period: ${activeFYObj.label}

1. Outward Supplies (Sales) - ${out.invoice_count} Invoices
- Taxable Value: Rs. ${out.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- CGST (2.5%): Rs. ${out.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- SGST (2.5%): Rs. ${out.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- IGST: Rs. ${out.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Total Output Tax: Rs. ${out.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

2. Inward Supplies (Purchase ITC) - ${itc.bill_count} Bills
- Taxable Purchases: Rs. ${itc.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Input CGST: Rs. ${itc.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Input SGST: Rs. ${itc.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Input IGST: Rs. ${itc.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Total Eligible ITC: Rs. ${itc.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

3. Net Tax Payable in Cash
- Net CGST: Rs. ${net.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Net SGST: Rs. ${net.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Net IGST: Rs. ${net.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
- Total Net Tax Payable: Rs. ${net.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
`;
    navigator.clipboard.writeText(text);
    notify('CA GST Summary copied to clipboard!');
  };

  // ═════════ LEDGER PAYMENT & EXPORT HANDLERS ═════════
  const handleRecordLedgerPayment = async (e) => {
    e.preventDefault();
    if (!ledgerPaymentForm.amount || parseFloat(ledgerPaymentForm.amount) <= 0) {
      notify("Please enter a valid amount", "error");
      return;
    }
    try {
      setLoading(true);
      await api.recordPayment({
        firm_id: firmId,
        customer_id: parseInt(selectedLedgerCustomerId),
        payment_number: `PMT-${Date.now().toString().slice(-6)}`,
        payment_type: ledgerPaymentForm.payment_type,
        payment_mode: ledgerPaymentForm.payment_mode,
        amount: parseFloat(ledgerPaymentForm.amount),
        payment_date: ledgerPaymentForm.payment_date,
        reference_number: ledgerPaymentForm.reference_number || undefined,
        notes: ledgerPaymentForm.notes || undefined,
      });
      notify("Payment recorded successfully!");
      setShowLedgerPaymentModal(false);
      setLedgerPaymentForm({
        payment_type: 'receipt',
        payment_mode: 'cash',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
      });
      loadLedger(selectedLedgerCustomerId);
    } catch (err) {
      notify(err.message || "Failed to record payment", "error");
    } finally {
      setLoading(false);
    }
  };

  const exportLedgerCsv = () => {
    if (!ledgerData || !ledgerData.transactions) {
      notify("No ledger data to export", "error");
      return;
    }
    const headers = ["Date", "Voucher Type", "Voucher No", "Narration", "Debit (Dr)", "Credit (Cr)", "Running Balance", "Type"];
    const rows = ledgerData.transactions.map(t => [
      t.date,
      `"${t.voucher_type}"`,
      `"${t.voucher_no}"`,
      `"${(t.narration || '').replace(/"/g, '""')}"`,
      t.debit.toFixed(2),
      t.credit.toFixed(2),
      t.running_balance.toFixed(2),
      t.balance_type
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + 
      [
        `"Party: ${ledgerData.party.name}"`,
        `"GSTIN: ${ledgerData.party.gstin || 'Unregistered'}"`,
        `"Period: ${ledgerData.period.start_date || 'Inception'} to ${ledgerData.period.end_date || 'Present'}"`,
        `"Opening Balance: Rs. ${ledgerData.opening_balance} ${ledgerData.opening_balance_type}"`,
        "",
        headers.join(","),
        ...rows.map(e => e.join(","))
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ledger_${ledgerData.party.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendLedgerWhatsApp = async () => {
    if (!ledgerData?.party) {
      notify("Please select a party first", "error");
      return;
    }

    let targetPhone = (ledgerData?.party?.phone || '').replace(/\D/g, '');
    if (!targetPhone) {
      const entered = window.prompt(`Please enter WhatsApp mobile number for ${ledgerData.party.name}:`, "");
      if (!entered || !entered.trim()) return;
      targetPhone = entered.replace(/\D/g, '');
    }

    const cleanPhone = targetPhone.length === 10 ? `91${targetPhone}` : targetPhone;
    if (cleanPhone.length < 10) {
      notify("Invalid WhatsApp phone number.", "error");
      return;
    }

    const firmName = ledgerFirmFilter === 'all' 
      ? 'All Combined Operating Firms' 
      : (firms.find(f => f.id === ledgerFirmFilter)?.name || activeFirm?.name || 'SyncBill');

    const isCust = (ledgerData?.party?.party_type || '').toLowerCase() === 'customer';
    const balanceLabel = isCust
      ? (ledgerData.closing_balance_type === 'Dr' ? 'Net Receivable (Due)' : ledgerData.closing_balance_type === 'Cr' ? 'Advance Received' : 'Settled')
      : (ledgerData.closing_balance_type === 'Cr' ? 'Net Payable to Supplier' : ledgerData.closing_balance_type === 'Dr' ? 'Advance Paid' : 'Settled');

    const msg = `🧾 *STATEMENT OF ACCOUNT (KHATA)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Party:* ${ledgerData?.party?.name}\n` +
      `*Firm:* ${firmName}\n` +
      `*Period:* ${ledgerData?.period?.start_date || 'Inception'} to ${ledgerData?.period?.end_date || 'Today'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Opening Balance:* ₹${ledgerData?.opening_balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${ledgerData?.opening_balance_type || ''}\n` +
      `• *${isCust ? 'Total Sales Billed (+Dr)' : 'Total Payments Made (+Dr)'}:* ₹${ledgerData?.total_debit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `• *${isCust ? 'Total Payments Received (-Cr)' : 'Total Purchases Inward (-Cr)'}:* ₹${ledgerData?.total_credit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ *CLOSING BALANCE:* *₹${ledgerData?.closing_balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${ledgerData?.closing_balance_type}*\n` +
      `*Status:* ${balanceLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (ledgerData.closing_balance > 0 && ((isCust && ledgerData.closing_balance_type === 'Dr') || (!isCust && ledgerData.closing_balance_type === 'Cr'))
        ? `Please verify your statement and arrange clearance of pending balance at your earliest convenience.\n\n`
        : `Thank you for your business and partnership!\n\n`) +
      (() => {
        const cp = customers.find(c => String(c.id) === String(selectedLedgerCustomerId)) || ledgerData?.party;
        const pUrl = ledgerData?.party?.official_pdf_url || cp?.official_pdf_url;
        return pUrl ? `📄 *Official Accurate Statement PDF:*\n${pUrl}\n\n` : '';
      })() +
      `_Automated Statement generated via SyncBill ERP_`;

    setSendingWhatsAppStatement(true);
    try {
      await api.sendCustomWhatsApp(cleanPhone, msg);
      notify(`✅ Statement sent directly to ${ledgerData.party.name} (${cleanPhone}) via WhatsApp Bridge!`, 'success');
    } catch (err) {
      console.warn("WhatsApp Bridge send failed:", err);
      const choice = window.confirm(
        `WhatsApp Bridge: ${err.message || 'Bridge offline or session expired'}.\n\n` +
        `Click OK to open the WhatsApp QR Code Scanner to connect/reconnect.\n` +
        `Click Cancel to open manual WhatsApp Web in your browser instead.`
      );
      if (choice) {
        setShowWhatsAppModal(true);
      } else {
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
      }
    } finally {
      setSendingWhatsAppStatement(false);
    }
  };


  const formatDate = (dStr) => {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  const filteredSalesInvoices = [...salesInvoices]
    .sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0) || (b.id - a.id))
    .filter((inv) => {
      const party = inv.customer || customers.find((c) => c.id === inv.customer_id);
      const pName = party?.name || inv.customer?.name || '';
      const billNo = inv.invoice_number || '';
      const invDate = inv.invoice_date || '';
      const invDateFormatted = formatDate(invDate);

      if (salesDateFilter && invDate !== salesDateFilter) {
        return false;
      }

      if (!salesSearch) return true;
      const s = salesSearch.toLowerCase().trim();
      return (
        billNo.toLowerCase().includes(s) ||
        pName.toLowerCase().includes(s) ||
        invDate.includes(s) ||
        invDateFormatted.includes(s)
      );
    });

  const filteredPurchaseInvoices = [...purchaseInvoices]
    .sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0) || (b.id - a.id))
    .filter((inv) => {
      const party = inv.customer || customers.find((c) => c.id === inv.customer_id);
      const pName = party?.name || inv.customer?.name || '';
      const billNo = inv.invoice_number || '';
      const invDate = inv.invoice_date || '';
      const invDateFormatted = formatDate(invDate);

      if (purchaseDateFilter && invDate !== purchaseDateFilter) {
        return false;
      }

      if (!purchaseSearch) return true;
      const s = purchaseSearch.toLowerCase().trim();
      return (
        billNo.toLowerCase().includes(s) ||
        pName.toLowerCase().includes(s) ||
        invDate.includes(s) ||
        invDateFormatted.includes(s)
      );
    });

  const filteredReceivables = (receivablesData.parties || []).filter(p => {
    if (!receivablesSearch) return true;
    const s = receivablesSearch.toLowerCase();
    return (p.party_name || '').toLowerCase().includes(s) ||
           (p.phone || '').toLowerCase().includes(s) ||
           (p.gstin || '').toLowerCase().includes(s);
  });

  return (
    <div className="app-shell">
      {/* ═════════ HIGH ATTENTION MANDATORY FIELD MODAL POP-UP ═════════ */}
      {mandatoryAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          maxWidth: '560px',
          width: '94%',
          background: '#991b1b', // Solid high-contrast deep red
          border: '3px solid #ef4444',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(239, 68, 68, 0.4)',
          color: '#ffffff',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          animation: 'shakeVibrate 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both'
        }}>
          <div style={{
            background: '#dc2626',
            borderRadius: '50%',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={26} color="#ffffff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em', color: '#fef2f2', marginBottom: '4px' }}>
              {mandatoryAlert.title}
            </div>
            <div style={{ fontSize: '14.5px', color: '#fee2e2', lineHeight: '1.45', fontWeight: 500 }}>
              {mandatoryAlert.message}
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  const el = typeof mandatoryAlert.targetSelectorOrEl === 'string'
                    ? document.querySelector(mandatoryAlert.targetSelectorOrEl)
                    : mandatoryAlert.targetSelectorOrEl;
                  if (el) {
                    el.classList.add('box-vibrate-error');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                    if (el.select) el.select();
                    setTimeout(() => el.classList.remove('box-vibrate-error'), 1800);
                  }
                  setMandatoryAlert(null);
                }}
                style={{
                  background: '#ffffff',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '7px 16px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Fix This Box Now
              </button>
              <button
                onClick={() => setMandatoryAlert(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: '4px',
                  padding: '7px 14px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            onClick={() => setMandatoryAlert(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '2px',
              alignSelf: 'flex-start'
            }}
            title="Close warning"
          >
            <X size={22} />
          </button>
        </div>
      )}

      {/* ═════════ TOP NOTIFICATION ═════════ */}
      {notification && (
        <div className="anim-toast-enter" style={{
          position: 'fixed', top: '15px', right: '15px', zIndex: 9999,
          background: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: notification.type === 'error' ? '#b91c1c' : '#15803d',
          border: `1.5px solid ${notification.type === 'error' ? '#f87171' : '#86efac'}`,
          padding: '12px 18px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: 600
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* ═════════ LEFT VERTICAL SIDEBAR (COLLAPSIBLE / AZIA STYLE) ═════════ */}
      <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Logo & Minimize Toggle */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            <div 
              className="sidebar-logo-icon"
              onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); }}
              style={{ cursor: sidebarCollapsed ? 'pointer' : 'default', flexShrink: 0 }}
              title={sidebarCollapsed ? "Click to expand sidebar (Ctrl+B)" : undefined}
            >
              S
            </div>
            <div className="sidebar-logo-text" style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                SYNCBILL <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 600 }}>ERP</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Accurate Offline Bridge
              </div>
            </div>
          </div>
          {!sidebarCollapsed && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #334155',
                borderRadius: '4px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 0,
                flexShrink: 0
              }}
              title="Minimize Left Panel (Ctrl+B)"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Sidebar Nav Items with Traveling Active Indicator */}
        <div className="sidebar-nav" ref={sidebarNavRef} style={{ position: 'relative' }}>
          {/* Traveling Active Indicator Pill */}
          <div 
            className="sidebar-traveling-pill"
            style={{
              top: `${navIndicator.top}px`,
              height: `${navIndicator.height || 38}px`,
              opacity: navIndicator.opacity,
            }}
          />

          <div className="sidebar-group-title">MAIN WORKSPACE</div>

          <button
            data-nav="desk"
            className={`sidebar-item ${activeNavKey === 'desk' ? 'active' : ''}`}
            onClick={() => { setActiveTab('desk'); setShowCaDropdown(false); }}
            title="Daily Counter Desk (F2)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Home size={16} color="#f59e0b" />
              <span>Daily Counter Desk</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
              F2
            </span>
          </button>

          <div className="sidebar-group-title">BILLING & VOUCHERS</div>

          <button
            data-nav="sale_bill"
            className={`sidebar-item ${activeNavKey === 'sale_bill' ? 'active' : ''}`}
            onClick={() => { setActiveTab('billing'); setSaleViewMode('create'); setShowCaDropdown(false); }}
            title="Sale Bill (GST) (F8)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Receipt size={16} color="#10b981" />
              <span>Sale Bill (GST)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#d1fae5', color: '#047857' }}>
              F8
            </span>
          </button>

          <button
            data-nav="purchase_bill"
            className={`sidebar-item ${activeNavKey === 'purchase_bill' ? 'active' : ''}`}
            onClick={() => { setActiveTab('purchase_entry'); setPurchaseViewMode('create'); setShowCaDropdown(false); }}
            title="Purchase Bill (F9)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart size={16} color="#8b5cf6" />
              <span>Purchase Bill</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
              F9
            </span>
          </button>

          <button
            data-nav="sales_return"
            className={`sidebar-item ${activeNavKey === 'sales_return' ? 'active' : ''}`}
            onClick={() => { setReturnInitialType('credit_note'); setActiveTab('returns'); setShowCaDropdown(false); }}
            title="Sales Return (Credit Note / F12)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RotateCcw size={16} color="#e11d48" />
              <span>Sales Return (CN)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#ffe4e6', color: '#be123c' }}>
              F12
            </span>
          </button>

          <button
            data-nav="purchase_return"
            className={`sidebar-item ${activeNavKey === 'purchase_return' ? 'active' : ''}`}
            onClick={() => { setReturnInitialType('debit_note'); setActiveTab('returns'); setShowCaDropdown(false); }}
            title="Purchase Return (Debit Note)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RotateCw size={16} color="#ea580c" />
              <span>Purchase Return (DN)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#ffedd5', color: '#c2410c' }}>
              Debit
            </span>
          </button>

          <button
            data-nav="customer_receipt"
            className={`sidebar-item ${activeNavKey === 'customer_receipt' ? 'active' : ''}`}
            onClick={() => { setAccountsVoucherInitialType('receipt'); setActiveTab('accounts_vouchers'); setShowCaDropdown(false); }}
            title="Customer Collection Voucher (Receipt / Jama / F10)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowDownLeft size={16} color="#10b981" />
              <span>Customer Receipt (जमा)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#d1fae5', color: '#047857' }}>
              F10
            </span>
          </button>

          <button
            data-nav="supplier_payment"
            className={`sidebar-item ${activeNavKey === 'supplier_payment' ? 'active' : ''}`}
            onClick={() => { setAccountsVoucherInitialType('payment'); setActiveTab('accounts_vouchers'); setShowCaDropdown(false); }}
            title="Supplier Payment Voucher (भुगतान)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowUpRight size={16} color="#6366f1" />
              <span>Supplier Payment (खर्च)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              Pay
            </span>
          </button>

          <button
            data-nav="customer_ledger"
            className={`sidebar-item ${activeNavKey === 'customer_ledger' ? 'active' : ''}`}
            onClick={() => {
              setLedgerPartyType('customer');
              setActiveTab('ledger');
              setShowCaDropdown(false);
              const custs = customers.filter(c => (c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both');
              if (custs.length > 0 && (!selectedLedgerCustomerId || !custs.some(c => String(c.id) === String(selectedLedgerCustomerId)))) {
                setSelectedLedgerCustomerId(String(custs[0].id));
                loadLedger(custs[0].id, ledgerFirmFilter, null, null);
              }
            }}
            title="Customer Ledger (ग्राहक खाता) (Ctrl+L)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={16} color="#38bdf8" />
              <span>Customer Ledger (ग्राहक)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              Ctrl+L
            </span>
          </button>

          <button
            data-nav="vendor_ledger"
            className={`sidebar-item ${activeNavKey === 'vendor_ledger' ? 'active' : ''}`}
            onClick={() => {
              setLedgerPartyType('vendor');
              setActiveTab('ledger');
              setShowCaDropdown(false);
              const vends = customers.filter(c => (c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both');
              if (vends.length > 0 && (!selectedLedgerCustomerId || !vends.some(c => String(c.id) === String(selectedLedgerCustomerId)))) {
                setSelectedLedgerCustomerId(String(vends[0].id));
                loadLedger(vends[0].id, ledgerFirmFilter, null, null);
              }
            }}
            title="Vendor / Supplier Ledger (सप्लायर खाता)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={16} color="#14b8a6" />
              <span>Vendor Ledger (सप्लायर)</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#ccfbf1', color: '#0f766e' }}>
              Party
            </span>
          </button>

          <div className="sidebar-group-title">REGISTERS & MASTERS</div>

          <button
            data-nav="sales_reg"
            className={`sidebar-item ${activeNavKey === 'sales_reg' ? 'active' : ''}`}
            onClick={() => { setActiveTab('billing'); setSaleViewMode('list'); setShowCaDropdown(false); }}
            title={`Sales Register (${salesInvoices.length} Bills)`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={16} color="#06b6d4" />
              <span>Sales Register</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{salesInvoices.length}</span>
          </button>

          <button
            data-nav="purchase_reg"
            className={`sidebar-item ${activeNavKey === 'purchase_reg' ? 'active' : ''}`}
            onClick={() => { setActiveTab('purchase_entry'); setPurchaseViewMode('list'); setShowCaDropdown(false); }}
            title={`Purchase Register (${purchaseInvoices.length} Bills)`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={16} color="#14b8a6" />
              <span>Purchase Register</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{purchaseInvoices.length}</span>
          </button>

          <button
            data-nav="items"
            className={`sidebar-item ${activeNavKey === 'items' ? 'active' : ''}`}
            onClick={() => { setActiveTab('items'); setShowCaDropdown(false); }}
            title={`Items Stock (${items.length} Items)`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package size={16} color="#f59e0b" />
              <span>Items Stock</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{items.length}</span>
          </button>

          <button
            data-nav="barcode_generator"
            className={`sidebar-item ${activeNavKey === 'barcode_generator' ? 'active' : ''}`}
            onClick={() => { setActiveTab('barcode_generator'); setShowCaDropdown(false); }}
            title="Garment Barcode & Price Tag Generator"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Tag size={16} color="#0284c7" />
              <span>Barcode Stickers</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              Print
            </span>
          </button>

          <button
            data-nav="parties"
            className={`sidebar-item ${activeNavKey === 'parties' ? 'active' : ''}`}
            onClick={() => { setActiveTab('parties'); setShowCaDropdown(false); }}
            title={`Party Accounts (${customers.length} Parties)`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={16} color="#f43f5e" />
              <span>Party Accounts</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{customers.length}</span>
          </button>

          <div className="sidebar-group-title">TAX & COMPLIANCE</div>

          <button
            data-nav="daybook_analytics"
            className={`sidebar-item ${activeNavKey === 'daybook_analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('daybook_analytics'); setShowCaDropdown(false); }}
            title="Accurate Daybook & Cash Register"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={16} color="#10b981" />
              <span>Daybook & Cash</span>
            </div>
            <span className="sidebar-badge" style={{ background: '#d1fae5', color: '#047857' }}>
              Today
            </span>
          </button>

          <button
            data-nav="gstr"
            className={`sidebar-item ${activeNavKey === 'gstr' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gstr'); setShowCaDropdown(false); }}
            title="CA & Tax Reports"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileSpreadsheet size={16} color="#a855f7" />
              <span>CA & Tax Reports</span>
            </div>
          </button>

          <button
            data-nav="dashboard"
            className={`sidebar-item ${activeNavKey === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setShowCaDropdown(false); }}
            title="Executive Overview"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LayoutDashboard size={16} color="#64748b" />
              <span>Executive Overview</span>
            </div>
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="footer-status-dot" style={{
            fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '7px',
            marginBottom: sidebarCollapsed ? 0 : '8px'
          }} title="Accurate Sync: Ready">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} className="animate-pulse"></span>
            <span className="footer-text" style={{ fontWeight: 600 }}>Accurate Sync: Ready</span>
          </div>
          <div className="footer-text" style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.4 }}>
            <div><strong style={{ color: '#94a3b8' }}>Ctrl + L</strong> : Open Ledger</div>
            <div><strong style={{ color: '#94a3b8' }}>F8</strong> : Sale | <strong style={{ color: '#94a3b8' }}>F9</strong> : Purchase</div>
            <div><strong style={{ color: '#94a3b8' }}>Ctrl + B</strong> : Toggle Panel</div>
          </div>
        </div>
      </aside>

      {/* ═════════ MAIN CONTENT AREA ═════════ */}
      <div className="app-main-area">
        {/* Modern Topbar */}
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sidebar Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#334155',
                padding: 0,
                marginRight: '2px',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title={sidebarCollapsed ? "Expand Left Panel (Ctrl+B)" : "Minimize Left Panel (Ctrl+B)"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            {activeTab === 'desk' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Home size={17} color="#b45309" />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    Daily Counter Desk
                  </h2>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ग्राहकों की उधारी और माल मँगाने की लिस्ट (Counter Privacy Safe)
                  </span>
                </div>
              </div>
            )}
            {(activeTab === 'billing' || activeTab === 'daybook') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} color="#10b981" />
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  {saleViewMode === 'create' ? 'Sales Voucher Entry (Tax Invoice)' : 'Sale Bills (GST)'}
                </h2>
              </div>
            )}
            {(activeTab === 'purchase_entry' || activeTab === 'purchases') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="#8b5cf6" />
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  {purchaseViewMode === 'create' ? 'Purchase Voucher Entry (Inward Stock Bill)' : 'Purchase Bills'}
                </h2>
              </div>
            )}
            {activeTab === 'ledger' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="#0284c7" />
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>Party Ledger Statement (Ctrl+L)</h2>
              </div>
            )}
            {activeTab === 'returns' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {returnInitialType === 'credit_note' ? (
                  <RotateCcw size={18} color="#e11d48" />
                ) : (
                  <RotateCw size={18} color="#ea580c" />
                )}
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  {returnInitialType === 'credit_note' ? 'Sales Goods Return (Credit Note / F12)' : 'Purchase Goods Return (Debit Note)'}
                </h2>
              </div>
            )}
            {activeTab === 'accounts_vouchers' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {accountsVoucherInitialType === 'receipt' ? (
                  <ArrowDownLeft size={18} color="#10b981" />
                ) : (
                  <ArrowUpRight size={18} color="#6366f1" />
                )}
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  {accountsVoucherInitialType === 'receipt' ? 'Customer Collection Voucher (Receipt / Jama / F10)' : 'Supplier Payment Voucher (भुगतान)'}
                </h2>
              </div>
            )}
            {activeTab === 'barcode_generator' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} color="#0284c7" />
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  Garment Barcode & Price Tag Generator
                </h2>
              </div>
            )}
            {activeTab === 'daybook_analytics' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#10b981" />
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>
                  Accurate Daybook & Cash Register
                </h2>
              </div>
            )}
            {activeTab !== 'desk' && activeTab !== 'billing' && activeTab !== 'purchase_entry' && activeTab !== 'ledger' && activeTab !== 'returns' && activeTab !== 'accounts_vouchers' && activeTab !== 'barcode_generator' && activeTab !== 'daybook_analytics' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '15px', color: '#0f172a', margin: 0, textTransform: 'capitalize' }}>
                  {activeTab.replace('_', ' ')}
                </h2>
              </div>
            )}
          </div>

          {/* Topbar Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Quick Shortcut Button to Ledger */}
            <button
              onClick={() => setActiveTab('ledger')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd',
                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Shortcut: Press Ctrl + L anytime"
            >
              <BookOpen size={13} />
              <span>Party Ledger (Ctrl+L)</span>
            </button>

            {/* Free WhatsApp Web Bridge Button */}
            <button
              onClick={() => setShowWhatsAppModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: whatsAppBridgeStatus?.connected ? '#f0fdf4' : '#f8fafc',
                color: whatsAppBridgeStatus?.connected ? '#15803d' : '#64748b',
                border: `1px solid ${whatsAppBridgeStatus?.connected ? '#bbf7d0' : '#cbd5e1'}`,
                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              title="WhatsApp Zero Cost Web Automation Bridge"
            >
              <Smartphone size={13} color={whatsAppBridgeStatus?.connected ? '#16a34a' : '#64748b'} />
              <span>
                {whatsAppBridgeStatus?.connected 
                  ? `WhatsApp (+${whatsAppBridgeStatus.phone || 'OK'})` 
                  : whatsAppBridgeStatus?.bridge_online 
                    ? 'Scan WhatsApp QR' 
                    : 'WhatsApp Offline'}
              </span>
            </button>

            {/* Firm Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <Building2 size={14} color="#6366f1" />
              <select
                value={firmId}
                onChange={(e) => setFirmId(parseInt(e.target.value))}
                style={{
                  background: 'transparent', color: '#0f172a', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none'
                }}
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Financial Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <Calendar size={14} color="#0284c7" />
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                style={{
                  background: 'transparent', color: '#0f172a', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none'
                }}
              >
                {FINANCIAL_YEARS.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="badge badge-indigo" style={{ padding: '4px 8px' }}>
              5% GST Active
            </span>
          </div>
        </header>

        {/* ═════════ MAIN CONTENT CONTAINER ═════════ */}
        <main className="app-content">

          {/* ═════════ 0. DAILY COUNTER DESK (DEFAULT MAIN SCREEN) ═════════ */}
          {activeTab === 'desk' && (
            <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Privacy Safeguard Banner */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={18} color="#059669" />
                  <span style={{ fontSize: '12px', color: '#065f46', fontWeight: 600 }}>
                    Counter Safe Mode: Sensitive profit percentages, purchase costs, and bank balances are strictly hidden from this counter screen.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setActiveTab('billing'); setSaleViewMode('create'); setSidebarCollapsed(true); }}>
                    + Sale Bill (F8)
                  </button>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => { setAccountsVoucherInitialType('receipt'); setActiveTab('accounts_vouchers'); setSidebarCollapsed(true); }}
                    style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5', fontWeight: 700 }}
                    title="Open Customer Collection Voucher (Receipt / F10)"
                  >
                    + Collection (F10)
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => { setReturnInitialType('credit_note'); setActiveTab('returns'); setSidebarCollapsed(true); }}
                    style={{ borderColor: '#fca5a5', color: '#be123c', background: '#fff1f2' }}
                    title="Open Sales Goods Return (F12)"
                  >
                    + Sales Return (F12)
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('ledger')}>
                    Ledger (Ctrl+L)
                  </button>
                </div>
              </div>

              {/* 2-Column Split: Pending Receivables (Left) + Restock Notes (Right) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', gap: '16px' }}>

                {/* ═══ COLUMN 1: PENDING RECEIVABLES (उधारी) ═══ */}
                <div className="desk-card">
                  <div className="desk-card-header" style={{ background: '#fff' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e11d48' }}></div>
                        <h3 style={{ fontSize: '14px', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                          Pending Receivables (ग्राहकों की उधारी)
                        </h3>
                        <span className="badge badge-rose">
                          {filteredReceivables.length} Parties
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Click the arrow next to any customer to see unpaid bills with date and amount
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Search party or phone..."
                          value={receivablesSearch}
                          onChange={(e) => setReceivablesSearch(e.target.value)}
                          style={{ width: '190px', paddingLeft: '26px', fontSize: '11.5px', padding: '5px 8px 5px 26px' }}
                        />
                        <Search size={13} style={{ position: 'absolute', left: '7px', top: '7px', color: '#94a3b8' }} />
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={loadReceivables}
                        title="Reload Receivables"
                      >
                        <RefreshCw size={12} className={loadingReceivables ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Receivables Table with Expandable Bill Details */}
                  <div style={{ maxHeight: 'calc(100vh - 195px)', overflowY: 'auto' }}>
                    <table className="accounting-table">
                      <thead>
                        <tr>
                          <th>Customer / Party Name</th>
                          <th>Phone / GSTIN</th>
                          <th style={{ textAlign: 'right' }}>Pending Due (₹)</th>
                          <th style={{ textAlign: 'center' }}>Bills</th>
                          <th style={{ textAlign: 'center', width: '140px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceivables.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                              {loadingReceivables ? 'Fetching pending receivables...' : 'No pending receivables found for this firm.'}
                            </td>
                          </tr>
                        ) : (
                          filteredReceivables.map((party) => {
                            const partyId = party.party_id || party.customer_id;
                            const partyName = party.party_name || party.name || (party.customer ? party.customer.name : 'Cash Customer');
                            const pendingDue = Number(party.balance ?? party.total_pending ?? 0);
                            const bills = party.bills || [];
                            const isExpanded = !!expandedParties[partyId];

                            return (
                              <React.Fragment key={partyId}>
                                <tr style={{ background: isExpanded ? '#f0f9ff' : 'transparent' }}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandParty(partyId)}
                                        style={{
                                          background: isExpanded ? '#0284c7' : '#f1f5f9',
                                          color: isExpanded ? '#ffffff' : '#475569',
                                          border: `1px solid ${isExpanded ? '#0284c7' : '#cbd5e1'}`,
                                          borderRadius: '4px',
                                          padding: '3px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.15s ease'
                                        }}
                                        title={isExpanded ? "Collapse bill details" : "Click arrow to view pending bills"}
                                      >
                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </button>
                                      <div
                                        style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontSize: '13px' }}
                                        onClick={() => toggleExpandParty(partyId)}
                                        title="Click to view pending bills breakdown"
                                      >
                                        {partyName}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {party.phone && (
                                      <div style={{ fontSize: '11.5px', color: '#334155', fontWeight: 500 }}>
                                        {party.phone}
                                      </div>
                                    )}
                                    {party.gstin && (
                                      <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>
                                        {party.gstin}
                                      </div>
                                    )}
                                    {!party.phone && !party.gstin && (
                                      <span style={{ color: '#94a3b8' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#b91c1c', fontSize: '13.5px' }}>
                                    ₹ {pendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandParty(partyId)}
                                      className="badge badge-unpaid"
                                      style={{ fontSize: '10.5px', cursor: 'pointer', border: 'none', background: '#ffe4e6', color: '#b91c1c' }}
                                      title="Click to view bill details"
                                    >
                                      {party.unpaid_invoices_count || bills.length || 1} Due {isExpanded ? '▲' : '▼'}
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleQuickOpenLedger(partyId)}
                                        title="View Party Ledger Statement"
                                        style={{ padding: '3px 7px', fontSize: '11px', color: '#0284c7' }}
                                      >
                                        <BookOpen size={11} /> Ledger
                                      </button>
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleQuickCollect(party)}
                                        title="Collect Payment from this Party"
                                        style={{ padding: '3px 8px', fontSize: '11px' }}
                                      >
                                        <Coins size={11} /> Collect
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* ═══ EXPANDED BILL-BY-BILL BREAKDOWN ═══ */}
                                {isExpanded && (
                                  <tr style={{ background: '#f8fafc' }}>
                                    <td colSpan="5" style={{ padding: '8px 12px 14px 20px', borderBottom: '2px solid #cbd5e1' }}>
                                      <div style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                      }}>
                                        <div style={{
                                          background: '#f1f5f9',
                                          padding: '8px 12px',
                                          borderBottom: '1px solid #e2e8f0',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center'
                                        }}>
                                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FileText size={13} color="#0284c7" />
                                            <span>Unpaid Bills for {partyName} ({bills.length} {bills.length === 1 ? 'Bill' : 'Bills'})</span>
                                          </div>
                                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b91c1c' }}>
                                            Total Due: ₹ {pendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </div>
                                        </div>

                                        {bills.length === 0 ? (
                                          <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }}>
                                            Pending balance is carried from ledger account opening balance.
                                          </div>
                                        ) : (
                                          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                            <thead>
                                              <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '6px 10px' }}>Bill No</th>
                                                <th style={{ padding: '6px 10px' }}>Bill Date</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Bill Amount</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Paid Amount</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Pending Due</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {bills.map((bill, bIdx) => (
                                                <tr key={bill.id || bIdx} style={{ borderBottom: '1px solid #f1f5f9', background: bIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                  <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0369a1' }}>
                                                    {bill.invoice_number}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', color: '#334155' }}>
                                                    {bill.invoice_date}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'right', color: '#475569' }}>
                                                    ₹ {Number(bill.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'right', color: '#16a34a' }}>
                                                    ₹ {Number(bill.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#b91c1c' }}>
                                                    ₹ {Number(bill.balance_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                    <span className="badge badge-rose" style={{ fontSize: '9.5px', padding: '1px 5px', textTransform: 'capitalize' }}>
                                                      {bill.payment_status || 'Unpaid'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ═══ COLUMN 2: RESTOCK LIST (NOTES APP - 100% USER-MANAGED) ═══ */}
                <div className="desk-card">
                  <div className="desk-card-header" style={{ background: '#fff' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></div>
                        <h3 style={{ fontSize: '14px', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                          Restock List
                        </h3>
                        <span className="badge badge-cyan">
                          {restockNotes.filter(n => !n.done).length} Notes
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Simple restock notes • System will never add items
                      </div>
                    </div>

                    {restockNotes.some(n => n.done) && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleClearCompletedNotes}
                        style={{ fontSize: '11px' }}
                      >
                        Clear Done
                      </button>
                    )}
                  </div>

                  {/* Add New Restock Note Form */}
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <form onSubmit={handleAddRestockNote} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Type item to restock (e.g. 50 pcs Raymond 40 size, 10 rolls tape)..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        style={{ flex: 1, fontSize: '12.5px' }}
                      />
                      <select
                        className="input-field"
                        value={newNotePriority}
                        onChange={(e) => setNewNotePriority(e.target.value)}
                        style={{ width: '100px', fontSize: '12px', fontWeight: 600 }}
                      >
                        <option value="Urgent">🚨 Urgent</option>
                        <option value="Normal">⚡ Normal</option>
                        <option value="Low">💤 Low</option>
                      </select>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </form>
                  </div>

                  {/* Restock Notes List */}
                  <div style={{ maxHeight: 'calc(100vh - 275px)', overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {restockNotes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                        <ClipboardList size={34} style={{ margin: '0 auto 8px auto', opacity: 0.35 }} />
                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: '13px' }}>Restock List is empty</div>
                        <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Type any items above that need to be purchased or ordered.</div>
                      </div>
                    ) : (
                      restockNotes.map((note) => {
                        const isUrgent = note.priority === 'Urgent';
                        const isNormal = note.priority === 'Normal';
                        return (
                          <div
                            key={note.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                              padding: '10px 12px', borderRadius: '8px',
                              background: note.done ? '#f8fafc' : '#ffffff',
                              border: `1px solid ${note.done ? '#e2e8f0' : isUrgent ? '#fecdd3' : '#e2e8f0'}`,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              <button
                                onClick={() => handleToggleRestockNote(note.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: note.done ? '#10b981' : '#94a3b8' }}
                                title={note.done ? "Mark as pending" : "Mark as completed"}
                              >
                                {note.done ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} />}
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '12.5px',
                                  fontWeight: note.done ? 400 : 600,
                                  color: note.done ? '#94a3b8' : '#0f172a',
                                  textDecoration: note.done ? 'line-through' : 'none',
                                  wordBreak: 'break-word'
                                }}>
                                  {note.text}
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span><Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />{note.date}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                className={`badge ${isUrgent ? 'badge-rose' : isNormal ? 'badge-cyan' : 'badge-amber'}`}
                                style={{ fontSize: '10px', padding: '1px 6px' }}
                              >
                                {note.priority}
                              </span>
                              <button
                                onClick={() => handleDeleteRestockNote(note.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#94a3b8' }}
                                title="Delete note"
                              >
                                <Trash2 size={13} hover={{ color: '#b91c1c' }} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ═════════ 1. SALE BILL (F8 / SALES VOUCHERS) ═════════ */}
          {(activeTab === 'billing' || activeTab === 'daybook') && saleViewMode === 'list' && (
            <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
                {/* Header with Title on Left and + Add Sale Bill Button on Top Right Corner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={20} color="#0284c7" />
                      <h2 style={{ fontSize: '16px', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                        Sale Bills (GST Invoices)
                      </h2>
                      <span className="badge badge-indigo" style={{ padding: '2px 8px' }}>
                        {activeFYObj.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      Showing <strong>{filteredSalesInvoices.length}</strong> of {salesInvoices.length} bills date-wise
                    </div>
                  </div>

                  {/* TOP RIGHT CORNER: Option to Add Bill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => { setSaleViewMode('create'); setSidebarCollapsed(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 600 }}
                      title="Create New Sale Bill (F8) (Auto-minimizes sidebar for wide table)"
                    >
                      <Plus size={15} /> + Add Sale Bill (F8)
                    </button>
                  </div>
                </div>

                {/* Search & Date Filter Bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
                  padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Search by Customer / Bill No / Date */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Search by customer, bill no, date..."
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                        style={{ width: '270px', paddingLeft: '28px', fontSize: '12px', padding: '6px 8px 6px 28px' }}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                      {salesSearch && (
                        <button
                          onClick={() => setSalesSearch('')}
                          style={{ position: 'absolute', right: '8px', top: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Date Filter Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>Date:</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="date"
                          className="input-field"
                          value={salesDateFilter}
                          onChange={(e) => setSalesDateFilter(e.target.value)}
                          title="Filter by specific bill date"
                          style={{ width: '145px', fontSize: '12px', padding: '5px 8px' }}
                        />
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(salesSearch || salesDateFilter) && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setSalesSearch(''); setSalesDateFilter(''); }}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Ordered: <strong>Latest Date First</strong>
                  </div>
                </div>

                {/* Date-wise Sale Bills Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="accounting-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Bill No</th>
                        <th style={{ width: '105px' }}>Bill Date</th>
                        <th>Customer / Buyer Name</th>
                        <th style={{ width: '160px' }}>Customer GSTIN</th>
                        <th style={{ width: '110px', textAlign: 'right' }}>Taxable (₹)</th>
                        <th style={{ width: '95px', textAlign: 'right' }}>5% GST (₹)</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Bill Total (₹)</th>
                        <th style={{ width: '95px', textAlign: 'center' }}>Status</th>
                        <th style={{ width: '85px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSalesInvoices.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                            <Receipt size={36} style={{ margin: '0 auto 8px auto', opacity: 0.35 }} />
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>No sale bills found</div>
                            <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                              {salesSearch || salesDateFilter ? 'Try clearing the search or date filters.' : 'Click "+ Add Sale Bill" to generate your first bill.'}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSalesInvoices.map((inv) => {
                          const party = inv.customer || customers.find((c) => c.id === inv.customer_id);
                          const partyName = party?.name || inv.customer?.name || 'Cash Customer';
                          const partyGstin = party?.gstin || inv.customer?.gstin || 'Unregistered / B2C';
                          return (
                            <tr key={inv.id}>
                              <td style={{ fontWeight: 700, color: '#0369a1' }}>{inv.invoice_number}</td>
                              <td style={{ fontWeight: 500, color: '#334155' }}>{formatDate(inv.invoice_date)}</td>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                {partyName}
                                {inv.transport_name && (
                                  <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 500, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Truck size={12} /> {inv.transport_name} {inv.lr_number ? `(LR: ${inv.lr_number})` : ''} {inv.destination ? `• ${inv.destination}` : ''}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>{partyGstin}</td>
                              <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.total_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                                ₹ {parseFloat(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge badge-${inv.payment_status}`} style={{ textTransform: 'capitalize' }}>
                                  {inv.payment_status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => window.open(api.getInvoicePrintUrl(inv.id), '_blank')}
                                    title="Print A4 GST Tax Invoice"
                                    style={{ padding: '3px 8px', fontSize: '11px' }}
                                  >
                                    <Printer size={12} /> Print
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => window.open(api.getDeliveryChallanPrintUrl(inv.id), '_blank')}
                                    title="Print Rule 55 Delivery Challan (D.C.)"
                                    style={{ padding: '3px 8px', fontSize: '11px', background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}
                                  >
                                    <Truck size={12} /> D.C.
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    onClick={async () => {
                                      try {
                                        setLoading(true);
                                        const res = await api.sendInvoiceWhatsApp(inv.id);
                                        setNotification({ type: 'success', message: res.message || 'Invoice sent via WhatsApp!' });
                                      } catch (err) {
                                        const rawPhone = (party?.phone || '').replace(/\D/g, '');
                                        const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                                        if (cleanPhone) {
                                          const firmName = firms.find(f => f.id === firmId)?.name || 'APEX APPARELS & TEXTILES';
                                          const msg = `🧾 *Tax Invoice #${inv.invoice_number}* from ${firmName}.\nGrand Total: ₹${parseFloat(inv.grand_total).toFixed(2)}\nThank you for your business!`;
                                          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                        } else {
                                          setShowWhatsAppModal(true);
                                          setNotification({ type: 'error', message: err.message || 'Customer phone missing or WhatsApp bridge offline.' });
                                        }
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    title="Send invoice via WhatsApp"
                                    style={{ padding: '3px 8px', fontSize: '11px', background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
                                  >
                                    <Share2 size={12} /> WhatsApp
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ 1B. ADD SALE BILL VOUCHER (CREATE FORM) ═════════ */}
          {(activeTab === 'billing' || activeTab === 'daybook') && saleViewMode === 'create' && (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSaleViewMode('list')}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px' }}
                    title="Back to Sale Bills List"
                  >
                    <ArrowLeft size={13} /> Back to Bills
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px' }}
                    title={sidebarCollapsed ? "Expand Left Panel (Ctrl+B)" : "Minimize Left Panel for Full Width (Ctrl+B)"}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
                    <span>{sidebarCollapsed ? 'Expand Sidebar' : 'Wide Screen'}</span>
                  </button>
                  <Receipt size={18} style={{ color: '#0284c7' }} />
                  <h2 style={{ fontSize: '16px', color: '#0f2b48', margin: 0 }}>Sales Voucher Entry (Tax Invoice)</h2>
                  <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>
                    Active FY: {activeFYObj.id}
                  </span>
                </div>
                <button className="btn btn-success" onClick={handleSaveSaleInvoice} disabled={loading}>
                  <CheckCircle size={15} /> Save & Generate Tax Invoice (Ctrl+S)
                </button>
              </div>

              {/* Accurate ERP Hotkey Toolbar Banner */}
              <div style={{
                background: '#0f172a', color: '#f8fafc', padding: '8px 12px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                fontSize: '11.5px', fontWeight: 600, marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.5px' }}>⚡ Hotkeys:</span>
                  <span
                    style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}
                    onClick={() => {
                      const el = document.querySelector('[data-type="sale"][data-col="quantity"]');
                      if (el) { el.focus(); if (el.select) el.select(); }
                    }}
                    title="Focus First Quantity Input (F1)"
                  >
                    [F1: Change Qty]
                  </span>
                  <span
                    style={{
                      background: parkedBills.length > 0 ? '#b45309' : '#1e293b',
                      color: parkedBills.length > 0 ? '#fef08a' : '#cbd5e1',
                      border: parkedBills.length > 0 ? '1px solid #f59e0b' : '1px solid #334155',
                      padding: '2px 8px', borderRadius: '3px', cursor: 'pointer'
                    }}
                    onClick={() => {
                      const hasLines = saleLines.some(l => l.item_id || l.item_name);
                      if (hasLines) {
                        handleParkCurrentBill();
                      } else if (parkedBills.length > 0) {
                        setShowParkedBillsModal(true);
                      } else {
                        notify('No items to park on hold.', 'info');
                      }
                    }}
                    title="Hold/Park current bill (F2)"
                  >
                    [F2: Park Bill {parkedBills.length > 0 ? `(${parkedBills.length} on hold)` : ''}]
                  </span>
                  {parkedBills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowParkedBillsModal(true)}
                      style={{ background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '3px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Resume ({parkedBills.length})
                    </button>
                  )}
                  <span
                    style={{ background: '#1e293b', color: '#4ade80', border: '1px solid #166534', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}
                    onClick={() => {
                      setSalePaidAmount(saleTotals.grandTotal.toString());
                      setSaleCashAmount(saleTotals.grandTotal.toString());
                      notify('F3: Setting Full Cash Paid...', 'info');
                      setTimeout(() => handleSaveSaleInvoice(), 60);
                    }}
                    title="Instant Save Full Cash (F3)"
                  >
                    [F3: Cash Save]
                  </span>
                  <span
                    style={{ background: '#1e293b', color: '#f87171', border: '1px solid #991b1b', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}
                    onClick={() => {
                      setSalePaidAmount('0');
                      notify('F4: Setting Full Credit / Udhaari...', 'warning');
                      setTimeout(() => handleSaveSaleInvoice(), 60);
                    }}
                    title="Instant Save Full Credit (F4)"
                  >
                    [F4: Credit Save]
                  </span>
                  <span
                    style={{ background: '#1e293b', color: '#c084fc', border: '1px solid #581c87', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}
                    onClick={() => handleToggleSaleRateType(saleRateType === 'retail' ? 'wholesale' : 'retail')}
                    title="Toggle Pricing Rate Type (F6)"
                  >
                    [F6: Rate Type ({saleRateType.toUpperCase()})]
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Rate Type:</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSaleRateType('retail')}
                    style={{
                      padding: '3px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '3px', cursor: 'pointer',
                      background: saleRateType === 'retail' ? '#0284c7' : '#1e293b',
                      color: saleRateType === 'retail' ? '#ffffff' : '#94a3b8',
                      border: '1px solid #334155'
                    }}
                  >
                    Retail (MRP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSaleRateType('wholesale')}
                    style={{
                      padding: '3px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '3px', cursor: 'pointer',
                      background: saleRateType === 'wholesale' ? '#7c3aed' : '#1e293b',
                      color: saleRateType === 'wholesale' ? '#ffffff' : '#94a3b8',
                      border: '1px solid #334155'
                    }}
                  >
                    Wholesale (W/S)
                  </button>
                </div>
              </div>

              {/* Accurate ERP Live Outstanding Red Banner */}
              {customerOutstanding && (
                <div style={{
                  background: '#b91c1c', color: '#ffffff', padding: '9px 14px', borderRadius: '4px',
                  fontWeight: 800, fontSize: '16.5px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '12px', letterSpacing: '0.3px',
                  boxShadow: '0 2px 6px rgba(185, 28, 28, 0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={19} color="#fecaca" />
                    <span>Outstanding &gt;&gt; {customerOutstanding.formatted}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 600 }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      Unpaid Bills: {customerOutstanding.unpaid_invoices_count}
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      Last Bill: {customerOutstanding.last_invoice_date || 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {/* Invoice Metadata Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '170px 1.4fr 170px 180px', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Customer / Buyer *</label>
                    <button onClick={() => setShowPartyModal(true)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      + Add New Party
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="🔍 Filter customer by name, phone, city..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11.5px', marginBottom: '4px', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                  />
                  <select
                    id="sale-customer-select"
                    className="input-field"
                    style={{ fontSize: '14px', padding: '8px 10px', fontWeight: 600, width: '100%' }}
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    {customers
                      .filter(c => {
                        if (!customerSearchQuery.trim()) return true;
                        const q = customerSearchQuery.toLowerCase();
                        return (c.name || '').toLowerCase().includes(q) ||
                               (c.city || '').toLowerCase().includes(q) ||
                               (c.phone || '').includes(q) ||
                               (c.gstin || '').toLowerCase().includes(q);
                      })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.city ? `(${c.city})` : ''} {c.gstin ? `[GST: ${c.gstin}]` : '[Cash Buyer]'}
                        </option>
                      ))}
                  </select>

                  {/* Customer Side Preview Card */}
                  {selectedCustomer && (
                    <div style={{ marginTop: '5px', padding: '5px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '11px', color: '#475569', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span><strong>Prop:</strong> {selectedCustomer.contact_person || 'Self'}</span>
                      <span><strong>City:</strong> {selectedCustomer.city || selectedCustomer.state_name || 'Local'}</span>
                      <span><strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Place of Supply</label>
                  <input
                    type="text"
                    className="input-field"
                    value={salePlaceOfSupply}
                    onChange={(e) => setSalePlaceOfSupply(e.target.value)}
                    placeholder="27 (Maharashtra)"
                    style={{ fontSize: '13.5px', padding: '8px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Customer GSTIN</label>
                  <input
                    type="text"
                    className="input-field"
                    readOnly
                    value={selectedCustomer?.gstin || 'Unregistered / B2C'}
                    style={{ background: '#f8fafc', color: '#64748b', fontSize: '13px', padding: '8px 10px' }}
                  />
                </div>
              </div>

              {/* Transport & Dispatch Details Row */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Truck size={17} color="#0284c7" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f2b48' }}>
                    Transport & Dispatch Details (L.R. / Bilty / Vehicle / Bales)
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>(Optional for B2B Goods Delivery & E-Way Bill)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Transporter Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Navata / V-Trans / ARC"
                      value={saleTransport.transport_name}
                      onChange={(e) => setSaleTransport({ ...saleTransport, transport_name: e.target.value })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Vehicle / Tempo No.
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. MH-12-AB-1234"
                      value={saleTransport.vehicle_number}
                      onChange={(e) => setSaleTransport({ ...saleTransport, vehicle_number: e.target.value.toUpperCase() })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      L.R. No. (Bilty No)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. LR-99824"
                      value={saleTransport.lr_number}
                      onChange={(e) => setSaleTransport({ ...saleTransport, lr_number: e.target.value })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      L.R. Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={saleTransport.lr_date}
                      onChange={(e) => setSaleTransport({ ...saleTransport, lr_date: e.target.value })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Destination / Station
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Solapur / Pune"
                      value={saleTransport.destination}
                      onChange={(e) => setSaleTransport({ ...saleTransport, destination: e.target.value })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      No. of Bales / Cases
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 1 Bale / 2 Boxes"
                      value={saleTransport.number_of_parcels}
                      onChange={(e) => setSaleTransport({ ...saleTransport, number_of_parcels: e.target.value })}
                      style={{ fontSize: '13.5px', padding: '7px 10px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Spreadsheet Grid Table */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Category Filter Toolbar */}
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Filter Section / Category:</span>
                  <select
                    className="input-field"
                    value={saleCategoryFilter}
                    onChange={(e) => setSaleCategoryFilter(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '13.5px', width: '240px', fontWeight: 600 }}
                  >
                    <option value="ALL">All Sections (Total {items.length} items)</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({items.filter(it => it.category === cat).length} items)
                      </option>
                    ))}
                  </select>
                  {saleCategoryFilter !== 'ALL' && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setSaleCategoryFilter('ALL')}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '12.5px', color: '#475569' }}>
                  ⚡ Press <b>Enter</b> to advance: Size → Color → Qty → MRP → Rate → CD1 → CD2 → CD3 → Remarks. Enter on Remarks adds next row!
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="accounting-table" style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ width: '32px', textAlign: 'center', fontSize: '12px' }}>#</th>
                      <th style={{ width: '140px', fontSize: '12px' }}>Section / Category</th>
                      <th style={{ minWidth: '220px', fontSize: '12px' }}>Item Description *</th>
                      <th style={{ width: '65px', textAlign: 'center', fontSize: '12px' }}>Size</th>
                      <th style={{ width: '70px', textAlign: 'center', fontSize: '12px' }}>Color</th>
                      <th style={{ width: '65px', textAlign: 'right', fontSize: '12px' }}>Qty</th>
                      <th style={{ width: '50px', textAlign: 'center', fontSize: '12px' }}>Unit</th>
                      <th style={{ width: '85px', textAlign: 'right', fontSize: '12px' }}>MRP (₹)*</th>
                      <th style={{ width: '85px', textAlign: 'right', fontSize: '12px' }}>Rate (₹)</th>
                      <th style={{ width: '58px', textAlign: 'right', fontSize: '12px' }}>CD 1 %</th>
                      <th style={{ width: '58px', textAlign: 'right', fontSize: '12px' }}>CD 2 %</th>
                      <th style={{ width: '58px', textAlign: 'right', fontSize: '12px' }}>CD 3 %</th>
                      <th style={{ width: '90px', textAlign: 'right', fontSize: '12px' }}>Taxable (₹)</th>
                      <th style={{ width: '55px', textAlign: 'center', fontSize: '12px' }}>GST %</th>
                      <th style={{ width: '95px', textAlign: 'right', fontSize: '12px' }}>Total (₹)</th>
                      <th style={{ width: '100px', fontSize: '12px' }}>Remarks</th>
                      <th style={{ width: '32px', textAlign: 'center', fontSize: '12px' }}>X</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleLines.map((line, idx) => {
                      const calc = saleTotals.rowCalcs[idx] || { taxable: 0, total: 0 };
                      const effectiveCat = line.category || saleCategoryFilter;
                      const rowItems = effectiveCat && effectiveCat !== 'ALL' 
                        ? items.filter(it => it.category === effectiveCat)
                        : items;
                      const isMrpBlank = (!line.mrp || parseFloat(line.mrp) <= 0) && (line.item_id || line.item_name);

                      return (
                        <tr key={idx} className="anim-row-enter" style={{ background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '13px' }}>{idx + 1}</td>
                          
                          {/* Category / Section */}
                          <td>
                            <select
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="category"
                              style={{ padding: '5px 7px', fontSize: '12.5px', width: '100%', fontWeight: 600 }}
                              value={line.category || 'READYMADE GARMENTS'}
                              onChange={(e) => {
                                if (e.target.value === '__ADD_NEW__') {
                                  setActiveCategoryTarget({ rowIndex: idx, isPurchase: false });
                                  setShowCategoryModal(true);
                                  return;
                                }
                                updateSaleLine(idx, 'category', e.target.value);
                                const selItem = items.find(it => it.id === parseInt(line.item_id));
                                if (selItem && selItem.category !== e.target.value) {
                                  updateSaleLine(idx, 'item_id', '');
                                  updateSaleLine(idx, 'item_name', '');
                                }
                                setTimeout(() => {
                                  const itemEl = document.querySelector(`[data-type="sale"][data-row="${idx}"][data-col="item"]`);
                                  if (itemEl) {
                                    itemEl.focus();
                                    try { itemEl.showPicker?.(); } catch (err) {}
                                  }
                                }, 50);
                              }}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'category', false)}
                            >
                              <option value="__ADD_NEW__" style={{ fontWeight: 700, color: '#0284c7' }}>
                                + Add New Section / Category...
                              </option>
                              {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>

                          {/* Item Description */}
                          <td>
                            <select
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="item"
                              style={{ 
                                padding: '5px 7px', fontSize: '13px', width: '100%',
                                borderColor: !line.item_id && !line.item_name ? '#cbd5e1' : '#0284c7',
                                fontWeight: line.item_id ? 700 : 400
                              }}
                              value={line.item_id}
                              onChange={(e) => handleSaleItemSelect(idx, e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'item', false)}
                            >
                              <option value="">-- Choose Item ({rowItems.length} items in {line.category || 'Section'}) --</option>
                              {rowItems.slice(0, 350).map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} {it.size ? `[${it.size}]` : ''} - MRP: ₹{parseFloat(it.mrp || 0).toFixed(0)} | Stock: {parseFloat(it.current_stock).toFixed(0)} {it.primary_uom}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Size */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="size"
                              placeholder="Size"
                              style={{ padding: '5px 5px', fontSize: '13px', textAlign: 'center', width: '100%', fontWeight: 600 }}
                              value={line.size || ''}
                              onChange={(e) => updateSaleLine(idx, 'size', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'size', false)}
                            />
                          </td>

                          {/* Color */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="color"
                              placeholder="Color"
                              style={{ padding: '5px 5px', fontSize: '12px', textAlign: 'center', width: '100%' }}
                              value={line.color || ''}
                              onChange={(e) => updateSaleLine(idx, 'color', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'color', false)}
                            />
                          </td>

                          {/* Quantity */}
                          <td>
                            <input
                              type="number"
                              step="1"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="quantity"
                              style={{ padding: '5px 5px', fontSize: '14px', textAlign: 'right', fontWeight: 700, width: '100%' }}
                              value={line.quantity}
                              onChange={(e) => updateSaleLine(idx, 'quantity', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'quantity', false)}
                            />
                          </td>

                          {/* Unit */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="uom"
                              style={{ padding: '5px 5px', fontSize: '12px', textAlign: 'center', width: '100%', background: '#f8fafc' }}
                              value={line.uom || 'Pcs'}
                              onChange={(e) => updateSaleLine(idx, 'uom', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'uom', false)}
                            />
                          </td>

                          {/* MRP (Required - cannot be blank!) */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="mrp"
                              placeholder="MRP*"
                              title={isMrpBlank ? "MRP is required and cannot be blank!" : "Maximum Retail Price"}
                              style={{ 
                                padding: '5px 5px', fontSize: '14px', textAlign: 'right', fontWeight: 700, width: '100%',
                                borderColor: isMrpBlank ? '#ef4444' : '#cbd5e1',
                                background: isMrpBlank ? '#fef2f2' : '#ffffff'
                              }}
                              value={line.mrp}
                              onChange={(e) => updateSaleLine(idx, 'mrp', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'mrp', false)}
                            />
                          </td>

                          {/* Rate */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="rate"
                              placeholder="Rate"
                              style={{ padding: '5px 5px', fontSize: '14px', textAlign: 'right', fontWeight: 700, width: '100%' }}
                              value={line.rate}
                              onChange={(e) => updateSaleLine(idx, 'rate', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'rate', false)}
                            />
                          </td>

                          {/* CD 1 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="cd1_percent"
                              placeholder="0.0"
                              style={{ padding: '5px 4px', fontSize: '12.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd1_percent}
                              onChange={(e) => updateSaleLine(idx, 'cd1_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd1_percent', false)}
                            />
                          </td>

                          {/* CD 2 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="cd2_percent"
                              placeholder="0.0"
                              style={{ padding: '5px 4px', fontSize: '12.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd2_percent}
                              onChange={(e) => updateSaleLine(idx, 'cd2_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd2_percent', false)}
                            />
                          </td>

                          {/* CD 3 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="cd3_percent"
                              placeholder="0.0"
                              style={{ padding: '5px 4px', fontSize: '12.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd3_percent}
                              onChange={(e) => updateSaleLine(idx, 'cd3_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd3_percent', false)}
                            />
                          </td>

                          {/* Taxable */}
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px' }}>
                            <span key={calc.taxable.toFixed(2)} className="anim-value-change">
                              ₹{calc.taxable.toFixed(2)}
                            </span>
                          </td>

                          {/* GST % */}
                          <td style={{ textAlign: 'center', color: '#0284c7', fontWeight: 700, fontSize: '12.5px' }}>
                            {line.gst_rate}%
                          </td>

                          {/* Total */}
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>
                            <span key={calc.total.toFixed(2)} className="anim-value-change">
                              ₹{calc.total.toFixed(2)}
                            </span>
                          </td>

                          {/* Remarks (Press Enter adds next row) */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="sale"
                              data-row={idx}
                              data-col="remarks"
                              placeholder="Note"
                              title="Press Enter to add next row"
                              style={{ padding: '5px 6px', fontSize: '12px', width: '100%' }}
                              value={line.remarks || ''}
                              onChange={(e) => updateSaleLine(idx, 'remarks', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'remarks', false)}
                            />
                          </td>

                          {/* Remove */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => removeSaleLine(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                              title="Remove Line"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={addSaleLine}>
                  + Add Next Row (Enter on Remarks)
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowItemModal(true)}>
                  + Create Product Master
                </button>
              </div>
            </div>

            {/* Bottom Summary & Tax Calculation Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '10px', color: '#0f2b48' }}>Payment / Receipt Settlement & Freight</h4>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {['cash', 'upi', 'bank_transfer', 'credit'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSalePaymentMode(m);
                        if (m === 'credit') {
                          setSalePaidAmount('0');
                        } else if (salePaidAmount === '0' || salePaidAmount === '') {
                          setSalePaidAmount(saleTotals.grandTotal.toString());
                        }
                      }}
                      style={{
                        flex: 1, padding: '7px', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase',
                        borderRadius: '3px', cursor: 'pointer',
                        border: salePaymentMode === m ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: salePaymentMode === m ? '#e0f2fe' : '#ffffff',
                        color: salePaymentMode === m ? '#0284c7' : '#475569',
                      }}
                    >
                      {m === 'credit' ? 'Udhaari (Credit)' : m}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Transport / Freight Charges (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={saleTransportCharges}
                      onChange={(e) => setSaleTransportCharges(e.target.value)}
                      style={{ fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Advance Received (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={saleAdvanceAmount}
                      onChange={(e) => setSaleAdvanceAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Amount Paid / Received (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder={`Full: ₹${saleTotals.grandTotal}`}
                      value={salePaidAmount}
                      onChange={(e) => setSalePaidAmount(e.target.value)}
                      style={{ fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Balance Outstanding / Udhaari (₹)</label>
                    <input
                      type="text"
                      className="input-field"
                      readOnly
                      style={{ background: '#fef2f2', fontWeight: 800, color: '#b91c1c' }}
                      value={`₹ ${(salePaidAmount !== '' ? Math.max(0, saleTotals.grandTotal - parseFloat(salePaidAmount || 0) - parseFloat(saleAdvanceAmount || 0)) : 0).toFixed(2)}`}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Bill Remarks / Narration
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Delivered via tempo / Payment promised within 15 days"
                    value={saleRemarks}
                    onChange={(e) => setSaleRemarks(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>
              </div>

              {/* Tax Calculation Breakdown */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '14.5px', color: '#1e293b' }}>
                  Tax Calculation Breakdown (5% GST)
                </div>

                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                    <span style={{ color: '#475569' }}>Taxable Amount:</span>
                    <span key={saleTotals.subtotal.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {saleTotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                    <span style={{ color: '#475569' }}>CGST @ 2.50%:</span>
                    <span key={saleTotals.cgst.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {saleTotals.cgst.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                    <span style={{ color: '#475569' }}>SGST @ 2.50%:</span>
                    <span key={saleTotals.sgst.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {saleTotals.sgst.toFixed(2)}</span>
                  </div>
                  {saleTotals.freight > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                      <span style={{ color: '#475569' }}>Freight / Transport:</span>
                      <span key={saleTotals.freight.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {saleTotals.freight.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                    <span style={{ color: '#475569' }}>Round Off:</span>
                    <span key={saleTotals.roundOff.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {saleTotals.roundOff.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '22px', fontWeight: 800, color: '#0f2b48', borderTop: '2px dashed #94a3b8', paddingTop: '10px', marginTop: '6px' }}>
                    <span>Grand Total:</span>
                    <span key={saleTotals.grandTotal.toFixed(2)} className="anim-value-change" style={{ color: '#0284c7', fontSize: '24px' }}>
                      ₹ {saleTotals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 2. PURCHASE BILL (F9 / PURCHASE VOUCHERS) ═════════ */}
        {(activeTab === 'purchase_entry' || activeTab === 'purchases') && purchaseViewMode === 'list' && (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
              {/* Header with Title on Left and + Add Purchase Bill Button on Top Right Corner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={20} color="#0f766e" />
                    <h2 style={{ fontSize: '16px', color: '#0f172a', margin: 0, fontWeight: 700 }}>
                      Purchase Bills (Inward Stock Bills)
                    </h2>
                    <span className="badge badge-teal" style={{ padding: '2px 8px' }}>
                      {activeFYObj.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                    Showing <strong>{filteredPurchaseInvoices.length}</strong> of {purchaseInvoices.length} bills date-wise
                  </div>
                </div>

                {/* TOP RIGHT CORNER: Option to Add Bill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => { setPurchaseViewMode('create'); setSidebarCollapsed(true); }}
                    style={{ background: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 600 }}
                    title="Create New Purchase Bill (F9) (Auto-minimizes sidebar for wide table)"
                  >
                    <Plus size={15} /> + Add Purchase Bill (F9)
                  </button>
                </div>
              </div>

              {/* Search & Date Filter Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
                padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Search by Vendor / Bill No / Date */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Search by vendor, bill no, date..."
                      value={purchaseSearch}
                      onChange={(e) => setPurchaseSearch(e.target.value)}
                      style={{ width: '270px', paddingLeft: '28px', fontSize: '12px', padding: '6px 8px 6px 28px' }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                    {purchaseSearch && (
                      <button
                        onClick={() => setPurchaseSearch('')}
                        style={{ position: 'absolute', right: '8px', top: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Date Filter Picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>Date:</span>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="date"
                        className="input-field"
                        value={purchaseDateFilter}
                        onChange={(e) => setPurchaseDateFilter(e.target.value)}
                        title="Filter by specific bill date"
                        style={{ width: '145px', fontSize: '12px', padding: '5px 8px' }}
                      />
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  {(purchaseSearch || purchaseDateFilter) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setPurchaseSearch(''); setPurchaseDateFilter(''); }}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Ordered: <strong>Latest Date First</strong>
                </div>
              </div>

              {/* Date-wise Purchase Bills Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="accounting-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Bill No</th>
                      <th style={{ width: '105px' }}>Bill Date</th>
                      <th>Supplier / Vendor Name</th>
                      <th style={{ width: '160px' }}>Supplier GSTIN</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Taxable (₹)</th>
                      <th style={{ width: '95px', textAlign: 'right' }}>Input Tax (₹)</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Bill Total (₹)</th>
                      <th style={{ width: '95px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchaseInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                          <ShoppingCart size={36} style={{ margin: '0 auto 8px auto', opacity: 0.35 }} />
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>No purchase bills found</div>
                          <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                            {purchaseSearch || purchaseDateFilter ? 'Try clearing the search or date filters.' : 'Click "+ Add Purchase Bill" to record your first inward stock bill.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPurchaseInvoices.map((inv) => {
                        const party = inv.customer || customers.find((c) => c.id === inv.customer_id);
                        const partyName = party?.name || inv.customer?.name || 'Cash Supplier';
                        const partyGstin = party?.gstin || inv.customer?.gstin || 'Unregistered';
                        return (
                          <tr key={inv.id}>
                            <td style={{ fontWeight: 700, color: '#0f766e' }}>{inv.invoice_number}</td>
                            <td style={{ fontWeight: 500, color: '#334155' }}>{formatDate(inv.invoice_date)}</td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{partyName}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>{partyGstin}</td>
                            <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.total_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                              ₹ {parseFloat(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge badge-${inv.payment_status}`} style={{ textTransform: 'capitalize' }}>
                                {inv.payment_status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => window.open(api.getInvoicePrintUrl(inv.id), '_blank')}
                                  title="Print Purchase Bill Voucher"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  <Printer size={12} /> Print
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCopyPurchaseToBilling(inv)}
                                  title="Copy this Purchase Bill items to Sales Voucher (Billing)"
                                  style={{ padding: '3px 8px', fontSize: '11px', background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                                >
                                  <Share2 size={12} /> Copy to Billing
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 2B. ADD PURCHASE BILL VOUCHER (CREATE FORM) ═════════ */}
        {(activeTab === 'purchase_entry' || activeTab === 'purchases') && purchaseViewMode === 'create' && (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPurchaseViewMode('list')}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px' }}
                    title="Back to Purchase Bills List"
                  >
                    <ArrowLeft size={13} /> Back to Bills
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px' }}
                    title={sidebarCollapsed ? "Expand Left Panel (Ctrl+B)" : "Minimize Left Panel for Full Width (Ctrl+B)"}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
                    <span>{sidebarCollapsed ? 'Expand Sidebar' : 'Wide Screen'}</span>
                  </button>
                  <ShoppingCart size={18} style={{ color: '#0f766e' }} />
                  <h2 style={{ fontSize: '16px', color: '#0f2b48', margin: 0 }}>Purchase Voucher Entry (Inward Stock Bill)</h2>
                  <span style={{ fontSize: '11px', background: '#ccfbf1', color: '#0f766e', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>
                    Active FY: {activeFYObj.id}
                  </span>
                </div>
                <button className="btn btn-success" onClick={handleSavePurchaseBill} disabled={loading} style={{ background: '#0f766e' }}>
                  <CheckCircle size={15} /> Save Purchase Bill & Update Stock (Ctrl+S)
                </button>
              </div>

              {/* Accurate ERP Live Payable Crimson Banner */}
              {vendorOutstanding && (
                <div style={{
                  background: '#991b1b', color: '#ffffff', padding: '9px 14px', borderRadius: '4px',
                  fontWeight: 800, fontSize: '16.5px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '12px', letterSpacing: '0.3px',
                  boxShadow: '0 2px 6px rgba(153, 27, 27, 0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={19} color="#fecaca" />
                    <span>Payable Amount &gt;&gt; {vendorOutstanding.formatted}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 600 }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      Unpaid Bills: {vendorOutstanding.unpaid_invoices_count}
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      Last Bill: {vendorOutstanding.last_invoice_date || 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {/* Purchase Metadata & Dual Bill Tracking Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 170px 150px 150px 170px', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Supplier / Vendor *</label>
                    <button onClick={() => setShowPartyModal(true)} style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      + Add New Supplier
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="🔍 Filter supplier by name, phone, city..."
                    value={vendorSearchQuery}
                    onChange={(e) => setVendorSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11.5px', marginBottom: '4px', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                  />
                  <select
                    id="purchase-vendor-select"
                    className="input-field"
                    style={{ fontSize: '14px', padding: '8px 10px', fontWeight: 600, width: '100%' }}
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    {customers
                      .filter(c => {
                        if (!vendorSearchQuery.trim()) return true;
                        const q = vendorSearchQuery.toLowerCase();
                        return (c.name || '').toLowerCase().includes(q) ||
                               (c.city || '').toLowerCase().includes(q) ||
                               (c.billing_address || '').toLowerCase().includes(q) ||
                               (c.phone || '').includes(q) ||
                               (c.gstin || '').toLowerCase().includes(q);
                      })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.billing_address ? `• 📍 ${c.billing_address}` : (c.city ? `(${c.city})` : '')} {c.gstin ? `[GST: ${c.gstin}]` : '[Cash Supplier]'}
                        </option>
                      ))}
                  </select>

                  {/* Supplier Side Preview Card */}
                  {selectedVendor && (
                    <div style={{ marginTop: '5px', padding: '5px 8px', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '3px', fontSize: '11px', color: '#0f766e', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span><strong>Prop:</strong> {selectedVendor.contact_person || 'Self'}</span>
                      <span><strong>City:</strong> {selectedVendor.city || selectedVendor.state_name || 'Local'}</span>
                      <span><strong>Phone:</strong> {selectedVendor.phone || 'N/A'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Supplier Bill No *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. SG-6677PTC / 971"
                    value={purchaseBillNumber}
                    onChange={(e) => setPurchaseBillNumber(e.target.value)}
                    style={{ fontSize: '13.5px', padding: '8px 10px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Supplier Bill Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={purchaseVendorBillDate}
                    onChange={(e) => setPurchaseVendorBillDate(e.target.value)}
                    style={{ fontSize: '13px', padding: '8px 8px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Inward Recd Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={purchaseRecdDate}
                    onChange={(e) => setPurchaseRecdDate(e.target.value)}
                    style={{ fontSize: '13px', padding: '8px 8px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Supplier GSTIN
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    readOnly
                    value={selectedVendor?.gstin || 'Unregistered Supplier'}
                    style={{ background: '#f8fafc', color: '#64748b', fontSize: '13px', padding: '8px 10px' }}
                  />
                </div>
              </div>
            </div>

            {/* Purchase Spreadsheet Grid */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Category Filter Toolbar */}
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Filter Section / Category:</span>
                  <select
                    className="input-field"
                    value={purchaseCategoryFilter}
                    onChange={(e) => setPurchaseCategoryFilter(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '13.5px', width: '240px', fontWeight: 600 }}
                  >
                    <option value="ALL">All Sections (Total {items.length} items)</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({items.filter(it => it.category === cat).length} items)
                      </option>
                    ))}
                  </select>
                  {purchaseCategoryFilter !== 'ALL' && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setPurchaseCategoryFilter('ALL')}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  ⚡ Press <b>Enter</b> to advance between Size, Color, Qty, MRP, Rate, CD1, CD2, CD3, Remarks. Enter on Remarks adds next row!
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="accounting-table" style={{ width: '100%', minWidth: '1350px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ width: '36px', textAlign: 'center', fontSize: '13px' }}>#</th>
                      <th style={{ width: '150px', fontSize: '13px' }}>Section / Category</th>
                      <th style={{ minWidth: '220px', fontSize: '13px' }}>Product / Material Purchased *</th>
                      <th style={{ width: '70px', textAlign: 'center', fontSize: '13px' }}>Size</th>
                      <th style={{ width: '80px', textAlign: 'center', fontSize: '13px' }}>Color</th>
                      <th style={{ width: '70px', textAlign: 'right', fontSize: '13px' }}>Qty</th>
                      <th style={{ width: '55px', textAlign: 'center', fontSize: '13px' }}>Unit</th>
                      <th style={{ width: '90px', textAlign: 'right', fontSize: '13px' }}>MRP (₹)*</th>
                      <th style={{ width: '90px', textAlign: 'right', fontSize: '13px' }}>Rate (₹)</th>
                      <th style={{ width: '65px', textAlign: 'right', fontSize: '13px' }}>CD 1 %</th>
                      <th style={{ width: '65px', textAlign: 'right', fontSize: '13px' }}>CD 2 %</th>
                      <th style={{ width: '65px', textAlign: 'right', fontSize: '13px' }}>CD 3 %</th>
                      <th style={{ width: '100px', textAlign: 'right', fontSize: '13px' }}>Taxable (₹)</th>
                      <th style={{ width: '60px', textAlign: 'center', fontSize: '13px' }}>GST %</th>
                      <th style={{ width: '105px', textAlign: 'right', fontSize: '13px' }}>Total (₹)</th>
                      <th style={{ width: '110px', fontSize: '13px' }}>Remarks</th>
                      <th style={{ width: '36px', textAlign: 'center', fontSize: '13px' }}>X</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseLines.map((line, idx) => {
                      const calc = purchaseTotals.rowCalcs[idx] || { taxable: 0, total: 0 };
                      const effectiveCat = line.category || purchaseCategoryFilter;
                      const rowItems = effectiveCat && effectiveCat !== 'ALL' 
                        ? items.filter(it => it.category === effectiveCat)
                        : items;
                      const isMrpBlank = (!line.mrp || parseFloat(line.mrp) <= 0) && (line.item_id || line.item_name);

                      return (
                        <tr key={idx} className="anim-row-enter" style={{ background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '14px' }}>{idx + 1}</td>
                          
                          {/* Category / Section */}
                          <td>
                            <select
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="category"
                              style={{ padding: '6px 8px', fontSize: '13px', width: '100%', fontWeight: 600 }}
                              value={line.category || 'READYMADE GARMENTS'}
                              onChange={(e) => {
                                if (e.target.value === '__ADD_NEW__') {
                                  setActiveCategoryTarget({ rowIndex: idx, isPurchase: true });
                                  setShowCategoryModal(true);
                                  return;
                                }
                                updatePurchaseLine(idx, 'category', e.target.value);
                                const selItem = items.find(it => it.id === parseInt(line.item_id));
                                if (selItem && selItem.category !== e.target.value) {
                                  updatePurchaseLine(idx, 'item_id', '');
                                  updatePurchaseLine(idx, 'item_name', '');
                                }
                                setTimeout(() => {
                                  const itemEl = document.querySelector(`[data-type="pur"][data-row="${idx}"][data-col="item"]`);
                                  if (itemEl) {
                                    itemEl.focus();
                                    try { itemEl.showPicker?.(); } catch (err) {}
                                  }
                                }, 50);
                              }}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'category', true)}
                            >
                              <option value="__ADD_NEW__" style={{ fontWeight: 700, color: '#0f766e' }}>
                                + Add New Section / Category...
                              </option>
                              {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>

                          {/* Item Description */}
                          <td>
                            <select
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="item"
                              style={{ 
                                padding: '6px 8px', fontSize: '14px', width: '100%',
                                borderColor: !line.item_id && !line.item_name ? '#cbd5e1' : '#0f766e',
                                fontWeight: line.item_id ? 700 : 400
                              }}
                              value={line.item_id}
                              onChange={(e) => handlePurchaseItemSelect(idx, e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'item', true)}
                            >
                              <option value="">-- Choose Item ({rowItems.length} items in {line.category || 'Section'}) --</option>
                              {rowItems.slice(0, 350).map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} {it.size ? `[Size: ${it.size}]` : ''} - MRP: ₹{parseFloat(it.mrp || 0).toFixed(0)} | Stock: {parseFloat(it.current_stock).toFixed(0)} {it.primary_uom}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Size */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="size"
                              placeholder="Size"
                              style={{ padding: '6px 6px', fontSize: '13.5px', textAlign: 'center', width: '100%', fontWeight: 600 }}
                              value={line.size || ''}
                              onChange={(e) => updatePurchaseLine(idx, 'size', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'size', true)}
                            />
                          </td>

                          {/* Color */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="color"
                              placeholder="Color"
                              style={{ padding: '6px 6px', fontSize: '13px', textAlign: 'center', width: '100%', fontWeight: 500 }}
                              value={line.color || ''}
                              onChange={(e) => updatePurchaseLine(idx, 'color', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'color', true)}
                            />
                          </td>

                          {/* Quantity */}
                          <td>
                            <input
                              type="number"
                              step="1"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="quantity"
                              style={{ padding: '6px 6px', fontSize: '15px', textAlign: 'right', fontWeight: 700, width: '100%' }}
                              value={line.quantity}
                              onChange={(e) => updatePurchaseLine(idx, 'quantity', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'quantity', true)}
                            />
                          </td>

                          {/* Unit */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="uom"
                              style={{ padding: '6px 6px', fontSize: '13px', textAlign: 'center', width: '100%', background: '#f8fafc' }}
                              value={line.uom || 'Pcs'}
                              onChange={(e) => updatePurchaseLine(idx, 'uom', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'uom', true)}
                            />
                          </td>

                          {/* MRP (Required - cannot be blank!) */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="mrp"
                              placeholder="MRP*"
                              title={isMrpBlank ? "MRP is required and cannot be blank!" : "Maximum Retail Price"}
                              style={{ 
                                padding: '6px 6px', fontSize: '15px', textAlign: 'right', fontWeight: 700, width: '100%',
                                borderColor: isMrpBlank ? '#ef4444' : '#cbd5e1',
                                background: isMrpBlank ? '#fef2f2' : '#ffffff'
                              }}
                              value={line.mrp}
                              onChange={(e) => updatePurchaseLine(idx, 'mrp', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'mrp', true)}
                            />
                          </td>

                          {/* Purchase Rate */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="rate"
                              placeholder="Rate"
                              style={{ padding: '6px 6px', fontSize: '15px', textAlign: 'right', fontWeight: 700, width: '100%' }}
                              value={line.rate}
                              onChange={(e) => updatePurchaseLine(idx, 'rate', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'rate', true)}
                            />
                          </td>

                          {/* CD 1 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="cd1_percent"
                              placeholder="0.0"
                              style={{ padding: '6px 6px', fontSize: '13.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd1_percent}
                              onChange={(e) => updatePurchaseLine(idx, 'cd1_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd1_percent', true)}
                            />
                          </td>

                          {/* CD 2 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="cd2_percent"
                              placeholder="0.0"
                              style={{ padding: '6px 6px', fontSize: '13.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd2_percent}
                              onChange={(e) => updatePurchaseLine(idx, 'cd2_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd2_percent', true)}
                            />
                          </td>

                          {/* CD 3 % */}
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="cd3_percent"
                              placeholder="0.0"
                              style={{ padding: '6px 6px', fontSize: '13.5px', textAlign: 'right', width: '100%', fontWeight: 600 }}
                              value={line.cd3_percent}
                              onChange={(e) => updatePurchaseLine(idx, 'cd3_percent', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'cd3_percent', true)}
                            />
                          </td>

                          {/* Taxable */}
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14.5px' }}>
                            <span key={calc.taxable.toFixed(2)} className="anim-value-change">
                              ₹{calc.taxable.toFixed(2)}
                            </span>
                          </td>

                          {/* GST % */}
                          <td style={{ textAlign: 'center', color: '#0f766e', fontWeight: 700, fontSize: '13.5px' }}>
                            {line.gst_rate}%
                          </td>

                          {/* Total */}
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15.5px', color: '#0f172a' }}>
                            <span key={calc.total.toFixed(2)} className="anim-value-change">
                              ₹{calc.total.toFixed(2)}
                            </span>
                          </td>

                          {/* Remarks / Item Note */}
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              data-type="pur"
                              data-row={idx}
                              data-col="remarks"
                              placeholder="Note"
                              title="Press Enter on Remarks to add next row"
                              style={{ padding: '6px 6px', fontSize: '12.5px', width: '100%' }}
                              value={line.remarks || ''}
                              onChange={(e) => updatePurchaseLine(idx, 'remarks', e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, idx, 'remarks', true)}
                            />
                          </td>

                          {/* Remove */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => removePurchaseLine(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                              title="Remove Line"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={addPurchaseLine}>
                  + Add Next Row (Enter on Remarks)
                </button>
                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                  Saving will automatically increment physical warehouse stock
                </div>
              </div>
            </div>

            {/* Purchase Totals Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
                <h4 style={{ fontSize: '13.5px', marginBottom: '10px', color: '#0f2b48', fontWeight: 700 }}>Stock Inward Freight & Narration</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Inward Freight / Transport (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={purchaseTransportCharges}
                      onChange={(e) => setPurchaseTransportCharges(e.target.value)}
                      style={{ fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Transport Name / Bilty No.
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. V-Trans / 8492"
                      value={purchaseRemarks}
                      onChange={(e) => setPurchaseRemarks(e.target.value)}
                      style={{ fontSize: '12.5px' }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                  Items inwarded will automatically increase inventory stock balances and update purchase cost history.
                </p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                  Purchase Bill Summary (5% Input Tax Credit)
                </div>

                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#475569' }}>Taxable Purchase:</span>
                    <span key={purchaseTotals.subtotal.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {purchaseTotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#475569' }}>Input CGST (2.50%):</span>
                    <span key={purchaseTotals.cgst.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {purchaseTotals.cgst.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#475569' }}>Input SGST (2.50%):</span>
                    <span key={purchaseTotals.sgst.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {purchaseTotals.sgst.toFixed(2)}</span>
                  </div>
                  {purchaseTotals.freight > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#475569' }}>Inward Freight:</span>
                      <span key={purchaseTotals.freight.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {purchaseTotals.freight.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#475569' }}>Round Off:</span>
                    <span key={purchaseTotals.roundOff.toFixed(2)} className="anim-value-change" style={{ fontWeight: 600 }}>₹ {purchaseTotals.roundOff.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 800, color: '#0f2b48', borderTop: '2px dashed #94a3b8', paddingTop: '10px', marginTop: '6px' }}>
                    <span>Total Bill Amount:</span>
                    <span key={purchaseTotals.grandTotal.toFixed(2)} className="anim-value-change" style={{ color: '#0f766e', fontSize: '22px' }}>₹ {purchaseTotals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 4. GOODS RETURN VOUCHERS (CREDIT & DEBIT NOTES - PHASE 2) ═════════ */}
        {activeTab === 'returns' && (
          <GoodsReturnVouchers
            firmId={firmId}
            firms={firms}
            customers={customers}
            items={items}
            notify={notify}
            onOpenLedger={(cid) => {
              setSelectedLedgerCustomerId(cid);
              setActiveTab('ledger');
            }}
            initialType={returnInitialType}
            onBackToDesk={() => setActiveTab('desk')}
          />
        )}

        {/* ═════════ 4.5 ACCOUNTS VOUCHERS (RECEIPT & PAYMENT - PHASE 3) ═════════ */}
        {activeTab === 'accounts_vouchers' && (
          <AccountsVouchers
            firmId={firmId}
            firms={firms}
            customers={customers}
            notify={notify}
            onOpenLedger={(cid) => {
              setSelectedLedgerCustomerId(cid);
              setActiveTab('ledger');
            }}
            initialType={accountsVoucherInitialType}
            onBackToDesk={() => setActiveTab('desk')}
          />
        )}

        {/* ═════════ 4.6 GARMENT BARCODE GENERATOR (PHASE 4) ═════════ */}
        {activeTab === 'barcode_generator' && (
          <BarcodeGenerator
            firmId={firmId}
            firms={firms}
            items={items}
            notify={notify}
            initialItems={barcodeInitialItems}
            onBackToDesk={() => setActiveTab('desk')}
          />
        )}

        {/* ═════════ 4.7 ACCURATE DAYBOOK & CASH REGISTER (PHASE 4) ═════════ */}
        {activeTab === 'daybook_analytics' && (
          <DaybookAnalytics
            firmId={firmId}
            firms={firms}
            notify={notify}
            onOpenLedger={(cid) => {
              setSelectedLedgerCustomerId(cid);
              setActiveTab('ledger');
            }}
            onOpenBarcode={(it) => {
              setBarcodeInitialItems([it]);
              setActiveTab('barcode_generator');
            }}
            onBackToDesk={() => setActiveTab('desk')}
          />
        )}


        {/* ═════════ 5. ITEM MASTER CATALOG ═════════ */}
        {activeTab === 'items' && (
          <div className="anim-view-enter" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', color: '#0f2b48' }}>Item Master Catalog</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Total {items.length} items imported from Accurate ERP across {categories.length} Sections | Default 5% GST
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Section filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Section:</label>
                  <select
                    className="input-field"
                    value={itemCategoryFilter}
                    onChange={(e) => setItemCategoryFilter(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: '12px', width: '200px', fontWeight: 600 }}
                  >
                    <option value="ALL">All Sections ({items.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({items.filter(it => it.category === cat).length})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search product name, code, size..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    style={{ width: '230px', paddingLeft: '28px', fontSize: '12px' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setActiveCategoryTarget(null);
                    setShowCategoryModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                  title="Add a new section / product category"
                >
                  <Plus size={14} /> Add Category
                </button>
                <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>
                  + Add Item Master
                </button>
              </div>
            </div>

            {/* Quick Sort Toolbar for Items Stock (Size, MRP, Current Stock) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ArrowUpDown size={14} color="#0284c7" /> Quick Sort:
              </span>

              {/* MRP Sorts */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'mrp', direction: 'desc' })}
                title="Sort MRP: High to Low (Costliest items first)"
              >
                MRP: High → Low ↓
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'mrp', direction: 'asc' })}
                title="Sort MRP: Low to High (Cheapest items first)"
              >
                MRP: Low → High ↑
              </button>

              <span style={{ color: '#cbd5e1' }}>|</span>

              {/* Stock Sorts */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'current_stock', direction: 'desc' })}
                title="Sort Stock: High to Low (Highest available stock first)"
              >
                Stock: High → Low ↓ (In-Stock)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'current_stock', direction: 'asc' })}
                title="Sort Stock: Low to High (Out of stock & low stock first)"
              >
                Stock: Low → High ↑ (Out-of-Stock)
              </button>

              <span style={{ color: '#cbd5e1' }}>|</span>

              {/* Size Sorts */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'size', direction: 'asc' })}
                title="Sort Size: Low to High (20→44 / S→XXL)"
              >
                Size: Low → High ↑
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: itemSortConfig.key === 'size' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#ffffff',
                  color: itemSortConfig.key === 'size' && itemSortConfig.direction === 'desc' ? '#ffffff' : '#334155',
                  borderColor: itemSortConfig.key === 'size' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setItemSortConfig({ key: 'size', direction: 'desc' })}
                title="Sort Size: High to Low (44→20 / XXL→S)"
              >
                Size: High → Low ↓
              </button>

              {/* Reset Sort Button */}
              {itemSortConfig.key && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '3px 8px', fontSize: '11.5px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 600,
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  onClick={() => setItemSortConfig({ key: null, direction: 'asc' })}
                  title="Reset to default catalog order"
                >
                  <X size={13} /> Reset Sort
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="accounting-table" style={{ width: '100%', minWidth: '1050px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: '35px', textAlign: 'center' }}>#</th>

                    {/* Item Code (Sortable) */}
                    <th 
                      style={{ width: '175px', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'item_code' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'item_code' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('item_code')}
                      title="Sort by Item Code / Article No."
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Item Code</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'item_code' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'item_code' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'item_code' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'item_code' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'item_code' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* Item Description (Sortable) */}
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'description' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'description' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('description')}
                      title="Sort by Item Description (A to Z / Z to A)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Item Description</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'description' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'description' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'description' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'description' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'description' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* Item Type (Sortable) */}
                    <th 
                      style={{ width: '120px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'item_type' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'item_type' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('item_type')}
                      title="Sort by Item Type (Readymade, Fabric, etc.)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span>Item Type</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'item_type' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'item_type' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'item_type' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'item_type' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                      </div>
                    </th>

                    {/* Section / Category (Sortable) */}
                    <th 
                      style={{ width: '150px', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'category' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'category' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('category')}
                      title="Sort by Section / Category"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Section / Category</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'category' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'category' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'category' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'category' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                      </div>
                    </th>

                    {/* Size (Sortable High to Low / Low to High) */}
                    <th 
                      style={{ width: '100px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'size' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'size' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('size')}
                      title={`Sort by Size (${itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? 'Currently: Low to High' : itemSortConfig.key === 'size' ? 'Currently: High to Low' : 'Click to sort Low to High / High to Low'})`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>Size</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'size' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'size' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'size' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'size' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'asc' ? 'LOW ↑' : 'HIGH ↓'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* MRP (Sortable High to Low / Low to High) */}
                    <th 
                      style={{ width: '125px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'mrp' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'mrp' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('mrp')}
                      title={`Sort by MRP (${itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? 'Currently: High to Low' : itemSortConfig.key === 'mrp' ? 'Currently: Low to High' : 'Click to sort High to Low / Low to High'})`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>MRP (₹)</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'mrp' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'mrp' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'desc' ? 'HIGH ↓' : 'LOW ↑'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* Selling Rate (Sortable) */}
                    <th 
                      style={{ width: '115px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'retail_rate' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'retail_rate' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('retail_rate')}
                      title="Sort by Selling Rate (High to Low / Low to High)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>Rate (₹)</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'retail_rate' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'retail_rate' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'retail_rate' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'retail_rate' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'retail_rate' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'desc' ? 'HIGH ↓' : 'LOW ↑'}
                          </span>
                        )}
                      </div>
                    </th>

                    <th style={{ width: '55px', textAlign: 'center' }}>Unit</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>GST %</th>

                    {/* Current Stock (Sortable High to Low / Low to High) */}
                    <th 
                      style={{ width: '140px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: itemSortConfig.key === 'current_stock' ? '#e0f2fe' : undefined, color: itemSortConfig.key === 'current_stock' ? '#0369a1' : undefined }}
                      onClick={() => handleItemSort('current_stock')}
                      title={`Sort by Stock (${itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? 'Currently: High to Low (In-Stock First)' : itemSortConfig.key === 'current_stock' ? 'Currently: Low to High (Out-of-Stock First)' : 'Click to sort High to Low / Low to High'})`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>Current Stock</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'asc' ? 3.5 : 1.5} color={itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? 3.5 : 1.5} color={itemSortConfig.key === 'current_stock' && itemSortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {itemSortConfig.key === 'current_stock' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            {itemSortConfig.direction === 'desc' ? 'HIGH ↓' : 'LOW ↑'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((it) => {
                      const matchCat = itemCategoryFilter === 'ALL' || it.category === itemCategoryFilter;
                      const q = itemSearch.toLowerCase();
                      const matchSearch = !itemSearch || 
                        (it.item_code && it.item_code.toLowerCase().includes(q)) ||
                        (it.name && it.name.toLowerCase().includes(q)) || 
                        (it.description && it.description.toLowerCase().includes(q)) ||
                        (it.item_type && it.item_type.toLowerCase().includes(q)) ||
                        (it.size && it.size.toLowerCase().includes(q)) ||
                        (it.category && it.category.toLowerCase().includes(q));
                      return matchCat && matchSearch;
                    })
                    .sort((a, b) => {
                      if (!itemSortConfig.key) return 0;
                      const { key, direction } = itemSortConfig;

                      if (key === 'mrp') {
                        const valA = parseFloat(a.mrp || a.retail_rate || 0);
                        const valB = parseFloat(b.mrp || b.retail_rate || 0);
                        return direction === 'asc' ? valA - valB : valB - valA;
                      }
                      if (key === 'retail_rate') {
                        const valA = parseFloat(a.retail_rate || 0);
                        const valB = parseFloat(b.retail_rate || 0);
                        return direction === 'asc' ? valA - valB : valB - valA;
                      }
                      if (key === 'current_stock') {
                        const valA = parseFloat(a.current_stock || 0);
                        const valB = parseFloat(b.current_stock || 0);
                        return direction === 'asc' ? valA - valB : valB - valA;
                      }
                      if (key === 'size') {
                        const rankA = parseGarmentSize(a.size);
                        const rankB = parseGarmentSize(b.size);
                        if (rankA !== rankB) {
                          return direction === 'asc' ? rankA - rankB : rankB - rankA;
                        }
                        const valA = (a.size || '').toString();
                        const valB = (b.size || '').toString();
                        return direction === 'asc' 
                          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
                      }
                      if (key === 'description') {
                        const valA = a.description || '';
                        const valB = b.description || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'item_type') {
                        const valA = a.item_type || 'Readymade';
                        const valB = b.item_type || 'Readymade';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'name') {
                        const valA = a.name || '';
                        const valB = b.name || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'category') {
                        const valA = a.category || '';
                        const valB = b.category || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'item_code') {
                        const valA = a.item_code || a.name || '';
                        const valB = b.item_code || b.name || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      return 0;
                    })
                    .slice(0, 300)
                    .map((it, idx) => (
                      <tr key={it.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                          {it.item_code || it.name}
                        </td>
                        <td style={{ color: it.description ? '#0f172a' : '#94a3b8', fontSize: '12.5px', fontWeight: it.description ? 500 : 400 }}>
                          {it.description || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {it.item_type || 'Readymade'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>
                            {it.category || 'READYMADE GARMENTS'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                          {it.size || '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹ {parseFloat(it.mrp || it.retail_rate || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹ {parseFloat(it.retail_rate || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>{it.primary_uom}</td>
                        <td style={{ textAlign: 'center', color: '#0284c7', fontWeight: 600 }}>
                          {parseFloat(it.gst_rate).toFixed(0)}%
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: parseFloat(it.current_stock) > 0 ? '#059669' : '#dc2626' }}>
                          {parseFloat(it.current_stock).toFixed(0)} {it.primary_uom}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setBarcodeInitialItems([it]);
                              setActiveTab('barcode_generator');
                              notify(`Loaded ${it.name} into Barcode Generator`);
                            }}
                            style={{ padding: '2px 8px', fontSize: '11px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title="Print Barcode Price Tag"
                          >
                            <Tag size={11} /> Barcode
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═════════ 6. PARTY MASTER (CUSTOMERS & VENDORS) ═════════ */}
        {activeTab === 'parties' && (
          <div className="anim-view-enter" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', color: '#0f2b48' }}>Party Accounts Master (Customers, Vendors & Dues)</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Total {customers.length} parties | Default GST State: 27 (Maharashtra)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Category Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Category:</label>
                  <select
                    className="input-field"
                    value={partyCategoryFilter}
                    onChange={(e) => setPartyCategoryFilter(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: '12px', width: '160px', fontWeight: 600 }}
                  >
                    <option value="ALL">All Categories ({customers.length})</option>
                    <option value="customer">Customers ({customers.filter(c => (c.party_type || '').toLowerCase() === 'customer').length})</option>
                    <option value="vendor">Vendors ({customers.filter(c => (c.party_type || '').toLowerCase() === 'vendor').length})</option>
                    <option value="both">Both ({customers.filter(c => c.party_type === 'both').length})</option>
                  </select>
                </div>

                {/* Only with dues checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  <input
                    type="checkbox"
                    checked={partyOnlyWithDues}
                    onChange={(e) => setPartyOnlyWithDues(e.target.checked)}
                  />
                  Only with Dues (&gt; ₹0)
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search party name, GSTIN, phone..."
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                    style={{ width: '230px', paddingLeft: '28px', fontSize: '12px' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                </div>
                <button className="btn btn-primary" onClick={() => setShowPartyModal(true)}>
                  + Add New Party
                </button>
              </div>
            </div>

            {/* Quick Sort Toolbar for Party Accounts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ArrowUpDown size={14} color="#0284c7" /> Quick Sort:
              </span>

              {/* Amount Due Sorts */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? '#0284c7' : '#ffffff',
                  color: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? '#ffffff' : '#334155',
                  borderColor: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setPartySortConfig({ key: 'amount_due', direction: 'desc' })}
                title="Sort by Amount Due: Highest Pending Dues on top"
              >
                Due: High → Low ↓ (Highest Dues First)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: partySortConfig.key === 'amount_due' && partySortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setPartySortConfig({ key: 'amount_due', direction: 'asc' })}
                title="Sort by Amount Due: Low to High (Clear accounts first)"
              >
                Due: Low → High ↑
              </button>

              <span style={{ color: '#cbd5e1' }}>|</span>

              {/* Category Sorts */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: partySortConfig.key === 'category' && partySortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: partySortConfig.key === 'category' && partySortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: partySortConfig.key === 'category' && partySortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setPartySortConfig({ key: 'category', direction: 'asc' })}
                title="Sort by Category: Customer, Vendor, Both (A to Z)"
              >
                Category: Group A → Z
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: partySortConfig.key === 'category' && partySortConfig.direction === 'desc' ? '#0284c7' : '#ffffff',
                  color: partySortConfig.key === 'category' && partySortConfig.direction === 'desc' ? '#ffffff' : '#334155',
                  borderColor: partySortConfig.key === 'category' && partySortConfig.direction === 'desc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setPartySortConfig({ key: 'category', direction: 'desc' })}
                title="Sort by Category: Vendor, Customer, Both (Z to A)"
              >
                Category: Group Z → A
              </button>

              <span style={{ color: '#cbd5e1' }}>|</span>

              {/* Name Sort */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 8px', fontSize: '11.5px', fontWeight: 600,
                  background: partySortConfig.key === 'name' && partySortConfig.direction === 'asc' ? '#0284c7' : '#ffffff',
                  color: partySortConfig.key === 'name' && partySortConfig.direction === 'asc' ? '#ffffff' : '#334155',
                  borderColor: partySortConfig.key === 'name' && partySortConfig.direction === 'asc' ? '#0284c7' : '#cbd5e1'
                }}
                onClick={() => setPartySortConfig({ key: 'name', direction: 'asc' })}
                title="Sort Party Name: A to Z"
              >
                Name: A → Z
              </button>

              {/* Reset Sort */}
              {partySortConfig.key && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '3px 8px', fontSize: '11.5px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 600,
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  onClick={() => setPartySortConfig({ key: null, direction: 'asc' })}
                  title="Reset to default party order"
                >
                  <X size={13} /> Reset Sort
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="accounting-table" style={{ width: '100%', minWidth: '950px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>

                    {/* Party Name (Sortable) */}
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none', background: partySortConfig.key === 'name' ? '#e0f2fe' : undefined, color: partySortConfig.key === 'name' ? '#0369a1' : undefined }}
                      onClick={() => handlePartySort('name')}
                      title="Sort by Party Name (A to Z / Z to A)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Party Name</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={partySortConfig.key === 'name' && partySortConfig.direction === 'asc' ? 3.5 : 1.5} color={partySortConfig.key === 'name' && partySortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={partySortConfig.key === 'name' && partySortConfig.direction === 'desc' ? 3.5 : 1.5} color={partySortConfig.key === 'name' && partySortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {partySortConfig.key === 'name' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {partySortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* Category / Party Type (Sortable) */}
                    <th 
                      style={{ width: '140px', cursor: 'pointer', userSelect: 'none', background: partySortConfig.key === 'category' ? '#e0f2fe' : undefined, color: partySortConfig.key === 'category' ? '#0369a1' : undefined }}
                      onClick={() => handlePartySort('category')}
                      title="Sort by Category / Party Type"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>Category / Type</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={partySortConfig.key === 'category' && partySortConfig.direction === 'asc' ? 3.5 : 1.5} color={partySortConfig.key === 'category' && partySortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={partySortConfig.key === 'category' && partySortConfig.direction === 'desc' ? 3.5 : 1.5} color={partySortConfig.key === 'category' && partySortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {partySortConfig.key === 'category' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {partySortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'}
                          </span>
                        )}
                      </div>
                    </th>

                    {/* GSTIN (Sortable) */}
                    <th 
                      style={{ width: '160px', cursor: 'pointer', userSelect: 'none', background: partySortConfig.key === 'gstin' ? '#e0f2fe' : undefined, color: partySortConfig.key === 'gstin' ? '#0369a1' : undefined }}
                      onClick={() => handlePartySort('gstin')}
                      title="Sort by GSTIN"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>GSTIN</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={partySortConfig.key === 'gstin' && partySortConfig.direction === 'asc' ? 3.5 : 1.5} color={partySortConfig.key === 'gstin' && partySortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={partySortConfig.key === 'gstin' && partySortConfig.direction === 'desc' ? 3.5 : 1.5} color={partySortConfig.key === 'gstin' && partySortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                      </div>
                    </th>

                    <th style={{ width: '90px' }}>State Code</th>
                    <th style={{ width: '130px' }}>Mobile / Phone</th>

                    {/* Amount Due (Replaces Credit Limit) - Sortable High to Low / Low to High */}
                    <th 
                      style={{ width: '160px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: partySortConfig.key === 'amount_due' ? '#e0f2fe' : undefined, color: partySortConfig.key === 'amount_due' ? '#0369a1' : undefined }}
                      onClick={() => handlePartySort('amount_due')}
                      title={`Sort by Amount Due (${partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? 'Currently: High to Low (Highest Dues First)' : partySortConfig.key === 'amount_due' ? 'Currently: Low to High' : 'Click to sort High to Low / Low to High'})`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>Amount Due (₹)</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', lineHeight: 1 }}>
                          <ArrowUp size={10} strokeWidth={partySortConfig.key === 'amount_due' && partySortConfig.direction === 'asc' ? 3.5 : 1.5} color={partySortConfig.key === 'amount_due' && partySortConfig.direction === 'asc' ? '#0284c7' : '#94a3b8'} />
                          <ArrowDown size={10} strokeWidth={partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? 3.5 : 1.5} color={partySortConfig.key === 'amount_due' && partySortConfig.direction === 'desc' ? '#0284c7' : '#94a3b8'} />
                        </div>
                        {partySortConfig.key === 'amount_due' && (
                          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            {partySortConfig.direction === 'desc' ? 'HIGH ↓' : 'LOW ↑'}
                          </span>
                        )}
                      </div>
                    </th>

                    <th style={{ textAlign: 'center', width: '110px' }}>Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((c) => {
                      // Category Filter
                      if (partyCategoryFilter !== 'ALL' && c.party_type !== partyCategoryFilter) {
                        return false;
                      }
                      // Only with dues filter
                      if (partyOnlyWithDues && getPartyAmountDue(c) <= 0) {
                        return false;
                      }
                      // Search filter
                      if (!partySearch) return true;
                      const q = partySearch.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
                        (c.phone && c.phone.toLowerCase().includes(q)) ||
                        (c.party_type && c.party_type.toLowerCase().includes(q))
                      );
                    })
                    .sort((a, b) => {
                      if (!partySortConfig.key) return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
                      const { key, direction } = partySortConfig;

                      if (key === 'amount_due') {
                        const valA = getPartyAmountDue(a);
                        const valB = getPartyAmountDue(b);
                        return direction === 'asc' ? valA - valB : valB - valA;
                      }
                      if (key === 'category') {
                        const valA = a.party_type || '';
                        const valB = b.party_type || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'name') {
                        const valA = a.name || '';
                        const valB = b.name || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'gstin') {
                        const valA = a.gstin || '';
                        const valB = b.gstin || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      if (key === 'state_code') {
                        const valA = a.state_code || '';
                        const valB = b.state_code || '';
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                      }
                      return 0;
                    })
                    .map((c, idx) => {
                      const amountDue = getPartyAmountDue(c);
                      return (
                        <tr key={c.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              background: (c.party_type || '').toLowerCase() === 'vendor' ? '#ccfbf1' : c.party_type === 'both' ? '#ede9fe' : '#e0f2fe',
                              color: (c.party_type || '').toLowerCase() === 'vendor' ? '#0f766e' : c.party_type === 'both' ? '#6d28d9' : '#0369a1'
                            }}>
                              {(c.party_type || '').toLowerCase() === 'customer' ? 'Customer' : (c.party_type || '').toLowerCase() === 'vendor' ? 'Supplier / Vendor' : 'Both'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#475569' }}>
                            {c.gstin || 'Unregistered / B2C'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.state_code || '27'}</td>
                          <td>{c.phone || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {amountDue > 0 ? (
                              <span style={{
                                fontWeight: 700,
                                fontSize: '13px',
                                color: (c.party_type || '').toLowerCase() === 'vendor' ? '#0f766e' : '#b91c1c',
                                background: (c.party_type || '').toLowerCase() === 'vendor' ? '#f0fdf4' : '#fef2f2',
                                border: `1px solid ${(c.party_type || '').toLowerCase() === 'vendor' ? '#bbf7d0' : '#fecaca'}`,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                ₹ {amountDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span style={{ fontSize: '10px', marginLeft: '3px', opacity: 0.85 }}>
                                  {(c.party_type || '').toLowerCase() === 'vendor' ? '(Payable)' : '(Due)'}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 600, fontSize: '12px' }}>
                                ₹ 0.00
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn"
                              style={{
                                padding: '3px 8px', fontSize: '11px', background: '#f0f9ff',
                                color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '3px',
                                cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                              onClick={() => {
                                setSelectedLedgerCustomerId(c.id.toString());
                                setActiveTab('ledger');
                              }}
                              title={`View ${c.name} Statement / Ledger`}
                            >
                              <BookOpen size={12} />
                              Ledger
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═════════ 6. PARTY LEDGER & STATEMENT OF ACCOUNT ═════════ */}
        {activeTab === 'ledger' && (() => {
          const isVendorLedger = ledgerPartyType === 'vendor';
          const activeLedgerParties = customers
            .filter(c => isVendorLedger ? ((c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both') : ((c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both'))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

          const filteredLedgerParties = activeLedgerParties.filter(c => {
            if (!ledgerSearch.trim()) return true;
            const q = ledgerSearch.toLowerCase().trim();
            return (
              (c.name && c.name.toLowerCase().includes(q)) ||
              (c.gstin && c.gstin.toLowerCase().includes(q)) ||
              (c.phone && c.phone.includes(q)) ||
              (c.billing_address && c.billing_address.toLowerCase().includes(q))
            );
          });

          return (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Section Switcher: Customer vs Vendor */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
              padding: '10px 16px', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ledger Mode:
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setLedgerPartyType('customer');
                    setLedgerSearch('');
                    const custs = customers.filter(c => (c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both')
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                    if (custs.length > 0 && (!selectedLedgerCustomerId || !custs.some(c => String(c.id) === String(selectedLedgerCustomerId)))) {
                      setSelectedLedgerCustomerId(String(custs[0].id));
                      loadLedger(custs[0].id, ledgerFirmFilter, null, null);
                    }
                  }}
                  style={{
                    padding: '8px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '5px',
                    border: !isVendorLedger ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: !isVendorLedger ? '#0284c7' : '#f8fafc',
                    color: !isVendorLedger ? '#ffffff' : '#334155',
                    boxShadow: !isVendorLedger ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BookOpen size={16} />
                  <span>👤 Customer Ledger (ग्राहक खाता)</span>
                  <span style={{
                    fontSize: '11px', padding: '1px 7px', borderRadius: '10px',
                    background: !isVendorLedger ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: !isVendorLedger ? '#ffffff' : '#64748b',
                    fontWeight: 700
                  }}>
                    {customers.filter(c => (c.party_type || '').toLowerCase() === 'customer' || (c.party_type || '').toLowerCase() === 'both').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLedgerPartyType('vendor');
                    setLedgerSearch('');
                    const vends = customers.filter(c => (c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both')
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                    if (vends.length > 0 && (!selectedLedgerCustomerId || !vends.some(c => String(c.id) === String(selectedLedgerCustomerId)))) {
                      setSelectedLedgerCustomerId(String(vends[0].id));
                      loadLedger(vends[0].id, ledgerFirmFilter, null, null);
                    }
                  }}
                  style={{
                    padding: '8px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '5px',
                    border: isVendorLedger ? '1px solid #0f766e' : '1px solid #cbd5e1',
                    background: isVendorLedger ? '#0f766e' : '#f8fafc',
                    color: isVendorLedger ? '#ffffff' : '#334155',
                    boxShadow: isVendorLedger ? '0 2px 4px rgba(15, 118, 110, 0.25)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Truck size={16} />
                  <span>🏭 Vendor / Supplier Ledger (सप्लायर खाता)</span>
                  <span style={{
                    fontSize: '11px', padding: '1px 7px', borderRadius: '10px',
                    background: isVendorLedger ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: isVendorLedger ? '#ffffff' : '#64748b',
                    fontWeight: 700
                  }}>
                    {customers.filter(c => (c.party_type || '').toLowerCase() === 'vendor' || (c.party_type || '').toLowerCase() === 'both').length}
                  </span>
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Sorted alphabetically A-Z • Full Multi-Year Khata & Payments
              </div>
            </div>

            {/* Top Control Bar */}
            <div style={{
              background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
              padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isVendorLedger ? (
                    <Truck size={22} style={{ color: '#0f766e' }} />
                  ) : (
                    <BookOpen size={22} style={{ color: '#0284c7' }} />
                  )}
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#0f2b48', margin: 0, fontWeight: 700 }}>
                      {isVendorLedger ? 'Vendor / Supplier Ledger & Statement' : 'Customer Ledger & Statement of Account'}
                    </h3>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {isVendorLedger
                        ? 'Inward purchase bills, payments made to supplier, return debit notes, and running balance'
                        : 'Sales invoices, payments received, credit notes, and customer running balance'}
                    </span>
                  </div>
                </div>

                {/* Party Search Filter */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '6px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={`Filter ${isVendorLedger ? 'vendors' : 'customers'}...`}
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    style={{ padding: '6px 26px 6px 28px', fontSize: '12px', width: '160px' }}
                  />
                  <Search size={13} style={{ position: 'absolute', left: '8px', color: '#94a3b8', pointerEvents: 'none' }} />
                  {ledgerSearch && (
                    <X
                      size={13}
                      style={{ position: 'absolute', right: '8px', color: '#94a3b8', cursor: 'pointer' }}
                      onClick={() => setLedgerSearch('')}
                    />
                  )}
                </div>

                {/* Party Dropdown (Sorted Alphabetically) */}
                <div>
                  <select
                    className="input-field"
                    style={{ minWidth: '320px', fontWeight: 600, fontSize: '13px' }}
                    value={selectedLedgerCustomerId}
                    onChange={(e) => {
                      setSelectedLedgerCustomerId(e.target.value);
                      loadLedger(e.target.value, ledgerFirmFilter, null, null);
                    }}
                  >
                    <option value="">{`-- Select ${isVendorLedger ? 'Vendor / Supplier' : 'Customer'} (${activeLedgerParties.length} available) --`}</option>
                    {filteredLedgerParties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.billing_address ? `• 📍 ${c.billing_address}` : ''} {c.gstin ? `(${c.gstin})` : ''} {c.phone ? `• 📞 ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn"
                  onClick={() => loadLedger(selectedLedgerCustomerId, ledgerFirmFilter)}
                  style={{
                    background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px'
                  }}
                  title="Refresh ledger"
                >
                  <RefreshCw size={13} className={loadingLedger ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>

                <button
                  className="btn"
                  onClick={exportLedgerCsv}
                  style={{
                    background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px'
                  }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const cp = customers.find(c => String(c.id) === String(selectedLedgerCustomerId)) || ledgerData?.party;
                    const officialUrl = cp?.official_pdf_url || ledgerData?.party?.official_pdf_url;
                    if (officialUrl) {
                      window.open(officialUrl, '_blank');
                    } else {
                      window.print();
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px'
                  }}
                >
                  <Printer size={13} />
                  <span>{(() => {
                    const cp = customers.find(c => String(c.id) === String(selectedLedgerCustomerId)) || ledgerData?.party;
                    return (cp?.official_pdf_url || ledgerData?.party?.official_pdf_url) ? 'Print / View Official PDF' : 'Print Statement';
                  })()}</span>
                </button>

                {(() => {
                  const cp = customers.find(c => String(c.id) === String(selectedLedgerCustomerId)) || ledgerData?.party;
                  const officialUrl = cp?.official_pdf_url || ledgerData?.party?.official_pdf_url;
                  return officialUrl ? (
                    <a
                      href={officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{
                        background: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8',
                        display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                        textDecoration: 'none'
                      }}
                      title="Open 100% Authentic Accurate .rpt PDF from Google Drive"
                    >
                      <FileText size={13} color="#38bdf8" />
                      <span>Accurate .RPT PDF</span>
                    </a>
                  ) : null;
                })()}

                <button
                  className="btn"
                  onClick={handleSendLedgerWhatsApp}
                  disabled={sendingWhatsAppStatement}
                  style={{
                    background: '#25D366', color: '#ffffff', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                    opacity: sendingWhatsAppStatement ? 0.75 : 1, cursor: sendingWhatsAppStatement ? 'wait' : 'pointer'
                  }}
                  title={whatsAppBridgeStatus?.connected ? `Send statement via WhatsApp Bridge (+${whatsAppBridgeStatus.phone || 'Connected'})` : "Share statement via WhatsApp Bridge"}
                >
                  <Share2 size={13} className={sendingWhatsAppStatement ? 'animate-spin' : ''} />
                  <span>{sendingWhatsAppStatement ? 'Sending WhatsApp...' : 'WhatsApp Statement'}</span>
                </button>

                <button
                  className="btn"
                  onClick={() => {
                    setLedgerPaymentForm(prev => ({
                      ...prev,
                      payment_type: isVendorLedger ? 'payment' : 'receipt',
                    }));
                    setShowLedgerPaymentModal(true);
                  }}
                  style={{
                    background: isVendorLedger ? '#0f766e' : '#16a34a',
                    color: '#ffffff', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600
                  }}
                >
                  <CreditCard size={13} />
                  <span>{isVendorLedger ? '+ Pay Vendor (भुगतान)' : '+ Receive Payment (जमा)'}</span>
                </button>
              </div>
            </div>

            {/* Date & Multi-Firm Filters Bar */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px'
            }}>
              {/* Multi-Firm Selector Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>🏢 Firm:</span>
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLedgerFirmFilter('all');
                      loadLedger(selectedLedgerCustomerId, 'all');
                    }}
                    style={{
                      padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                      background: ledgerFirmFilter === 'all' ? '#0f2b48' : 'transparent',
                      color: ledgerFirmFilter === 'all' ? '#ffffff' : '#475569',
                    }}
                  >
                    🏢 Combined (All Firms)
                  </button>
                  {firms.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="btn"
                      onClick={() => {
                        setLedgerFirmFilter(f.id);
                        loadLedger(selectedLedgerCustomerId, f.id);
                      }}
                      style={{
                        padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                        background: ledgerFirmFilter === f.id ? '#0284c7' : 'transparent',
                        color: ledgerFirmFilter === f.id ? '#ffffff' : '#475569',
                      }}
                    >
                      {f.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <span style={{ color: '#cbd5e1' }}>|</span>

              {/* Quick Period Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>Period:</span>
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                      loadLedger(selectedLedgerCustomerId, ledgerFirmFilter, null, null);
                    }}
                    style={{
                      padding: '3px 9px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                      background: (!ledgerStartDate && !ledgerEndDate) ? '#0f2b48' : 'transparent',
                      color: (!ledgerStartDate && !ledgerEndDate) ? '#ffffff' : '#475569',
                    }}
                    title="View complete transaction history from inception"
                  >
                    📅 Complete History (All Time)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const s = activeFYObj.start || '';
                      const e = activeFYObj.end || '';
                      setLedgerStartDate(s);
                      setLedgerEndDate(e);
                      loadLedger(selectedLedgerCustomerId, ledgerFirmFilter, s, e);
                    }}
                    style={{
                      padding: '3px 9px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                      background: (ledgerStartDate === activeFYObj.start && ledgerEndDate === activeFYObj.end) ? '#0284c7' : 'transparent',
                      color: (ledgerStartDate === activeFYObj.start && ledgerEndDate === activeFYObj.end) ? '#ffffff' : '#475569',
                    }}
                    title={`Filter by financial year ${activeFYObj.label}`}
                  >
                    Active FY ({activeFYObj.id})
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ color: '#64748b' }}>From:</label>
                <input
                  type="date"
                  className="input-field"
                  style={{ padding: '4px 8px', fontSize: '12px', width: '135px' }}
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ color: '#64748b' }}>To:</label>
                <input
                  type="date"
                  className="input-field"
                  style={{ padding: '4px 8px', fontSize: '12px', width: '135px' }}
                  value={ledgerEndDate}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                />
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11.5px' }}
                onClick={() => {
                  loadLedger(selectedLedgerCustomerId, ledgerFirmFilter, ledgerStartDate || null, ledgerEndDate || null);
                }}
              >
                Apply
              </button>
              {(ledgerStartDate || ledgerEndDate) && (
                <button
                  className="btn"
                  style={{ padding: '4px 10px', fontSize: '11.5px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                  onClick={() => {
                    setLedgerStartDate('');
                    setLedgerEndDate('');
                    loadLedger(selectedLedgerCustomerId, ledgerFirmFilter, null, null);
                  }}
                  title="Show all transactions from inception"
                >
                  ✕ Show All
                </button>
              )}
            </div>

            {/* Ledger Content */}
            {loadingLedger ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Calculating statement & running balance...</p>
              </div>
            ) : !ledgerData ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Please select a Customer or Vendor from the dropdown above to load their ledger.</p>
              </div>
            ) : (
              <>
                {/* Ultra-Compact Summary KPI Strip */}
                {(() => {
                  const isCust = (ledgerData.party.party_type || '').toLowerCase() === 'customer';
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {/* Opening Balance */}
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Opening Bal</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                            ₹ {ledgerData.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span style={{ fontSize: '10.5px', marginLeft: '4px', color: '#64748b' }}>{ledgerData.opening_balance_type || 'NIL'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Total Debits */}
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '9.5px', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>
                            {isCust ? 'Total Sales (+Dr)' : 'Total Payments (+Dr)'}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                            ₹ {ledgerData.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Total Credits */}
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
                            {isCust ? 'Total Received (-Cr)' : 'Total Purchases (-Cr)'}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                            ₹ {ledgerData.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Closing Balance */}
                      <div style={{
                        background: ledgerData.closing_balance_type === 'Dr' ? '#fff7ed' : ledgerData.closing_balance_type === 'Cr' ? '#f0fdf4' : '#ffffff',
                        border: `1.5px solid ${ledgerData.closing_balance_type === 'Dr' ? '#fdba74' : ledgerData.closing_balance_type === 'Cr' ? '#86efac' : '#cbd5e1'}`,
                        borderRadius: '4px', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase',
                            color: ledgerData.closing_balance_type === 'Dr' ? '#c2410c' : ledgerData.closing_balance_type === 'Cr' ? '#15803d' : '#64748b'
                          }}>
                            Closing Net Bal
                          </div>
                          <div style={{
                            fontSize: '15px', fontWeight: 800,
                            color: ledgerData.closing_balance_type === 'Dr' ? '#c2410c' : ledgerData.closing_balance_type === 'Cr' ? '#15803d' : '#1e293b'
                          }}>
                            ₹ {ledgerData.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span style={{ fontSize: '11px', marginLeft: '4px' }}>{ledgerData.closing_balance_type}</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 600,
                          color: ledgerData.closing_balance_type === 'Dr' ? '#ea580c' : ledgerData.closing_balance_type === 'Cr' ? '#16a34a' : '#64748b'
                        }}>
                          {isCust
                            ? (ledgerData.closing_balance_type === 'Dr' ? 'Receivable' : ledgerData.closing_balance_type === 'Cr' ? 'Advance' : 'Settled')
                            : (ledgerData.closing_balance_type === 'Cr' ? 'Payable' : ledgerData.closing_balance_type === 'Dr' ? 'Advance' : 'Settled')
                          }
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Printable Statement Container - Compact & Space-Efficient */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 12px' }} className="printable-ledger">
                  {/* Party Details Header */}
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '14px', color: '#0f2b48', margin: 0, fontWeight: 700 }}>
                          {ledgerData.party.name}
                        </h4>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '1px 6px', fontSize: '10px', height: '20px' }}
                          onClick={async () => {
                            const cur = ledgerData.party.billing_address || '';
                            const val = window.prompt(`Update Address for ${ledgerData.party.name}:`, cur);
                            if (val !== null && val.trim() !== cur) {
                              try {
                                await api.updateCustomer(ledgerData.party.id, { billing_address: val.trim() });
                                notify("Address updated!", "success");
                                loadCustomers();
                                loadLedger(ledgerData.party.id, ledgerFirmFilter);
                              } catch (err) {
                                notify(err.message, "error");
                              }
                            }
                          }}
                          title="Click to edit or set this vendor's address"
                        >
                          ✎ Edit Address
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span>GSTIN: <strong>{ledgerData.party.gstin || 'Unregistered'}</strong></span>
                        <span>•</span>
                        <span>Address: <strong style={{ color: ledgerData.party.billing_address ? '#0f2b48' : '#94a3b8' }}>{ledgerData.party.billing_address || 'No Address Set (Click Edit)'}</strong></span>
                        <span>•</span>
                        <span>State: {ledgerData.party.state_code || '27'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
                      <div>Firm: <strong style={{ color: '#0f2b48' }}>{ledgerFirmFilter === 'all' ? '🏢 Combined' : (firms.find(f => f.id === ledgerFirmFilter)?.name || 'APEX APPARELS & TEXTILES')}</strong></div>
                      <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Accounting Table - Scrollable Container for Max Visible Rows */}
                  <div style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '380px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '3px' }}>
                    <table className="accounting-table">
                    <thead>
                      <tr>
                        <th style={{ width: '95px' }}>Date</th>
                        <th style={{ width: '130px' }}>Voucher Type</th>
                        <th style={{ width: '145px' }}>Voucher No</th>
                        <th>Narration / Particulars</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Debit (₹ Dr)</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Credit (₹ Cr)</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                        <td>{ledgerData.period.start_date || '-'}</td>
                        <td style={{ color: '#475569' }}>Opening Balance</td>
                        <td style={{ color: '#94a3b8' }}>-</td>
                        <td style={{ fontStyle: 'italic', color: '#64748b' }}>Balance brought forward</td>
                        <td style={{ textAlign: 'right' }}>
                          {ledgerData.opening_balance_type === 'Dr' ? `₹ ${ledgerData.opening_balance.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {ledgerData.opening_balance_type === 'Cr' ? `₹ ${ledgerData.opening_balance.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹ {ledgerData.opening_balance.toFixed(2)} {ledgerData.opening_balance_type}
                        </td>
                      </tr>

                      {/* Transactions */}
                      {ledgerData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            No transactions found for this party in the selected period.
                          </td>
                        </tr>
                      ) : (
                        ledgerData.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{tx.date}</td>
                            <td>
                              <span style={{
                                fontSize: '11px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                                background: tx.voucher_type.includes('Sales') ? '#e0f2fe' : tx.voucher_type.includes('Purchase') ? '#ccfbf1' : tx.voucher_type.includes('Receipt') ? '#dcfce7' : '#fef3c7',
                                color: tx.voucher_type.includes('Sales') ? '#0369a1' : tx.voucher_type.includes('Purchase') ? '#0f766e' : tx.voucher_type.includes('Receipt') ? '#15803d' : '#b45309',
                              }}>
                                {tx.voucher_type}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              <div>{tx.voucher_no}</div>
                              {tx.firm_name && (
                                <span style={{
                                  fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', fontWeight: 600,
                                  background: tx.firm_id === 2 ? '#e0f2fe' : '#fef3c7',
                                  color: tx.firm_id === 2 ? '#0369a1' : '#92400e',
                                  border: `1px solid ${tx.firm_id === 2 ? '#bae6fd' : '#fde68a'}`,
                                  fontFamily: 'sans-serif', display: 'inline-block', marginTop: '2px'
                                }}>
                                  {tx.firm_name.split(' ')[0]}
                                </span>
                              )}
                            </td>
                            <td style={{ color: '#475569' }}>{tx.narration}</td>
                            <td style={{ textAlign: 'right', color: tx.debit > 0 ? '#0284c7' : '#94a3b8', fontWeight: tx.debit > 0 ? 600 : 400 }}>
                              {tx.debit > 0 ? `₹ ${tx.debit.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ textAlign: 'right', color: tx.credit > 0 ? '#16a34a' : '#94a3b8', fontWeight: tx.credit > 0 ? 600 : 400 }}>
                              {tx.credit > 0 ? `₹ ${tx.credit.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: tx.balance_type === 'Dr' ? '#c2410c' : tx.balance_type === 'Cr' ? '#15803d' : '#475569' }}>
                              ₹ {tx.running_balance.toFixed(2)} {tx.balance_type}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Closing Balance Row */}
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                        <td>{ledgerData.period.end_date || 'Today'}</td>
                        <td style={{ color: '#0f2b48' }}>Closing Balance</td>
                        <td style={{ color: '#94a3b8' }}>-</td>
                        <td style={{ fontStyle: 'italic', color: '#64748b' }}>Net closing balance carried forward</td>
                        <td style={{ textAlign: 'right', color: '#0284c7' }}>
                          ₹ {ledgerData.total_debit.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>
                          ₹ {ledgerData.total_credit.toFixed(2)}
                        </td>
                        <td style={{
                          textAlign: 'right', fontSize: '14px',
                          color: ledgerData.closing_balance_type === 'Dr' ? '#c2410c' : ledgerData.closing_balance_type === 'Cr' ? '#15803d' : '#1e293b'
                        }}>
                          ₹ {ledgerData.closing_balance.toFixed(2)} {ledgerData.closing_balance_type}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
          );
        })()}

        {/* ═════════ 7. CA & TAX COMPLIANCE HUB ═════════ */}
        {(activeTab === 'gstr1' || activeTab === 'gstr') && (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Hub Header & Actions */}
            <div style={{
              background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
              padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={22} style={{ color: '#0284c7' }} />
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f2b48' }}>
                    CA Compliance & Tax Portal
                  </h2>
                  <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    GST Standard 5%
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Company: <strong style={{ color: '#0f2b48' }}>{activeFirm?.name}</strong> | GSTIN: <code style={{ color: '#0284c7', fontWeight: 700 }}>{activeFirm?.gstin}</code> | Period: <strong style={{ color: '#0f2b48' }}>{activeFYObj.label}</strong>
                </div>
              </div>

              {/* Action Buttons for CA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleExportCaCsv}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7', fontSize: '12px' }}
                >
                  <Download size={14} /> Export All for CA (CSV)
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCopyCaSummary}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                >
                  <Share2 size={14} /> Copy Summary
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                >
                  <Printer size={14} /> Print Report
                </button>
              </div>
            </div>

            {/* Sub-Navigation Pill Tabs */}
            <div style={{
              display: 'flex', gap: '6px', background: '#ffffff',
              padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1',
              overflowX: 'auto'
            }}>
              {[
                { id: 'gstr1', label: '1. GSTR-1 (Outward Sales)', icon: FileText, color: '#0284c7' },
                { id: 'gstr2b', label: '2. GSTR-2B (Inward ITC Purchases)', icon: ArrowDownLeft, color: '#16a34a' },
                { id: 'gstr3b', label: '3. GSTR-3B (Monthly Return & Liability)', icon: FileSpreadsheet, color: '#7c3aed' },
                { id: 'stock_valuation', label: '4. Stock Valuation & HSN Audit', icon: Package, color: '#d97706' },
                { id: 'share_ca', label: '5. Share with CA / Export', icon: Share2, color: '#0f766e' },
              ].map(sub => {
                const Icon = sub.icon;
                const isSelected = caSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setCaSubTab(sub.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 14px', borderRadius: '4px', border: 'none',
                      cursor: 'pointer', fontSize: '12.5px', fontWeight: isSelected ? 700 : 500,
                      background: isSelected ? '#0f2b48' : 'transparent',
                      color: isSelected ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Icon size={14} color={isSelected ? '#38bdf8' : sub.color} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ───── SUB-TAB 1: GSTR-1 (OUTWARD SALES) ───── */}
            {caSubTab === 'gstr1' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {gstr1Data ? (
                  <>
                    {/* Top KPI Cards for GSTR-1 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL SALES INVOICES</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f2b48', marginTop: '2px' }}>
                          {gstr1Data?.totals?.total_invoices || 0}
                        </div>
                        <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px' }}>
                          B2B: {gstr1Data?.totals?.b2b_count || 0} | B2C: {gstr1Data?.totals?.b2c_count || 0}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL TAXABLE OUTWARD</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                          ₹ {((gstr1Data?.hsn_summary || []).reduce((acc, curr) => acc + (parseFloat(curr.taxable_value) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>5% GST Standard Rate</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>CGST COLLECTED (2.5%)</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
                          ₹ {((gstr1Data?.hsn_summary || []).reduce((acc, curr) => acc + (parseFloat(curr.cgst_amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '2px' }}>Intra-state sales</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SGST COLLECTED (2.5%)</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
                          ₹ {((gstr1Data?.hsn_summary || []).reduce((acc, curr) => acc + (parseFloat(curr.sgst_amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '2px' }}>Maharashtra state tax</div>
                      </div>
                    </div>

                    {/* 1. HSN / SAC Summary Table */}
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                          Table 12: HSN/SAC Summary of Outward Supplies (5% GST)
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Garments / Apparel Industry Standard</span>
                      </div>
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>HSN Code</th>
                            <th>Description</th>
                            <th>UOM</th>
                            <th style={{ textAlign: 'right' }}>Total Quantity</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
                            <th style={{ textAlign: 'right' }}>CGST 2.5% (₹)</th>
                            <th style={{ textAlign: 'right' }}>SGST 2.5% (₹)</th>
                            <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(gstr1Data.hsn_summary || []).map((h, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700, color: '#0f2b48' }}>{h.hsn_code}</td>
                              <td>{h.hsn_code === '6109' ? 'T-Shirts, Singlets & Vests' : 'Readymade Garments'}</td>
                              <td>{h.uom || 'Pcs'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{parseFloat(h.total_qty || h.total_quantity || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>₹ {parseFloat(h.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }}>₹ {parseFloat(h.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }}>₹ {parseFloat(h.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f2b48' }}>
                                ₹ {parseFloat(h.total_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 2. B2B Invoices & 3. B2C Invoices */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                      {/* B2B Table */}
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48' }}>
                            Table 4A: B2B Invoices (Registered GST Customers) [{(gstr1Data.b2b || gstr1Data.b2b_invoices || []).length}]
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Showing top entries</span>
                        </div>
                        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                          <table className="accounting-table">
                            <thead>
                              <tr>
                                <th>Invoice</th>
                                <th>Party Name</th>
                                <th>GSTIN</th>
                                <th style={{ textAlign: 'right' }}>Taxable (₹)</th>
                                <th style={{ textAlign: 'right' }}>Grand Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(gstr1Data.b2b || gstr1Data.b2b_invoices || []).slice(0, 30).map((inv, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                                  <td>{inv.customer_name}</td>
                                  <td><code style={{ fontSize: '11px', color: '#0284c7' }}>{inv.customer_gstin}</code></td>
                                  <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.taxable_value || 0).toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹ {parseFloat(inv.grand_total || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* B2C Table */}
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48' }}>
                            Table 7: B2C Small Retail (Unregistered Buyers) [{(gstr1Data.b2c || gstr1Data.b2c_invoices || []).length}]
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Showing top entries</span>
                        </div>
                        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                          <table className="accounting-table">
                            <thead>
                              <tr>
                                <th>Invoice</th>
                                <th>Buyer / Cash Customer</th>
                                <th style={{ textAlign: 'right' }}>Taxable (₹)</th>
                                <th style={{ textAlign: 'right' }}>Grand Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(gstr1Data.b2c || gstr1Data.b2c_invoices || []).slice(0, 30).map((inv, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                                  <td>{inv.customer_name}</td>
                                  <td style={{ textAlign: 'right' }}>₹ {parseFloat(inv.taxable_value || 0).toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹ {parseFloat(inv.grand_total || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>Loading GSTR-1 Data...</div>
                  </div>
                )}
              </div>
            )}

            {/* ───── SUB-TAB 2: GSTR-2B (INWARD ITC PURCHASES) ───── */}
            {caSubTab === 'gstr2b' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {gstr3bData ? (
                  <>
                    {/* ITC Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL PURCHASE BILLS</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f2b48', marginTop: '2px' }}>
                          {gstr3bData.table_4_itc.bill_count}
                        </div>
                        <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>Inward stock vouchers</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TAXABLE PURCHASES VALUE</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
                          ₹ {parseFloat(gstr3bData.table_4_itc.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Eligible inward supplies</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>INPUT CGST + SGST (2.5%)</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                          ₹ {(parseFloat(gstr3bData.table_4_itc.cgst) + parseFloat(gstr3bData.table_4_itc.sgst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Intra-state purchases</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL ELIGIBLE ITC CLAIMABLE</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                          ₹ {parseFloat(gstr3bData.table_4_itc.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>Available for GST offset</div>
                      </div>
                    </div>

                    {/* Inward Bills Register Table */}
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                            GSTR-2B Inward Purchase Bills Register (ITC Statement)
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            All inward bills imported from Accurate ERP with supplier GSTIN and tax credit
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {gstr3bData.inward_bills.length} Inward Records
                        </span>
                      </div>

                      <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
                        <table className="accounting-table">
                          <thead>
                            <tr>
                              <th>Bill No</th>
                              <th>Bill Date</th>
                              <th>Supplier / Vendor Name</th>
                              <th>Supplier GSTIN</th>
                              <th style={{ textAlign: 'right' }}>Taxable (₹)</th>
                              <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                              <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                              <th style={{ textAlign: 'right' }}>IGST (₹)</th>
                              <th style={{ textAlign: 'right' }}>Eligible ITC (₹)</th>
                              <th style={{ textAlign: 'right' }}>Total Bill (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gstr3bData.inward_bills.map((b, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{b.bill_number}</td>
                                <td>{b.bill_date}</td>
                                <td style={{ fontWeight: 600 }}>{b.supplier_name}</td>
                                <td>
                                  {b.supplier_gstin && b.supplier_gstin !== 'Unregistered' ? (
                                    <code style={{ color: '#0284c7', fontSize: '11px' }}>{b.supplier_gstin}</code>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Unregistered</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(b.taxable_value).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(b.cgst).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(b.sgst).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(b.igst).toFixed(2)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>₹ {parseFloat(b.total_tax).toFixed(2)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>₹ {parseFloat(b.grand_total).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>Loading GSTR-2B Inward Register...</div>
                  </div>
                )}
              </div>
            )}

            {/* ───── SUB-TAB 3: GSTR-3B (MONTHLY SUMMARY & TAX LIABILITY) ───── */}
            {caSubTab === 'gstr3b' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {gstr3bData ? (
                  <>
                    {/* Net Tax Payable Banner */}
                    <div style={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '6px', padding: '20px 24px', color: '#ffffff',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Official GSTR-3B Tax Computation
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0' }}>
                          Net GST Payable in Cash (After ITC Offset)
                        </h3>
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          Outward Output Liability (₹ {parseFloat(gstr3bData.table_3_1_outward.total_tax).toFixed(2)}) minus Inward Eligible ITC (₹ {parseFloat(gstr3bData.table_4_itc.total_tax).toFixed(2)})
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Net CGST Payable</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                            ₹ {parseFloat(gstr3bData.net_tax_payable.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Net SGST Payable</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                            ₹ {parseFloat(gstr3bData.net_tax_payable.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', background: '#38bdf8', padding: '10px 18px', borderRadius: '4px', color: '#0f2b48' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700 }}>TOTAL CASH TAX PAYABLE</div>
                          <div style={{ fontSize: '22px', fontWeight: 800 }}>
                            ₹ {parseFloat(gstr3bData.net_tax_payable.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table 3.1 & Table 4 in standard GST Portal style */}
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48', marginBottom: '10px' }}>
                        Table 3.1: Details of Outward Supplies & Liabilities (Sales)
                      </h4>
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>Nature of Supplies</th>
                            <th style={{ textAlign: 'right' }}>Total Taxable Value (₹)</th>
                            <th style={{ textAlign: 'right' }}>Integrated Tax / IGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>Central Tax / CGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>State Tax / SGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>Total Tax Liability (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 600 }}>
                              (a) Outward taxable supplies (other than zero rated, nil rated & exempted)
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹ {parseFloat(gstr3bData.table_3_1_outward.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_3_1_outward.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_3_1_outward.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_3_1_outward.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                              ₹ {parseFloat(gstr3bData.table_3_1_outward.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 4 Eligible ITC */}
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48', marginBottom: '10px' }}>
                        Table 4: Eligible Input Tax Credit (ITC Available from Inward Purchases)
                      </h4>
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>Details of ITC</th>
                            <th style={{ textAlign: 'right' }}>Taxable Purchases (₹)</th>
                            <th style={{ textAlign: 'right' }}>Integrated Tax / IGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>Central Tax / CGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>State Tax / SGST (₹)</th>
                            <th style={{ textAlign: 'right' }}>Total Available ITC (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 600 }}>
                              (A) (5) All other ITC - Inward supplies from registered suppliers
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹ {parseFloat(gstr3bData.table_4_itc.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_4_itc.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_4_itc.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹ {parseFloat(gstr3bData.table_4_itc.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              ₹ {parseFloat(gstr3bData.table_4_itc.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 5: Net Tax Payable Matrix */}
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48', marginBottom: '10px' }}>
                        Table 5: Net Tax Payable in Cash (Post ITC Set-Off)
                      </h4>
                      <table className="accounting-table">
                        <thead>
                          <tr>
                            <th>Description / Tax Head</th>
                            <th style={{ textAlign: 'right' }}>Tax Payable (Outward) (₹)</th>
                            <th style={{ textAlign: 'right' }}>Paid through ITC (Credit) (₹)</th>
                            <th style={{ textAlign: 'right' }}>Tax Paid in Cash (Net) (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 600 }}>Central Tax (CGST 2.5%)</td>
                            <td style={{ textAlign: 'right' }}>₹ {parseFloat(gstr3bData.table_3_1_outward.cgst).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', color: '#16a34a' }}>₹ {parseFloat(gstr3bData.table_4_itc.cgst).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f2b48' }}>₹ {parseFloat(gstr3bData.net_tax_payable.cgst).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 600 }}>State/UT Tax (SGST 2.5%)</td>
                            <td style={{ textAlign: 'right' }}>₹ {parseFloat(gstr3bData.table_3_1_outward.sgst).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', color: '#16a34a' }}>₹ {parseFloat(gstr3bData.table_4_itc.sgst).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f2b48' }}>₹ {parseFloat(gstr3bData.net_tax_payable.sgst).toFixed(2)}</td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                            <td style={{ color: '#0f2b48' }}>TOTAL NET TAX PAYABLE IN CASH</td>
                            <td style={{ textAlign: 'right' }}>₹ {parseFloat(gstr3bData.table_3_1_outward.total_tax).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', color: '#16a34a' }}>₹ {parseFloat(gstr3bData.table_4_itc.total_tax).toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontSize: '15px', color: '#0284c7' }}>
                              ₹ {parseFloat(gstr3bData.net_tax_payable.total).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>Calculating GSTR-3B Return...</div>
                  </div>
                )}
              </div>
            )}

            {/* ───── SUB-TAB 4: STOCK VALUATION & HSN AUDIT ───── */}
            {caSubTab === 'stock_valuation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {stockSummaryData ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL CATALOG ITEMS</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f2b48', marginTop: '2px' }}>
                          {stockSummaryData.total_items_count} Items
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Accurate Inventory Base</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL QUANTITY ON RECORD</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                          {parseFloat(stockSummaryData.total_stock_quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Units
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Pcs / Meters in stock</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>INVENTORY VALUATION (COST)</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
                          ₹ {(parseFloat(stockSummaryData.total_stock_valuation) / 10000000).toFixed(2)} Cr
                        </div>
                        <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '2px' }}>For CA Balance Sheet (Cost Basis)</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>POTENTIAL RETAIL VALUATION</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed', marginTop: '2px' }}>
                          ₹ {(parseFloat(stockSummaryData.total_retail_valuation) / 10000000).toFixed(2)} Cr
                        </div>
                        <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '2px' }}>At selling rate</div>
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                            Inventory Stock Valuation & Closing Balance Audit
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Item-wise closing stock and valuation for Chartered Accountant</span>
                        </div>
                      </div>

                      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="accounting-table">
                          <thead>
                            <tr>
                              <th>Item Code</th>
                              <th>Product Name</th>
                              <th>HSN</th>
                              <th>UOM</th>
                              <th style={{ textAlign: 'right' }}>Stock Qty</th>
                              <th style={{ textAlign: 'right' }}>Cost Rate (₹)</th>
                              <th style={{ textAlign: 'right' }}>Retail Rate (₹)</th>
                              <th style={{ textAlign: 'right' }}>Stock Asset Valuation (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockSummaryData.items.slice(0, 100).map((it) => (
                              <tr key={it.id}>
                                <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{it.item_code}</td>
                                <td style={{ fontWeight: 600 }}>{it.name}</td>
                                <td>{it.hsn_code}</td>
                                <td>{it.uom}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{parseFloat(it.current_stock).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(it.purchase_rate).toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>₹ {parseFloat(it.retail_rate).toFixed(2)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>
                                  ₹ {parseFloat(it.valuation_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>Calculating Inventory Stock Valuation...</div>
                  </div>
                )}
              </div>
            )}

            {/* ───── SUB-TAB 5: SHARE WITH CA / EXPORT ───── */}
            {caSubTab === 'share_ca' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Share2 size={18} style={{ color: '#0f766e' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2b48' }}>
                      Share Complete Compliance & Return Package with CA
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                    Everything your Chartered Accountant requires for monthly and quarterly GST filing in one convenient place. You can either copy the text summary directly to WhatsApp / Email or download the complete CSV workbook containing GSTR-1 B2B invoices, GSTR-2B purchase ITC bills, and the GSTR-3B tax computation.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48', marginBottom: '4px' }}>
                        Option 1: Download Full CA CSV Workbook
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                        Includes GSTR-3B Tax Summary, GSTR-1 B2B Sales List, and GSTR-2B Purchase ITC Register.
                      </div>
                      <button className="btn btn-primary" onClick={handleExportCaCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7' }}>
                        <Download size={14} /> Download CA Tax Workbook (.CSV)
                      </button>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48', marginBottom: '4px' }}>
                        Option 2: WhatsApp / Email Text Summary
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                        Formatted message with total sales, eligible ITC, and exact net cash tax payable to copy and send.
                      </div>
                      <button className="btn btn-secondary" onClick={handleCopyCaSummary} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Share2 size={14} /> Copy Summary for WhatsApp / Email
                      </button>
                    </div>
                  </div>

                  {/* Summary Preview Box */}
                  <div style={{ background: '#0f172a', borderRadius: '6px', padding: '16px', color: '#f8fafc', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, maxHeight: '300px', overflowY: 'auto' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>=== PREVIEW: CA GST COMPLIANCE REPORT ===</div>
                    <div>Firm: {activeFirm?.name} ({activeFirm?.gstin})</div>
                    <div>Period: {activeFYObj.label}</div>
                    <div style={{ margin: '8px 0', borderTop: '1px dashed #334155' }} />
                    {gstr3bData ? (
                      <>
                        <div style={{ color: '#93c5fd' }}>1. OUTWARD SALES (GSTR-1 / 3.1):</div>
                        <div> - Invoices Count: {gstr3bData.table_3_1_outward.invoice_count}</div>
                        <div> - Taxable Outward: ₹ {parseFloat(gstr3bData.table_3_1_outward.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div> - CGST (2.5%): ₹ {parseFloat(gstr3bData.table_3_1_outward.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div> - SGST (2.5%): ₹ {parseFloat(gstr3bData.table_3_1_outward.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div> - Output Tax Liability: ₹ {parseFloat(gstr3bData.table_3_1_outward.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div style={{ margin: '8px 0', borderTop: '1px dashed #334155' }} />
                        <div style={{ color: '#86efac' }}>2. INWARD PURCHASE ITC (GSTR-2B / 4):</div>
                        <div> - Bills Count: {gstr3bData.table_4_itc.bill_count}</div>
                        <div> - Taxable Purchases: ₹ {parseFloat(gstr3bData.table_4_itc.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div> - Eligible Input Credit (ITC): ₹ {parseFloat(gstr3bData.table_4_itc.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div style={{ margin: '8px 0', borderTop: '1px dashed #334155' }} />
                        <div style={{ color: '#fde047', fontWeight: 700 }}>3. NET TAX PAYABLE IN CASH:</div>
                        <div> - Net CGST: ₹ {parseFloat(gstr3bData.net_tax_payable.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div> - Net SGST: ₹ {parseFloat(gstr3bData.net_tax_payable.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 700 }}>
                          - TOTAL NET CASH PAYABLE: ₹ {parseFloat(gstr3bData.net_tax_payable.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    ) : (
                      <div>Loading return data...</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════ 8. EXECUTIVE DASHBOARD ═════════ */}
        {activeTab === 'dashboard' && (
          <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', color: '#0f2b48' }}>Executive Business Overview</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Period: {activeFYObj.label}</span>
              </div>
            </div>

            {dashboard && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                {/* 1. Total Sales */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>TOTAL SALES TURNOVER</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                    ₹ {parseFloat(dashboard.total_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>
                    ✓ {dashboard.invoices_count || dashboard.sales_invoices_count || 0} Tax Invoices Billed
                  </div>
                </div>

                {/* 2. Total Collections (Money IN) */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', letterSpacing: '0.04em', textTransform: 'uppercase' }}>TOTAL COLLECTIONS RECEIVED</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                    ₹ {parseFloat(dashboard.total_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
                    Cash: <strong>₹{parseFloat(dashboard.cash_collected || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong> • Bank/Cheque: <strong>₹{parseFloat(dashboard.bank_collected || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                  </div>
                </div>

                {/* 3. Net Receivables / Outstanding Udhaari */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>NET OUTSTANDING (UDHAARI)</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
                    ₹ {parseFloat(dashboard.total_receivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                    Customer Pending Ledger Balances
                  </div>
                </div>

                {/* 4. GST Tax Collected */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>OUTPUT GST COLLECTED</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f2b48', marginTop: '4px' }}>
                    ₹ {parseFloat(dashboard.total_tax_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                    5% Garment GST Rate
                  </div>
                </div>

                {/* 5. Inventory Catalog Items */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>INVENTORY CATALOG</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f766e', marginTop: '4px' }}>
                    {items.length} Products
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                    Accurate Master Synced
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ═════════ MODAL: NEW ITEM MASTER ═════════ */}
      {showItemModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="anim-modal-enter" style={{ background: '#ffffff', borderRadius: '6px', width: '520px', padding: '22px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '14px', color: '#0f2b48' }}>Add New Item Master (Garments & Apparel)</h3>
            <form onSubmit={handleCreateItem}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>Item Code / Article No. *</label>
                    <input
                      id="new-item-code"
                      type="text"
                      required
                      placeholder="e.g. BE1143(20/26)VANESIS"
                      className="input-field"
                      style={{ fontSize: '14.5px', padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700 }}
                      value={newItem.item_code}
                      onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>Item Type *</label>
                    <select
                      className="input-field"
                      style={{ fontSize: '14px', padding: '9px 10px', fontWeight: 600 }}
                      value={newItem.item_type || 'Readymade'}
                      onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                    >
                      <option value="Readymade">Readymade (Garments/Apparel)</option>
                      <option value="Fabric">Fabric (Than/Meters)</option>
                      <option value="Accessories">Accessories (Tags/Labels/Buttons)</option>
                      <option value="Hosiery">Hosiery Goods</option>
                      <option value="Other">Other Product</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Item Description (Particulars)</label>
                  <input
                    id="new-item-desc"
                    type="text"
                    placeholder="e.g. Boys Hooded Denim Jacket / Cotton Round Neck T-Shirt"
                    className="input-field"
                    style={{ fontSize: '14px', padding: '8px 12px' }}
                    value={newItem.description || ''}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Section / Category *</label>
                    <select
                      className="input-field"
                      value={newItem.category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setActiveCategoryTarget({ isNewItem: true });
                          setShowCategoryModal(true);
                          return;
                        }
                        setNewItem({ ...newItem, category: e.target.value });
                      }}
                      style={{ fontWeight: 600, fontSize: '14px', padding: '8px 10px' }}
                    >
                      <option value="__ADD_NEW__" style={{ fontWeight: 700, color: '#0284c7' }}>
                        + Add New Section / Category...
                      </option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Size (e.g. 20/26, M/XXL)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 20/26"
                      style={{ fontSize: '14px', padding: '8px 10px' }}
                      value={newItem.size}
                      onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>MRP (₹) *</label>
                    <input
                      id="new-item-mrp"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 619.00"
                      className="input-field"
                      style={{ fontSize: '15px', fontWeight: 700, padding: '9px 12px' }}
                      value={newItem.mrp}
                      onChange={(e) => setNewItem({ ...newItem, mrp: e.target.value, retail_rate: newItem.retail_rate || e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Selling / Wholesale Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 619.00"
                      className="input-field"
                      style={{ fontSize: '15px', fontWeight: 700, padding: '9px 12px' }}
                      value={newItem.retail_rate}
                      onChange={(e) => setNewItem({ ...newItem, retail_rate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>HSN Code</label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ fontSize: '14px' }}
                      value={newItem.hsn_code}
                      onChange={(e) => setNewItem({ ...newItem, hsn_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Primary Unit</label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ fontSize: '14px' }}
                      value={newItem.primary_uom}
                      onChange={(e) => setNewItem({ ...newItem, primary_uom: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Opening Stock</label>
                    <input
                      type="number"
                      className="input-field"
                      style={{ fontSize: '14px' }}
                      value={newItem.current_stock}
                      onChange={(e) => setNewItem({ ...newItem, current_stock: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Item Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════ MODAL: NEW PARTY ═════════ */}
      {showPartyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="anim-modal-enter" style={{ background: '#ffffff', borderRadius: '6px', width: '480px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '14px', color: '#0f2b48' }}>Add New Party Account</h3>
            <form onSubmit={handleCreateParty}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>Party Name *</label>
                  <input
                    id="new-party-name"
                    type="text"
                    required
                    className="input-field"
                    style={{ fontSize: '14.5px', padding: '9px 12px' }}
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Party Type</label>
                  <select
                    className="input-field"
                    value={newParty.party_type}
                    onChange={(e) => setNewParty({ ...newParty, party_type: e.target.value })}
                  >
                    <option value="customer">Customer (Buyer)</option>
                    <option value="vendor">Vendor / Supplier</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 27AABFF3019R1Z6"
                      value={newParty.gstin}
                      onChange={(e) => setNewParty({ ...newParty, gstin: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Mobile No</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPartyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Party Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════ MODAL: LEDGER PAYMENT / RECEIPT ═════════ */}
      {showLedgerPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="anim-modal-enter" style={{ background: '#ffffff', borderRadius: '6px', width: '480px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', color: '#0f2b48', marginBottom: '4px', fontWeight: 700 }}>
              Record Payment / Receipt
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
              Party: <strong>{ledgerData?.party?.name}</strong>
            </p>

            <form onSubmit={handleRecordLedgerPayment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Transaction Type
                  </label>
                  <select
                    className="input-field"
                    value={ledgerPaymentForm.payment_type}
                    onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, payment_type: e.target.value })}
                  >
                    <option value="receipt">Receipt (Money IN from Customer)</option>
                    <option value="payment">Payment (Money OUT to Vendor)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Payment Mode
                  </label>
                  <select
                    className="input-field"
                    value={ledgerPaymentForm.payment_mode}
                    onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, payment_mode: e.target.value })}
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank_transfer">NEFT / RTGS / Bank Transfer</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="e.g. 5000"
                      required
                      value={ledgerPaymentForm.amount}
                      onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Payment Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={ledgerPaymentForm.payment_date}
                      onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, payment_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Reference / UTR / Cheque No.
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. UPI Ref 3829104812"
                    value={ledgerPaymentForm.reference_number}
                    onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, reference_number: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Remarks / Notes
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Optional remarks"
                    value={ledgerPaymentForm.notes}
                    onChange={(e) => setLedgerPaymentForm({ ...ledgerPaymentForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLedgerPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Payment Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════ MODAL: NEW SECTION / CATEGORY ═════════ */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div className="anim-modal-enter" style={{ background: '#ffffff', borderRadius: '6px', width: '460px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Package size={22} color="#0284c7" />
              <h3 style={{ fontSize: '16px', color: '#0f2b48', margin: 0, fontWeight: 700 }}>Add New Item Section / Category</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.4' }}>
              Create a new category for your inventory (e.g. <strong>SAREES, KIDS WEAR, DRESS MATERIALS, FABRICS, JEANS</strong>).
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newCategoryName.trim().toUpperCase();
              if (!trimmed) return;
              if (!categories.includes(trimmed)) {
                setCategories(prev => [...prev, trimmed].sort());
              }
              if (activeCategoryTarget) {
                if (activeCategoryTarget.isPurchase) {
                  updatePurchaseLine(activeCategoryTarget.rowIndex, 'category', trimmed);
                } else if (activeCategoryTarget.isNewItem) {
                  setNewItem(prev => ({ ...prev, category: trimmed }));
                } else {
                  updateSaleLine(activeCategoryTarget.rowIndex, 'category', trimmed);
                }
                setTimeout(() => {
                  const prefix = activeCategoryTarget.isPurchase ? 'pur' : 'sale';
                  const itemEl = document.querySelector(`[data-type="${prefix}"][data-row="${activeCategoryTarget.rowIndex}"][data-col="item"]`);
                  if (itemEl) {
                    itemEl.focus();
                    try { itemEl.showPicker?.(); } catch (err) {}
                  }
                }, 60);
              }
              notify(`Section '${trimmed}' created and applied!`, 'success');
              setNewCategoryName('');
              setShowCategoryModal(false);
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Section / Category Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  required
                  autoFocus
                  placeholder="e.g. SAREES or KIDS WEAR"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value.toUpperCase())}
                  style={{ fontSize: '15px', fontWeight: 700, padding: '9px 12px', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Apply Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════ MODAL: PARKED BILLS ON HOLD (F2) ═════════ */}
      {showParkedBillsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div className="anim-modal-enter" style={{ background: '#ffffff', borderRadius: '8px', width: '620px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#0f2b48', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={22} color="#38bdf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Parked Bills On Hold (F2)</h3>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    {parkedBills.length} Bill{parkedBills.length !== 1 ? 's' : ''} currently held in counter memory
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowParkedBillsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {parkedBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <Clock size={44} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '15px', color: '#1e293b', marginBottom: '6px' }}>No Bills Currently on Hold</h4>
                  <p style={{ fontSize: '12.5px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                    When serving a customer at the counter, press <b>F2</b> or click <b>"Park Bill (F2)"</b> on the toolbar to hold an in-progress bill and attend to another customer without losing any line items.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {parkedBills.map((b) => (
                    <div 
                      key={b.id} 
                      style={{ 
                        border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px', 
                        background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#0f172a' }}>
                            {b.customer_name}
                          </span>
                          {b.customer_city && (
                            <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '3px' }}>
                              {b.customer_city}
                            </span>
                          )}
                          <span style={{ 
                            fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px',
                            background: b.rate_type === 'wholesale' ? '#fef3c7' : '#e0f2fe',
                            color: b.rate_type === 'wholesale' ? '#92400e' : '#0369a1',
                            textTransform: 'uppercase'
                          }}>
                            {b.rate_type || 'retail'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Held at <strong>{b.timestamp}</strong> | {b.items_count} item{b.items_count !== 1 ? 's' : ''} 
                          {b.lines && b.lines.length > 0 && b.lines[0].item_name && ` (${b.lines[0].item_name.substring(0, 26)}...)`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Amount</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f766e' }}>
                            ₹{parseFloat(b.grand_total || 0).toFixed(2)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleResumeParkedBill(b.id)}
                            style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}
                            title="Restore this bill to the Sales Voucher"
                          >
                            Resume (F2)
                          </button>
                          <button
                            onClick={() => handleDeleteParkedBill(b.id)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer' }}
                            title="Discard this parked bill"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', background: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowParkedBillsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ FOOTER STATUS BAR ═════════ */}
      <footer style={{
        background: '#ffffff', color: '#64748b', fontSize: '11px', padding: '8px 24px',
        borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          SyncBill ERP v2.7 — Offline-First Indian Accounting & GST POS
        </div>
        <div>
          Active Year: <strong style={{ color: '#0284c7' }}>{activeFYObj.label}</strong> | Database: SQLite (Offline Encrypted)
        </div>
      </footer>

      {/* ═════════ 100% FREE WHATSAPP WEB AUTOMATION BRIDGE MODAL ═════════ */}
      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        setNotification={setNotification}
      />
      </div>
    </div>
  );
}

