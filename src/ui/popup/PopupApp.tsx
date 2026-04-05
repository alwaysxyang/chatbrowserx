import { translateMessage } from '../../shared/i18n/i18n';

export function PopupApp() {
  return (
    <main style={{ width: 320, padding: 16, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>ChatBrowserX</h1>
      <p style={{ color: '#4b5563', lineHeight: 1.5 }}>{translateMessage('popup.description')}</p>
    </main>
  );
}
