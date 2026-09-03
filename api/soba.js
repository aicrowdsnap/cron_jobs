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
      process.env.SOBA_POC_CRON_URL;

    const apiKey = process.env.SOBA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        job: "soba",
        message: "SOBA_API_KEY is not configured",
      });
    }

    console.log("[SOBA POC] Cron started:", new Date().toISOString());

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });

    const responseText = await response.text();

    console.log("[SOBA POC] Status:", response.status);
    console.log("[SOBA POC] Response:", responseText);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        job: "soba",
        message: "SOBA POC API returned an error",
        targetStatus: response.status,
        targetResponse: responseText,
      });
    }

    return res.status(200).json({
      success: true,
      job: "soba",
      environment: "poc",
      message: "SOBA POC cron completed successfully",
      executedAt: new Date().toISOString(),
      targetStatus: response.status,
      targetResponse: responseText,
    });
  } catch (error) {
    console.error("[SOBA POC] Error:", error);

    return res.status(500).json({
      success: false,
      job: "soba",
      environment: "poc",
      message: "SOBA POC cron failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}