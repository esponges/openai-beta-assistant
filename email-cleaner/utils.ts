const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

export const askPermission = async (question: string) => {
  return new Promise((resolve) => {
    readline.question(
      question,
      (answer: string) => {
        resolve(answer);
      }
    );
  });
};

export {};
