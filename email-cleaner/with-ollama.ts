async function main() {
  const curl = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemma2:2b",
      prompt: "Why is the sky blue?",
      stream: false
    }),
  });
  const response = await curl.json();
  console.log(response);

  return response;
}

main().catch(console.error);

export {};
