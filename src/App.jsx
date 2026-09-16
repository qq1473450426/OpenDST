import React, { useEffect, useState } from 'react';
import MathTask from './tasks/MathTask';
import SpeechTask from './tasks/SpeechTask';

export default function App() {
  const [task, setTask] = useState('math');
  const [stream, setStream] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [finalStats, setFinalStats] = useState(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    }).then((mediaStream) => {
      if (active) setStream(mediaStream);
      else mediaStream.getTracks().forEach((track) => track.stop());
    }).catch((error) => {
      if (active) setMediaError(error?.message || '浏览器未授予摄像头/麦克风权限');
    });

    return () => {
      active = false;
      // Keep the stream alive between Math-Task and Speech-Task.
    };
  }, []);

  useEffect(() => () => {
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  if (mediaError && !stream) {
    return (
      <div className="permission-screen">
        <h1>需要摄像头和麦克风权限</h1>
        <p>{mediaError}</p>
        <p>请在浏览器设置中允许本网站使用摄像头和麦克风，然后刷新页面。</p>
      </div>
    );
  }

  if (task === 'math') {
    return <MathTask stream={stream} onComplete={() => setTask('speech')} />;
  }

  if (task === 'speech') {
    return <SpeechTask stream={stream} onComplete={(stats) => { setFinalStats(stats); setTask('done'); }} />;
  }

  return (
    <div className="complete-screen">
      <h1>测试结束</h1>
      <p>两个任务已经完成。</p>
      {finalStats && <p>演讲任务共完成 {finalStats.length} 个场景。</p>}
      <button onClick={() => window.location.reload()}>重新开始</button>
    </div>
  );
}
