export type Issue = "none" | "no_face" | "face_unclear" | "multiple_people" | "ai_generated" | "illustration" | "screenshot_or_meme" | "celebrity_or_stock" | "looks_underage" | "explicit_or_unsafe" | "spam_text" | "offensive_text";
export type Verdict = { approved: boolean; reason: string };
export type Raw = { issue: Issue; confidence: number; observations: string };

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["observations", "issue", "confidence"],
  properties: {
    observations: { type: "string" },
    issue: { type: "string", enum: ["none", "no_face", "face_unclear", "multiple_people", "ai_generated", "illustration", "screenshot_or_meme", "celebrity_or_stock", "looks_underage", "explicit_or_unsafe", "spam_text", "offensive_text"] },
    confidence: { type: "number" },
  },
};

export const INSTRUCTIONS = `You review profile photos for After9, a social app for adults at Navratri/Garba nights in India. Most uploads are genuine phone photos of real people: selfies, festival shots in chaniya choli or kurta, dim string-light lighting, motion blur, grain, beauty-mode smoothing, portrait-mode blur, mirror selfies, sunglasses or a friend partly in frame. All of these are NORMAL and must pass.

First write 1-3 short sentences of observations (what you see: people, face visibility, setting, any concrete artefacts). Then pick ONE issue:
- none: a real photo where one main person's face is reasonably visible.
- no_face: no person, or face fully hidden/turned away.
- face_unclear: face too small, dark or blurry to recognise anyone.
- multiple_people: several people and it's unclear which one is the user (a clear main subject with others behind is fine → none).
- ai_generated: ONLY with concrete artefacts: warped hands/fingers, melted jewellery or text, mismatched earrings, impossible anatomy, plastic waxy skin with no pores AND perfectly symmetric lighting, garbled background. Smooth skin, good lighting or a pretty background alone is NOT evidence.
- illustration: drawing, cartoon, anime, 3D render, avatar.
- screenshot_or_meme: screenshot, meme, text graphic, photo of a screen.
- celebrity_or_stock: a recognisable famous person or obvious stock/model shoot with watermark.
- looks_underage: the person clearly looks under 18.
- explicit_or_unsafe: nudity, sexual content, weapons, drugs, hate symbols.
- spam_text / offensive_text: the name or prompt has links, phone numbers, @handles, ads, or abuse.
confidence is 0 to 1 for the chosen issue. When unsure, choose none — rejecting a real person is worse than letting a borderline photo through for human report.`;

export const FEEDBACK: Record<Exclude<Issue, "none">, string> = {
  no_face: "We couldn't find your face. Upload a photo where you're facing the camera.",
  face_unclear: "Your face is too small, dark or blurry. Try a closer photo in better light.",
  multiple_people: "We can't tell which one is you. Use a solo photo or crop it to just you.",
  ai_generated: "This photo shows signs of being edited or AI-made (warped details). Use an unedited photo straight from your camera.",
  illustration: "That looks like a drawing or avatar. We need a real photo of you.",
  screenshot_or_meme: "That looks like a screenshot or meme. Upload an original photo of yourself.",
  celebrity_or_stock: "That looks like a famous person or stock photo. Use a photo of yourself.",
  looks_underage: "After9 is for adults 18+. If that's a mistake, try a recent photo of you.",
  explicit_or_unsafe: "This photo isn't allowed on After9. Choose a different one.",
  spam_text: "Remove links, numbers or social handles from your name and line.",
  offensive_text: "Your name or line has language that isn't allowed. Please edit it.",
};
// Only reject when the model is confident; soft calls go through.
export const THRESHOLD: Partial<Record<Issue, number>> = { ai_generated: 0.8, celebrity_or_stock: 0.85, looks_underage: 0.8, multiple_people: 0.7, face_unclear: 0.7 };

export function toVerdict(r: Raw): Verdict {
  if (r.issue === "none" || r.confidence < (THRESHOLD[r.issue] ?? 0.6)) return { approved: true, reason: "Looks great — you're live on Discover." };
  return { approved: false, reason: FEEDBACK[r.issue] };
}

