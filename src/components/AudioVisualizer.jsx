import React, { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';

export default function AudioVisualizer({ stream, active, onSilence }) {
  const canvasRef = useRef(null);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream || !active) return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf;
    let silentSince = null;
    let lastNotice = 0;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
      setVolume(mean);

      if (mean <= CONFIG.speech.silenceThreshold) {
        if (silentSince === null) silentSince = performance.now();
        if (performance.now() - silentSince >= CONFIG.speech.silenceMs && performance.now() - lastNotice > 1200) {
          onSilence?.();
          lastNotice = performance.now();
        }
      } else {
        silentSince = null;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        const bars = 48;
        for (let i = 0; i < bars; i += 1) {
          const index = Math.floor((i / bars) * data.length);
          const bar = Math.max(3, (data[index] / 255) * height);
          const x = (i / bars) * width;
          ctx.fillRect(x, height - bar, Math.max(2, width / bars - 2), bar);
        }
      }
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      context.close();
    };
  }, [stream, active, onSilence]);

  return (
    <div className="audio-panel">
      <canvas ref={canvasRef} width="800" height="120" />
      <div className="volume-label">音量 {Math.round(volume)}</div>
    </div>
  );
}
