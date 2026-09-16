export const CONFIG = {
  math: {
    totalSeconds: 90,
    initialQuestionMs: 3000,
    correctStreak: 3,
    correctTimeFactor: 0.90,
    wrongStreak: 3,
    wrongTimeFactor: 1.10,
    randomKeyboardTasks: 4,
    noInputStreak: 5,
    referenceScore: 75,
  },
  speech: {
    preparationMs: 10000,
    speakingMs: 20000,
    questionCount: 3,
    silenceMs: 1000,
    silenceThreshold: 7,
  },
};

export const SPEECH_QUESTIONS = [
  {
    title: '请描述一次你被他人批评的情形。',
    prompt: '请说明当时发生了什么、你如何应对，以及最终结果。',
  },
  {
    title: '请描述一次你在学习或工作中失败的经历。',
    prompt: '请说明困难是什么、你采取了什么措施，以及你从中获得了什么经验。',
  },
  {
    title: '请描述一次你与他人发生分歧的经历。',
    prompt: '请说明分歧产生的原因、你如何处理，以及最终如何解决。',
  },
];
