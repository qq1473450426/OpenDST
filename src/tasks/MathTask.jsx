import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
      if (dividend < 1 || dividend > 99) continue;
      a = dividend;
      b = divisor;
      answer = quotient;
    }

    return { text: `${a} ${operator} ${b}`, answer };
  }
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function MathTask({ onComplete, stream }) {
  const experimentStartedAt = useRef(Date.now());
  const [question, setQuestion] = useState(() => makeQuestion());
  const [input, setInput] = useState('');
  const [duration, setDuration] = useState(CONFIG.math.initialQuestionMs);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [remaining, setRemaining] = useState(CONFIG.math.initialQuestionMs);
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streakType, setStreakType] = useState(null);
  const [streak, setStreak] = useState(0);
  const [noInputStreak, setNoInputStreak] = useState(0);
  const [randomKeyboardLeft, setRandomKeyboardLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hint, setHint] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const score = answered ? Math.round((correct / answered) * 100) : 0;
  const standardKeys = ['1','2','3','4','5','6','7','8','9','0'];
  const keyboard = useMemo(
    () => randomKeyboardLeft > 0 ? shuffle(standardKeys) : standardKeys,
    [randomKeyboardLeft]
  );

  useEffect(() => {
    if (finished) return undefined;
    const timer = setInterval(() => {
      const questionElapsed = Date.now() - startedAt;
      const experimentElapsed = (Date.now() - experimentStartedAt.current) / 1000;
      setRemaining(Math.max(0, duration - questionElapsed));
      setTotalElapsed(experimentElapsed);
    }, 30);
    return () => clearInterval(timer);
  }, [duration, startedAt, finished]);

  useEffect(() => {
    if (!finished && totalElapsed >= CONFIG.math.totalSeconds) {
      setFinished(true);
      onComplete(score);
    }
  }, [totalElapsed, finished, onComplete, score]);

  const finishQuestion = useCallback((kind) => {
    if (finished || feedback) return;
    const isCorrect = kind === 'correct';
    const nextAnswered = answered + 1;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextNoInput = kind === 'slow' || kind === 'missing' ? noInputStreak + 1 : 0;
    const nextType = isCorrect ? 'correct' : 'wrong';
    const nextStreak = streakType === nextType ? streak + 1 : 1;
    let nextDuration = duration;
    let nextRandom = Math.max(0, randomKeyboardLeft - 1);

    if (nextStreak >= (isCorrect ? CONFIG.math.correctStreak : CONFIG.math.wrongStreak)) {
      nextDuration = Math.max(500, Math.round(duration * (isCorrect ? CONFIG.math.correctTimeFactor : CONFIG.math.wrongTimeFactor)));
      if (isCorrect) nextRandom = CONFIG.math.randomKeyboardTasks;
    }

    setAnswered(nextAnswered);
    setCorrect(nextCorrect);
    setNoInputStreak(nextNoInput);
    setStreakType(nextStreak >= 3 ? null : nextType);
    setStreak(nextStreak >= 3 ? 0 : nextStreak);
    setDuration(nextDuration);
    setRandomKeyboardLeft(nextRandom);
    setFeedback(kind);
    setHint(nextNoInput >= CONFIG.math.noInputStreak);

    const forceAdd = nextNoInput >= CONFIG.math.noInputStreak;
    window.setTimeout(() => {
      setQuestion(makeQuestion(forceAdd));
      setInput('');
      setFeedback('');
      setHint(false);
      setStartedAt(Date.now());
      setRemaining(nextDuration);
    }, 700);
  }, [answered, correct, duration, feedback, finished, noInputStreak, randomKeyboardLeft, streak, streakType]);

  const press = (digit) => {
    if (feedback || finished) return;
    const next = input + digit;
    if (next.length > 2) return;
    setInput(next);
    if (Number(next) === question.answer) finishQuestion('correct');
    else if (next.length === String(question.answer).length) finishQuestion('wrong');
  };

  useEffect(() => {
    if (finished || feedback || remaining > 0) return undefined;
    finishQuestion(noInputStreak >= CONFIG.math.noInputStreak - 1 ? 'missing' : 'slow');
    return undefined;
  }, [remaining, finished, feedback, finishQuestion, noInputStreak]);

  return (
    <main className="task-shell math-task">
      <section className="camera-section"><CameraPreview stream={stream} /></section>
      <section className="score-section">
        <div><span>当前正确率</span><strong>{score}%</strong></div>
        <div><span>同年龄/同性别参考</span><strong>{CONFIG.math.referenceScore}%</strong></div>
        <div className="score-bars">
          <div className="score-user" style={{ width: `${Math.min(100, score)}%` }} />
          <div className="score-reference" style={{ width: `${CONFIG.math.referenceScore}%` }} />
        </div>
      </section>
      {hint && <div className="stress-hint">请认真完成测试。本研究仅能使用严肃对待的测试结果。</div>}
      <section className={`question-card feedback-${feedback}`}>
        <div className="question-number">已完成 {answered} 题</div>
        <div className="question">{question.text}</div>
        <div className="answer">{input || ' '}</div>
        {feedback === 'wrong' && <div className="feedback-text">回答错误！</div>}
        {feedback === 'slow' && <div className="feedback-text">太慢了！</div>}
        {feedback === 'missing' && <div className="feedback-text">请继续参与测试。</div>}
      </section>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, (remaining / duration) * 100))}%` }} /></div>
      <section className="keypad">
        {keyboard.map((digit) => <button key={digit} disabled={!!feedback} onClick={() => press(digit)}>{digit}</button>)}
        <button className="clear" disabled={!!feedback} onClick={() => setInput('')}>清除</button>
      </section>
      <div className="task-meta">本题 {Math.max(0, remaining / 1000).toFixed(1)} 秒 · 剩余实验时间 {Math.max(0, CONFIG.math.totalSeconds - totalElapsed).toFixed(0)} 秒</div>
    </main>
  );
}
