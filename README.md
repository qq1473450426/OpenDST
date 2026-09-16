# OpenDST Lite

仅保留 OpenDST 的 Math-Task 与 Speech-Task 两个实验任务的独立 React 实现。

## 功能

### Math-Task
- 总时长 90 秒。
- 初始每题 3 秒。
- 题目为 1–99 的加、减、乘、除整数运算，答案限定为 1–99。
- 连续答对 3 题：当前单题限时缩短 10%。
- 连续答错、超时或无输入 3 题：当前单题限时增加 10%。
- 连续答对 3 题后，后续 4 题使用随机数字键盘布局。
- 连续 5 题完全没有输入：显示参与提示，并强制下一题为加法题。
- 红色递减进度条显示当前题剩余时间。
- 实时显示参与者正确率，并与固定 75% 参考值比较。
- 支持前置摄像头预览。

### Speech-Task
- 3 个演讲场景。
- 每题准备 10 秒，演讲 20 秒。
- 准备和演讲阶段均显示摄像头画面。
- 演讲阶段显示声音可视化。
- 持续约 1 秒没有检测到有效声音时显示“请继续说话”。
- 演讲阶段使用红色视觉闪烁作为实验刺激。
- 演讲结束后显示本次任务的基础统计信息。

## 环境要求

- Node.js 18+，推荐 Node.js 20 LTS。
- 支持 WebRTC 的现代浏览器。
- 摄像头和麦克风权限。
- 手机浏览器测试时通常需要 HTTPS；localhost 开发环境可直接使用。

## 安装

```bash
npm install
```

## 启动

```bash
npm start
```

浏览器访问：

```text
http://localhost:3000
```

## 手机使用

开发电脑与手机连接到同一局域网后，可使用电脑局域网 IP 访问开发服务器。正式部署建议使用 HTTPS，否则移动浏览器可能禁止摄像头和麦克风访问。

## 实验流程

```text
Math-Task
   ↓
Math-Task 结果
   ↓
Speech-Task
   ↓
结束
```

应用没有 JATOS、问卷、VAS、PANAS、参与者 ID、后端上传、视频上传和 survey 跳转等原项目功能。

## 数据

当前版本只在浏览器运行时保存任务状态，不向服务器上传数据。页面结束或刷新后运行时数据会丢失。

如需研究数据记录，可以在后续版本中增加 JSON/CSV 导出或后端 API；建议在正式研究部署前明确知情同意、数据保存期限、访问权限及摄像头/麦克风数据处理方式。

## Math-Task 参数

核心参数集中在 `src/config.js`：

```js
math: {
  totalSeconds: 90,
  initialQuestionMs: 3000,
  correctStreak: 3,
  correctTimeFactor: 0.90,
  wrongStreak: 3,
  wrongTimeFactor: 1.10,
  randomKeyboardTasks: 4,
  noInputStreak: 5,
  referenceScore: 75
}
```

## Speech-Task 参数

```js
speech: {
  preparationMs: 10000,
  speakingMs: 20000,
  questionCount: 3,
  silenceMs: 1000
}
```

## 注意事项

1. 摄像头和麦克风属于浏览器敏感权限，首次使用需要用户授权。
2. `getUserMedia()` 在移动设备上通常要求安全上下文（HTTPS）。
3. 声音检测使用 Web Audio API 的实时音量特征，并不是语音识别，因此不会判断参与者说了什么。
4. 该版本用于实现任务操作逻辑，不包含原 openDST 的完整研究管理和数据采集系统。
