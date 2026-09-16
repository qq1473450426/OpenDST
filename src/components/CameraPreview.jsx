import React, { useEffect, useRef } from 'react';

export default function CameraPreview({ stream, className = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className={`camera-box ${className}`}>
      {stream ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="camera-waiting">正在等待摄像头权限…</div>}
      <div className="recording-badge"><span /> REC</div>
    </div>
  );
}
