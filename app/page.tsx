import MapApp from '@/components/MapApp';

export default function Home() {
  return (
    <>
      <MapApp />
      <noscript>
        <p style={{ padding: 16 }}>這個地圖需要啟用 JavaScript。緊急狀況請撥 110 報案、119 救護；心情低落可撥 1925 安心專線。</p>
      </noscript>
    </>
  );
}
