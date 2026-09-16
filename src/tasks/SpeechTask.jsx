import React, { useCallback, useEffect, useState } from 'react';
import CameraPreview from '../components/CameraPreview';
import AudioVisualizer from '../components/AudioVisualizer';
import { CONFIG, SPEECH_QUESTIONS } from '../config';

export default function SpeechTask({ onComplete, stream }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState('prepare');
  const [remaining, setRemaining] = useState(CONFIG.speech.preparationMs);
  const [silenceNotice, setSilenceNotice] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [stats, setStats] = useState(() => SPEECH_QUESTIONS.map(() => ({ silenceCount: 0 })));

  const phaseDuration = phase === 'prepare' ? CONFIG.speech.preparationMs : CONFIG.speech.speakingMs;

  const handleSilence = useCallback(() => {
    if (phase !== 'speak') return;
    setSilenceNotice(true);
    setStats((current) => current.map((item, index) => index === questionIndex ? { ...item, silenceCount: item.silenceCount + 1 } : item));
    window.setTimeout(() => setSilenceNotice(false), 900);
  }, [phase, questionIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(Math.max(0, phaseDuration - (Date.now() - startedAt)));
    }, 30);
    return () => clearInterval(timer);
  }, [phaseDuration, startedAt]);

  useEffect(() => {
    if (remaining > 0) return;
    if (phase === 'prepare') {
      setPhase('speak');
      setRemaining(CONFIG.speech.speakingMs);
      setStartedAt(Date.now());
    } else if (questionIndex + 1 < CONFIG.speech.questionCount) {
      setQuestionIndex((value) => value + 1);
      setPhase('prepare');
      setRemaining(CONFIG.speech.preparationMs);
      setStartedAt(Date.now());
      setSilenceNotice(false);
    } else {
      onComplete(stats);
    }
  }, [remaining, phase, questionIndex, onComplete, stats]);

  const question = SPEECH_QUESTIONS[questionIndex];
  const percent = Math.max(0, Math.min(100, (remaining / phaseDuration) * 100));

  return (
    <main className={`task-shell speech-task ${phase === 'speak' ? 'speech-running' : ''}`}>
      <section className="speech-camera"><CameraPreview stream={stream} /></section>
      <header className="speech-header">
        <div className="speech-stage">问题 {questionIndex + 1} / {CONFIG.speech.questionCount}</div>
        <div className="speech-phase">{phase === 'prepare' ? '准备时间' : '请开始演讲'}</div>
        <div className="speech-time">{(remaining / 1000).toFixed(1)}s</div>
      </header>
      <section className="speech-question">
        <h1>{question.title}</h1>
        <p>{question.prompt}</p>
        {phase === 'prepare' && <div className="prepare-warning">请准备一个条理清晰且有说服力的回答，并尽量使用完整的时间。</div>}
        {phase === 'speak' && <div className="speak-warning">请持续说话直到倒计时结束。</div>}
      </section>
      {phase === 'speak' && silenceNotice && <div className="silence-warning">请继续说话</div>}
      <div className="progress-track speech-progress"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
      <AudioVisualizer stream={stream} active={phase === 'speak'} onSilence={handleSilence} />
    </main>
  );
}
