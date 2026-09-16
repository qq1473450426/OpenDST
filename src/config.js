export const CONFIG = {
  math: {
    totalSeconds: 90,
    initialQuestionMs: 3000,
    correctStreak: 3,
    correctTimeFactor: 0.9,
    wrongStreak: 3,
    wrongTimeFactor: 1.1,
    randomKeyboardTasks: 4,
    noInputStreak: 5,
    referenceScore: 75,
  },
  speech: {
    preparationMs: 10000,
    speakingMs: 20000,
    questions: [
      '请描述一次你被他人批评的情形。',
      '请描述一次你在工作或学习中犯错的经历。',
      '请说明一个你认为自己需要改进的方面。',
    ],
    silenceMs: 1000,
    // RMS threshold; lower than the previous FFT-average threshold so normal speech is detected reliably.
    silenceRmsThreshold: 0.018,
  },
};
