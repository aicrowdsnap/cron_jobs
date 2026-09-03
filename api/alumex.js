export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const authHeader = req.headers.authorization;

  try {
    const url = process.env.ALUMEX_CRON_URL;

    if (!url) {
      return res.status(500).json({
        success: false,
        message: "ALUMEX_CRON_URL is not configured",
      });
    }

    console.log("[ALUMEX] Cron started:", new Date().toISOString());

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await response.text();

    console.log("[ALUMEX] Status:", response.status);
    console.log("[ALUMEX] Response:", text);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        job: "alumex",
        targetStatus: response.status,
        targetResponse: text,
      });
    }

    return res.status(200).json({
      success: true,
      job: "alumex",
      executedAt: new Date().toISOString(),
      targetStatus: response.status,
      targetResponse: text,
    });
  } catch (error) {
    console.error("[ALUMEX] Error:", error);

    return res.status(500).json({
      success: false,
      job: "alumex",
      error: error.message,
    });
  }
}