import React, { useCallback, useEffect, useRef, useState } from 'react';
import CameraPreview from '../components/CameraPreview';
import { CONFIG } from '../config';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeQuestion(forceAdd = false) {
  for (;;) {
    const operator = forceAdd ? '+' : ['+', '-', '×', '÷'][randInt(0, 3)];
    let a = randInt(1, 99);
    let b = randInt(1, 99);
    let answer;

    if (operator === '+') {
      if (a + b > 99) continue;
      answer = a + b;
    } else if (operator === '-') {
      if (a < b) [a, b] = [b, a];
      answer = a - b;
      if (answer < 1 || answer > 99) continue;
    } else if (operator === '×') {
      answer = a * b;
      if (answer < 1 || answer > 99) continue;
    } else {
      const divisor = randInt(1, 99);
      const quotient = randInt(1, 99);
      const dividend = divisor * quotient;
      if (dividend > 99) continue;
      a = dividend;
      b = divisor;
      answer = quotient;
    }
    return { text: `${a} ${operator} ${b}`, answer };
  }
}

export default function MathTask({ profile, onComplete }) {
  const inputRef = useRef(null);
  const taskStartedAtRef = useRef(Date.now());
  const questionStartedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const finishQuestionRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [question, setQuestion] = useState(() => makeQuestion());
  const [input, setInput] = useState('');
  const [duration, setDuration] = useState(CONFIG.math.initialQuestionMs);
  const [remaining, setRemaining] = useState(CONFIG.math.initialQuestionMs);
  const [totalRemaining, setTotalRemaining] = useState(CONFIG.math.totalSeconds * 1000);
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streakType, setStreakType] = useState(null);
  const [streak, setStreak] = useState(0);
  const [noInputStreak, setNoInputStreak] = useState(0);
  const [hint, setHint] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');

  const score = answered ? Math.round((correct / answered) * 100) : 0;
  const genderLabel = { male: '男性', female: '女性', other: '其他性别' }[profile?.gender] || '参与者';
  const ageLabel = Number(profile?.age) || '';

  const focusAnswer = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    focusAnswer();
    const interval = window.setInterval(focusAnswer, 500);
    return () => window.clearInterval(interval);
  }, [focusAnswer]);

  useEffect(() => {
    let active = true;
    const openCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('当前浏览器不支持摄像头，请使用最新版 Chrome 或 Edge。');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        setCameraStream(stream);
      } catch (error) {
        if (active) setCameraError(error?.name === 'NotAllowedError' ? '摄像头权限被拒绝，请在浏览器地址栏允许访问。' : '无法访问摄像头，请检查设备和浏览器权限。');
      }
    };
    openCamera();
    return () => {
      active = false;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const completeTask = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(score);
  }, [onComplete, score]);

  const finishQuestion = useCallback((kind) => {
    if (completedRef.current || feedback) return;
    const isCorrect = kind === 'correct';
    const nextAnswered = answered + 1;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextNoInput = kind === 'slow' || kind === 'missing' ? noInputStreak + 1 : 0;
    const nextType = isCorrect ? 'correct' : 'wrong';
    const nextStreak = streakType === nextType ? streak + 1 : 1;
    let nextDuration = duration;
    if (nextStreak >= (isCorrect ? CONFIG.math.correctStreak : CONFIG.math.wrongStreak)) {
      nextDuration = Math.max(500, Math.round(duration * (isCorrect ? CONFIG.math.correctTimeFactor : CONFIG.math.wrongTimeFactor)));
    }

    setAnswered(nextAnswered);
    setCorrect(nextCorrect);
    setNoInputStreak(nextNoInput);
    setStreakType(nextStreak >= 3 ? null : nextType);
    setStreak(nextStreak >= 3 ? 0 : nextStreak);
    setDuration(nextDuration);
    setFeedback(kind);
    setHint(nextNoInput >= CONFIG.math.noInputStreak);

    window.setTimeout(() => {
      if (completedRef.current) return;
      const forceAdd = nextNoInput >= CONFIG.math.noInputStreak;
      setQuestion(makeQuestion(forceAdd));
      setInput('');
      setFeedback('');
      setHint(false);
      questionStartedAtRef.current = Date.now();
      setRemaining(nextDuration);
      focusAnswer();
    }, 450);
  }, [answered, correct, duration, feedback, focusAnswer, noInputStreak, streak, streakType]);

  finishQuestionRef.current = finishQuestion;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (completedRef.current) return;
      const now = Date.now();
      const globalElapsed = now - taskStartedAtRef.current;
      const questionElapsed = now - questionStartedAtRef.current;
      const globalLeft = Math.max(0, CONFIG.math.totalSeconds * 1000 - globalElapsed);
      const questionLeft = Math.max(0, duration - questionElapsed);
      setTotalRemaining(globalLeft);
      setRemaining(Math.min(questionLeft, globalLeft));
      if (globalLeft <= 0) {
        completeTask();
        return;
      }
      if (questionLeft <= 0 && !feedback) {
        finishQuestionRef.current?.(noInputStreak >= CONFIG.math.noInputStreak - 1 ? 'missing' : 'slow');
      }
    }, 30);
    return () => window.clearInterval(timer);
  }, [completeTask, duration, feedback, noInputStreak]);

  const press = useCallback((digit) => {
    if (completedRef.current || feedback) return;
    const next = input + String(digit);
    if (next.length > 2) return;
    setInput(next);
    if (Number(next) === question.answer) finishQuestion('correct');
    else if (next.length === String(question.answer).length) finishQuestion('wrong');
  }, [feedback, finishQuestion, input, question.answer]);

  const handleInputChange = useCallback((event) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 2);
    if (completedRef.current || feedback) return;
    setInput(digits);
    if (!digits) return;
    if (Number(digits) === question.answer) finishQuestion('correct');
    else if (digits.length === String(question.answer).length) finishQuestion('wrong');
  }, [feedback, finishQuestion, question.answer]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (completedRef.current || feedback) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setInput((value) => value.slice(0, -1));
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setInput('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [feedback, press]);

  return (
    <main className="experiment-shell math-experiment">
      <aside className="experiment-camera-pane">
        <CameraPreview stream={cameraStream} />
        <div className="experiment-camera-label">前置摄像头 · 实时采集</div>
        {cameraError && <div className="camera-error-overlay">{cameraError}</div>}
      </aside>

      <section className="experiment-task-pane">
        <div className="math-task-inner">
          <section className="score-section">
            <div><span>你的正确率</span><strong>{score}%</strong></div>
            <div><span>{ageLabel}岁 {genderLabel}模拟参考</span><strong>{CONFIG.math.referenceScore}%</strong></div>
            <div className="score-bars">
              <div className="score-user" style={{ width: `${Math.min(100, score)}%` }} />
              <div className="score-reference" style={{ width: `${CONFIG.math.referenceScore}%` }} />
            </div>
            <div className="score-compare">{score >= CONFIG.math.referenceScore ? `高于参考水平 ${CONFIG.math.referenceScore} 个百分点` : `低于参考水平 ${CONFIG.math.referenceScore - score} 个百分点`}</div>
          </section>

          {hint && <div className="stress-hint">请认真完成测试。本研究仅能使用严肃对待的测试结果。</div>}

          <section className={`question-card feedback-${feedback}`}>
            <div className="question-number">已完成 {answered} 题 · 正在监控作答</div>
            <div className="question">{question.text}</div>
            <input
              ref={inputRef}
              className="answer answer-input"
              value={input}
              onChange={handleInputChange}
              onBlur={focusAnswer}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="off"
              aria-label="答案输入框"
            />
            {feedback === 'wrong' && <div className="feedback-text">回答错误！</div>}
            {feedback === 'slow' && <div className="feedback-text">太慢了！</div>}
            {feedback === 'missing' && <div className="feedback-text">请继续参与测试。</div>}
          </section>

          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, (remaining / duration) * 100))}%` }} /></div>
          <div className="task-meta">本题剩余 <strong>{Math.max(0, remaining / 1000).toFixed(1)}</strong> 秒</div>
          <div className="hardware-keypad-hint">键盘已锁定到答案输入框 · 数字小键盘 / 数字行均可输入 · Backspace 删除 · Esc 清空</div>
          <div className="sr-only">测试总时长固定为90秒，剩余约 {Math.ceil(totalRemaining / 1000)} 秒。</div>
        </div>
      </section>
    </main>
  );
}
