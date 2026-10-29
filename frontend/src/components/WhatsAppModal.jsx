import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, AlertCircle, RefreshCw, Send, 
  Smartphone, ShieldCheck, QrCode, PowerOff, ExternalLink
} from 'lucide-react';
import * as api from '../api';

export default function WhatsAppModal({ isOpen, onClose, setNotification }) {
  const [loading, setLoading] = useState(false);
  const [bridgeData, setBridgeData] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Namaste! This is a test message from SyncBill ERP.');
  const [sendingTest, setSendingTest] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getWhatsAppStatus();
      setBridgeData(data);
    } catch (err) {
      setBridgeData({
        bridge_online: false,
        connected: false,
        status: 'OFFLINE',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();

    // Auto-poll status every 3.5 seconds while open until connected
    const interval = setInterval(async () => {
      try {
        const data = await api.getWhatsAppStatus();
        setBridgeData(data);
      } catch (err) {}
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testPhone) {
      if (setNotification) setNotification({ type: 'error', message: 'Please enter a test phone number.' });
      return;
    }
    try {
      setSendingTest(true);
      const res = await api.sendCustomWhatsApp(testPhone, testMessage);
      if (setNotification) {
        setNotification({ type: 'success', message: `Test message sent successfully to ${testPhone}!` });
      }
    } catch (err) {
      if (setNotification) {
        setNotification({ type: 'error', message: err.message || 'Failed to send test message.' });
      }
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = bridgeData?.connected === true;
  const isOnline = bridgeData?.bridge_online === true;
  const qrImage = bridgeData?.qr_image;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Smartphone size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                WhatsApp Free Automation Bridge
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Zero Meta Charges • 100% Free Background Automation
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Status Banner */}
          {!isOnline ? (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '14px', display: 'flex', gap: '12px'
            }}>
              <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px' }}>
                  WhatsApp Bridge is Offline
                </div>
                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px', lineHeight: 1.4 }}>
                  The local WhatsApp service is not running on Port 3001.
                  <br />
                  <strong>To start it:</strong> Double-click <code>START_WHATSAPP_BRIDGE.bat</code> or <code>START_SYNCBILL.bat</code> on your desktop.
                </div>
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  style={{
                    marginTop: '8px', padding: '4px 10px', fontSize: '12px',
                    background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <RefreshCw size={12} className={loading ? 'spin' : ''} />
                  <span>Retry Connection</span>
                </button>
              </div>
            </div>
          ) : isConnected ? (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center'
            }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', flexShrink: 0
              }}>
                <ShieldCheck size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#166534', fontSize: '15px' }}>
                    WhatsApp Connected & Active
                  </span>
                  <span style={{
                    fontSize: '10px', background: '#22c55e', color: '#fff',
                    padding: '2px 6px', borderRadius: '10px', fontWeight: 700
                  }}>
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                  +{bridgeData.phone || 'Unknown'} {bridgeData.name ? `(${bridgeData.name})` : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                  SyncBill will automatically send bill summaries & payment receipts directly from this number.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px'
              }}>
                Scan QR Code with WhatsApp
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Open WhatsApp on phone &rarr; <strong>Settings</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>
              </div>

              {qrImage ? (
                <div style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '2px solid #22c55e',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)'
                }}>
                  <img 
                    src={qrImage} 
                    alt="WhatsApp QR Code" 
                    style={{ width: '240px', height: '240px', display: 'block' }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '240px', height: '240px', margin: '0 auto',
                  background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', color: '#64748b'
                }}>
                  <RefreshCw size={24} className="spin" color="#0284c7" />
                  <span style={{ fontSize: '12px' }}>Generating fresh QR code...</span>
                </div>
              )}

              <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                QR code refreshes automatically every 20 seconds.
              </div>
            </div>
          )}

          {/* Test Sender Form (Only when connected) */}
          {isConnected && (
            <form onSubmit={handleSendTest} style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={14} color="#0284c7" />
                <span>Send a Test Message</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Customer Phone (10 digits)
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: '13px',
                      borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                    Message Content
                  </label>
                  <textarea
                    rows={2}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: '12px',
                      borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || !testPhone}
                  style={{
                    alignSelf: 'flex-start',
                    background: '#0284c7', color: '#fff', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    cursor: (sendingTest || !testPhone) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', opacity: (sendingTest || !testPhone) ? 0.6 : 1
                  }}
                >
                  <Send size={13} />
                  <span>{sendingTest ? 'Sending...' : 'Send WhatsApp Message'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Quick Info Box */}
          <div style={{
            background: '#f1f5f9', borderRadius: '6px', padding: '10px 12px',
            fontSize: '11px', color: '#475569', lineHeight: 1.5
          }}>
            <strong>💡 How SyncBill uses this:</strong>
            <br />
            • When you click <strong>"Auto WhatsApp"</strong> on any Tax Invoice, Receipt, or Party Statement, SyncBill sends it silently via your linked phone.
            <br />
            • No third-party gateway can read your customer data or charge you subscription fees.
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <a
            href={`http://${window.location.hostname}:3001/qr-view`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '11px', color: '#0284c7', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600
            }}
          >
            <span>Open Bridge Web View</span>
            <ExternalLink size={11} />
          </a>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
