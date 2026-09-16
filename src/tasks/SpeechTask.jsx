import React, { useEffect, useRef, useState } from 'react';
import CameraPreview from '../components/CameraPreview';
import AudioVisualizer from '../components/AudioVisualizer';
import { CONFIG } from '../config';

function calculateRms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const normalized = (data[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

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
  const [mediaError, setMediaError] = useState('');

  const phaseRef = useRef('prepare');
  const startRef = useRef(Date.now());
  const audioContextRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const silenceRef = useRef(0);

  const question = CONFIG.speech.questions[questionIndex];

  useEffect(() => {
    let active = true;

    const setupMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('当前浏览器不支持摄像头/麦克风访问，请使用最新版 Chrome 或 Edge。');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setMediaStream(stream);

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          setMediaError('当前浏览器不支持 Web Audio，声音检测不可用。');
          return;
        }

        const ctx = new AudioContextClass();
        await ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.25;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = ctx;

        const timeData = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!active) return;

          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(frequencyData);

          const rms = calculateRms(timeData);
          const displayVolume = Math.min(100, Math.round(rms * 1000));
          setVolume(displayVolume);
          setAudioData(new Uint8Array(frequencyData));

          if (phaseRef.current === 'speak') {
            if (rms < CONFIG.speech.silenceRmsThreshold) {
              if (!silenceRef.current) silenceRef.current = Date.now();
              if (Date.now() - silenceRef.current >= CONFIG.speech.silenceMs) {
                setSpeaking(false);
              }
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
      } catch (error) {
        if (!active) return;
        const message = error?.name === 'NotAllowedError'
          ? '摄像头/麦克风权限被拒绝，请在浏览器地址栏中允许访问。'
          : `无法访问摄像头/麦克风：${error?.message || '请检查浏览器权限。'}`;
        setMediaError(message);
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
    <main className="speech-shell">
      <aside className="speech-camera-pane">
        <CameraPreview stream={mediaStream} />
        <div className="speech-camera-label">前置摄像头 · 实时采集</div>
      </aside>

      <section className={`speech-content ${phase === 'speak' && flash ? 'stress-flash' : ''}`}>
        <div className="speech-content-inner">
          <div className="speech-header">
            <span>自由演讲任务</span>
            <span>第 {questionIndex + 1} / {CONFIG.speech.questions.length} 题</span>
          </div>

          <div className="speech-phase">{phase === 'prepare' ? '准备时间' : '请开始回答'}</div>
          <div className="speech-timer">{(remaining / 1000).toFixed(1)}<small> 秒</small></div>
          <div className="speech-question-label">请根据问题进行回答</div>
          <h2>{question}</h2>

          {mediaError && <div className="media-error">{mediaError}</div>}
          {phase === 'speak' && !speaking && <div className="speak-warning">请继续说话</div>}

          <AudioVisualizer audioData={audioData} />
          <div className="volume-meter">声音强度：{volume}</div>
          <div className="speech-progress"><div style={{ width: `${progress}%` }} /></div>

          <div className="speech-status">
            {phase === 'prepare' ? '请阅读问题并准备回答' : (speaking ? '正在检测声音…' : '未检测到声音，请继续说话')}
          </div>
        </div>
      </section>
    </main>
  );
}
