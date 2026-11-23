import { config } from "../config";

const BASE = () => `${config.OPENWA_URL}/sessions`;

// 628xxx → 628xxx@c.us
export function toChatId(waNumber: string): string {
  const clean = waNumber.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
  return `${clean}@c.us`;
}

// 628xxx@c.us → 628xxx
export function fromChatId(chatId: string): string {
  return chatId.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
}

// Normalisasi berbagai format nomor → 628xxx
export function normalizeWa(raw: string): string {
  return raw
    .replace(/@(c\.us|s\.whatsapp\.net)$/, "")
    .replace(/^08/, "628")
    .replace(/^(?!62)\b8/, "628");
}

export async function sendMessage(sessionName: string, waNumber: string, text: string): Promise<boolean> {
  const chatId = waNumber.includes("@") ? waNumber : toChatId(waNumber);
  console.log(`[OpenWA] sendMessage → chatId: "${chatId}" session: "${sessionName}"`);
  try {
    const res = await fetch(`${BASE()}/${sessionName}/messages/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.OPENWA_API_KEY,
      },
      body: JSON.stringify({ chatId, text }),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error(`[OpenWA] send failed (${res.status}):`, responseText);
    } else {
      console.log(`[OpenWA] send OK (${res.status}):`, responseText.slice(0, 120));
    }
    return res.ok;
  } catch (err) {
    console.error("[OpenWA] send error:", err);
    return false;
  }
}

export async function sendImage(sessionName: string, waNumber: string, imagePath: string, caption?: string): Promise<boolean> {
  const chatId = waNumber.includes("@") ? waNumber : toChatId(waNumber);
  try {
    const fs = await import("fs");
    const base64 = fs.readFileSync(imagePath).toString("base64");
    const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mimetype = ext === "png" ? "image/png" : "image/jpeg";

    const res = await fetch(`${BASE()}/${sessionName}/messages/send-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.OPENWA_API_KEY,
      },
      body: JSON.stringify({ chatId, base64, mimetype, caption: caption ?? "" }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[OpenWA] sendImage failed (${res.status}):`, err);
    }
    return res.ok;
  } catch (err) {
    console.error("[OpenWA] sendImage error:", err);
    return false;
  }
}

export async function sendTyping(sessionName: string, waNumber: string): Promise<void> {
  try {
    await fetch(`${BASE()}/${sessionName}/chats/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.OPENWA_API_KEY },
      body: JSON.stringify({
        chatId: waNumber.includes("@") ? waNumber : toChatId(waNumber),
        state: "typing",
      }),
    });
  } catch {
    // non-fatal
  }
}

export async function getSessionStatus(sessionName: string): Promise<string> {
  try {
    const res = await fetch(`${BASE()}/${sessionName}`, {
      headers: { "X-API-Key": config.OPENWA_API_KEY },
    });
    if (!res.ok) return "UNKNOWN";
    const data = await res.json() as { status: string };
    return data.status;
  } catch {
    return "UNKNOWN";
  }
}
