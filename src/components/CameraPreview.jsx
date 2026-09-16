import React, { useEffect, useRef, useState } from 'react';

export default function CameraPreview({ className = '' }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    let active = true;

    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    }).then((mediaStream) => {
      stream = mediaStream;
      if (active && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    }).catch((err) => {
      if (active) setError(`无法访问摄像头/麦克风：${err?.message || '请检查浏览器权限'}`);
    });

    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className={`camera-box ${className}`}>
      {error ? <div className="camera-error">{error}</div> : <video ref={videoRef} autoPlay muted playsInline />}
      <div className="recording-badge"><span /> REC</div>
    </div>
  );
}
