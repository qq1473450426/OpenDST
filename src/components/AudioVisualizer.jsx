import React, { useEffect, useRef } from 'react';

export default function AudioVisualizer({ audioData }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height;
    ctx.clearRect(0, 0, width, height); ctx.beginPath();
    const step = width / Math.max(1, audioData.length);
    audioData.forEach((v, i) => { const y = height - (v / 255) * height; if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * step, y); });
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
  }, [audioData]);
  return <canvas ref={canvasRef} width="640" height="100" style={{ width: '100%', height: 100 }} aria-label="声音可视化" />;
}
