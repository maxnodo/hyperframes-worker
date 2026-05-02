import OpenAI from "openai";

let client;

export async function generateVideoScript(prompt) {
  const res = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a marketing copywriter.",
          "Generate a short vertical video script in Spanish.",
          "Output ONLY JSON with this exact shape:",
          "{\"mainText\":\"...\",\"subText\":\"...\",\"scenes\":[{\"text\":\"...\",\"duration\":3}]}",
          "Write commercial, customer-facing copy.",
          "Never repeat or summarize the user's prompt instructions.",
        ].join(" "),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = res.choices[0].message.content;
  return JSON.parse(text);
}

function getClient() {
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return client;
}
