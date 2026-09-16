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
  const [mediaStream, setMediaStream] = useState(null);

  const phaseRef = useRef('prepare');
  const startRef = useRef(Date.now());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const silenceRef = useRef(0);

  const question = CONFIG.speech.questions[questionIndex];

  useEffect(() => {
    let active = true;

    const setupMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setMediaStream(stream);

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!active) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
          setVolume(avg);
          setAudioData(new Uint8Array(data));

          if (phaseRef.current === 'speak') {
            if (avg < CONFIG.speech.silenceThreshold) {
              if (!silenceRef.current) silenceRef.current = Date.now();
              if (Date.now() - silenceRef.current >= CONFIG.speech.silenceMs) setSpeaking(false);
            } else {
              silenceRef.current = 0;
              setSpeaking(true);
            }
          } else {
            silenceRef.current = 0;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // CameraPreview will show the waiting state; the task itself remains usable.
      }
    };

    setupMedia();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    startRef.current = Date.now();
    setRemaining(phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs);
    setSpeaking(true);
    setFlash(false);
    silenceRef.current = 0;

    if (done) return undefined;

    const timer = window.setInterval(() => {
      const limit = phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs;
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, limit - elapsed);
      setRemaining(left);

      if (phase === 'speak') {
        setFlash(Math.floor(elapsed / 250) % 2 === 0);
      }

      if (left <= 0) {
        window.clearInterval(timer);
        if (phase === 'prepare') {
          setPhase('speak');
        } else if (questionIndex < CONFIG.speech.questions.length - 1) {
          setQuestionIndex((index) => index + 1);
          setPhase('prepare');
        } else {
          setDone(true);
          onComplete?.();
        }
      }
    }, 30);

    return () => window.clearInterval(timer);
  }, [phase, questionIndex, done, onComplete]);

  const totalMs = phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs;
  const progress = Math.max(0, Math.min(100, 100 - (remaining / totalMs) * 100));

  return (
    <main className={`speech-shell ${phase === 'speak' && flash ? 'stress-flash' : ''}`}>
      <CameraPreview stream={mediaStream} />
      <section className="speech-content">
        <div className="speech-phase">{phase === 'prepare' ? '准备时间' : '请开始回答'}</div>
        <div className="speech-timer">{(remaining / 1000).toFixed(1)} s</div>
        <h2>{question}</h2>
        {phase === 'speak' && !speaking && <div className="speak-warning">请继续说话</div>}
        <AudioVisualizer audioData={audioData} />
        <div className="volume-meter">声音强度：{Math.round(volume)}</div>
        <div className="speech-progress"><div style={{ width: `${progress}%` }} /></div>
        <div className="speech-counter">第 {questionIndex + 1} / {CONFIG.speech.questions.length} 题</div>
      </section>
    </main>
  );
}
