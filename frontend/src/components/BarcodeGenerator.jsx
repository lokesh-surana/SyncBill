import React, { useState, useMemo, useRef } from 'react';
import { 
  Printer, Search, Plus, Trash2, Tag, Check, RefreshCw, 
  Layers, Sliders, X, Eye, FileText, ArrowLeft, Building2
} from 'lucide-react';

// Code 128B pattern table (107 patterns, each pattern is 11 modules wide, stop pattern is 13 modules)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

function generateCode128SvgBars(text) {
  if (!text) return null;
  const clean = text.replace(/[^\x20-\x7E]/g, '');
  if (!clean) return null;

  const START_B = 104;
  const STOP = 106;

  let values = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    values.push(code);
    checksum += code * (i + 1);
  }

  values.push(checksum % 103);
  values.push(STOP);

  // Convert width strings into binary bar/space pattern
  let modules = [];
  values.forEach(v => {
    const pat = CODE128_PATTERNS[v];
    if (pat) {
      let isBar = true;
      for (let ch of pat) {
        const count = parseInt(ch);
        for (let k = 0; k < count; k++) {
          modules.push(isBar ? 1 : 0);
        }
        isBar = !isBar;
      }
    }
  });

  return modules;
}

export default function BarcodeGenerator({
  firmId = 2,
  firms = [],
  items = [],
  notify = () => {},
  onBackToDesk = () => {},
  initialItems = [], // Optional preloaded items from purchase entry
}) {
  // Config state
  const [labelSize, setLabelSize] = useState('50x25'); // '50x25' | '38x25' | 'a4_24'
  const [selectedFirmId, setSelectedFirmId] = useState(firmId);
  const [showStoreHeader, setShowStoreHeader] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showOfferPrice, setShowOfferPrice] = useState(true);
  const [showSize, setShowSize] = useState(true);
  const [showColor, setShowColor] = useState(true);

  // Items in the print queue: { item, qty, customRate, customMrp, customSize, customColor }
  const [printQueue, setPrintQueue] = useState(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(it => ({
        id: it.id || Math.random(),
        item_code: it.item_code || `SG-${it.id || 100}`,
        name: it.name || it.item_name || 'Garment Item',
        category: it.category || 'READYMADE',
        size: it.size || 'Free',
        color: it.color || '',
        mrp: it.mrp || it.rate || 0,
        rate: it.rate || it.retail_rate || 0,
        qty: it.quantity || 1,
      }));
    }
    // Default: Pick top 2 items from items master if available
    if (items.length > 0) {
      return items.slice(0, 2).map(it => ({
        id: it.id,
        item_code: it.item_code || `SG-${it.id}`,
        name: it.name,
        category: it.category || 'READYMADE',
        size: it.size || '38',
        color: '',
        mrp: it.mrp || (parseFloat(it.retail_rate || 0) * 1.25) || 599,
        rate: it.retail_rate || it.wholesale_rate || 499,
        qty: 4,
      }));
    }
    return [];
  });

  // Search master to add items
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const activeFirm = firms.find(f => f.id === parseInt(selectedFirmId)) || firms[0] || { name: 'APEX APPARELS & TEXTILES' };

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach(it => { if (it.category) set.add(it.category); });
    return ['ALL', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchCat = categoryFilter === 'ALL' || it.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (it.name || '').toLowerCase().includes(q) || (it.item_code || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    }).slice(0, 20);
  }, [items, searchQuery, categoryFilter]);

  const handleAddItemToQueue = (it) => {
    const existing = printQueue.find(q => q.id === it.id);
    if (existing) {
      setPrintQueue(prev => prev.map(q => q.id === it.id ? { ...q, qty: q.qty + 1 } : q));
      notify(`Increased ${it.name} stickers to ${existing.qty + 1}`);
    } else {
      setPrintQueue(prev => [
        ...prev,
        {
          id: it.id,
          item_code: it.item_code || `SG-${it.id}`,
          name: it.name,
          category: it.category || 'READYMADE',
          size: it.size || '38',
          color: '',
          mrp: it.mrp || (parseFloat(it.retail_rate || 0) * 1.25) || 599,
          rate: it.retail_rate || it.wholesale_rate || 499,
          qty: 2,
        }
      ]);
      notify(`Added ${it.name} to barcode print queue`);
    }
  };

  const updateQueueItem = (id, field, value) => {
    setPrintQueue(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const removeQueueItem = (id) => {
    setPrintQueue(prev => prev.filter(q => q.id !== id));
  };

  const totalStickersToPrint = useMemo(() => {
    return printQueue.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
  }, [printQueue]);

  // Flattened stickers list for preview and print
  const flattenedStickers = useMemo(() => {
    const list = [];
    printQueue.forEach(item => {
      const count = parseInt(item.qty) || 0;
      for (let i = 0; i < count; i++) {
        list.push({ ...item, stickerIndex: i + 1, totalInGroup: count });
      }
    });
    return list;
  }, [printQueue]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="anim-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ═════════ TOP CONTROL TOOLBAR (SCREEN ONLY) ═════════ */}
      <div className="no-print" style={{
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
              <Tag size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f2b48' }}>
                Garment Barcode & Price Tag Generator
              </h3>
              <span className="badge badge-cyan">
                {totalStickersToPrint} Sticker{totalStickersToPrint !== 1 ? 's' : ''} Ready
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Standard thermal roll & laser sticker label printing (Code 128 / MRP / Size / Color)
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPrintQueue([])}
            disabled={printQueue.length === 0}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Clear Queue
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={flattenedStickers.length === 0}
            style={{
              fontSize: '12.5px', fontWeight: 700, padding: '7px 16px',
              display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7'
            }}
          >
            <Printer size={15} />
            <span>Print {totalStickersToPrint} Stickers</span>
          </button>
        </div>
      </div>

      {/* ═════════ 2-COLUMN SPLIT: CONTROLS & QUEUE (LEFT) + LIVE PRINT PREVIEW (RIGHT) ═════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.35fr', gap: '16px' }}>

        {/* ─── COLUMN 1: QUEUE & LABEL CONFIGURATION (NO-PRINT) ─── */}
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Label Dimensions & Format Options */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px 16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={15} color="#0284c7" />
              <span>Label Format & Dimensions</span>
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setLabelSize('50x25')}
                style={{
                  padding: '8px 10px', textAlign: 'center', borderRadius: '5px',
                  border: labelSize === '50x25' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: labelSize === '50x25' ? '#f0f9ff' : '#ffffff',
                  color: labelSize === '50x25' ? '#0369a1' : '#475569',
                  fontWeight: labelSize === '50x25' ? 700 : 500,
                  fontSize: '11.5px', cursor: 'pointer'
                }}
              >
                <div>50 × 25 mm</div>
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>2" × 1" Standard</div>
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => setLabelSize('38x25')}
                style={{
                  padding: '8px 10px', textAlign: 'center', borderRadius: '5px',
                  border: labelSize === '38x25' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: labelSize === '38x25' ? '#f0f9ff' : '#ffffff',
                  color: labelSize === '38x25' ? '#0369a1' : '#475569',
                  fontWeight: labelSize === '38x25' ? 700 : 500,
                  fontSize: '11.5px', cursor: 'pointer'
                }}
              >
                <div>38 × 25 mm</div>
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>1.5" × 1" Compact</div>
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => setLabelSize('a4_24')}
                style={{
                  padding: '8px 10px', textAlign: 'center', borderRadius: '5px',
                  border: labelSize === 'a4_24' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: labelSize === 'a4_24' ? '#f0f9ff' : '#ffffff',
                  color: labelSize === 'a4_24' ? '#0369a1' : '#475569',
                  fontWeight: labelSize === 'a4_24' ? 700 : 500,
                  fontSize: '11.5px', cursor: 'pointer'
                }}
              >
                <div>A4 (24 Sheets)</div>
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>3 × 8 Grid</div>
              </button>
            </div>

            {/* Firm Header Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                  Print Firm Header:
                </label>
                <select
                  className="input-field"
                  value={selectedFirmId}
                  onChange={(e) => setSelectedFirmId(e.target.value)}
                  style={{ fontSize: '11.5px', padding: '4px 6px' }}
                >
                  {firms.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                  Field Toggles:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showMrp} onChange={e => setShowMrp(e.target.checked)} />
                    MRP
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showOfferPrice} onChange={e => setShowOfferPrice(e.target.checked)} />
                    Our Rate
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showSize} onChange={e => setShowSize(e.target.checked)} />
                    Size
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showColor} onChange={e => setShowColor(e.target.checked)} />
                    Color
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Print Queue Items */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f2b48' }}>
                Sticker Queue ({printQueue.length} Products)
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Total: <strong>{totalStickersToPrint}</strong> labels
              </span>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '8px 12px' }}>
              {printQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '12px' }}>
                  No items in sticker queue. Pick items from below to add.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {printQueue.map((item) => (
                    <div 
                      key={item.id}
                      style={{
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '5px',
                        padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span>SKU: {item.item_code}</span>
                          <span>|</span>
                          <span>Cat: {item.category}</span>
                        </div>
                      </div>

                      {/* Size, Color, Price Inputs */}
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Size"
                          value={item.size}
                          onChange={(e) => updateQueueItem(item.id, 'size', e.target.value)}
                          style={{ width: '42px', padding: '3px 4px', fontSize: '11px', textAlign: 'center' }}
                          title="Garment Size"
                        />
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Color"
                          value={item.color}
                          onChange={(e) => updateQueueItem(item.id, 'color', e.target.value)}
                          style={{ width: '46px', padding: '3px 4px', fontSize: '11px', textAlign: 'center' }}
                          title="Color"
                        />
                        <input
                          type="number"
                          className="input-field"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => updateQueueItem(item.id, 'rate', e.target.value)}
                          style={{ width: '56px', padding: '3px 4px', fontSize: '11px', textAlign: 'right' }}
                          title="Selling Rate (₹)"
                        />
                        <input
                          type="number"
                          className="input-field"
                          placeholder="MRP"
                          value={item.mrp}
                          onChange={(e) => updateQueueItem(item.id, 'mrp', e.target.value)}
                          style={{ width: '56px', padding: '3px 4px', fontSize: '11px', textAlign: 'right' }}
                          title="MRP (₹)"
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            className="input-field"
                            value={item.qty}
                            onChange={(e) => updateQueueItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                            style={{ width: '42px', padding: '3px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}
                            title="Number of stickers to print"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Catalog Picker to Add More Items */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                Add Items from Inventory ({items.length} SKUs)
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  className="input-field"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ fontSize: '11px', padding: '2px 5px', maxWidth: '120px' }}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Filter name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '130px', fontSize: '11px', padding: '2px 6px' }}
                />
              </div>
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {filteredItems.map(it => (
                <div 
                  key={it.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 8px', borderRadius: '4px', background: '#f8fafc', border: '1px solid #f1f5f9',
                    fontSize: '11.5px'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{it.name}</span>
                    <span style={{ color: '#64748b', fontSize: '10.5px', marginLeft: '6px' }}>
                      (Rate: ₹{parseFloat(it.retail_rate || 0).toFixed(2)})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleAddItemToQueue(it)}
                    style={{ padding: '2px 6px', fontSize: '10.5px', color: '#0284c7' }}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ─── COLUMN 2: LIVE PRINT PREVIEW (PRINTABLE CONTAINER) ─── */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div className="no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px',
            paddingBottom: '8px', borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0f2b48' }}>
              <Eye size={15} color="#0284c7" />
              <span>Live Sticker Print Preview ({flattenedStickers.length} Labels)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Format: <strong>{labelSize.replace('_', ' ').toUpperCase()}</strong>
            </div>
          </div>

          {/* Stickers Grid */}
          <div 
            id="barcode-print-canvas"
            className={`barcode-canvas-${labelSize}`}
            style={{
              flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 230px)',
              display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-start',
              padding: '8px', background: '#f1f5f9', borderRadius: '4px'
            }}
          >
            {flattenedStickers.length === 0 ? (
              <div style={{ width: '100%', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                <Tag size={40} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>Sticker Preview Area</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Add products to the queue to view real-time barcode sticker labels.
                </div>
              </div>
            ) : (
              flattenedStickers.map((stk, idx) => {
                const barcodeData = stk.item_code || `SG-${stk.id}`;
                const modules = generateCode128SvgBars(barcodeData) || [];

                return (
                  <div
                    key={`${stk.id}-${idx}`}
                    className={`barcode-label barcode-label-${labelSize}`}
                    style={{
                      background: '#ffffff',
                      border: '1px dashed #94a3b8',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      padding: '4px 6px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      ...(labelSize === '50x25' ? { width: '189px', height: '94px', minWidth: '189px', minHeight: '94px' } :
                        labelSize === '38x25' ? { width: '144px', height: '94px', minWidth: '144px', minHeight: '94px' } :
                        { width: '210px', height: '110px' })
                    }}
                  >
                    {/* Header Store Name */}
                    {showStoreHeader && (
                      <div style={{
                        fontSize: labelSize === '38x25' ? '8.5px' : '9.5px',
                        fontWeight: 800, textAlign: 'center', color: '#0f2b48',
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                        lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden'
                      }}>
                        {activeFirm.name}
                      </div>
                    )}

                    {/* Garment Item Name */}
                    <div style={{
                      fontSize: labelSize === '38x25' ? '9px' : '10px',
                      fontWeight: 700, color: '#000000', textAlign: 'center',
                      lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {stk.name}
                    </div>

                    {/* Size & Color Line */}
                    {(showSize || showColor) && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                        fontSize: labelSize === '38x25' ? '8px' : '9px', fontWeight: 700, color: '#334155',
                        lineHeight: 1
                      }}>
                        {showSize && <span>SIZE: <strong>{stk.size || 'FREE'}</strong></span>}
                        {showColor && stk.color && <span>COL: <strong>{stk.color}</strong></span>}
                      </div>
                    )}

                    {/* SVG Barcode Graphic */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1px' }}>
                      <svg
                        viewBox={`0 0 ${modules.length} 26`}
                        preserveAspectRatio="none"
                        style={{ width: '92%', height: labelSize === '38x25' ? '18px' : '22px', display: 'block' }}
                      >
                        {modules.map((val, bIdx) => (
                          val === 1 ? (
                            <rect
                              key={bIdx}
                              x={bIdx}
                              y={0}
                              width={1}
                              height={26}
                              fill="#000000"
                            />
                          ) : null
                        ))}
                      </svg>
                      <div style={{
                        fontSize: labelSize === '38x25' ? '7.5px' : '8.5px',
                        fontFamily: 'monospace', color: '#1e293b',
                        fontWeight: 600, letterSpacing: '0.8px', marginTop: '1px', lineHeight: 1
                      }}>
                        {barcodeData}
                      </div>
                    </div>

                    {/* Price / MRP Line */}
                    <div style={{
                      display: 'flex', justifyContent: showMrp && showOfferPrice ? 'space-between' : 'center',
                      alignItems: 'baseline', fontSize: labelSize === '38x25' ? '8.5px' : '9.5px',
                      borderTop: '0.5px solid #e2e8f0', paddingTop: '2px', lineHeight: 1
                    }}>
                      {showMrp && (
                        <span style={{ color: '#475569', fontSize: labelSize === '38x25' ? '8px' : '9px' }}>
                          MRP: <span style={{ textDecoration: showOfferPrice && stk.mrp > stk.rate ? 'line-through' : 'none' }}>₹{parseFloat(stk.mrp || 0).toFixed(0)}</span>
                        </span>
                      )}
                      {showOfferPrice && (
                        <span style={{ fontWeight: 800, color: '#000000', fontSize: labelSize === '38x25' ? '9.5px' : '10.5px' }}>
                          RATE: ₹{parseFloat(stk.rate || 0).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ═════════ PRINT STYLESHEET (ACTIVE ONLY ON WINDOW.PRINT) ═════════ */}
      <style>{`
        @media print {
          /* Hide non-printable UI */
          body * {
            visibility: hidden;
          }
          #barcode-print-canvas, #barcode-print-canvas * {
            visibility: visible;
          }
          #barcode-print-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            gap: 2mm !important;
          }
          .barcode-label {
            border: 0.5px solid #000000 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
          }
          @page {
            margin: 3mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
