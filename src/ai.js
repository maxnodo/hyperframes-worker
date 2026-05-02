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
          "Eres copywriter experto en anuncios de Instagram.",
          "Genera SOLO copy final visible para un video corto vertical.",
          "No escribas instrucciones, análisis, guion técnico ni frases meta.",
          "Prohibido usar frases como: \"Crea un video\", \"Crea un reel\", \"El video debe\", \"Escena 1\", \"Objetivo\".",
          "No repitas instrucciones del usuario.",
          "Escribe como anuncio final para Instagram.",
          "Usa frases cortas, emocionales y comerciales en español natural.",
          "Genera 3 a 4 escenas.",
          "Cada escena debe tener máximo 12 palabras.",
          "Output SOLO JSON con esta forma exacta:",
          "{\"mainText\":\"...\",\"subText\":\"...\",\"scenes\":[{\"text\":\"...\",\"duration\":3}]}",
          "Ejemplo de estilo:",
          "{\"mainText\":\"Tortas personalizadas en Madrid\",\"subText\":\"Celebra momentos únicos con Daixi Sweet\",\"scenes\":[{\"text\":\"Cada cumpleaños merece una torta inolvidable\",\"duration\":3},{\"text\":\"Diseños artesanales hechos a tu medida\",\"duration\":4},{\"text\":\"Reserva tu torta personalizada hoy\",\"duration\":4}]}",
        ].join(" "),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = res.choices[0].message.content;
  return validateVideoScript(JSON.parse(text));
}

function getClient() {
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return client;
}

function validateVideoScript(value) {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI output must be an object");
  }
  const scenes = Array.isArray(value.scenes) ? value.scenes : [];
  if (!value.mainText || !value.subText || scenes.length < 3 || scenes.length > 4) {
    throw new Error("OpenAI output missing required marketing copy");
  }

  const strings = [
    value.mainText,
    value.subText,
    ...scenes.map((scene) => scene?.text),
  ].map((text) => String(text ?? ""));

  if (strings.some(hasMetaCopy)) {
    throw new Error("OpenAI output contains meta instructions");
  }
  if (scenes.some((scene) => countWords(scene?.text) > 12)) {
    throw new Error("OpenAI output scene exceeds 12 words");
  }

  return value;
}

function hasMetaCopy(text) {
  return /\b(crea\s+un\s+(video|reel)|el\s+video\s+debe|escena\s+\d+|objetivo)\b/i.test(text);
}

function countWords(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}
