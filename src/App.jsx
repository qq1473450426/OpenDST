import React, { useState } from 'react';
import MathTask from './tasks/MathTask';
import SpeechIntro from './tasks/SpeechIntro';
import SpeechTask from './tasks/SpeechTask';

export default function App() {
  const [stage, setStage] = useState('profile');
  const [profile, setProfile] = useState({ age: '', gender: '' });
  const [mathScore, setMathScore] = useState(null);

  const start = () => {
    const age = Number(profile.age);
    if (!Number.isInteger(age) || age < 1 || age > 120 || !profile.gender) return;
    setStage('math');
  };

  if (stage === 'profile') {
    return (
      <main className="start-shell">
        <div className="start-card">
          <h1>测试开始</h1>
          <p>请填写年龄和性别，用于生成<strong>模拟的同龄/同性别参考组</strong>标签。</p>
          <p className="form-note">参考值为固定的模拟值 75%，不代表真实人群统计数据。</p>

          <label htmlFor="age">年龄</label>
          <input
            id="age"
            type="number"
            min="1"
            max="120"
            step="1"
            value={profile.age}
            onChange={(e) => setProfile({ ...profile, age: e.target.value })}
            placeholder="请输入年龄"
          />

          <label htmlFor="gender">性别</label>
          <select
            id="gender"
            value={profile.gender}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
          >
            <option value="">请选择</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他/不便说明</option>
          </select>

          <button className="primary-button" onClick={start} disabled={!profile.age || !profile.gender}>
            开始心算任务
          </button>
        </div>
      </main>
    );
  }

  if (stage === 'math') {
    return (
      <MathTask
        profile={profile}
        onComplete={(score) => {
          setMathScore(score);
          setStage('speechIntro');
        }}
      />
    );
  }

  if (stage === 'speechIntro') return <SpeechIntro onStart={() => setStage('speech')} />;
  if (stage === 'speech') return <SpeechTask onComplete={() => setStage('done')} />;

  return (
    <main className="start-shell">
      <div className="start-card">
        <h1>测试结束</h1>
        <p>本次任务已经完成。</p>
        <p>心算任务最终正确率：<strong>{mathScore ?? 0}%</strong></p>
        <button className="primary-button" onClick={() => window.location.reload()}>重新开始</button>
      </div>
    </main>
  );
}
