export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const authHeader = req.headers.authorization;

  try {
    const url =
      process.env.NOVAHR_CRON_URL;

    const novahrToken = process.env.NOVAHR_API_TOKEN;

    if (!novahrToken) {
      return res.status(500).json({
        success: false,
        job: "novahr",
        message: "NOVAHR_API_TOKEN is not configured",
      });
    }

    console.log("[NOVAHR] Daily update started");
    console.log("[NOVAHR] Time:", new Date().toISOString());

    const response = await fetch(url, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${novahrToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const responseText = await response.text();

    console.log("[NOVAHR] Status:", response.status);
    console.log("[NOVAHR] Response:", responseText);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        job: "novahr",
        message: "NovaHR API returned an error",
        targetStatus: response.status,
        targetResponse: responseText,
      });
    }

    return res.status(200).json({
      success: true,
      job: "novahr",
      message: "NovaHR daily attendance update completed",
      executedAt: new Date().toISOString(),
      targetStatus: response.status,
      targetResponse: responseText,
    });
  } catch (error) {
    console.error("[NOVAHR] Cron error:", error);

    return res.status(500).json({
      success: false,
      job: "novahr",
      message: "NovaHR cron execution failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}