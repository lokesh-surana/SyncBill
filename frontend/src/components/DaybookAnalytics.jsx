import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Download, RefreshCw, Printer, Search, 
  FileSpreadsheet, ArrowLeft, TrendingUp, Users, Package, 
  ChevronLeft, ChevronRight, DollarSign, Wallet, CreditCard, 
  ArrowDownLeft, ArrowUpRight, AlertTriangle, ShieldCheck, Tag
} from 'lucide-react';
import * as api from '../api';

export default function DaybookAnalytics({
  firmId = 2,
  firms = [],
  notify = () => {},
  onOpenLedger = () => {},
  onOpenBarcode = () => {},
  onBackToDesk = () => {},
}) {
  const [activeSubTab, setActiveSubTab] = useState('daybook'); // 'daybook' | 'top_parties' | 'stock_analytics'
  const [selectedFirmId, setSelectedFirmId] = useState('all'); // 'all' or firmId
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [daybookData, setDaybookData] = useState(null);
  const [loadingDaybook, setLoadingDaybook] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Stock Summary & Customer stats
  const [stockSummary, setStockSummary] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  const loadDaybook = async (d = targetDate, fId = selectedFirmId) => {
    try {
      setLoadingDaybook(true);
      const data = await api.getDaybook(fId, d);
      setDaybookData(data);
    } catch (err) {
      notify(err.message || 'Failed to load daybook', 'error');
    } finally {
      setLoadingDaybook(false);
    }
  };

  const loadStockData = async () => {
    try {
      setLoadingStock(true);
      const data = await api.getStockSummary();
      setStockSummary(data || []);
    } catch (err) {
      console.error('Failed to load stock summary', err);
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    loadDaybook(targetDate, selectedFirmId);
  }, [targetDate, selectedFirmId]);

  useEffect(() => {
    if (activeSubTab === 'stock_analytics' && stockSummary.length === 0) {
      loadStockData();
    }
  }, [activeSubTab]);

  const handleDateStep = (deltaDays) => {
    const cur = new Date(targetDate);
    cur.setDate(cur.getDate() + deltaDays);
    setTargetDate(cur.toISOString().split('T')[0]);
  };

  const filteredEntries = useMemo(() => {
    if (!daybookData || !daybookData.entries) return [];
    if (!searchFilter.trim()) return daybookData.entries;
    const q = searchFilter.toLowerCase();
    return daybookData.entries.filter(e => 
      (e.party_name || '').toLowerCase().includes(q) ||
      (e.voucher_no || '').toLowerCase().includes(q) ||
      (e.voucher_type || '').toLowerCase().includes(q) ||
      (e.particulars || '').toLowerCase().includes(q)
    );
  }, [daybookData, searchFilter]);

  const summary = daybookData?.summary || {
    cash_inflows: 0,
    bank_inflows: 0,
    total_collections: 0,
    credit_sales: 0,
    cash_outflows: 0,
    bank_outflows: 0,
    total_outflows: 0,
    net_cash_delta: 0,
    vouchers_count: 0
  };

  const handleExportTally = () => {
    const url = api.getTallyXmlUrl(selectedFirmId, targetDate, targetDate);
    window.open(url, '_blank');
    notify('Tally XML export initiated for ' + targetDate);
  };

  return (
    <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ═════════ TOP CONTROL TOOLBAR ═════════ */}
      <div style={{
        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onBackToDesk}
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f2b48' }}>
                Accurate Daybook & Cash Register
              </h3>
              <span className="badge badge-cyan">
                {summary.vouchers_count} Transactions Today
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Daily Cash Inflows, UPI Settlements, Credit (Udhaari) Sales & Tally ERP XML Export
            </div>
          </div>
        </div>

        {/* View Switcher Pills & Tally XML Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '3px', gap: '3px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setActiveSubTab('daybook')}
              style={{
                border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                background: activeSubTab === 'daybook' ? '#0f2b48' : 'transparent',
                color: activeSubTab === 'daybook' ? '#ffffff' : '#475569',
              }}
            >
              📅 Daybook Register
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setActiveSubTab('stock_analytics')}
              style={{
                border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                background: activeSubTab === 'stock_analytics' ? '#0f2b48' : 'transparent',
                color: activeSubTab === 'stock_analytics' ? '#ffffff' : '#475569',
              }}
            >
              📦 Stock & Reorder Analysis
            </button>
          </div>

          <button
            type="button"
            className="btn"
            onClick={handleExportTally}
            style={{
              background: '#047857', color: '#ffffff', border: 'none',
              padding: '6px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
            }}
            title="Download Tally ERP 9 / Tally Prime compatible XML import file"
          >
            <Download size={13} />
            <span>Tally XML Export</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'daybook' && (
        <>
          {/* ═════════ DATE & MULTI-FIRM SELECTOR BAR ═════════ */}
          <div style={{
            background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
            padding: '12px 18px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: '12px'
          }}>
            {/* Date Nav Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                Daybook Date:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDateStep(-1)}
                  style={{ padding: '4px 8px' }}
                  title="Previous Day"
                >
                  <ChevronLeft size={14} />
                </button>
                <input
                  type="date"
                  className="input-field"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{ fontSize: '12.5px', padding: '4px 8px', fontWeight: 700, color: '#0f2b48' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDateStep(1)}
                  style={{ padding: '4px 8px' }}
                  title="Next Day"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTargetDate(new Date().toISOString().split('T')[0])}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Today
                </button>
              </div>
            </div>

            {/* Firm Selector Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>🏢 Firm:</span>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelectedFirmId('all')}
                  style={{
                    padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                    background: selectedFirmId === 'all' ? '#0f2b48' : 'transparent',
                    color: selectedFirmId === 'all' ? '#ffffff' : '#475569',
                  }}
                >
                  🏢 All Combined
                </button>
                {firms.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSelectedFirmId(f.id)}
                    style={{
                      padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: 'none',
                      background: selectedFirmId === f.id ? '#0284c7' : 'transparent',
                      color: selectedFirmId === f.id ? '#ffffff' : '#475569',
                    }}
                  >
                    {f.name.split(' ')[0]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadDaybook(targetDate, selectedFirmId)}
                title="Reload Daybook"
                style={{ padding: '5px 8px' }}
              >
                <RefreshCw size={12} className={loadingDaybook ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ═════════ 4 KPI SUMMARY CARDS ═════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            {/* Cash Inflow */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
                  Cash Collections (नकद)
                </span>
                <Wallet size={16} color="#16a34a" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                ₹ {summary.cash_inflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                Counter Cash sales + receipts
              </span>
            </div>

            {/* Bank & UPI Inflow */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>
                  Bank & UPI Inflows (ऑनलाइन)
                </span>
                <CreditCard size={16} color="#0284c7" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>
                ₹ {summary.bank_inflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                GPay, PhonePe, NEFT & Cheques
              </span>
            </div>

            {/* Credit Sales */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 700, textTransform: 'uppercase' }}>
                  Credit Sales (उधारी माल)
                </span>
                <Users size={16} color="#ea580c" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#c2410c', marginTop: '4px' }}>
                ₹ {summary.credit_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                Unpaid bill balance given to customers
              </span>
            </div>

            {/* Net Daily Cash Delta */}
            <div style={{
              background: summary.net_cash_delta >= 0 ? '#f0fdf4' : '#fff1f2',
              border: `1.5px solid ${summary.net_cash_delta >= 0 ? '#86efac' : '#fca5a5'}`,
              borderRadius: '6px', padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                  color: summary.net_cash_delta >= 0 ? '#15803d' : '#be123c'
                }}>
                  Net Cash Delta (Cash In Hand)
                </span>
                <DollarSign size={16} color={summary.net_cash_delta >= 0 ? '#15803d' : '#be123c'} />
              </div>
              <div style={{
                fontSize: '20px', fontWeight: 800, marginTop: '4px',
                color: summary.net_cash_delta >= 0 ? '#15803d' : '#be123c'
              }}>
                ₹ {summary.net_cash_delta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                Inflows (₹{summary.cash_inflows.toFixed(0)}) - Outflows (₹{summary.cash_outflows.toFixed(0)})
              </span>
            </div>
          </div>

          {/* ═════════ DAYBOOK TRANSACTIONS REGISTER TABLE ═════════ */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px',
              flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48' }}>
                Daybook Transactions for {daybookData?.date || targetDate} ({filteredEntries.length} Records)
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search party, voucher or notes..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ width: '230px', paddingLeft: '26px', fontSize: '11.5px', padding: '5px 8px 5px 26px' }}
                />
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8' }} />
              </div>
            </div>

            <table className="accounting-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Time</th>
                  <th style={{ width: '130px' }}>Voucher Type</th>
                  <th style={{ width: '130px' }}>Voucher No</th>
                  <th>Party Name</th>
                  <th>Particulars & Remarks</th>
                  <th style={{ textAlign: 'right', width: '100px', color: '#15803d' }}>Cash In (₹)</th>
                  <th style={{ textAlign: 'right', width: '100px', color: '#b91c1c' }}>Cash Out (₹)</th>
                  <th style={{ textAlign: 'right', width: '105px', color: '#0284c7' }}>Bank/UPI (₹)</th>
                  <th style={{ textAlign: 'right', width: '100px', color: '#ea580c' }}>Udhaari (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      {loadingDaybook ? 'Loading daybook...' : 'No transactions recorded on this date.'}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row) => (
                    <tr key={row.id}>
                      <td style={{ color: '#64748b', fontSize: '11.5px' }}>{row.time}</td>
                      <td>
                        <span style={{
                          fontSize: '11px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                          background: row.voucher_type.includes('Sales') ? '#e0f2fe' : row.voucher_type.includes('Receipt') ? '#dcfce7' : row.voucher_type.includes('Purchase') ? '#ccfbf1' : '#ffedd5',
                          color: row.voucher_type.includes('Sales') ? '#0369a1' : row.voucher_type.includes('Receipt') ? '#15803d' : row.voucher_type.includes('Purchase') ? '#0f766e' : '#c2410c'
                        }}>
                          {row.voucher_type}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        <div>{row.voucher_no}</div>
                        {row.firm_name && (
                          <span style={{ fontSize: '9px', color: '#64748b' }}>
                            [{row.firm_name.split(' ')[0]}]
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {row.party_name}
                      </td>
                      <td style={{ color: '#475569', fontSize: '11.5px' }}>
                        {row.particulars}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.cash_in > 0 ? 700 : 400, color: row.cash_in > 0 ? '#15803d' : '#94a3b8' }}>
                        {row.cash_in > 0 ? `₹ ${row.cash_in.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.cash_out > 0 ? 700 : 400, color: row.cash_out > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {row.cash_out > 0 ? `₹ ${row.cash_out.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: (row.bank_in > 0 || row.bank_out > 0) ? 700 : 400, color: row.bank_in > 0 ? '#0284c7' : '#94a3b8' }}>
                        {row.bank_in > 0 ? `₹ ${row.bank_in.toFixed(2)}` : row.bank_out > 0 ? `-₹ ${row.bank_out.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.credit_amount !== 0 ? 700 : 400, color: row.credit_amount > 0 ? '#c2410c' : '#94a3b8' }}>
                        {row.credit_amount !== 0 ? `₹ ${row.credit_amount.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═════════ TAB 2: STOCK & REORDER ANALYSIS ═════════ */}
      {activeSubTab === 'stock_analytics' && (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                Stock Summary & Reorder Warning Analysis
              </h4>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Items nearing or below reorder threshold in inventory
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadStockData}
              style={{ fontSize: '11.5px' }}
            >
              <RefreshCw size={12} className={loadingStock ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <table className="accounting-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th style={{ textAlign: 'right' }}>Reorder Level</th>
                <th style={{ textAlign: 'center' }}>Stock Health</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {loadingStock ? 'Analyzing inventory...' : 'No inventory data available.'}
                  </td>
                </tr>
              ) : (
                stockSummary.map((item) => {
                  const stock = parseFloat(item.current_stock || 0);
                  const reorder = parseFloat(item.reorder_level || 0);
                  const isLow = stock <= reorder;

                  return (
                    <tr key={item.id} style={{ background: isLow ? '#fff1f2' : 'inherit' }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.item_code || `SKU-${item.id}`}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? '#be123c' : '#059669' }}>
                        {stock} {item.primary_uom || 'Pcs'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>
                        {reorder} {item.primary_uom || 'Pcs'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isLow ? (
                          <span className="badge badge-rose" style={{ fontSize: '10px' }}>
                            ⚠️ Low Stock
                          </span>
                        ) : (
                          <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                            ✓ In Stock
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenBarcode(item)}
                          style={{ fontSize: '11px', padding: '3px 8px', color: '#0284c7' }}
                          title="Generate Barcodes for this item"
                        >
                          <Tag size={11} /> Barcode
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
