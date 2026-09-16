import React from 'react';

export default function SpeechIntro({ onStart }) {
  return (
    <main className="start-shell">
      <div className="speech-intro-card">
        <h1>自由演讲任务</h1>
        <p>接下来将进行三个口头表达任务。</p>
        <ul>
          <li>每个问题有 <strong>10 秒准备时间</strong>。</li>
          <li>准备结束后有 <strong>20 秒回答时间</strong>，请尽量持续表达并使用完整时间。</li>
          <li>任务期间将使用前置摄像头和麦克风进行实时采集与显示。</li>
          <li>如果持续没有检测到声音，屏幕会提示“请继续说话”。</li>
          <li>演讲阶段可能出现红色视觉刺激。</li>
        </ul>
        <p><strong>准备好后点击下面的按钮开始。</strong></p>
        <button className="primary-button" onClick={onStart}>开始自由演讲任务</button>
      </div>
    </main>
  );
}
