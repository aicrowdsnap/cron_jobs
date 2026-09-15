export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const url = process.env.SPEECHTOTEXT_CRON_URL;

    if (!url) {
      return res.status(500).json({
        success: false,
        message: "SPEECHTOTEXT_CRON_URL is not configured",
      });
    }

    console.log(
      "[SPEECH-TO-TEXT] Backup cron started:",
      new Date().toISOString()
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const text = await response.text();

    console.log("[SPEECH-TO-TEXT] Status:", response.status);
    console.log("[SPEECH-TO-TEXT] Response:", text);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        job: "speechtotext",
        targetStatus: response.status,
        targetResponse: text,
      });
    }

    return res.status(200).json({
      success: true,
      job: "speechtotext",
      message: "Speech-to-text backup completed",
      executedAt: new Date().toISOString(),
      targetStatus: response.status,
      targetResponse: text,
    });
  } catch (error) {
    console.error("[SPEECH-TO-TEXT] Error:", error);

    return res.status(500).json({
      success: false,
      job: "speechtotext",
      error: error.message,
    });
  }
}