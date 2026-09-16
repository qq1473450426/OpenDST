import React, { useEffect, useRef, useState } from 'react';
import CameraPreview from '../components/CameraPreview';
import AudioVisualizer from '../components/AudioVisualizer';
import { CONFIG } from '../config';

export default function SpeechTask({ onComplete }) {
  const [phase, setPhase] = useState('prepare');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remaining, setRemaining] = useState(CONFIG.speech.preparationMs);
  const [volume, setVolume] = useState(0);
  const [speaking, setSpeaking] = useState(true);
  const [flash, setFlash] = useState(false);
  const [done, setDone] = useState(false);
  const [audioData, setAudioData] = useState(new Uint8Array(64));
  const startRef = useRef(Date.now());
  const audioContextRef = useRef(null); const analyserRef = useRef(null); const rafRef = useRef(null); const streamRef = useRef(null);
  const silenceRef = useRef(0);

  const question = CONFIG.speech.questions[questionIndex];

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: true }).then((stream) => {
      if (!active) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream); source.connect(analyser); audioContextRef.current = ctx; analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!active) return; analyser.getByteFrequencyData(data); const avg = data.reduce((a, b) => a + b, 0) / data.length; setVolume(avg); setAudioData(new Uint8Array(data));
        if (phase === 'speak') { if (avg < CONFIG.speech.silenceThreshold) { if (!silenceRef.current) silenceRef.current = Date.now(); if (Date.now() - silenceRef.current >= CONFIG.speech.silenceMs) setSpeaking(false); } else { silenceRef.current = 0; setSpeaking(true); } }
        rafRef.current = requestAnimationFrame(tick);
      }; tick();
    }).catch(() => {});
    return () => { active = false; cancelAnimationFrame(rafRef.current); audioContextRef.current?.close(); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [phase]);

  useEffect(() => {
    if (done) return undefined;
    startRef.current = Date.now(); setRemaining(phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs);
    const timer = setInterval(() => { const limit = phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs; const left = Math.max(0, limit - (Date.now() - startRef.current)); setRemaining(left); if (phase === 'speak') setFlash(Math.floor((Date.now() - startRef.current) / 250) % 2 === 0); if (left <= 0) { clearInterval(timer); if (phase === 'prepare') setPhase('speak'); else if (questionIndex < CONFIG.speech.questions.length - 1) { setQuestionIndex((i) => i + 1); setPhase('prepare'); } else { setDone(true); onComplete?.(); } } }, 30);
    return () => clearInterval(timer);
  }, [phase, questionIndex, done, onComplete]);

  return <main className={`speech-shell ${phase === 'speak' && flash ? 'stress-flash' : ''}`}>
    <CameraPreview stream={streamRef.current} />
    <section className="speech-content">
      <div className="speech-phase">{phase === 'prepare' ? '准备时间' : '请开始回答'}</div>
      <div className="speech-timer">{(remaining / 1000).toFixed(1)} s</div>
      <h2>{question}</h2>
      {phase === 'speak' && !speaking && <div className="speak-warning">请继续说话</div>}
      <AudioVisualizer audioData={audioData} />
      <div className="volume-meter">声音强度：{Math.round(volume)}</div>
      <div className="speech-progress"><div style={{ width: `${100 - (remaining / (phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs)) * 100}%` }} /></div>
      <div className="speech-counter">第 {questionIndex + 1} / {CONFIG.speech.questions.length} 题</div>
    </section>
  </main>;
}
