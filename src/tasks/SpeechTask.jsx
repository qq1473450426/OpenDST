import React, { useEffect, useRef, useState } from 'react';
import CameraPreview from '../components/CameraPreview';
import AudioVisualizer from '../components/AudioVisualizer';
import { CONFIG } from '../config';

function calculateRms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const x = (data[i] - 128) / 128;
    sum += x * x;
  }
  return Math.sqrt(sum / data.length);
}

export default function SpeechTask({ onComplete }) {
  const [phase, setPhase] = useState('prepare');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remaining, setRemaining] = useState(CONFIG.speech.preparationMs);
  const [volume, setVolume] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [flash, setFlash] = useState(false);
  const [done, setDone] = useState(false);
  const [audioData, setAudioData] = useState(new Uint8Array(128));
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [micReady, setMicReady] = useState(false);
  const [micPermission, setMicPermission] = useState('未知');
  const [micInfo, setMicInfo] = useState({
    label: '未获取',
    readyState: '—',
    enabled: false,
    muted: false,
    sampleRate: '—',
    channelCount: '—',
  });
  const [audioState, setAudioState] = useState('未初始化');
  const [rms, setRms] = useState(0);
  const [noiseFloor, setNoiseFloor] = useState(0);
  const [threshold, setThreshold] = useState(CONFIG.speech.silenceRmsThreshold);
  const [retryKey, setRetryKey] = useState(0);

  const phaseRef = useRef('prepare');
  const startRef = useRef(Date.now());
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const rafRef = useRef(null);
  const silenceRef = useRef(0);
  const noiseFloorRef = useRef(0.008);

  const question = CONFIG.speech.questions[questionIndex];

  useEffect(() => {
    let active = true;

    const updatePermission = async () => {
      try {
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({ name: 'microphone' });
          if (active) {
            setMicPermission(result.state === 'granted' ? '已允许' : result.state === 'denied' ? '已拒绝' : '待授权');
            result.onchange = () => {
              if (active) setMicPermission(result.state === 'granted' ? '已允许' : result.state === 'denied' ? '已拒绝' : '待授权');
            };
          }
        }
      } catch {
        if (active) setMicPermission('浏览器未提供');
      }
    };

    const setupMedia = async () => {
      setMediaError('');
      setMicReady(false);
      setAudioState('正在初始化');
      setMicInfo((info) => ({ ...info, readyState: '请求中…' }));
      await updatePermission();

      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('当前浏览器不支持摄像头/麦克风，请使用最新版 Chrome 或 Edge。');
        setAudioState('不支持');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setMediaStream(stream);
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          setMediaError('没有检测到麦克风音轨，请检查 Windows 输入设备。');
          setAudioState('无麦克风音轨');
          return;
        }

        const settings = audioTrack.getSettings ? audioTrack.getSettings() : {};
        setMicReady(true);
        setMicInfo({
          label: audioTrack.label || '浏览器未提供设备名称',
          readyState: audioTrack.readyState,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          sampleRate: settings.sampleRate || '—',
          channelCount: settings.channelCount || '—',
        });

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          setMediaError('当前浏览器不支持 Web Audio 声音检测。');
          setAudioState('Web Audio 不支持');
          return;
        }

        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        setAudioState(ctx.state);
        ctx.onstatechange = () => {
          if (active) setAudioState(ctx.state);
        };
        await ctx.resume().catch(() => {});
        setAudioState(ctx.state);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.15;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        noiseFloorRef.current = 0.008;

        const tick = () => {
          if (!active) return;
          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(frequencyData);
          const currentRms = calculateRms(timeData);

          if (phaseRef.current !== 'speak' || currentRms < noiseFloorRef.current * 1.8) {
            noiseFloorRef.current = noiseFloorRef.current * 0.98 + currentRms * 0.02;
          }
          const currentThreshold = Math.max(
            CONFIG.speech.silenceRmsThreshold,
            noiseFloorRef.current * 2.2,
          );
          const displayVolume = Math.min(100, Math.round(Math.max(0, currentRms - noiseFloorRef.current) * 900));

          setRms(currentRms);
          setNoiseFloor(noiseFloorRef.current);
          setThreshold(currentThreshold);
          setVolume(displayVolume);
          setAudioData(new Uint8Array(frequencyData));
          setMicInfo((info) => ({
            ...info,
            readyState: audioTrack.readyState,
            enabled: audioTrack.enabled,
            muted: audioTrack.muted,
          }));

          if (phaseRef.current === 'speak') {
            if (currentRms >= currentThreshold) {
              silenceRef.current = 0;
              setSpeaking(true);
            } else {
              if (!silenceRef.current) silenceRef.current = Date.now();
              if (Date.now() - silenceRef.current >= CONFIG.speech.silenceMs) setSpeaking(false);
            }
          } else {
            silenceRef.current = 0;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (error) {
        if (!active) return;
        setMicReady(false);
        setAudioState('初始化失败');
        setMediaError(
          error?.name === 'NotAllowedError'
            ? '摄像头/麦克风权限被拒绝，请点击地址栏摄像头图标并允许访问。'
            : error?.name === 'NotFoundError'
              ? '系统没有找到可用麦克风，请检查 Windows 声音输入设备。'
              : `无法访问摄像头/麦克风：${error?.message || '请检查系统输入设备。'}`,
        );
      }
    };

    setupMedia();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.onstatechange = null;
        audioContextRef.current.close().catch(() => {});
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [retryKey]);

  useEffect(() => {
    phaseRef.current = phase;
    startRef.current = Date.now();
    setRemaining(phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs);
    setSpeaking(false);
    setFlash(false);
    silenceRef.current = 0;
    if (done) return undefined;

    const timer = window.setInterval(() => {
      const limit = phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs;
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, limit - elapsed);
      setRemaining(left);
      if (phase === 'speak') setFlash(Math.floor(elapsed / 250) % 2 === 0);
      if (left <= 0) {
        window.clearInterval(timer);
        if (phase === 'prepare') setPhase('speak');
        else if (questionIndex < CONFIG.speech.questions.length - 1) {
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
  const rmsPercent = Math.min(100, Math.round(rms * 1000));

  return (
    <main className="experiment-shell speech-experiment">
      <aside className="experiment-camera-pane">
        <CameraPreview stream={mediaStream} />
        <div className="experiment-camera-label">前置摄像头 · 实时采集</div>
      </aside>

      <section className={`experiment-task-pane speech-task-pane ${phase === 'speak' && flash ? 'stress-flash' : ''}`}>
        <div className="speech-task-inner">
          <div className="speech-header"><span>自由演讲任务</span><span>第 {questionIndex + 1} / {CONFIG.speech.questions.length} 题</span></div>
          <div className="speech-phase">{phase === 'prepare' ? '准备时间' : '请开始回答'}</div>
          <div className="speech-timer">{(remaining / 1000).toFixed(1)}<small> 秒</small></div>
          <div className="speech-question-label">请根据问题进行回答</div>
          <h2>{question}</h2>
          {mediaError && <div className="media-error">{mediaError}</div>}
          {phase === 'speak' && !speaking && <div className="speak-warning">请继续说话</div>}
          <AudioVisualizer audioData={audioData} />
          <div className="volume-meter">声音强度：{volume} {micReady ? '· 麦克风正常' : '· 麦克风未就绪'}</div>
          <div className="speech-progress"><div style={{ width: `${progress}%` }} /></div>
          <div className="speech-status">{phase === 'prepare' ? '请阅读问题并准备回答' : (speaking ? '正在检测声音…' : '未检测到声音，请继续说话')}</div>

          <details className="mic-diagnostics" open>
            <summary>麦克风实时诊断</summary>
            <div className="mic-diagnostic-grid">
              <div><span>权限</span><strong>{micPermission}</strong></div>
              <div><span>麦克风状态</span><strong>{micReady ? '正常' : '未就绪'}</strong></div>
              <div><span>音轨</span><strong>{micInfo.readyState} / {micInfo.enabled ? 'enabled' : 'disabled'}{micInfo.muted ? ' / muted' : ''}</strong></div>
              <div><span>AudioContext</span><strong>{audioState}</strong></div>
              <div className="wide"><span>输入设备</span><strong title={micInfo.label}>{micInfo.label}</strong></div>
              <div><span>采样率</span><strong>{micInfo.sampleRate} Hz</strong></div>
              <div><span>声道</span><strong>{micInfo.channelCount}</strong></div>
              <div><span>RMS</span><strong>{rms.toFixed(4)}</strong></div>
              <div><span>噪声底</span><strong>{noiseFloor.toFixed(4)}</strong></div>
              <div><span>检测阈值</span><strong>{threshold.toFixed(4)}</strong></div>
              <div className="wide"><span>当前输入电平</span><div className="mic-level"><i style={{ width: `${rmsPercent}%` }} /></div></div>
            </div>
            <div className="mic-diagnostic-tip">
              说话时观察 RMS 和输入电平是否明显上升。若 RMS 始终接近 0，请检查 Windows“设置 → 系统 → 声音 → 输入”以及浏览器地址栏的麦克风权限。
            </div>
            <button type="button" className="mic-retry-button" onClick={() => setRetryKey((value) => value + 1)}>
              重新检测麦克风
            </button>
          </details>
        </div>
      </section>
    </main>
  );
}
